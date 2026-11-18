#!/usr/bin/env bash
# Usage: from project root, with `wrangler dev --local --port 8787` running: bash tests/api.sh
B=${BASE:-http://localhost:8787}; PW=${PW:-Dunnage}
TOKEN=$(printf 'shield-battery:%s' "$PW" | sha256sum | cut -d' ' -f1)
C="Cookie: sb_pass=$TOKEN"; fail=0
ok(){ if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (got '$2', want '$3')"; fail=1; fi; }
edit(){ curl -s -H "$C" -H 'content-type: application/json' -d "$1" $B/api/edit; }
ver(){ curl -s -H "$C" $B/api/state | sed 's/.*"version":\([0-9]*\).*/\1/'; }
logn(){ curl -s -H "$C" "$B/api/log?limit=500" | grep -o '"summary"' | wc -l; }

# 1 concurrent edits
v0=$(ver); l0=$(logn)
edit '{"who":"A","summary":"a","ops":[{"path":"fields.ca","value":"1"}]}' >/dev/null &
edit '{"who":"B","summary":"b","ops":[{"path":"fields.cb","value":"2"}]}' >/dev/null &
wait
ok "concurrent version +2" "$(ver)" "$((v0+2))"
ok "concurrent 2 log rows" "$(logn)" "$((l0+2))"
S=$(curl -s -H "$C" $B/api/state); echo "$S" | grep -q '"ca":"1"' && echo "$S" | grep -q '"cb":"2"'; ok "both values present" $? 0

# 2 undo after later change
r=$(edit '{"who":"A","summary":"x1","ops":[{"path":"fields.u","value":"first"}]}'); id=$(echo "$r" | sed 's/.*"logId":\([0-9]*\).*/\1/')
edit '{"who":"B","summary":"x2","ops":[{"path":"fields.u","value":"second"}]}' >/dev/null
code=$(curl -s -o /tmp/undo.out -w '%{http_code}' -H "$C" -H 'content-type: application/json' -d "{\"id\":$id,\"who\":\"A\"}" $B/api/undo)
ok "undo after later change 200" "$code" 200
curl -s -H "$C" $B/api/state | grep -q '"u"'; ok "undo removed key (before was absent)" $? 1
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$C" -H 'content-type: application/json' -d "{\"id\":$id,\"who\":\"A\"}" $B/api/undo)
ok "double undo 409" "$code" 409

# 3 bad path / missing who
out=$(curl -s -w ' %{http_code}' -H "$C" -H 'content-type: application/json' -d '{"who":"A","ops":[{"path":"a b!","value":"x"}]}' $B/api/edit)
ok "bad path 400" "${out##* }" 400; echo "$out" | grep -q '"error":"[A-Z]'; ok "bad path message" $? 0
out=$(curl -s -w ' %{http_code}' -H "$C" -H 'content-type: application/json' -d '{"ops":[{"path":"fields.a","value":"x"}]}' $B/api/edit)
ok "missing who 400" "${out##* }" 400; echo "$out" | grep -qi 'name'; ok "missing who message" $? 0
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$C" -d 'not json' $B/api/edit); ok "bad json 400" "$code" 400

# 4 logout
code=$(curl -s -o /dev/null -w '%{http_code}' $B/api/state); ok "no cookie 401" "$code" 401
hdr=$(curl -s -D- -o /dev/null $B/logout); echo "$hdr" | grep -qi 'sb_pass=;'; ok "logout clears cookie" $? 0
jar=/tmp/sbjar.txt; rm -f $jar
curl -s -c $jar -o /dev/null -d "password=$PW" $B/login
cookie=$(grep sb_pass $jar | awk '{print $7}'); [ -z "$cookie" ] && cookie=$TOKEN
ok "login then state 200" "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: sb_pass=$cookie" $B/api/state)" 200
curl -s -c $jar -b $jar -o /dev/null $B/logout
ok "after logout (jar) 401" "$(curl -s -o /dev/null -w '%{http_code}' -b $jar $B/api/state)" 401
exit $fail
