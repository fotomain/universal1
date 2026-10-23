-- PART 38: the PAYMENT FACT (documentation/PAYMENTS_FACT_WBS.html): ONE bank transaction (project_payment_fact_header + _lines), "get from plan" (the POSTED payment plan, PART 37), Post -> cash_account_ledger_movements,
-- the rests of a money account (cash_account_ledger_rests), the recalculation when an exchange rate changes (trigger -> queue -> worker), the money account catalog, RLS.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS t3, t."projectGUID" AS p1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t4 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowGUID" <> :'t3' AND COALESCE(t."rowJSON"->>'rowKind', 'task') = 'task' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT t."rowGUID" AS t_marko FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi_out FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'outboundPaymentGenus' ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi_in  FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'inboundPaymentGenus'  ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi_time FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'timeGenus' ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT "rowGUID" AS c_eur FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'EUR' \gset
SELECT "rowGUID" AS c_usd FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'USD' \gset
SELECT "rowGUID" AS c_gbp FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'GBP' \gset
SELECT tt.eq(:'bi_out' <> '' AND :'bi_in' <> '' AND :'bi_time' <> '', true, 'the seeds have an outbound payment item, an inbound payment item and a Time item');

-- the catalogs the payments need: a legal entity, partners (a supplier with TWO contracts, another supplier, a customer), a person, contracts
INSERT INTO public."legalEntityTable" ("rowGUID", "rowJSON") VALUES ('le1', '{"title":"Acme Ltd"}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('pt1', '{"partnerTitle":"Supplier One"}'), ('pt2', '{"partnerTitle":"Supplier Two"}'), ('pt3', '{"partnerTitle":"Customer Three"}');
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('pe1', '{"personFirstName":"Pat","personLastName":"Lee"}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('c1', 'pt1', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-1', 'paymentBudgetItemOutbound', :'bi_out')),
  ('c2', 'pt1', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-2')),
  ('c3', 'pt2', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-3')),
  ('c4', 'pt3', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-4', 'paymentBudgetItemInbound', :'bi_in')),
  ('c5', 'pt1', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'USD', 'contractNumber', 'C-5'));

-- rates far in the future (the seeded ECB rates stop in the past): EUR is the base. Default: USD 1.25, GBP 0.8. Budget: USD 1.2
CREATE OR REPLACE FUNCTION tt.rate(p_owner text, p_day text, p_ratio numeric, p_type text DEFAULT 'Default') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON")
  VALUES (p_owner, CASE WHEN p_type = 'Default' THEN p_day ELSE p_day || '|' || p_type END, jsonb_build_object('startingDate', p_day, 'currencyRatio', p_ratio, 'rateType', p_type));
END $$;
SELECT tt.rate(:'c_usd', '2030-01-01', 1.25);
SELECT tt.rate(:'c_gbp', '2030-01-01', 0.8);
SELECT tt.rate(:'c_usd', '2030-01-01', 1.2, 'Budget');

-- the payment plan of the task: three OUTBOUND payments (pt1/c1 100, pt1/c2 200, pt2/c3 50), one INBOUND (pt3/c4 500), one that stays a draft; the project has no currency yet
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'currencyForAccounting' - 'currencyForBudget' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.task_payment_plan_lines ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', :'t3', 'outbound', jsonb_build_object('paymentPlanBudgetItem', :'bi_out', 'paymentPlanPartner', 'pt1', 'paymentPlanContract', 'c1', 'paymentPlanCurrency', 'EUR', 'paymentPlanBusinessUnit', 'bu1',
     'paymentPlanTimelineAnchor', 'taskStart', 'paymentPlanTimelineShiftDays', 4, 'paymentPlannedTransactionDate', '2030-01-05', 'sumForContract', 100, 'paymentPlanPaymentDirection', 'outbound')),
  ('aaaaaaaa-0000-0000-0000-000000000002', :'t3', 'outbound', jsonb_build_object('paymentPlanBudgetItem', :'bi_out', 'paymentPlanPartner', 'pt1', 'paymentPlanContract', 'c2', 'paymentPlanCurrency', 'EUR',
     'paymentPlanTimelineAnchor', 'taskStart', 'paymentPlanTimelineShiftDays', 4, 'paymentPlannedTransactionDate', '2030-01-05', 'sumForContract', 200, 'paymentPlanPaymentDirection', 'outbound')),
  ('aaaaaaaa-0000-0000-0000-000000000003', :'t3', 'outbound', jsonb_build_object('paymentPlanBudgetItem', :'bi_out', 'paymentPlanPartner', 'pt2', 'paymentPlanContract', 'c3', 'paymentPlanCurrency', 'EUR',
     'paymentPlanTimelineAnchor', 'taskStart', 'paymentPlanTimelineShiftDays', 3, 'paymentPlannedTransactionDate', '2030-01-04', 'sumForContract', 50, 'paymentPlanPaymentDirection', 'outbound')),
  ('aaaaaaaa-0000-0000-0000-000000000004', :'t3', 'inbound', jsonb_build_object('paymentPlanBudgetItem', :'bi_in', 'paymentPlanPartner', 'pt3', 'paymentPlanContract', 'c4', 'paymentPlanCurrency', 'EUR',
     'paymentPlanTimelineAnchor', 'taskEnd', 'paymentPlanTimelineShiftDays', 0, 'paymentPlannedTransactionDate', '2030-01-07', 'sumForContract', 500, 'paymentPlanPaymentDirection', 'inbound'));
SELECT tt.eq(public.post_task_payment_plan(:'t3', '2030-01-01', '2030-01-31')->>'status', 'posted', 'the payment plan of the task is posted');
INSERT INTO public.task_payment_plan_lines ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000005', :'t3', 'outbound', jsonb_build_object('paymentPlanBudgetItem', :'bi_out', 'paymentPlanPartner', 'pt1', 'paymentPlanContract', 'c1', 'paymentPlanCurrency', 'EUR', 'sumForContract', 70, 'paymentPlanPaymentDirection', 'outbound'));

