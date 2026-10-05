#!/usr/bin/env bash
# Start Finder (restart it if it is stuck) and show this project folder.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! pgrep -x Finder >/dev/null; then
  echo "Finder is not running - starting it..."
  open -a Finder
  sleep 2
fi

if ! open "$DIR"; then
  echo "Finder did not respond - restarting it..."
  killall Finder 2>/dev/null
  sleep 2
  open -a Finder
  sleep 2
  open "$DIR"
fi

echo "Finder opened at: $DIR"
