#!/usr/bin/env bash
# Speed check of the cash ledger (documentation/PAYMENTS_FACT_WBS.html, PART 38) on a throwaway database of the local Postgres (docker compose up -d first):
#   N posted movements (default 10000) of ONE money account over 1000 days, 3 currencies; then
#   the rebuild of all the rests - the rests of one back-dated Post (from day 500) - ONE exchange rate change that rules a year (cash_ledger_recalc) - the verify.
# Targets: rebuild of the rests < 1 s - a rate change that rules 9 000 movements < 5 s (the rates are read once per currency pair and DAY) - verify returns nothing.      Usage: ./bench_cash_ledger.sh [movements]
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlcashbench
N=${1:-10000}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/$f.sql >/dev/null
done

echo "== $N movements on one account (made with the triggers off: the documents are not what is measured)"
psqlc -d "$DB" >/dev/null <<SQL
INSERT INTO public."moneyAccountTable" ("rowGUID", "rowJSON") VALUES ('ma-bench', '{"moneyAccountTitle":"Bench","moneyAccountCurrency":"EUR","moneyAccountOpeningBalance":1000}');
INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT c."rowGUID", '2030-01-01|Budget', jsonb_build_object('startingDate', '2030-01-01', 'currencyRatio', 1.2, 'rateType', 'Budget', 'rateBase', 'EUR') FROM public."currencyTable" c WHERE c."rowJSON"->>'currencyCode' = 'USD';
SELECT public.organization_ensure_user('bench@acme.test', '99999999-9999-9999-9999-999999999999', 'Bench', 'B');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('bbbbbbbb-0000-0000-0000-000000000001', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001'), '99999999-9999-9999-9999-999999999999', '{"name":"Bench","currencyForBudget":"USD"}');
SET session_replication_role = replica;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-000000000002', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000002'), 'bbbbbbbb-0000-0000-0000-000000000001', gen_random_uuid(), '{"taskDescription":"t"}');
INSERT INTO public.project_payment_fact_header ("rowGUID", "rowOrganizationGUID", "rowJSON") VALUES ('bbbbbbbb-0000-0000-0000-000000000003', 'org-bench', '{"documentHeader":{"documentStatus":"posted"},"moneyAccountFact":"ma-bench"}');
INSERT INTO public.project_payment_fact_lines ("rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "rowJSON")
SELECT gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '{}' FROM generate_series(1, $N);
INSERT INTO public.cash_account_ledger_movements ("rowOrganizationGUID", "rowHeaderGUID", "rowLineGUID", "rowProjectGUID", "rowOwnerGUID", "moneyAccount", "periodDay", "paymentDirection", "currencyForContract", "currencyForBudget", "currencyForMoneyAccount",
       "sumForContract", "sumForBudget", "sumForMoneyAccount")
SELECT 'org-bench', l."rowHeaderGUID", l."rowGUID", l."rowProjectGUID", l."rowOwnerGUID", 'ma-bench', DATE '2030-01-01' + (row_number() OVER () % 1000)::int, 'outbound', 'EUR', 'USD', 'EUR',
       -100, -120, -100 FROM public.project_payment_fact_lines l;
RESET session_replication_role;
SQL

echo "== timings"
psqlc -d "$DB" <<'SQL'
DO $$
DECLARE t0 timestamptz; n integer; changed integer;
BEGIN
  t0 := clock_timestamp(); n := public.cash_ledger_rebuild('org-bench', 'ma-bench');
  RAISE NOTICE 'rebuild of all the rests: % rows, % ms', n, round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); n := public.cash_ledger_rebuild_rests('org-bench', 'ma-bench', DATE '2031-05-15');
  RAISE NOTICE 'rests from day 500 (a back-dated Post): % rows, % ms', n, round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON")
  SELECT c."rowGUID", '2030-03-01|Budget', jsonb_build_object('startingDate', '2030-03-01', 'currencyRatio', 1.5, 'rateType', 'Budget', 'rateBase', 'EUR') FROM public."currencyTable" c WHERE c."rowJSON"->>'currencyCode' = 'USD';
  RAISE NOTICE 'the queue after the new rate: % entries', (SELECT count(*) FROM public.cash_account_ledger_dirty);
  t0 := clock_timestamp(); changed := public.cash_ledger_process_dirty();
  RAISE NOTICE 'a rate change that rules the rest of the book: % movements changed, % ms', changed, round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); n := (SELECT count(*) FROM public.cash_ledger_verify('org-bench', 'ma-bench'));
  RAISE NOTICE 'verify: % problems, % ms', n, round(extract(epoch FROM clock_timestamp() - t0) * 1000);
END $$;
SQL