-- 1. the money account catalog -------------------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO public."moneyAccountTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES
  ('ma-eur', 'le1', '{"moneyAccountTitle":"Bank EUR","moneyAccountKind":"bank","moneyAccountCurrency":"EUR","moneyAccountOpeningDate":"2030-01-02","moneyAccountOpeningBalance":1000}'),
  ('ma-usd', 'le1', '{"moneyAccountTitle":"Bank USD","moneyAccountKind":"bank","moneyAccountCurrency":"USD"}'),
  ('ma-none', 'empty', '{"moneyAccountTitle":"No currency yet","moneyAccountKind":"cash"}');
SELECT tt.fails($f$INSERT INTO public."moneyAccountTable" ("rowParentGUID", "rowJSON") VALUES ('no-such-entity', '{}')$f$, 'not a legal entity', 'the folder of a money account is a legal entity (or empty)');
SELECT tt.fails($f$INSERT INTO public."moneyAccountTable" ("rowJSON") VALUES ('{"moneyAccountKind":"piggy"}')$f$, 'money_account_kind_chk', 'the kind is bank or cash');
SELECT tt.fails($f$INSERT INTO public."moneyAccountTable" ("rowJSON") VALUES ('{"moneyAccountCurrency":"EURO"}')$f$, 'money_account_currency_chk', 'the currency is an ISO code');
SELECT tt.fails($f$INSERT INTO public."moneyAccountTable" ("rowJSON") VALUES ('{"moneyAccountOpeningBalance":"lots"}')$f$, 'must be a number', 'the opening balance is a number');

-- 2. a payment fact from the plan ------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.payment_fact_create(:'t3', 'outbound', ARRAY['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[]) AS da \gset
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentStatus' FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'draft', 'a new payment fact is a draft');
SELECT tt.eq(left((SELECT "rowJSON"->'documentHeader'->>'documentNumber' FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 3), 'PF-', '... with the number PF-nnnnn');
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactPartner' || ':' || ("rowJSON"->>'paymentFactDirection') FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'pt1:outbound', 'the payee and the direction come from the first plan payment');
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_lines WHERE "rowHeaderGUID" = :'da'), 2::bigint, 'one line per plan payment (the RULE: one bank transaction, two contracts of the payee)');
SELECT tt.eq((SELECT string_agg(l."rowJSON"->>'paymentFactContract' || '=' || (l."rowJSON"->>'sumForContract'), ',' ORDER BY l."orderInList") FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'da'), 'c1=100.00,c2=200.00', '... the contract and the open sum are copied');
SELECT tt.eq((SELECT l."rowJSON"->>'paymentFactBudgetItem' || ':' || COALESCE(l."rowJSON"->>'paymentFactBusinessUnit', '-') FROM public.project_payment_fact_lines l WHERE l."paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), :'bi_out' || ':bu1', '... with the budget item and the business unit of the payment');
SELECT tt.eq((SELECT l."rowProjectGUID" FROM public.project_payment_fact_lines l WHERE l."paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), :'p1'::uuid, '... and the project of the task');
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactDate' FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD'), 'the date starts as today');

-- candidates: only POSTED plan payments with something open, of the payee and direction of the document
SELECT tt.eq((SELECT jsonb_array_length(public.payment_fact_plan_candidates(NULL, '{"direction":"outbound"}')->'rows')), 3, 'without a document: the three posted outbound payments (the draft payment is not offered)');
SELECT tt.eq((SELECT jsonb_array_length(public.payment_fact_plan_candidates(:'da', '{}')->'rows')), 0, 'for the document: nothing is open (both payments of pt1 are on it; pt2 is another payee)');
SELECT public.payment_fact_add_from_plan(:'da', ARRAY['aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001']::uuid[]) AS r \gset
SELECT tt.eq(:'r'::jsonb->>'added', '0', 'a payment of another payee / direction / a draft payment / one already on the document adds no line');
SELECT tt.eq((SELECT string_agg(s->>'reason', ',' ORDER BY s->>'planLineGUID') FROM jsonb_array_elements(:'r'::jsonb->'skipped') s), 'nothingOpen,wrongPayee,wrongDirection,planPaymentNotPosted', '... and says why for each');

-- the guards of a line
SELECT tt.fails(format($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c3"}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$), 'not a contract of the payee', 'the contract of another payee is refused');
SELECT tt.fails(format($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || jsonb_build_object('paymentFactBudgetItem', %L) WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, :'bi_in'), 'payment genus', 'a budget item of the other direction is refused');
SELECT tt.fails(format($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || jsonb_build_object('paymentFactBudgetItem', %L) WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, :'bi_time'), 'payment genus', 'a cost budget item is refused');
SELECT tt.fails($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactCurrency":"USD"}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, 'keeps its currency', 'a line of a plan payment keeps the currency of the payment');
SELECT tt.fails($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForContract":-1}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, 'payment_fact_lines_sum_chk', 'the sum is not negative');
SELECT tt.fails($f$UPDATE public.project_payment_fact_lines SET "paymentPlanLineGUID" = NULL WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, 'cannot be changed', 'the plan payment of a line cannot be changed');
SELECT tt.fails(format($f$UPDATE public.project_payment_fact_lines SET "rowOwnerGUID" = %L WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, :'t4'), 'cannot be changed here', 'the task of a line cannot be changed by an update');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"paymentFactPartner":"pt2"}')$f$, :'da'), 'delete the lines', 'the payee cannot change while the document has lines');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"paymentFactDirection":"inbound"}')$f$, :'da'), 'delete the lines', '... nor the direction');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"paymentFactDate":"05.01.2030"}')$f$, :'da'), 'YYYY-MM-DD', 'the date is YYYY-MM-DD');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"moneyAccountFact":"nope"}')$f$, :'da'), 'does not exist', 'the money account must exist');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"paymentFactBankAmount":-5}')$f$, :'da'), 'not negative', 'the bank amount is not negative');

