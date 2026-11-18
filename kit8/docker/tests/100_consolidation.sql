-- CONSOLIDATION (documentation/CONSOLIDATION_WBS.html, PART 52): the obligatory currency of the organization, the VAT switches, sumForConsolidation of the movement tables (calculated by the
-- database only), the queue + worker, the gaps (a missing rate never refuses a Post), the project currency guard (Q1), the report and the verify.
-- Golden example of the document: A (budget EUR) 5000 + B (budget USD) 10000 at 1.25 USD per EUR = 8000 EUR; consolidation currency EUR.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT o."rowGUID" AS org FROM public."organizationTable" o WHERE o."rowOwnerGUID" = 'anna@acme.test' \gset
SELECT p."rowGUID" AS pa FROM public.project_table p WHERE p."rowParentGUID" = :'org' AND p."rowJSON"->>'name' = 'Project 1' \gset
SELECT p."rowGUID" AS pb FROM public.project_table p WHERE p."rowParentGUID" = :'org' AND p."rowJSON"->>'name' = 'Project 2' \gset
SELECT t."rowGUID" AS ta FROM public.project_task_table t WHERE t."projectGUID" = :'pa' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT t."rowGUID" AS tb FROM public.project_task_table t WHERE t."projectGUID" = :'pb' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT c."rowGUID" AS c_usd FROM public."currencyTable" c WHERE upper(c."rowJSON"->>'currencyCode') = 'USD' \gset
-- rates in 2030 (the seeded ECB rates end in the past): USD per EUR 1.25 ; the currency ZZZ (not in the catalog: no rate at all) gets its rate later (a missing rate first)
INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'c_usd', '2030-01-01', jsonb_build_object('startingDate', '2030-01-01', 'currencyRatio', 1.25, 'rateType', 'Default'));
DELETE FROM public.consolidation_dirty;
SELECT 'c-zzz' AS c_chf \gset

-- 1. the settings of an organization made before the feature: the install fills them (Q12) --------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT o."rowJSON"->>'currencyForConsolidation' FROM public."organizationTable" o WHERE o."rowGUID" = :'org'), 'USD', 'an organization made at the sign in (organization_for_email): the consolidation currency is USD');
-- a second user signing in gets its own new organization, again with USD
SELECT public.organization_ensure_user('bob@acme.test', '22222222-2222-2222-2222-222222222222', 'Bob', 'L');
SELECT tt.eq((SELECT o."rowJSON"->>'currencyForConsolidation' FROM public."organizationTable" o WHERE o."rowOwnerGUID" = 'bob@acme.test'), 'USD', 'every new organization made at a sign in starts with USD as the currency for consolidation');
SELECT tt.eq((SELECT o."rowJSON"->>'exchangeRateTypeForConsolidation' FROM public."organizationTable" o WHERE o."rowGUID" = :'org'), 'Default', 'the rate type defaults to Default');
SELECT tt.eq((SELECT (o."rowJSON"->'consolidationIncludePurchaseVAT', o."rowJSON"->'consolidationIncludeSaleVAT', o."rowJSON"->>'consolidationState')::text FROM public."organizationTable" o WHERE o."rowGUID" = :'org'),
             '(false,false,ready)', 'both VAT switches are OFF, the state is ready');
-- an organization that has no key at all (an old row) is filled by the one-time UPDATE of the install; with no default project settings the base currency, else EUR
SELECT tt.eq((SELECT public.consolidation_default_currency('{"defaultProjectSettings": {"currencyForBudget": "gbp"}, "baseCurrency": "SEK"}'::jsonb)), 'GBP', 'default: the budget currency of the default project settings');
SELECT tt.eq((SELECT public.consolidation_default_currency('{"baseCurrency": "sek"}'::jsonb)), 'SEK', 'default: else the base currency');
SELECT tt.eq((SELECT public.consolidation_default_currency('{}'::jsonb)), 'EUR', 'default: else EUR');
INSERT INTO public."organizationTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('org-old', 'old@acme.test', '{"organizationTitle": "Old", "baseCurrency": "SEK"}');
SELECT tt.eq((SELECT o."rowJSON"->>'currencyForConsolidation' FROM public."organizationTable" o WHERE o."rowGUID" = 'org-old'), 'SEK', 'a client insert without the key gets the default (the catalog form sends partial JSON)');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" - 'currencyForConsolidation' - 'consolidationIncludeSaleVAT' WHERE "rowGUID" = 'org-old';
SELECT tt.eq((SELECT (o."rowJSON"->>'currencyForConsolidation', o."rowJSON"->'consolidationIncludeSaleVAT')::text FROM public."organizationTable" o WHERE o."rowGUID" = 'org-old'), '(SEK,false)', 'a form that does not know the keys (they are absent) never drops them');

