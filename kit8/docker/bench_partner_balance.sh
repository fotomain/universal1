#!/usr/bin/env bash
# Speed check of the partner balance (documentation/PARTNER_BALANCE.html, PART 39) on a throwaway database of the local Postgres (docker compose up -d first):
#   N register rows (default 100000) over 500 partners x 4 contracts x 50 tasks, 1000 days, both roles; the ledger is kept by the statement trigger while they are written; then the timings of
#   the report (whole book / a period / the sum filters / sorted by the budget sum / one partner's tasks), the filter lists, 200 rows written by one Post, 200 rows taken away by one Unpost, the verify.
# Targets: every report call < 3 s on the whole book of 100 000 rows (measured 2026-10-24: 2.2 s the first call, about 1.4 s after; the Supabase limit for `authenticated` is 8 s) - a Post / Unpost of 200 lines < 1 s - verify returns nothing.      Usage: ./bench_partner_balance.sh [rows]
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlpbbench
N=${1:-100000}
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables start2_sql_code start4_sql_insert_missing; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/$f.sql >/dev/null
done

echo "== $N register rows (the ledger follows by its trigger)"
psqlc -d "$DB" <<SQL
SELECT public.organization_ensure_user('bench@acme.test', '99999999-9999-9999-9999-999999999999', 'Bench', 'B') \gset
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'bench@acme.test', 'sub', '99999999-9999-9999-9999-999999999999')::text, false);
SELECT set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
SELECT public.organization_of_current_user() AS org \gset
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('bbbbbbbb-0000-0000-0000-000000000001', public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001'), '99999999-9999-9999-9999-999999999999', '{"name":"Bench"}');
SET session_replication_role = replica;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT ('bbbbbbbb-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000001') || public.pm_ltree_label(('bbbbbbbb-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid),
       'bbbbbbbb-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', jsonb_build_object('taskDescription', 'Task ' || g) FROM generate_series(1, 50) g;
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") SELECT 'bp' || g, jsonb_build_object('partnerTitle', 'Partner ' || lpad(g::text, 4, '0')) FROM generate_series(1, 500) g;
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT 'bc' || p || '-' || c, 'bp' || p, 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractNumber', 'C-' || p || '-' || c, 'contractCurrency', 'EUR', 'contractFinishDate', (DATE '2031-01-01' + (p * 7 + c) % 700)::text)
  FROM generate_series(1, 500) p, generate_series(1, 4) c;
RESET session_replication_role;
INSERT INTO public.partner_balance_movements ("rowOrganizationGUID", "registratorGUID", "registratorKind", "registratorLineGUID", "partnerBalanceOperationType", "balanceRole", "periodDay", "balancePartner", "balancePartnerContract",
       "projectGUID", "projectPaymentPlanTaskGUID", "currencyForContract", "currencyForAccounting", "currencyForBudget", "sumForContract", "sumForAccounting", "sumForBudget")
SELECT :'org', gen_random_uuid(), CASE WHEN g % 3 = 0 THEN 'paymentFact' ELSE 'vendorInvoice' END, gen_random_uuid(),
       CASE WHEN g % 3 = 0 THEN 'paymentToVendor' ELSE 'vendorCredit' END, 'vendor', DATE '2030-01-01' + (g % 1000), 'bp' || (1 + g % 500), 'bc' || (1 + g % 500) || '-' || (1 + (g / 500) % 4),
       'bbbbbbbb-0000-0000-0000-000000000001', ('bbbbbbbb-0000-0000-0001-' || lpad((1 + g % 50)::text, 12, '0'))::uuid, 'EUR', 'EUR', 'EUR',
       CASE WHEN g % 3 = 0 THEN 100 ELSE -150 END, CASE WHEN g % 3 = 0 THEN 100 ELSE -150 END, CASE WHEN g % 3 = 0 THEN 100 ELSE -150 END
  FROM generate_series(1, $N) g;
ANALYZE public.partner_balance_movements;
SQL

echo "== timings (the whole book, as the user)"
psqlc -d "$DB" <<'SQL'
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'bench@acme.test', 'sub', '99999999-9999-9999-9999-999999999999')::text, false);
SELECT set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
DO $$
DECLARE t0 timestamptz; r jsonb; n integer; org text := public.organization_of_current_user();
BEGIN
  t0 := clock_timestamp(); r := public.partner_balance_report('vendor', NULL, NULL);
  RAISE NOTICE 'report, whole book, no dates: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_report('vendor', DATE '2031-03-01', DATE '2031-04-30');
  RAISE NOTICE 'report, a period of two months: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_report('vendor', NULL, NULL, '{"sumBiggerThan": 1000, "sumSmallerThan": 5000, "hideSettled": true}');
  RAISE NOTICE 'report, sums between 1000 and 5000: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_report('vendor', NULL, NULL, '{}', '{"sortBy":"sumForBudgetEnd"}');
  RAISE NOTICE 'report, sorted by the budget sum: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_report('vendor', NULL, NULL, '{}', '{"sortBy":"contractFinishDate","sortDir":"desc"}');
  RAISE NOTICE 'report, sorted by the contract finish date: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_report('vendor', NULL, NULL, '{"partnerFilter":"bp7","partnerContractFilter":"bc7-1"}', '{}', 'task');
  RAISE NOTICE 'drill-down, the tasks of one contract: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_filter_items('vendor', NULL, NULL);
  RAISE NOTICE 'filter items: % partners, % ms', jsonb_array_length(r->'partners'), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); r := public.partner_balance_movements_list('vendor', 'bp7', 'bc7-1');
  RAISE NOTICE 'movements of one contract: % rows, % ms', jsonb_array_length(r), round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  -- one Post / one Unpost of 200 lines: the rows go in and out with their trigger
  t0 := clock_timestamp();
  INSERT INTO public.partner_balance_movements ("rowOrganizationGUID", "registratorGUID", "registratorKind", "registratorLineGUID", "partnerBalanceOperationType", "balanceRole", "periodDay", "balancePartner", "balancePartnerContract",
         "projectGUID", "projectPaymentPlanTaskGUID", "currencyForContract", "currencyForAccounting", "currencyForBudget", "sumForContract", "sumForAccounting", "sumForBudget")
  SELECT org, 'dddddddd-0000-0000-0000-000000000001', 'vendorInvoice', ('dddddddd-1000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'vendorCredit', 'vendor', DATE '2031-05-01', 'bp7', 'bc7-1',
         'bbbbbbbb-0000-0000-0000-000000000001', ('bbbbbbbb-0000-0000-0001-' || lpad((1 + g % 50)::text, 12, '0'))::uuid, 'EUR', 'EUR', 'EUR', -10, -10, -10 FROM generate_series(1, 200) g;
  RAISE NOTICE 'a Post of 200 lines on one contract: % ms', round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp();
  DELETE FROM public.partner_balance_movements WHERE "registratorGUID" = 'dddddddd-0000-0000-0000-000000000001';
  RAISE NOTICE 'an Unpost of 200 lines: % ms', round(extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); n := (SELECT count(*) FROM public.partner_balance_verify(org));
  RAISE NOTICE 'verify: % problems, % ms', n, round(extract(epoch FROM clock_timestamp() - t0) * 1000);
END $$;
SQL