-- 3. the header: number, date, account -> the converted sums of the lines follow ---------------------------------------------------------------------------------------------
SELECT public.payment_fact_set_header(:'da', '{"paymentFactNumber":"BANK-1","paymentFactDate":"2030-01-05","moneyAccountFact":"ma-eur"}');
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactFolder' || '|' || ("rowJSON"->>'paymentFactCurrency') FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'ma-eur:pt1|EUR', 'the folder (account:payee) and the currency (of the account) are derived');
SELECT tt.eq((SELECT sum((l."rowJSON"->>'sumForMoneyAccount')::numeric) FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'da'), 300::numeric, 'the account is in EUR like the contracts: the amount of the account = the sum (300)');
SELECT tt.eq((SELECT bool_and(l."rowJSON"->>'moneyAccountSumSource' = 'auto') FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'da'), true, '... converted, not typed');
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'da' AND jsonb_typeof(l."rowJSON"->'sumForAccounting') = 'number'), 0::bigint, 'the project has no accounting currency yet: no accounting sum');

SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForAccounting":"EUR","currencyForBudget":"USD"}' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
-- the date written again: the lines are converted again (the project got its currencies)
SELECT public.payment_fact_set_header(:'da', '{"paymentFactDate":"2030-01-06"}');
SELECT public.payment_fact_set_header(:'da', '{"paymentFactDate":"2030-01-05"}');
SELECT tt.eq((SELECT string_agg((l."rowJSON"->>'sumForAccounting') || '/' || (l."rowJSON"->>'sumForBudget'), ',' ORDER BY l."orderInList") FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'da'), '100.00/120.00,200.00/240.00'::text, 'sums: accounting EUR 1:1, budget USD at the Budget rate 1.2 of the date');
-- a sum edit is converted again; the amount of the account follows (auto)
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForContract":150}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT l."rowJSON"->>'sumForAccounting' || '/' || (l."rowJSON"->>'sumForBudget') || '/' || (l."rowJSON"->>'sumForMoneyAccount') FROM public.project_payment_fact_lines l WHERE l."paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), '150.00/180.00/150.00', 'a new sum is converted again (accounting / budget / account)');
-- the bank amount TYPED: it stays when the sum changes; cleared it is converted again
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForMoneyAccount":149.5}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT l."rowJSON"->>'moneyAccountSumSource' || ':' || (l."rowJSON"->>'sumForMoneyAccount') FROM public.project_payment_fact_lines l WHERE l."paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'typed:149.5', 'a typed amount of the account is marked typed');
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForContract":160}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT l."rowJSON"->>'moneyAccountSumSource' || ':' || (l."rowJSON"->>'sumForMoneyAccount') FROM public.project_payment_fact_lines l WHERE l."paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'typed:149.5', '... and stays when the sum changes');
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForMoneyAccount":null,"sumForContract":150}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT l."rowJSON"->>'moneyAccountSumSource' || ':' || (l."rowJSON"->>'sumForMoneyAccount') FROM public.project_payment_fact_lines l WHERE l."paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'auto:150.00', '... cleared it is converted again');
-- a rate that is missing leaves the sum empty and says why (Post refuses)
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactBusinessUnit":"bu1"}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000002';

-- an unplanned line (no plan payment) on the second task, with the contract of the payee: the contract gives its currency and its budget item
SELECT public.payment_fact_add_line(:'da', :'t4') AS lind \gset
SELECT tt.eq((SELECT "paymentPlanLineGUID" IS NULL AND "rowOwnerGUID" = :'t4'::uuid FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lind'), true, 'an independent line has no plan payment and the task I gave');
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c1","sumForContract":10}' WHERE "rowGUID" = :'lind';
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactCurrency' || ':' || ("rowJSON"->>'paymentFactBudgetItem') FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lind'), 'EUR:' || :'bi_out', 'the contract gives its currency and its budget item to a line that has none');
SELECT public.payment_fact_set_line_task(:'lind', :'t3');
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lind'), :'t3'::uuid, 'the task of an independent line can be changed (by the RPC)');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_line_task(%L, %L)$f$, (SELECT "rowGUID" FROM public.project_payment_fact_lines WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), :'t4'), 'stays with the task', 'a line of a plan payment keeps its task');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_line_task(%L, %L)$f$, :'lind', :'t_marko'), 'not your project', 'a task of another user is refused');
SELECT public.payment_fact_add_line(:'da') AS lind2 \gset
DELETE FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lind2';
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_lines WHERE "rowHeaderGUID" = :'da'), 3::bigint, 'a draft line can be deleted (the document now has 3 lines)');