-- 2. obligatory ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": ""}' WHERE "rowGUID" = 'org-old'$q$, 'obligatory', 'an empty currency is refused');
SELECT tt.fails($q$UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": "EURO"}' WHERE "rowGUID" = 'org-old'$q$, 'obligatory', 'a code that is not 3 letters is refused');
SELECT tt.fails($q$UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": null}' WHERE "rowGUID" = 'org-old'$q$, 'obligatory', 'a JSON null is refused');
SELECT tt.fails($q$UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"exchangeRateTypeForConsolidation": ""}' WHERE "rowGUID" = 'org-old'$q$, 'rate type', 'an empty rate type is refused');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": "nok", "consolidationIncludePurchaseVAT": "true"}' WHERE "rowGUID" = 'org-old';
SELECT tt.eq((SELECT (o."rowJSON"->>'currencyForConsolidation', o."rowJSON"->'consolidationIncludePurchaseVAT')::text FROM public."organizationTable" o WHERE o."rowGUID" = 'org-old'), '(NOK,true)', 'a code is upper cased, a switch is a real boolean');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"consolidationState": "gaps"}' WHERE "rowGUID" = 'org-old';
SELECT tt.eq((SELECT o."rowJSON"->>'consolidationState' FROM public."organizationTable" o WHERE o."rowGUID" = 'org-old'), 'ready', 'the state belongs to the database: a client value is ignored');
DELETE FROM public."organizationTable" WHERE "rowGUID" = 'org-old';
DELETE FROM public.consolidation_dirty;

-- 3. a change of the consolidation currency queues every project of the organization; the worker recalculates ------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": "EUR"}' WHERE "rowGUID" = :'org';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_dirty), 2::bigint, 'the two projects of the organization are queued');
SELECT tt.eq((SELECT o."rowJSON"->>'consolidationState' FROM public."organizationTable" o WHERE o."rowGUID" = :'org'), 'recalculating', 'the state is recalculating');
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_dirty), 0::bigint, 'the worker emptied the queue');
SELECT tt.eq((SELECT o."rowJSON"->>'consolidationState' FROM public."organizationTable" o WHERE o."rowGUID" = :'org'), 'ready', '... and the state is ready again');
-- only the administrator of the organization changes the settings: another user does not even see the row (RLS), the check is the second wall
SELECT public.organization_ensure_user('bob@acme.test', '22222222-2222-2222-2222-222222222222', 'Bob', 'B');
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": "JPY"}' WHERE "rowGUID" = %L$q$, :'org')), 0::bigint, 'a user of another organization changes nothing');
SELECT tt.as_admin();

-- 4. the projects: A budgets in EUR (= the consolidation currency), B in USD ---------------------------------------------------------------------------------------------------------
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "EUR"}' WHERE "rowGUID" = :'pa';
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "USD"}' WHERE "rowGUID" = :'pb';
SELECT public.consolidation_process_dirty();

-- 5. Post: the twin is written in the same statement -----------------------------------------------------------------------------------------------------------------------------------
INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID",
                                             "qtyProjectStatus", "sumForBudget", "vatForBudget", "vatInCostForBudget") VALUES
  ('used', '2030-11-10 10:00+00', '2030-11-10', gen_random_uuid(), 'x', :'pa', :'ta', 'materialGenus', 1, 5000, 1050, 50),
  ('used', '2030-11-10 10:00+00', '2030-11-10', gen_random_uuid(), 'x', :'pb', :'tb', 'materialGenus', 1, 10000, 2100, 100),
  ('sold', '2030-11-10 10:00+00', '2030-11-10', gen_random_uuid(), 'x', :'pb', :'tb', 'revenueGenus', 1, 4000, 840, 0);
SELECT tt.eq((SELECT ("sumForConsolidation", "vatForConsolidation", "vatInCostForConsolidation")::text FROM public.project_status_movements WHERE "rowProjectGUID" = :'pa'), '(5000.00,1050.00,50.00)',
             'A: same currency = the sums themselves (no rate)');
SELECT tt.eq((SELECT ("sumForConsolidation", "vatForConsolidation", "vatInCostForConsolidation")::text FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb' AND "rowMovementKind" = 'used'), '(8000.00,1680.00,80.00)',
             'B: 10 000 USD at 1.25 USD per EUR = 8 000 EUR, the VAT parts follow');
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb' AND "rowMovementKind" = 'sold'), 3200::numeric, 'B sold: 4 000 USD = 3 200 EUR');
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table), 0::bigint, 'no gap');

