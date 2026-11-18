# Shield Battery API contract (frozen at W0, 2026-11-18)

Worker: src/worker.js (Cloudflare Worker, assets in ./public, run_worker_first, D1 binding DB, var SITE_PASSWORD default "Dunnage").
Local run: npx wrangler d1 execute shield-battery --local --file=schema.sql && npx wrangler dev --local --port 8787

| Call | Body | Returns |
|---|---|---|
| POST /login | form password | 303 to / and cookie sb_pass (1 yr); wrong → 401 login page |
| GET /logout | | clears cookie |
| GET /api/state?since=V | | {version,state,updated_at} or {version,unchanged:true} |
| POST /api/edit | {who, summary, ops:[{path,value}]} (≤50 ops; value null deletes) | {version,state,logId} |
| POST /api/undo | {id, who} | {version,state,logId}; 409 if already undone; 404 unknown |
| GET /api/log?limit=N | | {entries:[{id,at,who,summary,ops:[{path,before,after}],undo_of,undone_by}]} newest first |
Unauthed /api/* → 401 JSON; unauthed pages → login page. Errors: {error:"human message"}.

Paths: 1–6 dot-separated segments of [A-Za-z0-9_-]. who required (≤60 chars).
State: {status:{<taskId>:todo|doing|waiting|done|skip}, steps:{<taskId>_<n>:true}, fields:{<key>:string},
 calls:{<id>:{at,org,rep,ref,due,notes,by}}, appts:{<id>:{date,time,type,where,ride,notes,status:scheduled|done|missed}},
 money:{<id>:{date,dir:in|out,cat,party,amount,status,note,by}}}

W0 results: gate, login, state, edit, undo, double-undo refusal, log, and the UI save + name modal + toast + Date Log all pass locally. No console errors on any page at 400px. Not built yet: public/leg.js (stub). Not tested: concurrent-edit 409 retry, poll refresh across two browsers, dark mode.