-- 4. Post refuses an incomplete document: ALL OR NOTHING, with the list -------------------------------------------------------------------------------------------------------
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS dempty \gset
SELECT public.post_payment_fact(:'dempty') AS r \gset
SELECT tt.eq((SELECT string_agg(p->>'problem', ',' ORDER BY p->>'problem') FROM jsonb_array_elements(:'r'::jsonb->'problems') p), 'documentHasNoLines,moneyAccountMissing,payeeMissing,paymentFactNumberMissing', 'an empty document: no lines, no number, no money account, no payee');
SELECT public.payment_fact_set_header(:'da', '{"paymentFactNumber":""}');
SELECT public.payment_fact_set_header(:'da', '{"moneyAccountFact":"ma-none"}');
SELECT public.post_payment_fact(:'da') AS r \gset
SELECT tt.eq((SELECT string_agg(DISTINCT p->>'problem', ',' ORDER BY p->>'problem') FROM jsonb_array_elements(:'r'::jsonb->'problems') p), 'accountCurrencyMissing,paymentFactNumberMissing,sumForMoneyAccountMissing', 'no number, an account without a currency, no amount of the account: all listed');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements), 0::bigint, 'nothing was written');
SELECT public.payment_fact_set_header(:'da', '{"paymentFactNumber":"BANK-1","moneyAccountFact":"ma-eur","paymentFactDate":"2030-01-01"}');
SELECT public.post_payment_fact(:'da') AS r \gset
SELECT tt.eq((SELECT string_agg(p->>'problem', ',') FROM jsonb_array_elements(:'r'::jsonb->'problems') p), 'dateBeforeOpening', 'a date before the opening date of the account is refused');
SELECT public.payment_fact_set_header(:'da', '{"paymentFactDate":"2030-01-05"}');
-- a line of the document without a rate: the sum stays empty, the line says why, Post refuses (a currency with no rate at all)
SELECT public.payment_fact_add_line(:'da') AS lnorate \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c5","sumForContract":5}' WHERE "rowGUID" = :'lnorate';
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactCurrency' FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lnorate'), 'USD', 'the contract c5 is in USD');
SELECT tt.eq((SELECT "rowJSON"->>'sumForAccounting' || '/' || ("rowJSON"->>'sumForBudget') FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lnorate'), '4.00/5.00', 'USD -> EUR at 1/1.25 and USD -> USD (the same currency) 1:1');
DELETE FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lnorate';

-- 5. Post -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.post_payment_fact(:'da')->>'status', 'posted', 'the payment fact is posted (3 lines: 150 + 200 + 10 EUR)');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'da'), 3::bigint, 'one movement per line');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'da'), -360::numeric, 'an OUTBOUND payment has negative sums');
SELECT tt.eq((SELECT string_agg(DISTINCT "moneyAccount" || ':' || "periodDay" || ':' || "paymentDirection" || ':' || "partner", ',') FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'da'), 'ma-eur:2030-01-05:outbound:pt1', '... on the account and the date of the document, with the payee');
SELECT tt.eq((SELECT sum("sumForBudget") || '/' || min("currencyForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'da'), '-432.00/USD', 'the budget sum is in USD (360 x 1.2)');
SELECT tt.eq((SELECT "rest" FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-eur' AND "sumKind" = 'account' AND "currency" = 'EUR' AND "periodDay" = '2030-01-05'), 640.00::numeric, 'the rest of the account: opening 1000 - 360 = 640');
SELECT tt.eq((SELECT "rest" FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-eur' AND "sumKind" = 'budget' AND "currency" = 'USD' AND "periodDay" = '2030-01-05'), -432.00::numeric, '... the rest in the budget currency starts from 0');
SELECT tt.eq(public.post_payment_fact(:'da')->>'status', 'refused', 'a posted document cannot be posted again');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'da'), 3::bigint, '... and keeps its movements');

-- a posted document is read only
SELECT tt.eq(tt.rows_of($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForContract":1}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$), 0::bigint, 'a line of a posted document cannot be changed (policy)');
SELECT tt.as_admin();
SELECT tt.fails($f$UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForContract":1}' WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, 'posted', '... and not even by the owner of the database (trigger)');
SELECT tt.fails($f$DELETE FROM public.project_payment_fact_lines WHERE "paymentPlanLineGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'$f$, 'unpost it first', '... nor deleted (trigger)');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(tt.rows_of(format($f$DELETE FROM public.project_payment_fact_lines WHERE "rowHeaderGUID" = %L$f$, :'da')), 0::bigint, 'a line of a posted document cannot be deleted (policy)');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"paymentFactNumber":"X"}')$f$, :'da'), 'posted', 'the header of a posted document cannot be changed');
SELECT tt.fails(format($f$SELECT public.delete_payment_fact(%L)$f$, :'da'), 'posted', 'a posted document cannot be deleted');
SELECT tt.fails(format($f$SELECT public.payment_fact_add_line(%L)$f$, :'da'), 'posted', 'a posted document gets no new line');
SELECT tt.as_admin();
SELECT tt.fails($f$UPDATE public."moneyAccountTable" SET "rowJSON" = "rowJSON" || '{"moneyAccountCurrency":"USD"}' WHERE "rowGUID" = 'ma-eur'$f$, 'cannot change', 'the currency of an account with movements cannot change');
SELECT tt.fails($f$UPDATE public."moneyAccountTable" SET "rowJSON" = "rowJSON" || '{"moneyAccountOpeningBalance":5}' WHERE "rowGUID" = 'ma-eur'$f$, 'cannot change', '... nor its opening balance');
SELECT tt.fails($f$DELETE FROM public."moneyAccountTable" WHERE "rowGUID" = 'ma-eur'$f$, 'used by a payment fact', 'an account that a document uses is not deleted');
SELECT tt.fails(format($f$DELETE FROM public.project_task_table WHERE "rowGUID" = %L$f$, :'t3'), 'unpost it first', 'a task with a posted payment fact is not deleted');
UPDATE public."moneyAccountTable" SET "rowJSON" = "rowJSON" || '{"isActive":false,"moneyAccountTitle":"Bank EUR (main)"}' WHERE "rowGUID" = 'ma-eur';
SELECT tt.eq((SELECT count(*) FROM public."moneyAccountTable" WHERE "rowJSON"->>'isActive' = 'false'), 1::bigint, 'the title and the active flag of an account with movements can change');

-- 6. what is open / paid on the plan ------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.payment_fact_plan_open('aaaaaaaa-0000-0000-0000-000000000001'), -50::numeric, 'plan payment 1: 100 planned, 150 paid = -50 open (paying more than planned is allowed)');
SELECT tt.eq(public.payment_fact_plan_open('aaaaaaaa-0000-0000-0000-000000000002'), 0::numeric, 'plan payment 2: 200 planned, 200 paid = 0 open');
SELECT tt.eq((SELECT jsonb_array_length(public.payment_fact_plan_candidates(NULL, '{"direction":"outbound"}')->'rows')), 1, 'the candidates: only plan payment 3 (50) has something open');
SELECT tt.eq((SELECT (x->>'paid') || '/' || (x->>'open') FROM jsonb_array_elements(public.task_payment_paid(:'t3')) x WHERE x->>'planLineGUID' = 'aaaaaaaa-0000-0000-0000-000000000002'), '200.00/0.00', 'task_payment_paid: paid and open per plan payment');
SELECT tt.eq((SELECT (x->>'paid') || '/' || (x->>'open') FROM jsonb_array_elements(public.task_payment_paid(:'t3')) x WHERE x->>'planLineGUID' = 'aaaaaaaa-0000-0000-0000-000000000004'), '0.00/500.00', '... an unpaid payment: 0 paid, 500 open');

-- 7. the second document: INBOUND on 2030-01-07, and a BACK-DATED one on 2030-01-04 -> the rests are re-rolled -------------------------------------------------------------------
SELECT public.payment_fact_create(:'t3', 'inbound', ARRAY['aaaaaaaa-0000-0000-0000-000000000004']::uuid[]) AS db \gset
SELECT public.payment_fact_set_header(:'db', '{"paymentFactNumber":"BANK-2","paymentFactDate":"2030-01-07","moneyAccountFact":"ma-eur"}');
SELECT tt.eq(public.post_payment_fact(:'db')->>'status', 'posted', 'an INBOUND payment fact is posted');
SELECT tt.eq((SELECT "sumForContract" FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'db'), 500.00::numeric, '... with positive sums');
SELECT tt.eq((SELECT "rest" FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-eur' AND "sumKind" = 'account' AND "periodDay" = '2030-01-07'), 1140.00::numeric, 'the rest after the second day: 640 + 500 = 1140');
SELECT public.payment_fact_create(:'t3', 'outbound', ARRAY['aaaaaaaa-0000-0000-0000-000000000003']::uuid[]) AS dc \gset
SELECT public.payment_fact_set_header(:'dc', '{"paymentFactNumber":"BANK-3","paymentFactDate":"2030-01-04","moneyAccountFact":"ma-eur"}');
SELECT tt.eq(public.post_payment_fact(:'dc')->>'status', 'posted', 'a back-dated payment fact (2030-01-04, 50 out) is posted');
SELECT tt.eq((SELECT string_agg("periodDay" || '=' || "rest", ',' ORDER BY "periodDay") FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-eur' AND "sumKind" = 'account'), '2030-01-04=950.00,2030-01-05=590.00,2030-01-07=1090.00', 'the rests of the later days were re-rolled (1000-50, -360, +500)');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.cash_ledger_verify('' || (SELECT "rowOrganizationGUID" FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'ma-eur')), 0::bigint, 'cash_ledger_verify: the stored rests are the ones the movements give');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.unpost_payment_fact(:'dc')->>'status', 'draft', 'unpost the back-dated document');
SELECT tt.eq((SELECT string_agg("periodDay" || '=' || "rest", ',' ORDER BY "periodDay") FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-eur' AND "sumKind" = 'account'), '2030-01-05=640.00,2030-01-07=1140.00', '... its movements and its day are gone, the rests are as before');
SELECT tt.eq(public.post_payment_fact(:'dc')->>'status', 'posted', 'post it again');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements), 5::bigint, 'Post, Unpost, Post gives the same rows (3 + 1 + 1)');

-- 8. the money account in ANOTHER currency: the amount is converted at the Default rate of the date (100 EUR = 125 USD) --------------------------------------------------------------
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS du \gset
SELECT public.payment_fact_set_header(:'du', jsonb_build_object('paymentFactNumber', 'BANK-4', 'paymentFactDate', '2030-01-12', 'moneyAccountFact', 'ma-usd', 'paymentFactPartner', 'pt2'));
SELECT public.payment_fact_add_line(:'du') AS lu \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || jsonb_build_object('paymentFactContract', 'c3', 'paymentFactBudgetItem', :'bi_out', 'sumForContract', 100) WHERE "rowGUID" = :'lu';
SELECT tt.eq((SELECT "rowJSON"->>'sumForMoneyAccount' FROM public.project_payment_fact_lines WHERE "rowGUID" = :'lu'), '125.00', 'a USD account paid with a EUR contract: 100 EUR = 125.00 USD');
SELECT tt.eq(public.post_payment_fact(:'du')->>'status', 'posted', 'posted');
SELECT tt.eq((SELECT "rest" FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-usd' AND "sumKind" = 'account' AND "currency" = 'USD'), -125.00::numeric, 'the USD account has no opening balance: the rest is -125 USD');
SELECT tt.eq((SELECT string_agg("sumKind" || ':' || "currency" || '=' || "rest", ',' ORDER BY "sumKind", "currency") FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-usd'), 'account:USD=-125.00,accounting:EUR=-100.00,budget:USD=-120.00,contract:EUR=-100.00', 'the rests per sum kind and currency');

-- 9. the exchange rate CHANGES: [from, next rate) is recalculated, the rests are rebuilt, what the bank moved never changes -----------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_dirty), 0::bigint, 'the queue of rate changes is empty');
-- a typed amount that must survive every recalculation
UPDATE public.cash_account_ledger_movements SET "moneyAccountSumSource" = 'typed', "sumForMoneyAccount" = -124.00 WHERE "rowHeaderGUID" = :'du';
SELECT public.cash_ledger_rebuild((SELECT "rowOrganizationGUID" FROM public.project_payment_fact_header WHERE "rowGUID" = :'du'), 'ma-usd');
-- rate rows: USD Budget 1.5 from 2030-01-06 .. until a row on 2030-01-10 (1.9): the days 06..09 change (the doc of 01-07); 01-05 and 01-12 do not
SELECT tt.rate(:'c_usd', '2030-01-10', 1.9, 'Budget');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_dirty), 1::bigint, 'a new rate row of a currency a payment uses queues [its date, next rate)');
SELECT public.cash_ledger_process_dirty();
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'du'), -190.00::numeric, 'the movement of 2030-01-12 now uses the new Budget rate 1.9 (100 x 1.9)');
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'db'), 600.00::numeric, '... the one of 2030-01-07 still the old rate 1.2 (500 x 1.2)');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_dirty), 0::bigint, 'the worker emptied the queue');
SELECT tt.rate(:'c_usd', '2030-01-06', 1.5, 'Budget');
SELECT public.cash_ledger_process_dirty() AS n \gset
SELECT tt.eq(:'n'::integer, 1, 'a rate between two others recalculates only the days it rules (1 movement)');
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'db'), 750.00::numeric, '2030-01-07: 500 x 1.5 = 750');
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'da'), -432.00::numeric, '2030-01-05: unchanged (360 x 1.2)');
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'du'), -190.00::numeric, '2030-01-12: unchanged by the row of 01-06 (the row of 01-10 rules it)');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.cash_account_ledger_movements), -360::numeric + 500 - 50 - 100, 'the contract sums (what the bank moved) never change');
SELECT tt.eq((SELECT "sumForMoneyAccount" FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'du'), -124.00::numeric, 'a TYPED amount of the account survives the recalculation');
SELECT tt.eq((SELECT "rest" FROM public.cash_account_ledger_rests WHERE "moneyAccount" = 'ma-eur' AND "sumKind" = 'budget' AND "periodDay" = '2030-01-07'), 258.00::numeric, 'the budget rests of the account were rebuilt: -60 - 432 + 750 = 258');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements WHERE "recalculatedAt" IS NOT NULL), 2::bigint, 'the recalculated movements carry the time of the recalculation');
SELECT tt.eq((SELECT count(*) FROM public.cash_ledger_verify((SELECT "rowOrganizationGUID" FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'ma-eur')), 0::bigint, 'verify: nothing left to recalculate, the rests are right (EUR account)');
SELECT tt.eq((SELECT count(*) FROM public.cash_ledger_verify((SELECT "rowOrganizationGUID" FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'ma-usd')), 0::bigint, '... and the USD account');
-- a CHANGED ratio of an existing row, and a DELETED row
UPDATE public."currencyExchangeRateTable" SET "rowJSON" = "rowJSON" || '{"currencyRatio":2}' WHERE "rowOwnerGUID" = :'c_usd' AND "rowParentGUID" = '2030-01-06|Budget';
SELECT public.cash_ledger_process_dirty();
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'db'), 1000.00::numeric, 'a changed ratio is recalculated: 500 x 2');
DELETE FROM public."currencyExchangeRateTable" WHERE "rowOwnerGUID" = :'c_usd' AND "rowParentGUID" = '2030-01-06|Budget';
SELECT public.cash_ledger_process_dirty();
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'db'), 600.00::numeric, 'a deleted rate: the days go back to the rate before it (1.2)');
-- a rate of a currency no payment uses, and a rate in the future: nothing changes
SELECT tt.rate(:'c_gbp', '2030-01-06', 0.5);
SELECT public.cash_ledger_process_dirty() AS n \gset
SELECT tt.eq(:'n'::integer, 0, 'a rate of a currency no payment uses changes nothing');
SELECT tt.rate(:'c_usd', '2031-06-01', 3, 'Budget');
SELECT public.cash_ledger_process_dirty() AS n \gset
SELECT tt.eq(:'n'::integer, 0, 'a rate of a day after every payment changes nothing');
SELECT tt.eq((SELECT count(*) FROM public.cash_ledger_verify((SELECT "rowOrganizationGUID" FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'ma-eur')), 0::bigint, 'verify is clean again');
-- the signed-in user can run the worker (the button "Refresh rests")
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.cash_ledger_refresh_now()->>'queue', '0', 'cash_ledger_refresh_now answers with the queue length');