-- 6. the report: the golden total and the four combinations of the two VAT switches -------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT sum(r.o_net) FROM public.consolidation_report() r WHERE r.o_kind = 'used'), 13000::numeric, 'golden: A 5 000 + B 8 000 = 13 000 EUR (net of the two projects, one currency)');
SELECT tt.eq((SELECT sum(r.o_amount) FROM public.consolidation_report() r WHERE r.o_kind = 'used'), 13130::numeric, 'switches OFF: purchase = net + the VAT that is cost (50 + 80) = 13 130');
SELECT tt.eq((SELECT sum(r.o_amount) FROM public.consolidation_report() r WHERE r.o_kind = 'sold'), 3200::numeric, 'switches OFF: sale = net 3 200');
SELECT tt.eq((SELECT count(*) FROM public.consolidation_report(ARRAY[:'pb'::uuid])), 2::bigint, 'one project: used + sold rows');
SELECT tt.eq((SELECT r.o_budget_currency || ' ' || r.o_budget_net FROM public.consolidation_report(ARRAY[:'pb'::uuid]) r WHERE r.o_kind = 'used'), 'USD 10000.00', 'the same row in the budget currency of the project');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"consolidationIncludePurchaseVAT": true}' WHERE "rowGUID" = :'org';
SELECT tt.eq((SELECT sum(r.o_amount) FROM public.consolidation_report() r WHERE r.o_kind = 'used'), 15730::numeric, 'purchase ON: net + all the VAT (13 000 + 1 050 + 1 680) = 15 730');
SELECT tt.eq((SELECT sum(r.o_amount) FROM public.consolidation_report() r WHERE r.o_kind = 'sold'), 3200::numeric, '... the sale side did not move');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"consolidationIncludeSaleVAT": true}' WHERE "rowGUID" = :'org';
SELECT tt.eq((SELECT sum(r.o_amount) FROM public.consolidation_report() r WHERE r.o_kind = 'sold'), 3872::numeric, 'sale ON: 3 200 + 672');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"consolidationIncludePurchaseVAT": false}' WHERE "rowGUID" = :'org';
SELECT tt.eq((SELECT sum(r.o_amount) FROM public.consolidation_report() r WHERE r.o_kind = 'used'), 13130::numeric, 'purchase OFF again: the purchase side followed, the sale side stays ON');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_dirty), 0::bigint, 'a change of a VAT switch needs no recalculation: the queue stays empty');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"consolidationIncludeSaleVAT": false}' WHERE "rowGUID" = :'org';
SELECT tt.eq(public.consolidation_amount(100, 21, 5, 'purchase', false, false), 105::numeric, 'consolidation_amount: purchase OFF = Cost basis');
SELECT tt.eq(public.consolidation_amount(100, 21, 5, 'purchase', true, false), 121::numeric, 'purchase ON = With VAT');
SELECT tt.eq(public.consolidation_amount(100, 21, 5, 'sale', false, false), 100::numeric, 'sale OFF = net');
SELECT tt.eq(public.consolidation_amount(100, 21, 5, 'sale', false, true), 121::numeric, 'sale ON = With VAT');

-- 7. a client cannot write the twin ------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$UPDATE public.project_status_movements SET "sumForConsolidation" = 1$q$, 'permission denied', 'a client cannot update the register');
SELECT tt.fails($q$DELETE FROM public.consolidation_gap_table$q$, 'permission denied', 'a client cannot write the gaps');
SELECT tt.fails($q$SELECT * FROM public.consolidation_dirty$q$, 'permission denied', 'a client cannot read the queue');
SELECT tt.fails($q$SELECT * FROM public.consolidation_verify('x')$q$, 'permission denied', 'verify is a maintenance function');
SELECT tt.as_admin();

