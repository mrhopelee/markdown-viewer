#!/usr/bin/env bash
# Doctor: read-only check that a launched verification instance is worth driving.
#
# Usage:
#   doctor.sh <state.json>
#
# Exits 0 when all checks pass, 1 otherwise. Prints PASS/FAIL per check.

set -euo pipefail

STATE="${1:?usage: doctor.sh <state.json>}"

read_json () { python3 -c "import sys,json;d=json.load(open('$STATE'));print(d.get('$1',''))"; }

PORT="$(read_json port)"
PID="$(read_json pid)"
EXT_ID="$(read_json extensionId)"

fail=0

check () { # check <label> <0|1>
  if [[ "$2" = "0" ]]; then echo "PASS  $1"; else echo "FAIL  $1"; fail=1; fi
}

# 1. process alive
kill -0 "$PID" 2>/dev/null; check "chrome process $PID alive" $?

# 2. debugging port answers
curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; check "debugging port $PORT answers" $?

# 3. extension service worker target present
SW_URL=$(curl -s "http://127.0.0.1:$PORT/json" | python3 -c '
import sys, json
u = next((t["url"] for t in json.load(sys.stdin) if "/background/index.js" in t.get("url","")), "")
print(u)
')
[[ -n "$SW_URL" ]]; check "extension service worker target present" $?

# 4. extension identity + file access (via CDP into the service worker)
node --input-type=module - "$PORT" "$EXT_ID" <<'NODE'
const [port, extId] = process.argv.slice(2)
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const sw = list.find((t) => t.url && t.url.includes('/background/index.js'))
if (!sw) { process.exit(1) }
const ws = new WebSocket(sw.webSocketDebuggerUrl)
const result = await new Promise((resolve, reject) => {
  const onOpen = () => {
    const expr = `(async () => JSON.stringify({
      name: chrome.runtime.getManifest().name,
      version: chrome.runtime.getManifest().version,
      fileAccess: await new Promise(r => chrome.extension.isAllowedFileSchemeAccess(r))
    }))()`
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
  }
  ws.addEventListener('open', onOpen)
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id === 1) { ws.close(); resolve(m.result?.result?.value) }
  })
  ws.addEventListener('error', () => reject(new Error('ws error')))
  setTimeout(() => reject(new Error('timeout')), 8000)
})
const got = JSON.parse(result)
const ok = got.name === 'Markdown Viewer' && got.version === '5.3' && got.fileAccess === true
console.log(ok ? 'PASS' : 'FAIL', `extension identity + file access (${JSON.stringify(got)})`)
process.exit(ok ? 0 : 1)
NODE
check "extension is Markdown Viewer 5.3 with file access" $?

if [[ "$fail" = "0" ]]; then echo "doctor: OK"; else echo "doctor: FAILED"; fi
exit "$fail"