-- 10. the list ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.payment_fact_list('{}')->>'totalCount', '5', 'the list has the five documents');
SELECT tt.eq(public.payment_fact_list('{"status":"draft"}')->>'totalCount', '1', '... one is a draft (the empty one)');
SELECT tt.eq(public.payment_fact_list(jsonb_build_object('taskGUID', :'t3'))->>'totalCount', '5', 'the filter taskGUID: documents with a line of the task (and the empty draft made for it)');
SELECT tt.eq(public.payment_fact_list('{"planLineGUID":"aaaaaaaa-0000-0000-0000-000000000004"}')->>'totalCount', '1', 'the filter planLineGUID: the document that fulfils that plan payment');
SELECT tt.eq((SELECT (r->>'moneyAccountTitle') || '|' || (r->>'payeeTitle') || '|' || (r->>'direction') || '|' || (r->>'sumForMoneyAccount') || '|' || (r->>'lineCount')
                FROM jsonb_array_elements(public.payment_fact_list(jsonb_build_object('documentGUIDs', jsonb_build_array(:'da')))->'rows') r), 'Bank EUR (main)|Supplier One|outbound|360.00|3', 'a row of the list: account, payee, direction, the amount of the account, lines');
SELECT tt.eq((SELECT jsonb_array_length(public.payment_fact_list('{}')->'totalsByCurrency')), 3, 'the totals are per currency of the account (EUR, USD and the empty draft)');
SELECT tt.eq(public.payment_fact_list('{"fromDay":"2030-01-06","toDay":"2030-01-08"}')->>'totalCount', '1', 'fromDay / toDay filter the date of the document');

