#!/usr/bin/env bash
# Cleanup: tear down the instance a run launched. Kills only the PID recorded in
# state.json (never by process name). Removes scratch state (profile, fixtures,
# chrome log) but keeps artifacts/ so proof survives.
#
# Usage:
#   cleanup.sh <state.json>

set -euo pipefail

STATE="${1:?usage: cleanup.sh <state.json>}"

read_json () { python3 -c "import sys,json;d=json.load(open('$STATE'));print(d.get('$1',''))"; }

PID="$(read_json pid)"
PROFILE="$(read_json profile)"
RUN_DIR="$(read_json runDir)"
ARTIFACTS="$(read_json artifacts)"

# kill what we started, by recorded PID only
if [[ -n "$PID" ]]; then
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$PID" 2>/dev/null || break
      sleep 0.25
    done
    kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null || true
  fi
fi

# scratch: profile and fixtures (evidence in artifacts/ is never touched)
[[ -n "$PROFILE" && -d "$PROFILE" ]] && rm -rf "$PROFILE"
[[ -n "$RUN_DIR" && -d "$RUN_DIR/fixtures" ]] && rm -rf "$RUN_DIR/fixtures"
[[ -f "$RUN_DIR/chrome.log" ]] && rm -f "$RUN_DIR/chrome.log"

echo "cleanup: instance stopped; artifacts remain at $ARTIFACTS"
if [[ -d "$ARTIFACTS" ]]; then
  find "$ARTIFACTS" -type f | sed 's/^/  kept: /'
fi
