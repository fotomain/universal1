-- PART 36 (documentation/TIME_SHEET_WBS.html section 14): the cost of an hour in SQL - exchange rates, the hour price of a contract, the rate of a role, and Post with money per day.
-- The GOLDEN cases (the lines "-- golden <id> = <value>") are the same numbers as __tests__/documents/timesheet/timesheetCostGolden.test.ts checks against the TypeScript of the task lines.
BEGIN;
SELECT tt.as_admin();

-- the golden book: currencies (EUR is the base) and rates
INSERT INTO public."currencyTable" ("rowGUID", "rowJSON") VALUES
  ('c-zzz', '{"currencyCode":"ZZZ","decimalDigits":0,"isActive":true}'), ('c-yyy', '{"currencyCode":"YYY","decimalDigits":3,"isActive":true}'), ('c-xch', '{"currencyCode":"XCH","decimalDigits":2,"isActive":true}');
SELECT "rowGUID" AS c_eur FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'EUR' \gset
SELECT "rowGUID" AS c_usd FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'USD' \gset
SELECT "rowGUID" AS c_gbp FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'GBP' \gset
CREATE OR REPLACE FUNCTION tt.rate(p_owner text, p_day text, p_ratio numeric, p_type text DEFAULT 'Default', p_base text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON")
  VALUES (p_owner, CASE WHEN p_type = 'Default' THEN p_day ELSE p_day || '|' || p_type END,
          jsonb_strip_nulls(jsonb_build_object('startingDate', p_day, 'currencyRatio', p_ratio, 'rateType', p_type, 'rateBase', p_base)));
END $$;
SELECT tt.rate(:'c_usd', '2030-01-01', 1.25);
SELECT tt.rate(:'c_gbp', '2030-01-01', 0.8);
SELECT tt.rate(:'c_gbp', '2030-01-10', 0.9);
SELECT tt.rate('c-zzz', '2030-01-01', 150);
SELECT tt.rate('c-yyy', '2030-01-01', 1.2345);
SELECT tt.rate(:'c_usd', '2030-01-01', 1.2, 'Budget');
SELECT tt.rate(:'c_eur', '2030-01-02', 0.8, 'Test', 'USD');
SELECT tt.rate('c-xch', '2030-01-02', 0.9, 'Test', 'USD');
SELECT tt.rate('c-xch', '2030-01-08', 0.99, 'Test', 'USD');
SELECT tt.rate('c-xch', '2030-01-05', 1.5, 'Test');
SELECT tt.rate('c-xch', '2030-01-09', 1.1, 'Test');

-- 1. exchange rates
SELECT tt.eq(public.fx_base_currency(), 'EUR', 'the base currency is EUR by default');
SELECT tt.eq(public.fx_pair_rate('EUR', 'USD', 'Default', '2030-01-05'), 1.25::numeric, 'golden fx1');   -- golden fx1 = 1.25
SELECT tt.eq(public.fx_pair_rate('USD', 'EUR', 'Default', '2030-01-05'), 0.8::numeric, 'golden fx2');   -- golden fx2 = 0.8
SELECT tt.eq(public.fx_pair_rate('USD', 'GBP', 'Default', '2030-01-05'), 0.64::numeric, 'golden fx3');   -- golden fx3 = 0.64
SELECT tt.eq(public.fx_pair_rate('USD', 'GBP', 'Default', '2030-01-12'), 0.72::numeric, 'golden fx4');   -- golden fx4 = 0.72
SELECT tt.eq(round(public.fx_pair_rate('USD', 'EUR', 'Budget', '2030-01-05'), 12), round(0.8333333333333334::numeric, 12), 'golden fx5');   -- golden fx5 = 0.8333333333333334
SELECT tt.eq(public.fx_miss_text('EUR', 'XCH', 'Budget', '2030-01-05'), 'No Budget exchange rate of XCH on or before 2030-01-05', 'golden fx6');   -- golden fx6 = No Budget exchange rate of XCH on or before 2030-01-05
SELECT tt.eq(public.fx_miss_text('EUR', 'ZZZ', 'Default', '2029-12-31'), 'No Default exchange rate of ZZZ on or before 2029-12-31', 'golden fx7');   -- golden fx7 = No Default exchange rate of ZZZ on or before 2029-12-31
SELECT tt.eq(public.fx_miss_text('EUR', 'QQQ', 'Default', '2030-01-05'), 'Currency QQQ is not in the currency catalog', 'golden fx8');   -- golden fx8 = Currency QQQ is not in the currency catalog
SELECT tt.eq(public.fx_pair_rate('USD', 'USD', 'Default', '2030-01-05'), 1::numeric, 'golden fx9');   -- golden fx9 = 1
SELECT tt.eq(public.fx_pair_rate('EUR', 'XCH', 'Test', '2030-01-03'), 1.125::numeric, 'golden fx10');   -- golden fx10 = 1.125
SELECT tt.eq(public.fx_pair_rate('EUR', 'XCH', 'Test', '2030-01-04'), 1.125::numeric, 'golden fx11');   -- golden fx11 = 1.125
SELECT tt.eq(public.fx_pair_rate('EUR', 'XCH', 'Test', '2030-01-06'), 1.5::numeric, 'golden fx12');   -- golden fx12 = 1.5
SELECT tt.eq(public.fx_pair_rate('EUR', 'XCH', 'Test', '2030-01-08'), 1.2375::numeric, 'golden fx13');   -- golden fx13 = 1.2375
SELECT tt.eq(public.fx_pair_rate('EUR', 'XCH', 'Test', '2030-01-09'), 1.1::numeric, 'golden fx14');   -- golden fx14 = 1.1
SELECT tt.eq(public.fx_pair_rate('EUR', 'USD', 'Test', '2030-01-05'), 1.25::numeric, 'golden fx15');   -- golden fx15 = 1.25
SELECT tt.eq(public.fx_miss_text('EUR', 'XCH', 'Test', '2030-01-01'), 'No Test exchange rate of XCH on or before 2030-01-01', 'golden fx16');   -- golden fx16 = No Test exchange rate of XCH on or before 2030-01-01
SELECT tt.eq(public.fx_pair_rate('EUR', 'XCH', 'Budget', '2030-01-05') IS NULL AND public.fx_pair_rate('EUR', 'ZZZ', 'Default', '2029-12-31') IS NULL AND public.fx_pair_rate('EUR', 'QQQ', 'Default', '2030-01-05') IS NULL, true, 'a miss is NULL (never a rate of another type)');
SELECT tt.eq(public.fx_miss_text('EUR', 'USD', 'Default', '2030-01-05'), NULL::text, 'no miss text when there is a rate');
SELECT tt.eq(public.fx_convert(100, 'EUR', 'ZZZ', 'Default', '2030-01-05'), 15000::numeric, 'golden cv1');   -- golden cv1 = 15000
SELECT tt.eq(public.fx_convert(33.33, 'EUR', 'ZZZ', 'Default', '2030-01-05'), 5000::numeric, 'golden cv2');   -- golden cv2 = 5000
SELECT tt.eq(public.fx_convert(10, 'EUR', 'YYY', 'Default', '2030-01-05'), 12.345::numeric, 'golden cv3');   -- golden cv3 = 12.345
SELECT tt.eq(public.fx_convert(261.92, 'EUR', 'USD', 'Default', '2030-01-05'), 327.4::numeric, 'golden cv4');   -- golden cv4 = 327.4
SELECT tt.eq(public.fx_convert(10, 'EUR', 'XCH', 'Budget', '2030-01-05'), NULL::numeric, 'convert with no rate = NULL');
-- another base: the organization key baseCurrency
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"baseCurrency":"usd"}' WHERE "rowGUID" = public.organization_of_user('11111111-1111-1111-1111-111111111111');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.fx_base_currency(), 'USD', 'the base currency is the key baseCurrency of the organization (upper case)');
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" - 'baseCurrency' WHERE "rowGUID" = public.organization_of_user('11111111-1111-1111-1111-111111111111');

