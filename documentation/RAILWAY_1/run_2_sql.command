#!/bin/zsh
# =========================================================================
# UNIVERSAL1 - Railway #1 sample data on the LINKED Supabase project: runs TWO SQL files, in this order
#   1. kit8/sql/start/start4_sql_insert_missing.sql   the seed rows (INSERT ... ON CONFLICT DO NOTHING): adds what is missing, among it the standard budget items
#                                                       (PART 32) that Railway #1 uses; nothing of yours is changed
#   2. documentation/RAILWAY_1/RAILWAY_1_DATA.sql     the project Railway #1: task, lines, plan, purchase order, product receipt, fact, vendor invoice, customer invoice
#                                                       + the 3 money accounts and the 2 payment facts made of the two invoices (PART 38)
#                                                       (it REPLACES the earlier Railway #1 data; it stops with a message when start1 + start2 + start4 were not run)
#   both are idempotent: safe to run again.
#   NOT run on purpose: start1 / start2 (the structure: kit8/sql/start/run_sql_cli.command), start5 (overwrites seed rows), delete_sql_structure.sql.
#
#   ./run_2_sql.command            shows the project and the files, waits for Enter, runs both, then checks the result
#   ./run_2_sql.command -y         no question
#   ./run_2_sql.command --dry      only shows what would run
#   ./run_2_sql.command --verify   runs NOTHING: only the read-only check of what is in the database now (items, lines, the 5 documents, the money accounts and the 2 payment facts, cash flow by activity)
#   PROJECT_REF=abcdef ./run_2_sql.command   another project (default: supabase/.temp/linked-project.json of the repo)
# Needs the Supabase CLI logged in (supabase login). Stops at the FIRST error and tells which file failed.
# =========================================================================

set -eo pipefail

# standard system and Homebrew binaries when launched from the macOS Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$HERE/../.." && pwd)"
cd "$REPO_DIR"

ASSUME_YES=0
DRY=0
VERIFY=0
for a in "$@"; do
  case "$a" in
    -y|--yes) ASSUME_YES=1 ;;
    --dry|--dry-run) DRY=1 ;;
    --verify|--check) VERIFY=1 ;;
    *) echo "unknown option: $a (use -y, --dry or --verify)"; exit 2 ;;
  esac
done

pause_end() { if [ -t 0 ] && [ "$ASSUME_YES" = 0 ]; then echo; read -k 1 "?Press any key to close..."; echo; fi; }
die() { echo; echo "FAILED: $*"; pause_end; exit 1; }

command -v supabase >/dev/null 2>&1 || die "the Supabase CLI is not installed (brew install supabase/tap/supabase)"

# the project: PROJECT_REF, else the linked project of this repo
REF="${PROJECT_REF:-}"
if [ -z "$REF" ] && [ -f supabase/.temp/linked-project.json ]; then
  REF="$(python3 -I -c 'import json,sys;print(json.load(open("supabase/.temp/linked-project.json")).get("ref",""))')"
fi
[ -n "$REF" ] || die "no project: run 'supabase link' in $REPO_DIR or set PROJECT_REF"

# the two files, in this order (the seeds first: the project points at the standard budget items)
FILES=("$REPO_DIR/kit8/sql/start/start4_sql_insert_missing.sql" "$HERE/RAILWAY_1_DATA.sql")
for f in "${FILES[@]}"; do [ -f "$f" ] || die "missing file: $f"; done

# supabase db query --linked talks to the Management API; --project-ref names the project explicitly (the plain --linked can fail with ProjectRefNotLinkedError)
run_sql() { supabase db query --linked --project-ref "$REF" "$@" 2>&1 | grep -v "new version of Supabase CLI\|We recommend updating regularly"; return "${pipestatus[1]}"; }

