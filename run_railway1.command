#!/usr/bin/env bash
# UNIVERSAL1 - Root Shortcut to load Railway #1 Data
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/documentation/RAILWAY_1/RAILWAY_1_DATA_run.command" "$@"