-- 2. the hour price of a contract
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Month","contractSumBeforeVAT":5500}'), 32.74::numeric, 'golden ct1');   -- golden ct1 = 32.74
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Day","contractSumBeforeVAT":183}'), 22.88::numeric, 'golden ct2');   -- golden ct2 = 22.88
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Week","contractSumBeforeVAT":1000}'), 25::numeric, 'golden ct3');   -- golden ct3 = 25
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"OneTime","contractSumBeforeVAT":100}'), NULL::numeric, 'golden ct4');   -- golden ct4 = NULL
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Quarter","contractSumBeforeVAT":504}'), 1::numeric, 'golden ct5');   -- golden ct5 = 1
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Year","contractSumBeforeVAT":2016}'), 1::numeric, 'golden ct6');   -- golden ct6 = 1
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Month","contractSumBeforeVAT":0}'), NULL::numeric, 'golden ct7');   -- golden ct7 = NULL
SELECT tt.eq(public.contract_hour_price('{"contractPaymentsPeriod":"Month","contractSumBeforeVAT":"1680"}'), 10::numeric, 'a sum written as text is read (as lineNumber)');

-- 3. the rate of a role (the first price list that fits roles is pt_customerA)
INSERT INTO public."resourceRoleTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('rg1', 'humanResources', '{"title":"Golden role"}'), ('rg2', 'humanResources', '{"title":"Day-only role"}');
INSERT INTO public."rolePriceTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('rg1', 'empty', '{"priceTypeGUID":"pt_customerA","price":50,"validFrom":"2030-01-01","measureUnit":"unit_hour"}'),
  ('rg1', 'empty', '{"priceTypeGUID":"pt_customerA","price":55,"validFrom":"2030-01-10","measureUnit":"unit_hour"}'),
  ('rg1', 'pv7',   '{"priceTypeGUID":"pt_customerA","price":70,"validFrom":"2030-01-01","measureUnit":"unit_hour"}'),
  ('rg1', 'empty', '{"priceTypeGUID":"pt_customerA","price":400,"validFrom":"2030-01-20","measureUnit":"unit_day"}'),
  ('rg1', 'empty', '{"priceTypeGUID":"pt_bill","price":99,"validFrom":"2030-01-01","measureUnit":"unit_hour"}'),
  ('rg2', 'empty', '{"priceTypeGUID":"pt_customerA","price":400,"validFrom":"2030-01-01","measureUnit":"unit_day"}');
