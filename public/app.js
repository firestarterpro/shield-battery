// Shield Battery front end: shared state from /api, name-on-edit, undo toast, Date Log.
(function () {
"use strict";
const { C, TYPES, TASKS, FU_Q, LABS, HAVE } = window.SB_DATA;

// ---------- state ----------
let S = blank();
let version = 0;
let loaded = false;
function blank() { return { status: {}, steps: {}, fields: {}, calls: {}, appts: {}, money: {} }; }
function normalize(o) { const b = blank(); for (const k of Object.keys(b)) b[k] = (o && typeof o[k] === "object" && o[k]) ? o[k] : {}; return b; }

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dots = n => "●".repeat(n) + "○".repeat(5 - n);
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const D = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const daysTo = s => Math.round((D(s) - today()) / 864e5);
const fmt = s => D(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtAt = iso => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const money = n => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stepKey = (t, j) => t + "_" + j;
const stL = { todo: "Not started", doing: "In progress", waiting: "Waiting on them", done: "Done", skip: "Skipped" };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

// ---------- api ----------
async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  if (res.status === 401) { location.reload(); throw new Error("Locked"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't save. Check your connection and try again.");
  return data;
}
async function load(initial) {
  try {
    const d = await api("/api/state" + (initial ? "" : "?since=" + version));
    $("#live").textContent = "Up to date · " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (d.unchanged) return;
    S = normalize(d.state); version = d.version; loaded = true;
    renderAll(!initial);
  } catch (e) { $("#live").textContent = "Can't reach the server right now. Retrying…"; }
}

// ---------- name + edits ----------
let pendingName = null;
function currentName() { return ssGet("sb.name"); }
function showWho() { const n = currentName(); $("#who-label").textContent = n ? "Editing as " + n : "You'll be asked your name when you save"; }
function askName() {
  return new Promise(resolve => {
    const m = $("#name-modal"); m.hidden = false;
    const inp = $("#name-input"); inp.value = lsGet("sb.lastName") || ""; setTimeout(() => inp.focus(), 30);
    pendingName = resolve;
  });
}
$("#name-form").addEventListener("submit", e => {
  e.preventDefault(); const v = $("#name-input").value.trim(); if (!v) return;
  ssSet("sb.name", v); lsSet("sb.lastName", v); $("#name-modal").hidden = true; showWho();
  if (pendingName) { pendingName(v); pendingName = null; }
});
$("#name-cancel").addEventListener("click", () => { $("#name-modal").hidden = true; if (pendingName) { pendingName(null); pendingName = null; } render(); });
$("#who-change").addEventListener("click", async () => { try { sessionStorage.removeItem("sb.name"); } catch (e) {} await askName(); });

let queue = Promise.resolve();
function edit(ops, summary) {
  queue = queue.then(async () => {
    let who = currentName() || await askName();
    if (!who) { render(); return null; }
    try {
      const d = await api("/api/edit", { who, ops, summary });
      S = normalize(d.state); version = d.version;
      toast("Saved: " + summary, d.logId);
      render(); renderHome();
      if (currentView === "log") renderLog();
      return d;
    } catch (e) { toast(e.message, null, true); load(true); return null; }
  });
  return queue;
}
async function undo(id) {
  let who = currentName() || await askName(); if (!who) return;
  try {
    const d = await api("/api/undo", { id, who });
    S = normalize(d.state); version = d.version; hideToast();
    toast("Undone", null); renderAll(false); renderLog();
  } catch (e) { toast(e.message, null, true); }
}

// ---------- toast ----------
let toastTimer = null, toastId = null;
function toast(msg, logId, err) {
  const t = $("#toast"); $("#toast-msg").textContent = msg; t.classList.toggle("err", !!err);
  toastId = logId; $("#toast-undo").hidden = !logId; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, logId ? 7000 : 3500);
}
function hideToast() { $("#toast").hidden = true; clearTimeout(toastTimer); }
$("#toast-x").addEventListener("click", hideToast);
$("#toast-undo").addEventListener("click", () => { if (toastId) undo(toastId); });
$("#toast").addEventListener("mouseenter", () => clearTimeout(toastTimer));
$("#toast").addEventListener("mouseleave", () => { toastTimer = setTimeout(hideToast, 3000); });

// ---------- shared bits ----------
function numBtn(label, val) { return `<button class="num" data-copy="${esc(val)}"><small>${esc(label)}</small>${esc(val)}</button>`; }
function contactHTML(k, withCall = true) {
  const c = C[k]; if (!c) return "";
  let vals = c.v.map(([l, v]) => numBtn(l, v)).join("");
  if (c.field) vals += `<input class="fill" data-field="${c.field}" placeholder="add their number" style="max-width:220px">`;
  return `<div class="contact"><div><div class="who">${esc(c.n)}</div><div class="what">${esc(c.w)}</div></div>${withCall ? `<button data-callorg="${k}" title="Open the call view for this office">📞 Call</button>` : "<div></div>"}<div class="val">${vals}</div></div>`;
}
const fieldLabel = el => el.dataset.label || (el.closest("label") && el.closest("label").childNodes[0].textContent.trim()) || (el.closest("dd") && el.closest("dd").previousElementSibling && el.closest("dd").previousElementSibling.textContent) || el.placeholder || el.dataset.field;
function fillFields() {
  document.querySelectorAll("[data-field]").forEach(el => {
    if (el === document.activeElement) return;
    const v = S.fields[el.dataset.field] ?? "";
    if (el.value !== v) el.value = v;
  });
}
function stepList(t) { return t.steps === "FU" ? FU_Q : t.steps; }

// ---------- HOME ----------
function renderDeadline() {
  const n = daysTo("2026-12-07"); const sent = S.status.t4 === "done";
  $("#deadline").innerHTML = sent
    ? `<span class="big">✓</span><div><b>Mutual of Omaha claim marked sent.</b><div class="sub">Claim # ${esc(S.fields.claimNo || "not entered yet")}</div></div>`
    : `<span class="big mono">${n > 0 ? n : 0}</span><div><b>${n > 0 ? "days" : "Deadline reached"}</b> left to file the Mutual of Omaha claim<div class="sub">30 days from injury · ~Mon, Dec 7, 2026 · needs the assignor's signature first</div></div>`;
}
function moneyTotals() {
  let out = 0, inn = 0, owed = 0, toIns = 0;
  for (const m of Object.values(S.money)) {
    const a = Number(m.amount) || 0;
    if (m.dir === "in") inn += a; else { out += a; if (m.status === "owed") owed += a; if (m.status === "toinsurer" || m.status === "submitted") toIns += a; }
  }
  return { out, inn, owed, toIns };
}
function nextAppt() {
  const now = new Date().toISOString().slice(0, 10);
  const list = Object.entries(S.appts).map(([id, a]) => ({ id, ...a })).filter(a => a.status !== "done" && a.status !== "missed" && a.date >= now).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  if (list.length) return list[0];
  if (S.fields.fuDate && S.fields.fuDate >= now) return { date: S.fields.fuDate, time: S.fields.fuTime, type: "Dr. Levy", where: "3125 Matlock Rd, Arlington" };
  return null;
}
function renderHome() {
  renderDeadline();
  const t = moneyTotals(); const na = nextAppt();
  const done = TASKS.filter(x => S.status[x.id] === "done").length;
  $("#home-tiles").innerHTML = `
    <a class="tile" href="#rehab"><span class="eyebrow">Next appointment</span>${na ? `<span class="bignum" style="font-size:1.25rem">${fmt(na.date)}</span><span class="sub">${esc(na.type)}${na.time ? " · " + esc(na.time) : ""}${na.ride ? " · ride: " + esc(na.ride) : ""}</span>` : `<span class="bignum" style="font-size:1.25rem">~Mon, Nov 23</span><span class="sub">Dr. Levy follow-up, not confirmed</span>`}</a>
    <a class="tile" href="#rehab"><span class="eyebrow">Rehab status</span><span style="font-weight:600">${esc(S.fields.rehabStatus || "Brace locked straight (first 2 weeks)")}</span><span class="sub">${esc(S.fields.rehabNote || "Bend allowed: " + (S.fields.bendAllowed || "0") + "°")}</span></a>
    <a class="tile" href="#money"><span class="eyebrow">Money out / in</span><span class="bignum" style="font-size:1.25rem"><span class="money-out">${money(t.out)}</span> / <span class="money-in">${money(t.inn)}</span></span><span class="sub">Still owed ${money(t.owed)}</span></a>
    <a class="tile" href="#tasks"><span class="eyebrow">Tasks</span><span class="bignum">${done}<span class="sub"> / ${TASKS.length}</span></span><span class="sub">done</span></a>`;
  const open = TASKS.filter(x => !["done", "skip"].includes(S.status[x.id] || "todo")).slice(0, 5);
  $("#home-next").innerHTML = open.map(x => `<div class="row" style="padding:5px 0;border-top:1px solid var(--line)"><span class="chip ${x.req}">${x.tier === 1 ? "Now" : x.tier === 2 ? "Soon" : "Later"}</span><a href="#tasks" data-open="${x.id}">${esc(x.title)}</a><span class="stat" data-s="${S.status[x.id] || "todo"}">${stL[S.status[x.id] || "todo"]}</span></div>`).join("") || `<p class="note">Everything's done. 🎉</p>`;
  renderHomeLog();
}
let logCache = [];
async function fetchLog() { try { const d = await api("/api/log?limit=300"); logCache = d.entries; } catch (e) {} }
function renderHomeLog() {
  $("#home-log").innerHTML = logCache.slice(0, 6).map(e => `<div class="logentry${e.undone_by ? " undone" : ""}"><div class="row" style="justify-content:space-between"><b>${esc(e.who)}</b><span class="mono note">${fmtAt(e.at)}</span></div><div class="sum">${esc(e.summary)}</div></div>`).join("") || `<p class="note">No changes yet. The first edit anyone saves shows up here.</p>`;
}

// ---------- TASKS ----------
let filter = "all";
function renderFilters() {
  const opts = [["all", "All"], ["open", "Not done"], ...Object.entries(TYPES)];
  $("#filters").innerHTML = opts.map(([k, l]) => `<button data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join("");
}
function renderTasks() {
  const tiers = { 1: "Do first · deadline and money", 2: "Recovery and income", 3: "Records and cleanup" };
  let html = "", cur = 0;
  TASKS.forEach((t, i) => {
    const st = S.status[t.id] || "todo";
    if (filter === "open" && (st === "done" || st === "skip")) return;
    if (filter !== "all" && filter !== "open" && !t.types.includes(filter)) return;
    if (t.tier !== cur) { cur = t.tier; html += `<div class="tierhead"><span class="eyebrow">Tier ${cur}</span><h2>${tiers[cur]}</h2></div>`; }
    const steps = stepList(t); const sd = steps.filter((_, j) => S.steps[stepKey(t.id, j)]).length;
    const reqL = { req: "Required", rec: "Recommended", opt: "Optional" }[t.req];
    html += `<details class="task" data-tier="${t.tier}" data-status="${st}" id="task-${t.id}">
      <summary><span class="pri">${i + 1}</span><span class="t-title">${esc(t.title)}</span>
      <span class="t-meta"><span class="chip ${t.req}">${reqL}</span><span class="dots" title="Effort ${t.effort} of 5">${dots(t.effort)}</span><span>${esc(t.time)}</span>${t.types.map(x => `<span class="chip">${TYPES[x]}</span>`).join("")}<span class="stat" data-s="${st}">${stL[st]}</span><span class="mono">${sd}/${steps.length}</span></span></summary>
      <div class="t-body">
        <div class="seg" role="group" aria-label="Status">${Object.entries(stL).map(([k, l]) => `<button data-status="${k}" data-task="${t.id}" aria-pressed="${st === k}">${l}</button>`).join("")}</div>
        <p style="margin:0">${esc(t.why)}</p>
        <ol class="steps">${steps.map((s, j) => { const k = stepKey(t.id, j); const on = !!S.steps[k]; return `<li class="${on ? "done" : ""}"><input type="checkbox" id="s-${k}" data-step="${k}" data-task="${t.id}" ${on ? "checked" : ""}><label for="s-${k}"><span>${esc(s)}</span></label></li>`; }).join("")}</ol>
        ${t.script ? `<div><span class="eyebrow">Phone script</span><div class="script">${esc(t.script)}</div></div>` : ""}
        ${t.fields && t.fields.length ? `<div class="formgrid">${t.fields.map(([k, l]) => `<label class="f">${esc(l)}<input class="fill" data-field="${k}" data-label="${esc(l)}" ${k === "fuDate" ? 'type="date"' : k === "fuTime" ? 'type="time"' : ""} placeholder="—"></label>`).join("")}</div>` : ""}
        ${t.links && t.links.length ? `<div class="links">${t.links.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join("")}</div>` : ""}
        ${t.contacts && t.contacts.length ? `<div>${t.contacts.map(k => contactHTML(k)).join("")}</div>` : ""}
        ${t.note ? `<p class="note warn" style="margin:0">${esc(t.note)}</p>` : ""}
      </div></details>`;
  });
  const open = new Set([...document.querySelectorAll("#tasklist details[open]")].map(d => d.id));
  $("#tasklist").innerHTML = html || `<p class="note">Nothing matches this filter.</p>`;
  open.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
  $("#progress").textContent = `${TASKS.filter(t => S.status[t.id] === "done").length}/${TASKS.length} done`;
}

// ---------- CALLS ----------
let callOrg = lsGet("sb.org") || "moo"; if (!C[callOrg]) callOrg = "moo";
function renderCalls() {
  const sel = $("#c-org");
  if (!sel.options.length) sel.innerHTML = Object.keys(C).map(k => `<option value="${k}">${esc(C[k].n)}</option>`).join("") + `<option value="other">Someone else</option>`;
  sel.value = callOrg;
  const c = C[callOrg], box = $("#c-card");
  if (!c) box.innerHTML = `<p class="note">Log the call below and name who you called in the notes.</p>`;
  else {
    const tasks = TASKS.filter(t => t.contacts && t.contacts.includes(callOrg));
    const scripts = tasks.filter(t => t.script);
    const past = Object.values(S.calls).filter(x => x.org === callOrg).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
    box.innerHTML = `${contactHTML(callOrg, false)}
      <div><span class="eyebrow">Have ready</span><dl class="kv" style="margin-top:6px">
        <dt>Policy #</dt><dd><button class="num" data-copy="SR201IN-P-054461">SR201IN-P-054461</button></dd>
        <dt>Encounter ID</dt><dd><button class="num" data-copy="I00985835910">I00985835910</button></dd>
        <dt>Dates of care</dt><dd class="mono">Injury Nov 7 · surgery Nov 8 · discharge Nov 9, 2026</dd>
        ${(HAVE[c.g] || []).map(([f, l]) => `<dt>${esc(l)}</dt><dd><input class="fill" data-field="${f}" data-label="${esc(l)}" placeholder="—"></dd>`).join("")}
      </dl></div>
      ${scripts.length ? scripts.map(t => `<div><span class="eyebrow">Script · ${esc(t.title)}</span><div class="script">${esc(t.script)}</div></div>`).join("") : `<div><span class="eyebrow">Opener</span><div class="script">${esc(OPENER)}</div></div>`}
      ${tasks.length ? `<div><span class="eyebrow">Tasks this call moves forward</span><ul style="margin:6px 0 0;padding-left:18px">${tasks.map(t => `<li><a href="#tasks" data-open="${t.id}">${esc(t.title)}</a> <span class="stat" data-s="${S.status[t.id] || "todo"}">${stL[S.status[t.id] || "todo"]}</span></li>`).join("")}</ul></div>` : ""}
      ${past.length ? `<div><span class="eyebrow">Last calls with them</span>${past.map(x => `<div class="note">${esc(x.at.slice(0, 10))} · ${esc(x.by || "")} ${x.rep ? "talked to " + esc(x.rep) : ""} ${x.ref ? "· Ref " + esc(x.ref) : ""} · ${esc(x.notes || "")}</div>`).join("")}</div>` : ""}`;
  }
  const cs = Object.entries(S.calls).map(([id, c]) => ({ id, ...c })).sort((a, b) => b.at.localeCompare(a.at));
  $("#calls").innerHTML = cs.length ? cs.map(c => `<div class="logitem"><div class="row" style="justify-content:space-between"><b>${esc(C[c.org] ? C[c.org].n : "Someone else")}</b><span class="mono note">${esc(c.at.slice(0, 16).replace("T", " "))}</span></div>
    <div class="row note">${c.by ? "Called by " + esc(c.by) : ""} ${c.rep ? "· Rep: " + esc(c.rep) : ""} ${c.ref ? `· Ref <span class="mono">${esc(c.ref)}</span>` : ""} ${c.due ? "· Follow up by " + esc(c.due) : ""}</div>
    ${c.notes ? `<div>${esc(c.notes)}</div>` : ""}<div><button data-delcall="${esc(c.id)}">Remove</button></div></div>`).join("") : `<p class="note">No calls logged yet.</p>`;
}
const OPENER = "Hi, I'm Kenneth Cornute, date of birth [DOB]. I'm calling about my left knee injury on November 7, 2026, treated at Medical City ER Grand Prairie and Medical City Arlington, encounter I00985835910. I have Mutual of Omaha excess accident coverage, policy SR201IN-P-054461.";
function renderContacts() {
  $("#opener").textContent = OPENER;
  const groups = {}; Object.keys(C).forEach(k => { (groups[C[k].g] = groups[C[k].g] || []).push(k); });
  $("#contacts").innerHTML = Object.entries(groups).map(([g, ks]) => `<div style="min-width:0"><span class="eyebrow">${g}</span>${ks.map(k => contactHTML(k)).join("")}</div>`).join("");
}

// ---------- MONEY ----------
const CATS = { out: ["Hospital bill", "Doctor / surgeon bill", "Physical therapy", "Pharmacy", "Brace / walker / equipment", "Gas / rides", "Rent / bills help needed", "Other expense"], in: ["Mutual of Omaha reimbursement", "Charity care write-off", "TWC unemployment", "SNAP", "Family help", "Other income"] };
const MSTAT = { out: [["owed", "Owed"], ["paid", "Paid by us"], ["toinsurer", "Send to insurer"], ["submitted", "Sent to insurer"], ["covered", "Covered / written off"]], in: [["expected", "Expected"], ["received", "Received"]] };
let mFilter = "all";
function fillMoneySelects() {
  const dir = $("#m-dir").value;
  $("#m-cat").innerHTML = CATS[dir].map(c => `<option>${c}</option>`).join("");
  $("#m-status").innerHTML = MSTAT[dir].map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
}
function renderMoney() {
  const t = moneyTotals();
  $("#money-tiles").innerHTML = `
    <div class="tile"><span class="eyebrow">Money out</span><span class="bignum money-out">${money(t.out)}</span><span class="sub">bills and expenses</span></div>
    <div class="tile"><span class="eyebrow">Money in</span><span class="bignum money-in">${money(t.inn)}</span><span class="sub">payments and help</span></div>
    <div class="tile"><span class="eyebrow">Still owed</span><span class="bignum money-owed">${money(t.owed)}</span><span class="sub">unpaid bills</span></div>
    <div class="tile"><span class="eyebrow">For Mutual of Omaha</span><span class="bignum">${money(t.toIns)}</span><span class="sub">to send or sent</span></div>`;
  $("#m-filters").innerHTML = [["all", "All"], ["out", "Out"], ["in", "In"], ["owed", "Owed"], ["toinsurer", "Send to insurer"]].map(([k, l]) => `<button data-mfilter="${k}" aria-pressed="${mFilter === k}">${l}</button>`).join("");
  let rows = Object.entries(S.money).map(([id, m]) => ({ id, ...m })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (mFilter === "out" || mFilter === "in") rows = rows.filter(r => r.dir === mFilter);
  else if (mFilter !== "all") rows = rows.filter(r => r.status === mFilter);
  const statusSel = r => `<select data-mstatus="${r.id}" aria-label="Status">${MSTAT[r.dir === "in" ? "in" : "out"].map(([k, l]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  $("#money-list").innerHTML = rows.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>What</th><th class="amount">Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td class="mono">${esc(r.date || "")}</td><td><b>${esc(r.cat)}</b><div class="note">${esc(r.party || "")}${r.note ? " · " + esc(r.note) : ""}${r.by ? " · added by " + esc(r.by) : ""}</div></td><td class="amount ${r.dir === "in" ? "money-in" : "money-out"}">${r.dir === "in" ? "+" : "−"}${money(Number(r.amount) || 0)}</td><td>${statusSel(r)}</td><td><button data-delmoney="${r.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="note">No entries yet. Add the first bill, receipt or payment above. The hospital bill will arrive 2–4 weeks after discharge.</p>`;
}

// ---------- REHAB ----------
function renderRehab() {
  $("#fu-questions").innerHTML = FU_Q.map((q, j) => { const k = stepKey("t6", j); const on = !!S.steps[k]; return `<li class="${on ? "done" : ""}"><input type="checkbox" id="q-${k}" data-step="${k}" data-task="t6" ${on ? "checked" : ""}><label for="q-${k}"><span>${esc(q)}</span></label></li>`; }).join("");
  const appts = Object.entries(S.appts).map(([id, a]) => ({ id, ...a }));
  const ptDays = new Set(appts.filter(a => a.type === "PT session" && a.status === "done").map(a => a.date)).size;
  $("#pt-used").textContent = ptDays; $("#pt-bar").style.width = Math.min(100, ptDays / 40 * 100) + "%";
  $("#pt-money").textContent = `Up to ${money(Math.min(ptDays, 40) * 50)} claimable so far · ${Math.max(0, 40 - ptDays)} days left`;
  const sorted = appts.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  $("#appts").innerHTML = sorted.length ? `<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>When</th><th>What</th><th>Status</th><th></th></tr></thead><tbody>${sorted.map(a => `<tr class="appt ${a.status === "done" ? "done" : ""}"><td class="mono">${esc(a.date)}${a.time ? "<br>" + esc(a.time) : ""}</td><td><b>${esc(a.type)}</b><div class="note">${esc(a.where || "")}${a.ride ? " · ride: " + esc(a.ride) : ""}${a.notes ? " · " + esc(a.notes) : ""}</div></td><td><select data-astatus="${a.id}" aria-label="Status">${[["scheduled", "Scheduled"], ["done", "Done"], ["missed", "Missed / moved"]].map(([k, l]) => `<option value="${k}" ${a.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></td><td><button data-delappt="${a.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="note">No appointments yet. Add the Dr. Levy follow-up once it's confirmed, then each PT session.</p>`;
  const fu = S.fields.fuDate || "2026-11-23";
  const n = daysTo(fu);
  $("#fu-count").innerHTML = S.fields.fuDate ? `<b>${n > 0 ? n + " days away" : n === 0 ? "Today" : "Past"}</b> · ${fmt(fu)}${S.fields.fuTime ? " at " + esc(S.fields.fuTime) : ""}` : `Not confirmed yet · estimated ${fmt(fu)}`;
  const tl = [["2026-11-07", "Injury, ER Grand Prairie (12:52 PM intake)"], ["2026-11-08", "Surgery, Dr. Levy"], ["2026-11-09", "Discharged · brace locked straight"], ["2026-11-14", "Hydrocodone 5-day course ends"], [fu, "Dr. Levy follow-up" + (S.fields.fuDate ? "" : " (estimated)") + " · 2-week brace lock ends"], ["2026-12-07", "Mutual of Omaha claim deadline"], ["2026-12-15", "HealthCare.gov deadline for Jan 1 coverage"], ["2026-12-21", "Aspirin 42-day course ends"], ["2027-07-01", "Policy coverage period ends"], ["2027-11-07", "52-week benefit period ends"]].sort((a, b) => a[0].localeCompare(b[0]));
  let nextSet = false;
  $("#timeline").innerHTML = tl.map(([d, l]) => { const p = daysTo(d) < 0; let c = p ? "past" : ""; if (!p && !nextSet) { c = "next"; nextSet = true; } return `<div class="tl ${c}"><span class="d">${fmt(d)}</span><span class="dot"></span><span>${esc(l)}</span></div>`; }).join("");
  window.dispatchEvent(new CustomEvent("sb:bend", { detail: Number(S.fields.bendAllowed) || 0 }));
}

// ---------- DATE LOG ----------
let confirmId = null;
function shortVal(v) { if (v === null || v === undefined) return "—"; if (typeof v === "object") return v.cat || v.type || v.notes || v.org || "entry"; const s = String(v); return s.length > 40 ? s.slice(0, 40) + "…" : s; }
async function renderLog(cached) {
  if (!cached) { await fetchLog(); renderHomeLog(); }
  $("#log").innerHTML = logCache.length ? logCache.map(e => `<div class="logentry${e.undone_by ? " undone" : ""}" id="log-${e.id}">
    <div class="row" style="justify-content:space-between"><b>${esc(e.who)}</b><span class="mono note">#${e.id} · ${fmtAt(e.at)}</span></div>
    <div class="sum">${esc(e.summary)}</div>
    <div class="ops">${e.ops.map(o => `${esc(o.path)}: ${esc(shortVal(o.before))} → ${esc(shortVal(o.after))}`).join("<br>")}</div>
    <div>${e.undone_by ? `<span class="note">Undone in #${e.undone_by}</span>` : confirmId === e.id ? `<span class="confirm">Undo this change? <button class="danger" data-undoyes="${e.id}">Yes, undo</button><button data-undono="1">Cancel</button></span>` : `<button data-undoask="${e.id}">Undo</button>`}</div>
  </div>`).join("") : `<p class="note">No changes yet.</p>`;
}

// ---------- labs ----------
function renderLabs() { const el = $("#labs"); if (el) el.innerHTML = LABS.map(([t, v, f]) => `<tr><td>${t}</td><td class="mono">${v}</td><td class="${f === "High" ? "flag-h" : f === "Low" ? "flag-l" : ""}">${f || "Normal"}</td></tr>`).join(""); }

// ---------- render orchestration ----------
function render() {
  const active = document.activeElement;
  const typing = active && active.matches && active.matches("input:not([type=checkbox]),textarea,select") && active.closest("section.view:not([hidden])");
  if (!typing || currentView === "home") renderHome(); else renderDeadline();
  if (!typing) { renderTasks(); renderCalls(); renderMoney(); renderRehab(); }
  fillFields();
}
function renderAll(fromPoll) { render(); if (fromPoll && currentView === "log") renderLog(); }

// ---------- events ----------
document.addEventListener("click", e => {
  const cp = e.target.closest("[data-copy]");
  if (cp) { const v = cp.dataset.copy; const ok = () => { cp.classList.add("copied"); setTimeout(() => cp.classList.remove("copied"), 900); };
    try { navigator.clipboard.writeText(v).then(ok, () => selectText(cp)); } catch (_) { selectText(cp); } return; }
  const co = e.target.closest("[data-callorg]"); if (co) { callOrg = co.dataset.callorg; lsSet("sb.org", callOrg); renderCalls(); fillFields(); location.hash = "calls"; return; }
  const op = e.target.closest("[data-open]"); if (op) { filter = "all"; renderFilters(); renderTasks(); fillFields(); setTimeout(() => { const d = document.getElementById("task-" + op.dataset.open); if (d) { d.open = true; d.scrollIntoView({ block: "start" }); } }, 60); return; }
  const fb = e.target.closest("[data-filter]"); if (fb) { filter = fb.dataset.filter; renderFilters(); renderTasks(); fillFields(); return; }
  const mf = e.target.closest("[data-mfilter]"); if (mf) { mFilter = mf.dataset.mfilter; renderMoney(); return; }
  const sb = e.target.closest("button[data-status]"); if (sb && sb.dataset.task) { const t = TASKS.find(x => x.id === sb.dataset.task); edit([{ path: "status." + t.id, value: sb.dataset.status === "todo" ? null : sb.dataset.status }], `Set "${t.title}" to ${stL[sb.dataset.status]}`); return; }
  const dc = e.target.closest("[data-delcall]"); if (dc) { const c = S.calls[dc.dataset.delcall]; edit([{ path: "calls." + dc.dataset.delcall, value: null }], `Removed call log entry${c && C[c.org] ? " (" + C[c.org].n + ")" : ""}`); return; }
  const dm = e.target.closest("[data-delmoney]"); if (dm) { const m = S.money[dm.dataset.delmoney]; edit([{ path: "money." + dm.dataset.delmoney, value: null }], `Removed ${m ? m.cat + " " + money(Number(m.amount) || 0) : "money entry"}`); return; }
  const da = e.target.closest("[data-delappt]"); if (da) { const a = S.appts[da.dataset.delappt]; edit([{ path: "appts." + da.dataset.delappt, value: null }], `Removed appointment${a ? " " + a.type + " " + a.date : ""}`); return; }
  const ua = e.target.closest("[data-undoask]"); if (ua) { confirmId = Number(ua.dataset.undoask); renderLog(true); return; }
  const un = e.target.closest("[data-undono]"); if (un) { confirmId = null; renderLog(true); return; }
  const uy = e.target.closest("[data-undoyes]"); if (uy) { const id = Number(uy.dataset.undoyes); confirmId = null; undo(id); return; }
});
function selectText(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "c-org") { callOrg = el.value; lsSet("sb.org", callOrg); renderCalls(); fillFields(); return; }
  if (el.id === "m-dir") { fillMoneySelects(); return; }
  if (el.dataset.step) {
    const t = TASKS.find(x => x.id === el.dataset.task); const k = el.dataset.step; const j = Number(k.split("_")[1]);
    const ops = [{ path: "steps." + k, value: el.checked ? true : null }];
    const after = { ...S.steps, [k]: el.checked };
    const all = stepList(t).every((_, i) => after[stepKey(t.id, i)]);
    const st = S.status[t.id] || "todo";
    if (all && st !== "done") ops.push({ path: "status." + t.id, value: "done" });
    else if (el.checked && st === "todo") ops.push({ path: "status." + t.id, value: "doing" });
    edit(ops, `${el.checked ? "Ticked" : "Unticked"} "${stepList(t)[j].slice(0, 70)}" (${t.title})`);
    return;
  }
  if (el.dataset.mstatus) { const m = S.money[el.dataset.mstatus]; const lab = (MSTAT[m.dir === "in" ? "in" : "out"].find(x => x[0] === el.value) || [])[1]; edit([{ path: `money.${el.dataset.mstatus}.status`, value: el.value }], `Marked ${m.cat} ${money(Number(m.amount) || 0)} as ${lab}`); return; }
  if (el.dataset.astatus) { const a = S.appts[el.dataset.astatus]; edit([{ path: `appts.${el.dataset.astatus}.status`, value: el.value }], `Marked ${a.type} on ${a.date} as ${el.options[el.selectedIndex].text}`); return; }
  if (el.dataset.field) commitField(el);
});
// Text fields save after a pause in typing, or when you leave the box.
const fieldTimers = {};
document.addEventListener("input", e => {
  const el = e.target; if (!el.dataset || !el.dataset.field || el.tagName === "SELECT") return;
  document.querySelectorAll(`[data-field="${el.dataset.field}"]`).forEach(o => { if (o !== el) o.value = el.value; });
  clearTimeout(fieldTimers[el.dataset.field]);
  fieldTimers[el.dataset.field] = setTimeout(() => commitField(el), 1500);
});
document.addEventListener("focusout", e => { const el = e.target; if (el.dataset && el.dataset.field && el.tagName !== "SELECT") commitField(el); });
function commitField(el) {
  const k = el.dataset.field; clearTimeout(fieldTimers[k]);
  const v = el.value.trim(); const old = S.fields[k] ?? "";
  if (v === old) return;
  const label = String(fieldLabel(el)).trim().replace(/\s+/g, " ").slice(0, 50);
  edit([{ path: "fields." + k, value: v || null }], v ? `Set ${label} to "${v.slice(0, 60)}"` : `Cleared ${label}`);
}

$("#c-add").addEventListener("click", () => {
  const n = $("#c-notes").value.trim(), r = $("#c-ref").value.trim();
  if (!n && !r) { $("#c-msg").textContent = "Add a note or reference number first."; return; }
  const now = new Date(); const at = new Date(now - now.getTimezoneOffset() * 6e4).toISOString();
  const id = newId("c");
  edit([{ path: "calls." + id, value: { at, org: callOrg, rep: $("#c-rep").value.trim(), ref: r, due: $("#c-due").value, notes: n, by: currentName() || "" } }], `Logged a call to ${C[callOrg] ? C[callOrg].n : "someone else"}`)
    .then(d => { if (d) { ["#c-rep", "#c-ref", "#c-due", "#c-notes"].forEach(s => $(s).value = ""); $("#c-msg").textContent = "Call saved."; } });
});
$("#m-add").addEventListener("click", () => {
  const amt = Number(String($("#m-amt").value).replace(/[$,\s]/g, ""));
  if (!$("#m-date").value || !isFinite(amt) || amt <= 0) { $("#m-msg").textContent = "Add a date and an amount above $0."; return; }
  const dir = $("#m-dir").value; const id = newId("m");
  const entry = { date: $("#m-date").value, dir, cat: $("#m-cat").value, party: $("#m-party").value.trim(), amount: Math.round(amt * 100) / 100, status: $("#m-status").value, note: $("#m-note").value.trim(), by: currentName() || "" };
  edit([{ path: "money." + id, value: entry }], `Added ${dir === "in" ? "money in" : "money out"}: ${entry.cat} ${money(entry.amount)}`)
    .then(d => { if (d) { ["#m-amt", "#m-party", "#m-note"].forEach(s => $(s).value = ""); $("#m-msg").textContent = "Entry added."; } });
});
$("#a-add").addEventListener("click", () => {
  if (!$("#a-date").value) { $("#a-msg").textContent = "Pick a date first."; return; }
  const id = newId("a");
  const a = { date: $("#a-date").value, time: $("#a-time").value, type: $("#a-type").value, where: $("#a-where").value.trim(), ride: $("#a-ride").value.trim(), notes: $("#a-notes").value.trim(), status: "scheduled" };
  edit([{ path: "appts." + id, value: a }], `Added appointment: ${a.type} on ${a.date}`)
    .then(d => { if (d) { ["#a-notes", "#a-ride"].forEach(s => $(s).value = ""); $("#a-msg").textContent = "Appointment added."; } });
});
// The bend slider follows the rehab "bend allowed" field only until someone moves it.

// ---------- routing ----------
const VIEWS = ["home", "tasks", "calls", "money", "rehab", "knee", "record", "log"];
let currentView = "home";
function route() {
  const h = location.hash.slice(1); currentView = VIEWS.includes(h) ? h : "home";
  document.querySelectorAll("section.view").forEach(s => s.hidden = s.dataset.view !== currentView);
  document.querySelectorAll("nav.tabs a").forEach(a => a.setAttribute("aria-current", a.dataset.tab === currentView ? "page" : "false"));
  if (currentView === "log") renderLog();
  if (currentView === "rehab") window.dispatchEvent(new Event("sb:rehab-open"));
  if (currentView === "knee") window.dispatchEvent(new Event("sb:knee-open"));
  const cur = document.querySelector(`nav.tabs a[data-tab="${currentView}"]`), tt = document.getElementById("appbar-title"); if (tt && cur) tt.textContent = cur.textContent.trim();
  closeMenu();
}
window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });

// ---------- boot ----------
const td = new Date(); const iso = new Date(td - td.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
$("#m-date").value = iso; fillMoneySelects();
renderFilters(); renderContacts(); renderLabs(); showWho(); route();
render();
load(true).then(() => fetchLog().then(renderHomeLog));
setInterval(() => { if (!document.hidden) { load(false); fetchLog().then(() => { renderHomeLog(); }); } }, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });
})();

// ---------- SIDEBAR / PHONE MENU ----------
function closeMenu() { const sd = document.getElementById("side"), sc = document.getElementById("scrim"), mb = document.getElementById("menu-btn"); if (!sd) return; sd.classList.remove("open"); if (sc) sc.hidden = true; if (mb) mb.setAttribute("aria-expanded", "false"); }
document.getElementById("menu-btn")?.addEventListener("click", () => { const sd = document.getElementById("side"), open = !sd.classList.contains("open"); sd.classList.toggle("open", open); document.getElementById("scrim").hidden = !open; document.getElementById("menu-btn").setAttribute("aria-expanded", String(open)); });
document.getElementById("scrim")?.addEventListener("click", closeMenu);
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
