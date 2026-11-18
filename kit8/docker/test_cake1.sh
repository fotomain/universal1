#!/usr/bin/env bash
# CAKE1 (documentation/CAKE1): the plan file through the real schema - import as `authenticated` (statement limit 8 s), Post of every task with the payloads of the app's own
# calculateTaskLinePlan, the Monitor01 worker, every sum checked.  Usage: ./test_cake1.sh [json]   (docker compose up -d first; start1 + start2 + start4 are installed by the script)
set -euo pipefail
cd "$(dirname "$0")"
JSON=${1:-../../documentation/CAKE1/cake1_plan_json.json}
OUT=$(mktemp -t cake1payloads).json
(cd ../.. && CAKE1_JSON="$(cd kit8/docker && cd "$(dirname "$JSON")" && pwd)/$(basename "$JSON")" CAKE1_POST_OUT="$OUT" npx jest __tests__/pm/crud/exchange/cake1PostPlan.test.ts >/dev/null 2>&1) || { echo "the Post calculation of the app failed (run the jest test)"; exit 1; }
python3 cake1_import_check.py "$JSON" "$OUT"