SELECT tt.eq(public.role_hour_rate('rg1', '2030-01-05'), 50::numeric, 'golden rr1');   -- golden rr1 = 50
SELECT tt.eq(public.role_hour_rate('rg1', '2030-01-12'), 55::numeric, 'golden rr2');   -- golden rr2 = 55
SELECT tt.eq(public.role_hour_rate('rg1', '2029-12-31'), NULL::numeric, 'golden rr3');   -- golden rr3 = NULL
SELECT tt.eq(public.role_hour_rate('rg1', '2030-01-25'), 55::numeric, 'golden rr4');   -- golden rr4 = 55
SELECT tt.eq(public.role_hour_rate('rg2', '2030-01-05'), 400::numeric, 'golden rr5');   -- golden rr5 = 400
SELECT tt.eq(public.role_hour_rate('nope', '2030-01-05'), NULL::numeric, 'a role that does not exist has no rate');

-- 4. Post: the money of every entered cell with the price and the exchange rate of ITS day
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3, t."projectGUID" AS p1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t4 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowGUID" <> :'t3' AND COALESCE(t."rowJSON"->>'rowKind', 'task') = 'task' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT "rowGUID" AS bi1 FROM public."budgetItemTable" WHERE "rowParentGUID" <> 'empty' AND "rowJSON"->>'managementGenusItem' = 'timeGenus' ORDER BY "rowGUID" LIMIT 1 \gset
SELECT (current_date - 8) AS day_a \gset
SELECT (current_date - 3) AS day_b \gset
SELECT (current_date - 40) AS day_c \gset
SELECT (current_date - 61) AS day_d \gset
-- the project: contract currency EUR, accounting ZZZ (0 decimals), budget YYY (3 decimals); rates: ZZZ Default 100 from 60 days ago, 120 from 5 days ago; YYY Budget 2 from 60 days ago
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForContract":"EUR","currencyForAccounting":"ZZZ","currencyForBudget":"YYY"}' WHERE "rowGUID" = :'p1';
SELECT tt.rate('c-zzz', (current_date - 60)::text, 100);
SELECT tt.rate('c-zzz', (current_date - 5)::text, 120);
SELECT tt.rate('c-yyy', (current_date - 60)::text, 2, 'Budget');
-- anna: a work center, a contract (Month 5500 EUR, started 30 days ago), the role rate of hr_ba (50 EUR an hour from 100 days ago)
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT "rowGUID" AS bu1 FROM public."businessUnitTable" ORDER BY "rowGUID" LIMIT 1 \gset
SELECT public.timesheet_create_my_work_center(:'bu1')->>'workCenter' AS wc_anna \gset
SELECT public.timesheet_user_person() AS person_anna \gset
SELECT tt.as_admin();
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('k-anna', :'person_anna', 'person', jsonb_build_object('contractPartyType', 'person', 'contractStatus', 'active', 'contractStartDate', (current_date - 30)::text, 'contractPaymentsPeriod', 'Month', 'contractCurrency', 'EUR', 'contractSumBeforeVAT', 5500));
INSERT INTO public."rolePriceTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('hr_ba', 'empty', jsonb_build_object('priceTypeGUID', 'pt_customerA', 'price', 50, 'validFrom', (current_date - 100)::text, 'measureUnit', 'unit_hour'));
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"timesheetOnlyCurrentMonthInputEnabled": false}' WHERE "rowGUID" = :'person_anna';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT o_source || ':' || o_price::text || ':' || o_currency FROM public.timesheet_hour_price(:'wc_anna', :'t3', 'hr_ba', :'day_a'::date)), 'contract:32.74:EUR', 'a Person work center: the contract of the person in force on the day');
SELECT tt.eq((SELECT o_contract FROM public.timesheet_hour_price(:'wc_anna', :'t3', 'hr_ba', :'day_a'::date)), 'k-anna', '... and its GUID');
SELECT tt.eq((SELECT o_source || ':' || o_price::text || ':' || o_currency FROM public.timesheet_hour_price(:'wc_anna', :'t3', 'hr_ba', :'day_c'::date)), 'role:50:EUR', 'the contract is not in force yet: the rate of the role, in the contract currency of the project');
SELECT tt.eq((SELECT o_problem FROM public.timesheet_hour_price(:'wc_anna', :'t3', 'hr_be', :'day_c'::date)), 'noContractRate', 'a Person: no contract in force and no role rate = noContractRate');

