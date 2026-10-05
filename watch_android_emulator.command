#!/usr/bin/env bash
# Keeps the Android emulator build running and restarts it on request.
# Start this once and leave the window open. Whenever the file ".android_rerun"
# appears in this folder, the current run is stopped and
# run_on_emulator_android.command is started again.
# Usage: ./watch_android_emulator.command [appClothes1|appCC1|appOnTrend|appPosts]
cd "$(dirname "${BASH_SOURCE[0]}")"
TRIGGER=".android_rerun"

stop_run() {
  [ -n "$RUN_PID" ] || return 0
  pkill -P "$RUN_PID" 2>/dev/null
  kill "$RUN_PID" 2>/dev/null
  pkill -f "expo run:android" 2>/dev/null
  PORT_PIDS="$(lsof -ti :8088 2>/dev/null || true)"
  [ -n "$PORT_PIDS" ] && kill -9 $PORT_PIDS 2>/dev/null
  wait "$RUN_PID" 2>/dev/null
  RUN_PID=""
}
trap 'stop_run; exit 0' INT TERM

while true; do
  rm -f "$TRIGGER"
  echo "[watch] $(date '+%H:%M:%S') starting run_on_emulator_android.command"
  ./run_on_emulator_android.command "$@" </dev/null &
  RUN_PID=$!
  while [ ! -f "$TRIGGER" ]; do
    if ! kill -0 "$RUN_PID" 2>/dev/null; then
      wait "$RUN_PID"; echo "[watch] run ended (exit $?). Waiting for a restart request..."
      RUN_PID=""
      while [ ! -f "$TRIGGER" ]; do sleep 3; done
      break
    fi
    sleep 3
  done
  echo "[watch] $(date '+%H:%M:%S') restart requested"
  stop_run
done
