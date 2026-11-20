#!/usr/bin/env bash
# BIM4 Sixty5 cost + time plan (documentation/BIM4_SIXTY5): generate the SQL, then run it through the real schema (fresh db, start1 + start2 + start4, the 1658 rows of the BIM import,
# capacityModeBlock) exactly as the Supabase Management API would run it. Usage: ./test_sixty5.sh   (docker compose up -d first)
set -euo pipefail
cd "$(dirname "$0")"
OUT=$(mktemp -d -t sixty5out)
SIXTY5_OWNER=99999999-9999-9999-9999-999999999999 python3 -I ../../documentation/BIM4_SIXTY5/build_sixty5_plan.py "$OUT" > /dev/null
python3 sixty5_check.py "$OUT"