# the read-only check (also the end of a run): what Railway #1 is in the database now
P='a1000000-0000-4000-8000-000000000001'
check() {
  local Q1="select (select count(*) from public.\"budgetItemTable\" where \"rowGUID\" in ('serviceRevenueBudgetItem','rawMaterialsBudgetItem','subcontractedServicesBudgetItem','externalLaborBudgetItem','customerReceiptsBudgetItem','vendorPaymentsBudgetItem')) as standard_items_of_6, (select count(*) from public.task_line_table where \"rowProjectGUID\" = '$P'::uuid) as task_lines_of_4, (select count(*) from public.task_line_table l join public.\"budgetItemTable\" b on b.\"rowGUID\" = l.\"rowJSON\"->>'budgetItemTaskLine' where l.\"rowProjectGUID\" = '$P'::uuid and coalesce(b.\"rowJSON\"->>'budgetItemGenericKey','') <> '') as lines_with_key_of_4, (select count(*) from public.\"budgetItemTable\" where \"rowGUID\" like 'bi-nec%') as old_items_must_be_0, (select count(distinct \"rowHeaderGUID\") from public.purchase_order_lines where \"rowProjectGUID\" = '$P'::uuid) as purchase_orders_of_1, (select count(distinct \"rowHeaderGUID\") from public.product_receipt_lines where \"rowProjectGUID\" = '$P'::uuid) as product_receipts_of_1, (select count(distinct \"rowHeaderGUID\") from public.task_fact_usage_timeline where \"rowProjectGUID\" = '$P'::uuid) as fact_documents_of_1, (select count(distinct \"rowHeaderGUID\") from public.vendor_invoice_lines where \"rowProjectGUID\" = '$P'::uuid) as vendor_invoices_of_1, (select count(distinct \"rowHeaderGUID\") from public.customer_invoice_lines where \"rowProjectGUID\" = '$P'::uuid) as customer_invoices_of_1, (select count(*) from public.\"moneyAccountTable\" where \"rowGUID\" like 'ma-nec%') as money_accounts_of_3, (select count(distinct l.\"rowHeaderGUID\") from public.project_payment_fact_lines l join public.project_payment_fact_header h on h.\"rowGUID\" = l.\"rowHeaderGUID\" where l.\"rowProjectGUID\" = '$P'::uuid and h.\"rowJSON\"->'documentHeader'->>'documentStatus' = 'posted') as payment_facts_of_2"
  run_sql "$Q1" | grep -E '"[a-z_]+_(of_[0-9]|must_be_0)"' | sed 's/^ */   /' || echo "   (the check could not be read)"
  echo "   cash flow of the budget items of the task lines (activity genus, IAS 7):"
  local Q2="select split_part(b.\"rowJSON\"->>'budgetItemGenericKey', '.', 1) || ' ' || (b.\"rowJSON\"->>'direction') as cash_flow, sum((l.\"rowJSON\"->>'sumForBudget')::numeric) as budget_usd from public.task_line_table l join public.\"budgetItemTable\" b on b.\"rowGUID\" = l.\"rowJSON\"->>'budgetItemTaskLine' where l.\"rowProjectGUID\" = '$P'::uuid group by 1 order by 1"
  run_sql "$Q2" | grep -E '"(cash_flow|budget_usd)"' | sed 's/^ */      /' || echo "   (the cash flow could not be read)"
}

if [ "$VERIFY" = 1 ]; then
  echo "Project ref : $REF  (read only - nothing is changed)"
  echo; echo ">> check"; check
  pause_end; exit 0
fi

echo "=============================================================================="
echo "  UNIVERSAL1 -> SUPABASE: Railway #1 sample data (2 SQL files)"
echo "  Project ref : $REF"
echo "  Files       :"
for f in "${FILES[@]}"; do echo "    - $(basename "$f")  ($(wc -c < "$f" | tr -d ' ') bytes)"; done
echo "  Needs       : start1_sql_tables.sql and start2_sql_code.sql already run on this project (kit8/sql/start/run_sql_cli.command)"
echo "  WARNING     : RAILWAY_1_DATA.sql REPLACES the earlier Railway #1 data of this project"
echo "=============================================================================="

if [ "$DRY" = 1 ]; then echo "(dry run: nothing was executed)"; exit 0; fi

if [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
  read -k 1 "?Run these 2 files on this project? [Enter = yes, any other key = no] "; echo
  [ "$REPLY" = $'\n' ] || [ -z "$REPLY" ] || { echo "cancelled"; exit 0; }
fi

for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  echo; echo ">> $name"
  start=$SECONDS
  if out="$(run_sql -f "$f")"; then
    echo "   OK in $((SECONDS - start)) s"
  else
    echo "$out" | tail -15
    die "$name failed - the files after it were NOT run"
  fi
done

echo; echo ">> check (read only)"; check

echo; echo "DONE. Reload the app; no Expo restart is needed (only the database changed)."
pause_end