-- 8. the gaps: a movement that cannot be converted gets 0 and a gap, a Post is never refused; the rate closes it -----------------------------------------------------------------------------------
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "ZZZ"}' WHERE "rowGUID" = :'pb';       -- the SQL editor may change it: B has posted documents (Q1 is for users)
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table WHERE "reason" = 'noExchangeRate'), 2::bigint, 'no ZZZ rate: the two movements of B are gaps');
SELECT tt.eq((SELECT sum("sumForConsolidation") FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb'), 0::numeric, '... with a twin of 0');
SELECT tt.eq((SELECT o."rowJSON"->>'consolidationState' FROM public."organizationTable" o WHERE o."rowGUID" = :'org'), 'gaps', 'the state is gaps');
INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "qtyProjectStatus", "sumForBudget") VALUES
  ('used', '2030-11-11 10:00+00', '2030-11-11', gen_random_uuid(), 'x', :'pb', :'tb', 'materialGenus', 1, 700);
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table), 3::bigint, 'a new Post is accepted and makes its own gap');
DELETE FROM public.project_status_movements WHERE "sumForBudget" = 700;
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table), 2::bigint, 'an Unpost (delete) takes its gap with it');
INSERT INTO public."currencyTable" ("rowGUID", "rowJSON") VALUES ('c-zzz', '{"currencyCode": "ZZZ", "decimalDigits": 2}');
INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'c_chf', '2030-01-01', jsonb_build_object('startingDate', '2030-01-01', 'currencyRatio', 0.5, 'rateType', 'Default'));
SELECT tt.eq((SELECT count(*) FROM public.consolidation_dirty WHERE "rowProjectGUID" = '00000000-0000-0000-0000-000000000000'), 1::bigint, 'a rate arrived while there are gaps: the retry marker is queued');
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table), 0::bigint, 'the worker closed the gaps');
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb' AND "rowMovementKind" = 'used'), 20000::numeric, 'ZZZ 10 000 at 0.5 ZZZ per EUR = 20 000 EUR');
SELECT tt.eq((SELECT o."rowJSON"->>'consolidationState' FROM public."organizationTable" o WHERE o."rowGUID" = :'org'), 'ready', 'the state is ready again');
-- a rate that changes later does NOT move a posted sum (decision Q3)
UPDATE public."currencyExchangeRateTable" SET "rowJSON" = "rowJSON" || '{"currencyRatio": 0.25}' WHERE "rowOwnerGUID" = :'c_chf';
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb' AND "rowMovementKind" = 'used'), 20000::numeric, 'a changed rate does not move a posted sum');
DELETE FROM public."currencyExchangeRateTable" WHERE "rowOwnerGUID" = :'c_chf';
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "USD"}' WHERE "rowGUID" = :'pb';
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb' AND "rowMovementKind" = 'used'), 8000::numeric, 'back to USD: the project is converted again by the worker');
-- a project with no budget currency
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'currencyForBudget' WHERE "rowGUID" = :'pb';
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table WHERE "reason" = 'noBudgetCurrency'), 2::bigint, 'no budget currency: a gap of its own kind');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "USD"}' WHERE "rowGUID" = :'pb';
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT count(*) FROM public.consolidation_gap_table), 0::bigint, 'the currency was given again: no gap');

-- 9. Q1: the budget / accounting currency of a project with posted documents is not changed by a user ---------------------------------------------------------------------------------
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForAccounting": "EUR"}' WHERE "rowGUID" = :'pa';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "EUR"}' WHERE "rowGUID" = %L$q$, :'pb'), 'posted documents', 'the budget currency of B is refused (it has posted documents)');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForAccounting": "USD"}' WHERE "rowGUID" = %L$q$, :'pa'), 'posted documents', 'the accounting currency too (used 1)');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForContract": "GBP"}' WHERE "rowGUID" = :'pb';
SELECT tt.eq((SELECT "rowJSON"->>'currencyForContract' FROM public.project_table WHERE "rowGUID" = :'pb'), 'GBP', 'the default currency for contracts is always free');
SELECT tt.as_admin();
DELETE FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "GBP"}' WHERE "rowGUID" = :'pb';
SELECT tt.eq((SELECT "rowJSON"->>'currencyForBudget' FROM public.project_table WHERE "rowGUID" = :'pb'), 'GBP', 'with no posted document (only a plan) a user changes it');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForBudget": "USD"}' WHERE "rowGUID" = :'pb';
SELECT tt.as_admin();

-- 10. the status and the refresh the screen calls -----------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT (public.consolidation_status()->>'currency') || (public.consolidation_status()->>'state')), 'EURrecalculating', 'status: the project currency change of step 9 is still queued');
SELECT public.consolidation_refresh_now();
SELECT tt.eq((SELECT (public.consolidation_status()->>'currency') || (public.consolidation_status()->>'state')), 'EURready', 'refresh now (no pg_cron needed): the queue is worked off, the state is ready');
SELECT tt.eq((SELECT (public.consolidation_status()->>'queued')::integer), 0, 'refresh now: nothing queued');
SELECT tt.as_admin();

