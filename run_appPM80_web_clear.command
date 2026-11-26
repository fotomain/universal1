#!/usr/bin/env bash
# Run the "Project Budget Management" app (appPM80) in the BROWSER (Expo web, port 8088) with an EMPTY Metro cache - no phone needed.
# Same as: APP_NAME=appPM80 npx expo start --web --port 8088 -c
# Use it after a change of .env, app.config.js, a babel / metro config, or when the browser shows old code.
# Another app: ./run_appPM80_web_clear.command appClothes1
# Usage: ./run_appPM80_web_clear.command [app]
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
export APP_NAME="${1:-appPM80}"

# Close EVERYTHING that listens on port 8088 (an earlier web run, a phone run, a stuck node / Metro): it would serve the old bundle or block the port.
# Only the LISTENING programs are closed - a browser tab that is merely connected to the port is not touched.
listeners() { lsof -nP -tiTCP:8088 -sTCP:LISTEN 2>/dev/null | sort -u; }
PIDS="$(listeners)"
if [ -n "$PIDS" ]; then
  echo "Port 8088 is in use by PID(s): $(echo $PIDS | tr '\n' ' '). Closing them ..."
  for p in $PIDS; do ps -o pid=,command= -p "$p" 2>/dev/null | cut -c1-120; done
  kill $PIDS 2>/dev/null || true            # a polite stop first
  for i in 1 2 3 4 5 6; do [ -z "$(listeners)" ] && break; sleep 0.5; done
  PIDS="$(listeners)"
  if [ -n "$PIDS" ]; then
    echo "Still open: $(echo $PIDS | tr '\n' ' '). Forcing ..."
    kill -9 $PIDS 2>/dev/null || true
    sleep 1
  fi
  if [ -n "$(listeners)" ]; then
    echo "Port 8088 could not be freed. Programs still on it:"; lsof -nP -iTCP:8088 -sTCP:LISTEN; exit 1
  fi
  echo "Port 8088 is free."
fi

echo "========================================="
echo "Expo web, empty cache: $APP_NAME  ->  http://localhost:8088"
echo "========================================="
exec npx expo start --web --port 8088 -c