SELECT public.timesheet_create(:'wc_anna', (current_date - 61), current_date) AS d1 \gset
SELECT public.timesheet_add_line(:'d1', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3', 'timesheetLineRole', 'hr_ba', 'timesheetLineBudgetItem', :'bi1')) AS l1 \gset
SELECT tt.eq((SELECT ("rateSource", "unitPrice", "unitPriceCurrency")::text FROM public.project_timesheet_lines WHERE "rowGUID" = :'l1'), '(role,50.000000,EUR)', 'the line shows the price of the START date of the sheet (61 days ago: no contract yet, the role rate)');
SELECT public.timesheet_set_hours(:'l1', :'day_a'::date, 8);
SELECT public.timesheet_set_hours(:'l1', :'day_b'::date, 4);
SELECT public.timesheet_set_hours(:'l1', :'day_c'::date, 2);
SELECT public.timesheet_set_hours(:'l1', :'day_d'::date, 1);
SELECT public.post_timesheet(:'d1') AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'status', 'refused', 'Post is refused: no exchange rate on the first day');
SELECT tt.eq(jsonb_array_length(:'r1'::jsonb->'problems'), 1, 'only that cell is a problem');
SELECT tt.eq(:'r1'::jsonb->'problems'->0->>'problem', 'noExchangeRate', '... noExchangeRate');
SELECT tt.eq(:'r1'::jsonb->'problems'->0->>'day', :'day_d', '... it names the day');
SELECT tt.eq(:'r1'::jsonb->'problems'->0->>'detail', 'No Default exchange rate of ZZZ on or before ' || :'day_d', '... and the currency, the rate type and the day');
SELECT tt.eq(:'r1'::jsonb->'problems'->0->>'lineGUID', :'l1', '... and the line');
SELECT public.timesheet_set_hours(:'l1', :'day_d'::date, NULL);
SELECT public.post_timesheet(:'d1') AS r2 \gset
SELECT tt.eq(:'r2'::jsonb->>'status', 'posted', 'without that cell the sheet is posted');
SELECT tt.as_admin();
CREATE OR REPLACE FUNCTION tt.mv(p_header uuid, p_day date) RETURNS text LANGUAGE sql AS $$
  SELECT "qtyProjectStatus"::text || '|' || "sumForContract"::text || '|' || "sumForAccounting"::text || '|' || "sumForBudget"::text || '|' || COALESCE("contractGUID", '-')
    FROM public.project_status_movements WHERE "rowRegistratorGUID" = p_header AND "rowTurnoverDay" = p_day $$;