-- 11. who sees what -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_header), 0::bigint, 'another organization sees none of the documents');
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_lines), 0::bigint, '... none of the lines');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements) + (SELECT count(*) FROM public.cash_account_ledger_rests), 0::bigint, '... none of the movements and the rests');
SELECT tt.eq(public.payment_fact_list('{}')->>'totalCount', '0', '... the list is empty');
SELECT tt.fails(format($f$SELECT public.post_payment_fact(%L)$f$, :'dempty'), 'does not exist', 'another organization cannot post a document');
SELECT tt.fails(format($f$SELECT public.unpost_payment_fact(%L)$f$, :'da'), 'does not exist', '... or unpost it');
SELECT tt.fails(format($f$SELECT public.payment_fact_add_line(%L)$f$, :'dempty'), 'does not exist', '... or add a line');
SELECT tt.fails(format($f$SELECT public.task_payment_paid(%L)$f$, :'t3'), 'not yours', '... or read what its plan has paid');
SELECT tt.fails(format($f$SELECT public.payment_fact_create(%L, 'outbound', NULL)$f$, :'t3'), 'not your project', '... or make a document for a task that is not its');
SELECT tt.eq((SELECT jsonb_array_length(public.payment_fact_plan_candidates(NULL, '{}')->'rows')), 0, '... and is offered no plan payment');
SELECT tt.fails($f$INSERT INTO public.cash_account_ledger_movements ("rowOrganizationGUID", "rowHeaderGUID", "rowLineGUID", "rowProjectGUID", "rowOwnerGUID", "moneyAccount", "periodDay", "paymentDirection", "sumForContract")
  SELECT 'x', "rowGUID", gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'ma-eur', '2030-01-01', 'inbound', 1 FROM public.project_payment_fact_header$f$, 'permission denied', 'the client cannot write a movement');
