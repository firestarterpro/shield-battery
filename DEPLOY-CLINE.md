# Shield Battery deploy runbook (for Cline on the TemplarArchives PC)

Paste this whole file into Cline. Stop and report if any step fails. Don't change source files.

Folder: C:\Templar Archives\Observatory\Shield Battery

1. Check Node: run `node -v`. If missing or below 18, install Node.js LTS from https://nodejs.org and reopen the terminal.
2. `cd "C:\Templar Archives\Observatory\Shield Battery"` then `npm install`
3. `npx wrangler login`. A browser opens; Ken approves. Then run `npx wrangler whoami` and confirm the account is the one that holds templararchives.org.
4. `npx wrangler d1 create shield-battery`. Copy the printed database_id into wrangler.jsonc, replacing 00000000-0000-0000-0000-000000000000.
5. In wrangler.jsonc, replace the line `// routes added at deploy` with:
   "routes": [ { "pattern": "foot.templararchives.org", "custom_domain": true } ]
6. `npx wrangler d1 execute shield-battery --remote --file=schema.sql`
7. (The password is set as a plain variable, SITE_PASSWORD="Dunnage", in wrangler.jsonc. No secret or KV is needed.)
8. `npx wrangler deploy`
9. Open https://foot.templararchives.org. Expect the Shield Battery login page. Enter Dunnage, then check that Home loads.
10. `git add -A && git commit -m "Deploy config" && git push` (only if the repo is already set up in this folder).

Report back: the deployed URL, the database_id, and any errors.