SELECT tt.eq(tt.mv(:'d1', :'day_a'::date), '8.00|261.92|26192.00|523.84|k-anna', 'day A: 8 h x 32.74 EUR = 261.92; x100 = 26192 ZZZ (0 decimals); x2 = 523.84 YYY; the contract is in the movement');
SELECT tt.eq(tt.mv(:'d1', :'day_b'::date), '4.00|130.96|15715.00|261.92|k-anna', 'day B: the rate of THAT day (120): 130.96 x 120 = 15715.2 -> 15715');
SELECT tt.eq(tt.mv(:'d1', :'day_c'::date), '2.00|100.00|10000.00|200.00|-', 'day C: no contract yet - the role rate 50 EUR: 100.00; x100 = 10000');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), 3::bigint, 'one movement for every entered cell');

-- Unpost, a new contract sum, Post again: the numbers are made again
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_timesheet(:'d1');
SELECT tt.as_admin();
UPDATE public."contractTable" SET "rowJSON" = "rowJSON" || '{"contractSumBeforeVAT": 6000}' WHERE "rowGUID" = 'k-anna';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.post_timesheet(:'d1')->>'status', 'posted', 'posted again');
SELECT tt.as_admin();
SELECT tt.eq(tt.mv(:'d1', :'day_a'::date), '8.00|285.68|28568.00|571.36|k-anna', 'a new contract sum: 6000 / 168 = 35.71 an hour; 8 h = 285.68');
SELECT tt.eq(tt.mv(:'d1', :'day_b'::date), '4.00|142.84|17141.00|285.68|k-anna', 'day B again: 142.84 x 120 = 17140.8 -> 17141');

-- source (a): the Time line of the task first - its unit sums, no conversion, no contract
SELECT tt.as_admin();
INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('dddddddd-0000-0000-0000-000000000021', :'p1', :'t4', 'timeGenus', 1,
        jsonb_build_object('taskResourceKind', 'workCenter', 'taskResourceItem', :'wc_anna', 'resourceRoleItem', 'hr_ba', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 10, 'sumForBudget', 1000, 'sumForContract', 900, 'sumForAccounting', 950, 'budgetItemTaskLine', :'bi1'));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_create(:'wc_anna', (current_date - 61), current_date) AS d2 \gset