-- 11. the other three movement tables (the foreign keys to the documents are dropped inside this rolled back transaction, so the rows can be written directly) ----------------------------------
INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "qtyProjectStatus", "sumForBudget") VALUES
  ('used', '2030-11-10 10:00+00', '2030-11-10', gen_random_uuid(), 'x', :'pb', :'tb', 'materialGenus', 1, 10000);
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.conname, c.conrelid::regclass AS tbl FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid IN ('public.cash_account_ledger_movements'::regclass, 'public.partner_balance_movements'::regclass, 'public.task_payment_plan_movements'::regclass) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
INSERT INTO public.cash_account_ledger_movements ("rowGUID", "rowOrganizationGUID", "rowHeaderGUID", "rowLineGUID", "rowProjectGUID", "rowOwnerGUID", "moneyAccount", "periodDay", "paymentDirection", "sumForContract", "sumForBudget")
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', :'org', gen_random_uuid(), gen_random_uuid(), :'pb', :'tb', 'ma', '2030-11-10', 'outbound', -1000, -1000);
INSERT INTO public.partner_balance_movements ("rowGUID", "rowOrganizationGUID", "registratorGUID", "registratorKind", "registratorLineGUID", "partnerBalanceOperationType", "balanceRole", "periodDay", "balancePartner", "projectGUID", "sumForContract", "sumForBudget")
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', :'org', gen_random_uuid(), 'vendorInvoice', gen_random_uuid(), 'vendorCredit', 'vendor', '2030-11-10', 'p1', :'pb', -500, -500);
INSERT INTO public.task_payment_plan_movements ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "periodDay", "paymentDirection", "sumForContract", "sumForBudget")
VALUES ('aaaaaaaa-0000-0000-0000-000000000003', :'pb', :'tb', gen_random_uuid(), '2030-11-10', 'outbound', 250, 250);
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.cash_account_ledger_movements), -800::numeric, 'cash ledger: -1 000 USD = -800 EUR (WITH VAT, outside the VAT switches)');
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.partner_balance_movements), -400::numeric, 'partner balance: -500 USD = -400 EUR (apply passes the "a row is never changed" guard)');
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.task_payment_plan_movements), 200::numeric, 'payment plan: 250 USD = 200 EUR');
SELECT tt.fails($q$UPDATE public.partner_balance_movements SET "sumForBudget" = 1$q$, 'never changed', 'a direct update of the partner register stays refused');
UPDATE public.cash_account_ledger_movements SET "sumForBudget" = -2000;
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.cash_account_ledger_movements), -1600::numeric, 'the cash ledger is recalculated by UPDATE (a rate change): the twin follows a changed budget sum');
UPDATE public.cash_account_ledger_movements SET "paymentDirection" = 'outbound';
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.cash_account_ledger_movements), -1600::numeric, 'an update that leaves the budget sum alone leaves the twin alone');

-- 12. verify: nothing wrong; a damaged twin is found and the queue repairs it -----------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT sum(v.o_wrong) FROM public.consolidation_verify(:'org') v), 0::numeric, 'verify: 0 rows wrong');
SELECT tt.eq((SELECT sum(v.o_rows) FROM public.consolidation_verify(:'org') v), 5::numeric, '... over 5 rows (2 of the register + cash + partner + payment plan)');
UPDATE public.project_status_movements SET "sumForConsolidation" = 1 WHERE "rowProjectGUID" = :'pb';
SELECT tt.eq((SELECT sum(v.o_wrong) FROM public.consolidation_verify(:'org') v), 1::numeric, 'a damaged twin is found');
SELECT public.consolidation_queue_project(:'pb', 'test');
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT sum(v.o_wrong) FROM public.consolidation_verify(:'org') v), 0::numeric, 'the worker repaired it');

-- 13. the currency of the organization changes again: every twin follows (EUR -> USD) ------------------------------------------------------------------------------------------------------------
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"currencyForConsolidation": "USD"}' WHERE "rowGUID" = :'org';
SELECT public.consolidation_process_dirty();
SELECT tt.eq((SELECT "sumForConsolidation" FROM public.project_status_movements WHERE "rowProjectGUID" = :'pa'), 6250::numeric, 'A: 5 000 EUR = 6 250 USD');
SELECT tt.eq((SELECT sum("sumForConsolidation") FROM public.project_status_movements WHERE "rowProjectGUID" = :'pb'), 10000::numeric, 'B: USD = USD, no conversion');
SELECT tt.eq((SELECT sum(v.o_wrong) FROM public.consolidation_verify(:'org') v), 0::numeric, 'verify: 0 wrong');

-- 14. the twin exists in the movement tables and NOWHERE else (no document, no task line, no form) --------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT string_agg(DISTINCT c.table_name, ',' ORDER BY c.table_name) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.column_name ILIKE '%consolidation%'),
             'cash_account_ledger_movements,partner_balance_movements,project_status_movements,task_payment_plan_movements', 'only the four movement tables have a consolidation column');

ROLLBACK;