SELECT tt.fails($f$INSERT INTO public.cash_account_ledger_rests VALUES ('x', 'ma-eur', 'budget', 'USD', '2030-01-01', 1, 1)$f$, 'permission denied', '... or a rest');
SELECT tt.fails($f$SELECT count(*) FROM public.cash_account_ledger_dirty$f$, 'permission denied', 'the queue is the database''s own');
SELECT tt.fails($f$SELECT public.cash_ledger_recalc('2030-01-01', NULL, NULL)$f$, 'permission denied', 'the recalculation cannot be called by the client');
SELECT tt.fails($f$INSERT INTO public.project_payment_fact_header ("rowOrganizationGUID", "rowJSON") VALUES ('x', '{}')$f$, 'permission denied', 'a document is made by the RPC only');

-- 12. a draft is deleted with its lines; unpost lets the task go ----------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.delete_payment_fact(:'dempty');
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_header WHERE "rowGUID" = :'dempty'), 0::bigint, 'a draft document is deleted');
SELECT public.payment_fact_create(:'t3', 'outbound', ARRAY['aaaaaaaa-0000-0000-0000-000000000005']::uuid[]) AS dx \gset
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_lines WHERE "rowHeaderGUID" = :'dx'), 0::bigint, 'a draft plan payment is not taken');
DELETE FROM public.project_payment_fact_header WHERE "rowGUID" = :'dx';
SELECT tt.eq(public.unpost_payment_fact(:'da')->>'status', 'draft', 'unpost the first document');
SELECT tt.eq(public.unpost_payment_fact(:'db')->>'status', 'draft', '... and the second');
SELECT tt.eq(public.unpost_payment_fact(:'dc')->>'status', 'draft', '... the third');
SELECT tt.eq(public.unpost_payment_fact(:'du')->>'status', 'draft', '... and the USD one');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements) + (SELECT count(*) FROM public.cash_account_ledger_rests), 0::bigint, 'no movement and no rest is left');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.cash_ledger_verify((SELECT "rowOrganizationGUID" FROM public.project_payment_fact_header WHERE "rowGUID" = :'da'), 'ma-eur')), 0::bigint, 'verify: empty');
-- 13. "Create based on -> Payment fact" of a POSTED vendor / customer invoice --------------------------------------------------------------------------------------------------------------
-- (the invoices are written straight into their tables, as the user anna: the header trigger takes her organization)
SELECT tt.as_admin();
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'anna@acme.test', 'sub', '11111111-1111-1111-1111-111111111111')::text, true);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
INSERT INTO public.vendor_invoice_header ("rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'le1', 'x', jsonb_build_object('vendorInvoicePartner', 'pt1', 'vendorInvoiceContract', 'c1', 'vendorInvoiceCurrency', 'EUR', 'vendorInvoiceNumber', 'VI-1', 'documentHeader', jsonb_build_object('documentNumber', 'VI-1', 'documentStatus', 'draft'))),
  ('eeeeeeee-0000-0000-0000-000000000002', 'le1', 'x', jsonb_build_object('vendorInvoicePartner', 'pt1', 'vendorInvoiceContract', 'c2', 'vendorInvoiceCurrency', 'EUR', 'vendorInvoiceNumber', 'VI-2', 'documentHeader', jsonb_build_object('documentNumber', 'VI-2', 'documentStatus', 'posted')));
INSERT INTO public.vendor_invoice_lines ("rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "orderInList", "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "rowJSON") VALUES
  ('eeeeeeee-1000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', :'p1', :'t3', 'materialGenus', 1, 2, 100, 10, '{}'),
  ('eeeeeeee-1000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', :'p1', :'t4', 'expenseGenus', 2, 1, 50, 10, '{"businessUnitTaskLine":"bu1"}'),
  ('eeeeeeee-1000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000002', :'p1', :'t3', 'materialGenus', 1, 1, 40, 0, '{}');
INSERT INTO public.customer_invoice_header ("rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES
  ('eeeeeeee-0000-0000-0000-0000000000c1', 'le1', 'x', jsonb_build_object('customerInvoicePartner', 'pt3', 'customerInvoiceContract', 'c4', 'customerInvoiceCurrency', 'EUR', 'customerInvoiceNumber', 'CI-1', 'documentHeader', jsonb_build_object('documentNumber', 'CI-1', 'documentStatus', 'posted')));
INSERT INTO public.customer_invoice_lines ("rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "orderInList", "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "rowJSON") VALUES
  ('eeeeeeee-1000-0000-0000-0000000000c1', 'eeeeeeee-0000-0000-0000-0000000000c1', :'p1', :'t3', 'revenueGenus', 1, 4, 100, 0, '{}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

SELECT tt.fails($f$SELECT public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000001')$f$, 'post the vendor invoice first', 'a DRAFT invoice cannot be paid');
SELECT tt.fails($f$SELECT public.create_payment_fact_from_vendor_invoice(gen_random_uuid())$f$, 'does not exist', 'an invoice that does not exist');
SELECT tt.fails($f$SELECT public.payment_fact_from_invoice('vendor', gen_random_uuid())$f$, 'permission denied', 'the internal function is not callable by the client (only the two create_payment_fact_from_… RPCs are)');
SELECT tt.as_admin();
UPDATE public.vendor_invoice_header SET "rowJSON" = jsonb_set("rowJSON", '{documentHeader,documentStatus}', '"posted"') WHERE "rowGUID" = 'eeeeeeee-0000-0000-0000-000000000001';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000001') AS r \gset
SELECT tt.eq(jsonb_array_length(:'r'::jsonb->'documents'), 1, 'a posted vendor invoice makes ONE draft payment fact');
SELECT (:'r'::jsonb->'documents'->0->>'documentGUID')::uuid AS dvi \gset
SELECT tt.eq(:'r'::jsonb->'documents'->0->>'lineCount', '2', '... with one line per invoice line');
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactPartner' || ':' || ("rowJSON"->>'paymentFactDirection') || ':' || ("rowJSON"->>'paymentFactInvoiceKind') FROM public.project_payment_fact_header WHERE "rowGUID" = :'dvi'), 'pt1:outbound:vendor', '... of the vendor of the invoice, OUTBOUND, and it remembers the invoice');
SELECT tt.eq((SELECT string_agg((l."rowJSON"->>'sumForContract') || '/' || (l."rowJSON"->>'paymentFactContract') || '/' || (l."rowJSON"->>'paymentFactCurrency'), ',' ORDER BY l."orderInList") FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'dvi'), '220.00/c1/EUR,55.00/c1/EUR', '... the sum of a line + its VAT, the contract and the currency of the invoice');
SELECT tt.eq((SELECT string_agg(DISTINCT l."rowJSON"->>'paymentFactBudgetItem', ',') FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'dvi'), :'bi_out', '... the budget item the CONTRACT names (paymentBudgetItemOutbound)');
SELECT tt.eq((SELECT string_agg(l."rowOwnerGUID"::text || ':' || COALESCE(l."rowJSON"->>'paymentFactBusinessUnit', '-'), ',' ORDER BY l."orderInList") FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'dvi'), :'t3' || ':-,' || :'t4' || ':bu1', '... the task and the business unit of each invoice line');
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactTask' FROM public.project_payment_fact_header WHERE "rowGUID" = :'dvi'), :'t3', '... made for the task of the first line');
SELECT tt.eq(public.payment_fact_invoice_open('vendor', 'eeeeeeee-1000-0000-0000-000000000001'), 220.00::numeric, 'nothing is paid yet: the whole line is open (a draft payment does not count)');
-- pay the first line only in part and post
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"sumForContract":100}' WHERE "rowHeaderGUID" = :'dvi' AND "orderInList" = 1;
DELETE FROM public.project_payment_fact_lines WHERE "rowHeaderGUID" = :'dvi' AND "orderInList" = 2;
SELECT public.payment_fact_set_header(:'dvi', '{"paymentFactNumber":"BANK-VI","paymentFactDate":"2030-01-08","moneyAccountFact":"ma-eur"}');
SELECT tt.eq(public.post_payment_fact(:'dvi')->>'status', 'posted', 'the payment fact made from the invoice is posted');
SELECT tt.eq(public.payment_fact_invoice_open('vendor', 'eeeeeeee-1000-0000-0000-000000000001'), 120.00::numeric, 'the line of the invoice has 120 left to pay');
SELECT public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000001') AS r2 \gset
SELECT tt.eq((SELECT string_agg(l."rowJSON"->>'sumForContract', ',' ORDER BY l."orderInList") FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = (:'r2'::jsonb->'documents'->0->>'documentGUID')::uuid), '120.00,55.00', 'a second payment fact takes what is left: 120 and the unpaid line 55');
-- the contract without a payment budget item takes the standard "Payments to vendors"
SELECT public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000002') AS r3 \gset
SELECT tt.eq((SELECT l."rowJSON"->>'paymentFactBudgetItem' FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = (:'r3'::jsonb->'documents'->0->>'documentGUID')::uuid), 'vendorPaymentsBudgetItem', 'a contract without a payment budget item: the standard item "Payments to vendors"');
-- a customer invoice comes IN
SELECT public.create_payment_fact_from_customer_invoice('eeeeeeee-0000-0000-0000-0000000000c1') AS r4 \gset
SELECT (:'r4'::jsonb->'documents'->0->>'documentGUID')::uuid AS dci \gset
SELECT tt.eq((SELECT "rowJSON"->>'paymentFactPartner' || ':' || ("rowJSON"->>'paymentFactDirection') || ':' || ("rowJSON"->>'paymentFactInvoiceKind') FROM public.project_payment_fact_header WHERE "rowGUID" = :'dci'), 'pt3:inbound:customer', 'a posted customer invoice makes an INBOUND payment fact of its customer');
SELECT tt.eq((SELECT (l."rowJSON"->>'sumForContract') || '/' || (l."rowJSON"->>'paymentFactBudgetItem') FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = :'dci'), '400.00/' || :'bi_in', '... 4 x 100 with the inbound budget item of the contract');
SELECT public.payment_fact_set_header(:'dci', '{"paymentFactNumber":"BANK-CI","paymentFactDate":"2030-01-09","moneyAccountFact":"ma-eur"}');
SELECT tt.eq(public.post_payment_fact(:'dci')->>'status', 'posted', 'the customer receipt is posted: the account gets +400');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'dci'), 400.00::numeric, '... a positive movement');
SELECT tt.eq(public.create_payment_fact_from_customer_invoice('eeeeeeee-0000-0000-0000-0000000000c1')->'skipped'->0->>'reason', 'nothingToPay', 'a customer invoice that is paid in full has nothing to pay: no document is made');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails($f$SELECT public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000001')$f$, 'does not exist', 'another organization cannot make a payment fact of my invoice');
SELECT tt.as_admin();

-- clean up: the documents made here leave no trace for the next sections
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_payment_fact(:'dvi');
SELECT public.unpost_payment_fact(:'dci');
DELETE FROM public.project_payment_fact_header WHERE "rowJSON"->>'paymentFactInvoiceKind' IS NOT NULL;
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements) + (SELECT count(*) FROM public.cash_account_ledger_rests), 0::bigint, 'no movement and no rest is left after the invoices');
SELECT tt.as_admin();
DELETE FROM public.project_task_table WHERE "rowGUID" = :'t3';
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_lines), 0::bigint, 'deleting the task deletes the lines of the draft documents');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public.project_payment_fact_header), 4::bigint, '... the (now empty) documents stay');

ROLLBACK;
