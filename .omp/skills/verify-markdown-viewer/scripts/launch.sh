#!/usr/bin/env bash
# Launch an isolated Markdown Viewer verification instance (Chrome for Testing +
# the unpacked extension) and write its state to <run-dir>/state.json.
#
# Usage:
#   launch.sh [--port PORT] [--run-dir DIR]
#
# Prints the state file path on stdout. The extension is loaded from this repo's
# checkout, so run from the repo root (or set MDV_REPO to the checkout path).

set -euo pipefail

PORT=""
RUN_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)    PORT="$2"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

REPO="${MDV_REPO:-$(cd "$(dirname "$0")/../../../.." && pwd)}"

# ---- resolve Chrome for Testing (branded Google Chrome ignores --load-extension) ----
resolve_cft () {
  [[ -n "${MDV_CFT:-}" && -x "$MDV_CFT" ]] && { echo "$MDV_CFT"; return; }
  local c
  for c in \
    "$HOME/.cache/puppeteer/chrome" \
    "$HOME/.omp/puppeteer/chrome"; do
    local bin
    bin=$(find "$c" -type f -path '*Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' 2>/dev/null | head -1)
    [[ -n "$bin" ]] && { echo "$bin"; return; }
  done
  # Linux/Chromium fallback (may ignore --load-extension if branded)
  for c in chromium chromium-browser google-chrome-stable; do
    command -v "$c" >/dev/null 2>&1 && { echo "$(command -v "$c")"; return; }
  done
  echo "" # not found
}

CFT="$(resolve_cft)"
if [[ -z "$CFT" ]]; then
  echo "launch.sh: no Chrome for Testing binary found. Set MDV_CFT to its path." >&2
  exit 1
fi

# ---- pick a free port ----
if [[ -z "$PORT" ]]; then
  PORT=9233
  while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
fi

# ---- run dir ----
if [[ -z "$RUN_DIR" ]]; then
  RUN_DIR="/tmp/mdv-verify-$(date +%s)-$$"
fi
mkdir -p "$RUN_DIR/profile" "$RUN_DIR/fixtures" "$RUN_DIR/artifacts"

# ---- fixtures ----
cat > "$RUN_DIR/fixtures/hello.md" <<'EOF'
# Hello Markdown Viewer

This is a **bold** sentence and a [link](https://example.com).

- first
- second
- third

```js
var hello = 'hi'
```

## Second Section

Some prose after the code block.

> A blockquote for good measure.
EOF

# ---- launch ----
"$CFT" \
  --user-data-dir="$RUN_DIR/profile" \
  --remote-debugging-port="$PORT" \
  --no-first-run --no-default-browser-check --disable-background-networking \
  --load-extension="$REPO" \
  --disable-extensions-except="$REPO" \
  about:blank >"$RUN_DIR/chrome.log" 2>&1 &
CFT_PID=$!

# ---- wait for readiness ----
for _ in $(seq 1 60); do
  if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 || {
  echo "launch.sh: Chrome did not become ready on port $PORT" >&2
  cat "$RUN_DIR/chrome.log" >&2
  exit 1
}

# ---- find extension id ----
EXT_ID=""
for _ in $(seq 1 20); do
  EXT_ID=$(curl -s "http://127.0.0.1:$PORT/json" | python3 -c '
import sys, json
for t in json.load(sys.stdin):
    if "/background/index.js" in t.get("url", ""):
        print(t["url"].split("/")[2]); break
' 2>/dev/null)
  [[ -n "$EXT_ID" ]] && break
  sleep 0.5
done
if [[ -z "$EXT_ID" ]]; then
  echo "launch.sh: extension failed to load (no /background/index.js target)" >&2
  cat "$RUN_DIR/chrome.log" >&2
  exit 1
fi

cat > "$RUN_DIR/state.json" <<EOF
{
  "port": $PORT,
  "pid": $CFT_PID,
  "profile": "$RUN_DIR/profile",
  "fixtures": "$RUN_DIR/fixtures",
  "artifacts": "$RUN_DIR/artifacts",
  "runDir": "$RUN_DIR",
  "extensionId": "$EXT_ID",
  "cft": "$CFT",
  "repo": "$REPO"
}
EOF

echo "$RUN_DIR/state.json"
