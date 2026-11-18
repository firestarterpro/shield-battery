// Shield Battery worker: shared-password gate, one shared JSON document in D1,
// and a "Date Log" of every edit with per-entry undo.

const COOKIE = "sb_pass";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const password = env.SITE_PASSWORD || "Dunnage";
    const token = await sha256("shield-battery:" + password);

    if (url.pathname === "/login" && request.method === "POST") {
      const form = await request.formData();
      if ((form.get("password") || "").toString() === password) {
        return new Response(null, {
          status: 303,
          headers: {
            Location: "/",
            "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      }
      return html(loginPage(true), 401);
    }

    if (url.pathname === "/logout") {
      return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0` } });
    }

    const authed = readCookie(request, COOKIE) === token;
    if (!authed) {
      if (url.pathname.startsWith("/api/")) return json({ error: "Enter the password first." }, 401);
      return html(loginPage(false), 200);
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url);
      } catch (e) {
        return json({ error: e.message || "Something went wrong." }, e.status || 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function api(request, env, url) {
  const db = env.DB;
  const p = url.pathname;

  if (p === "/api/state" && request.method === "GET") {
    const row = await getDoc(db);
    const since = Number(url.searchParams.get("since") || 0);
    if (since && since === row.version) return json({ version: row.version, unchanged: true });
    return json({ version: row.version, state: JSON.parse(row.body), updated_at: row.updated_at });
  }

  if (p === "/api/log" && request.method === "GET") {
    const limit = Math.min(500, Number(url.searchParams.get("limit") || 200));
    const { results } = await db.prepare("SELECT * FROM log ORDER BY id DESC LIMIT ?").bind(limit).all();
    return json({ entries: results.map(r => ({ ...r, ops: JSON.parse(r.ops) })) });
  }

  if (p === "/api/edit" && request.method === "POST") {
    const body = await readJson(request);
    const who = cleanName(body.who);
    const ops = Array.isArray(body.ops) ? body.ops : [];
    if (!ops.length) throw httpError("Nothing to save.", 400);
    if (ops.length > 50) throw httpError("Too many changes at once.", 400);
    const summary = String(body.summary || "Edited").slice(0, 300);
    return json(await applyOps(db, who, summary, ops.map(o => ({ path: cleanPath(o.path), value: o.value })), null));
  }

  if (p === "/api/undo" && request.method === "POST") {
    const body = await readJson(request);
    const who = cleanName(body.who);
    const entry = await db.prepare("SELECT * FROM log WHERE id = ?").bind(Number(body.id)).first();
    if (!entry) throw httpError("That log entry no longer exists.", 404);
    if (entry.undone_by) throw httpError("That change was already undone.", 409);
    const ops = JSON.parse(entry.ops).reverse().map(o => ({ path: o.path, value: o.before }));
    const res = await applyOps(db, who, `Undid #${entry.id}: ${entry.summary}`.slice(0, 300), ops, entry.id);
    await db.prepare("UPDATE log SET undone_by = ? WHERE id = ?").bind(res.logId, entry.id).run();
    return json(res);
  }

  throw httpError("Not found", 404);
}

async function applyOps(db, who, summary, ops, undoOf) {
  // Retry on a concurrent write (optimistic version check).
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await getDoc(db);
    const state = JSON.parse(row.body);
    const recorded = [];
    for (const op of ops) {
      const before = getPath(state, op.path);
      setPath(state, op.path, op.value);
      recorded.push({ path: op.path, before: before === undefined ? null : before, after: op.value === undefined ? null : op.value });
    }
    const now = new Date().toISOString();
    const next = row.version + 1;
    // One atomic batch: the log row is only written if the version check passed.
    const [upd, ins] = await db.batch([
      db.prepare("UPDATE doc SET body = ?, version = ?, updated_at = ? WHERE id = 1 AND version = ?")
        .bind(JSON.stringify(state), next, now, row.version),
      db.prepare("INSERT INTO log (at, who, summary, ops, undo_of) SELECT ?, ?, ?, ?, ? WHERE (SELECT version FROM doc WHERE id = 1) = ? AND (SELECT updated_at FROM doc WHERE id = 1) = ?")
        .bind(now, who, summary, JSON.stringify(recorded), undoOf, next, now),
    ]);
    if (upd.meta.changes !== 1 || ins.meta.changes !== 1) {
      await new Promise(r => setTimeout(r, Math.random() * 40));
      continue;
    }
    return { version: next, state, logId: ins.meta.last_row_id };
  }
  throw httpError("Someone else is saving right now. Try again.", 409);
}

async function getDoc(db) {
  let row = await db.prepare("SELECT body, version, updated_at FROM doc WHERE id = 1").first();
  if (!row) {
    await db.prepare("INSERT OR IGNORE INTO doc (id, body, version, updated_at) VALUES (1, '{}', 0, ?)").bind(new Date().toISOString()).run();
    row = { body: "{}", version: 0, updated_at: new Date().toISOString() };
  }
  return row;
}

// Paths look like "fields.claimNo" or "money.m123.amount". A null value deletes the key.
function cleanPath(p) {
  const s = String(p || "");
  if (!/^[A-Za-z0-9_\-]+(\.[A-Za-z0-9_\-]+){0,5}$/.test(s)) throw httpError("Bad field name.", 400);
  if (/(^|\.)(__proto__|prototype|constructor)(\.|$)/.test(s)) throw httpError("Bad field name.", 400);
  return s;
}
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!o[keys[i]] || typeof o[keys[i]] !== "object") o[keys[i]] = {};
    o = o[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete o[last];
  else o[last] = value;
}
function cleanName(n) {
  const s = String(n || "").trim().slice(0, 60);
  if (!s) throw httpError("Enter your name before saving.", 400);
  return s;
}
async function readJson(request) {
  try { const b = await request.json(); if (b && typeof b === "object") return b; } catch (e) {}
  throw httpError("That request was not understood. Reload the page and try again.", 400);
}
function httpError(message, status) { const e = new Error(message); e.status = status; return e; }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function html(body, status) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
function readCookie(req, name) {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function loginPage(wrong) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shield Battery</title>
<style>
:root{--bg:#eef3f4;--paper:#fff;--ink:#15232b;--muted:#5a6b74;--accent:#0f5f73;--line:#d8dfe3;--crit:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#0f171b;--paper:#162127;--ink:#e3eaed;--muted:#93a4ac;--accent:#5fb7cc;--line:#2a3a42;--crit:#f08a80}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px}
form{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:28px 24px;width:min(360px,100%);display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:1.6rem}p{margin:0;color:var(--muted)}
input{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
button{font:600 1rem system-ui;padding:11px;border-radius:8px;border:0;background:var(--accent);color:var(--paper);cursor:pointer}
.err{color:var(--crit);font-weight:600}
.cell{width:46px;height:46px}
</style></head><body>
<form method="post" action="/login">
<svg class="cell" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 42 10v13c0 11-8 19-18 22C14 42 6 34 6 23V10z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 13 17 26h7l-2 9 9-13h-7z" fill="currentColor"/></svg>
<h1>Shield Battery</h1>
<p>Family recovery hub. Enter the shared password.</p>
${wrong ? '<p class="err">That password didn\'t match. Try again.</p>' : ""}
<input type="password" name="password" autocomplete="current-password" placeholder="Password" required autofocus aria-label="Password">
<button type="submit">Enter</button>
</form></body></html>`;
}
