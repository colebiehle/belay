#!/bin/bash
# Run Belay's ingest once: every source, every tracked company, then score every
# new role. The same scan as the Run ingest button.
#
# Schedule it daily on macOS (noon local time):
#   bash scripts/daily-ingest.sh --install
# Remove the schedule:
#   bash scripts/daily-ingest.sh --uninstall
# Run it now:
#   bash scripts/daily-ingest.sh
#
# The weekly gap check is the same scan read further back and deeper, looking for
# roles the daily run missed (Sundays at 13:00, an hour clear of the daily run):
#   bash scripts/daily-ingest.sh --weekly --install
#   bash scripts/daily-ingest.sh --weekly --uninstall
#   bash scripts/daily-ingest.sh --weekly
#
# Logs go to private/logs/, which is gitignored.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGDIR="$ROOT/private/logs"
mkdir -p "$LOGDIR"

if [ "${1:-}" = "--weekly" ]; then
  shift
  WEEKLY=1
  LABEL="com.belay.weekly-gap-check"
  NAME="weekly gap check"
  LOG="$LOGDIR/weekly-gap-check.log"
  QUERY="?weekly=1"
  WHEN="<key>Weekday</key><integer>0</integer><key>Hour</key><integer>13</integer><key>Minute</key><integer>0</integer>"
  SCHEDULED="Sundays at 13:00"
else
  WEEKLY=""
  LABEL="com.belay.daily-ingest"
  NAME="daily ingest"
  LOG="$LOGDIR/daily-ingest.log"
  QUERY=""
  WHEN="<key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer>"
  SCHEDULED="daily at 12:00"
fi
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

case "${1:-}" in
  --install)
    # launchd runs with a bare PATH; carry this shell's so node and claude resolve.
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$ROOT/scripts/daily-ingest.sh</string>${WEEKLY:+<string>--weekly</string>}</array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH</string></dict>
  <key>StartCalendarInterval</key>
  <dict>$WHEN</dict>
  <key>StandardOutPath</key><string>$LOGDIR/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/launchd.err.log</string>
</dict>
</plist>
EOF
    launchctl unload "$PLIST" 2>/dev/null
    launchctl load "$PLIST" && echo "Scheduled $SCHEDULED. Logs: $LOG"
    exit $?
    ;;
  --uninstall)
    launchctl unload "$PLIST" 2>/dev/null
    rm -f "$PLIST" && echo "Removed the $NAME schedule."
    exit 0
    ;;
esac

say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# /api/jobs is a cheap real route; a 404 here would read as a dead server.
alive() { curl -sf -m 5 "http://localhost:$1/api/jobs" > /dev/null 2>&1; }
find_port() { for p in 3001 3000; do alive "$p" && { echo "$p"; return 0; }; done; return 1; }

say "--- $NAME starting ---"

# A run that starts the moment the Mac wakes can beat the network back: Gmail, LinkedIn
# and the portfolio boards all came back "fetch failed" or empty on 2026-10-21. Wait
# for the internet (up to ten minutes) before scanning.
for i in $(seq 1 60); do
  if curl -s -m 5 -o /dev/null https://www.google.com; then break; fi
  [ "$i" = "1" ] && say "no network yet; waiting for it"
  sleep 10
done

PORT=$(find_port) || PORT=""
if [ -z "$PORT" ]; then
  say "no dev server responding; starting one"
  cd "$ROOT" || { say "FATAL: $ROOT missing"; exit 1; }
  npm run dev >> "$LOGDIR/dev-server.log" 2>&1 &
  for _ in $(seq 1 60); do
    sleep 2
    PORT=$(find_port) && break
  done
  # Left running afterwards, so the queue is ready to review.
fi

if [ -z "$PORT" ]; then
  say "FATAL: dev server never came up; skipping"
  exit 1
fi
say "using port $PORT"

# Scanning takes a few minutes and scoring every new role can take several more.
RESPONSE=$(curl -s -m 2400 -X POST "http://localhost:$PORT/api/ingest/all$QUERY")
say "response: ${RESPONSE:0:2000}"

SUMMARY=$(printf '%s' "$RESPONSE" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('summary', 'no summary'))
except Exception:
    print('ingest returned non-JSON')
" 2>/dev/null)
say "$SUMMARY"

osascript -e "display notification \"${SUMMARY//\"/}\" with title \"Belay $NAME\"" 2>/dev/null

say "--- done ---"