SELECT public.timesheet_add_line(:'d2', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t4', 'timesheetLineRole', 'hr_ba', 'timesheetLineBudgetItem', :'bi1')) AS l2 \gset
SELECT tt.eq((SELECT "rateSource" FROM public.project_timesheet_lines WHERE "rowGUID" = :'l2'), 'taskLine', 'a task WITH a Time line of the role: its numbers (source taskLine)');
SELECT public.timesheet_set_hours(:'l2', (current_date - 10), 3);
SELECT tt.eq(public.post_timesheet(:'d2')->>'status', 'posted', 'posted');
SELECT tt.as_admin();
SELECT tt.eq(tt.mv(:'d2', (current_date - 10)), '3.00|270.00|285.00|300.00|-', '3 h x the unit sums of the Time line (90 / 95 / 100), no conversion');

-- no rate at all: a Person without a contract in force and a role without a rate; an equipment work center with a role that has no rate
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_create(:'wc_anna', (current_date - 61), current_date) AS d3 \gset
SELECT public.timesheet_add_line(:'d3', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3', 'timesheetLineRole', 'hr_be', 'timesheetLineBudgetItem', :'bi1')) AS l3 \gset
SELECT public.timesheet_set_hours(:'l3', :'day_c'::date, 2);
SELECT public.timesheet_set_hours(:'l3', :'day_a'::date, 2);
SELECT public.post_timesheet(:'d3') AS r3 \gset
SELECT tt.eq((SELECT array_agg(p->>'day' || ':' || (p->>'problem') ORDER BY p->>'day') FROM jsonb_array_elements(:'r3'::jsonb->'problems') p), ARRAY[:'day_c' || ':noContractRate']::text[], 'hr_be has no rate: day C (no contract yet) = noContractRate; day A is priced by the contract');
SELECT tt.as_admin();
INSERT INTO public."equipmentTable" ("rowGUID", "rowJSON") VALUES ('e-gold', '{"equipmentTitle":"Golden crane"}');
INSERT INTO public."workCenterTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('wc-gold', :'bu1', '{"workCenterKind":"equipment","workCenterBase":"e-gold"}');
UPDATE public."personTable" SET "rowJSON" = "rowJSON" || '{"timesheetAllWorkCenterInputAvailable": true}' WHERE "rowGUID" = :'person_anna';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.timesheet_create('wc-gold', (current_date - 61), current_date) AS d4 \gset
SELECT public.timesheet_add_line(:'d4', jsonb_build_object('timesheetLineProject', :'p1', 'timesheetLineTask', :'t3', 'timesheetLineRole', 'eqr_crane', 'timesheetLineBudgetItem', :'bi1')) AS l4 \gset
SELECT public.timesheet_set_hours(:'l4', :'day_a'::date, 5);
SELECT tt.eq(:'d4'::text <> '', true, 'an Equipment work center takes an equipment role');
SELECT public.post_timesheet(:'d4') AS r4 \gset
SELECT tt.eq(:'r4'::jsonb->'problems'->0->>'problem', 'noRoleRate', 'an Equipment work center: no rate of the role in the first price list = noRoleRate');
SELECT tt.as_admin();
INSERT INTO public."rolePriceTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('eqr_crane', 'empty', jsonb_build_object('priceTypeGUID', 'pt_customerA', 'price', 120, 'validFrom', (current_date - 100)::text, 'measureUnit', 'unit_hour'));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.post_timesheet(:'d4')->>'status', 'posted', 'with a role rate the equipment sheet is posted');
SELECT tt.as_admin();
SELECT tt.eq(tt.mv(:'d4', :'day_a'::date), '5.00|600.00|60000.00|1200.00|-', 'the role rate 120 EUR: 5 h = 600.00; x100 = 60000 ZZZ; x2 = 1200 YYY');

-- a project that has no accounting / budget currency: those moneys are 0 (as the plan), the contract money is there
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'currencyForAccounting' - 'currencyForBudget' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_timesheet(:'d4');
SELECT public.post_timesheet(:'d4');
SELECT tt.as_admin();
SELECT tt.eq(tt.mv(:'d4', :'day_a'::date), '5.00|600.00|0.00|0.00|-', 'no accounting / budget currency on the project: 0 in those columns, the contract money stays');

ROLLBACK;
