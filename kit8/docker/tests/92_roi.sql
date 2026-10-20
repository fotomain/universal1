-- PARTs 33 + 34: ROI (documentation/ROI_DOC.html): the Revenue lines in the register, the cost that has no vendor, the task months and the project months, the rules (ratio, VAT), the task switch, the history
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3, t."projectGUID" AS p1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t4 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 113' \gset
SELECT t."rowGUID" AS tm, t."projectGUID" AS pm FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset

-- 0. the rules, as pure functions (the fixture of ROI_DOC.html: plan cost 1000 (VAT 200), plan revenue 1500 (VAT 300), invoices 900 / 1200 (VAT 180 / 240)) ----------------------------------------------------
SELECT tt.eq(public.roi_ratio(1500, 1000), 0.5::numeric, 'ROI = (R - C) / C: (1500 - 1000) / 1000 = 50 %');
SELECT tt.eq(public.roi_ratio(1500, 0) IS NULL, true, 'no cost = no value (NULL), never 0 and never infinity');
SELECT tt.eq(public.roi_ratio(NULL, 1000), -1::numeric, 'no revenue at all = -100 %');
SELECT tt.eq(public.roi_cost(1000, 200, 0, false), 1000::numeric, 'cost, purchase VAT not included, recoverable VAT: net');
SELECT tt.eq(public.roi_cost(1000, 200, 50, false), 1050::numeric, 'cost, purchase VAT not included: net + the VAT that is cost');
SELECT tt.eq(public.roi_cost(1000, 200, 50, true), 1200::numeric, 'cost, purchase VAT included: net + ALL the VAT');
SELECT tt.eq(public.roi_revenue(1500, 300, false), 1500::numeric, 'revenue, sale VAT not included: net');
SELECT tt.eq(public.roi_revenue(1500, 300, true), 1800::numeric, 'revenue, sale VAT included: net + VAT');
SELECT tt.eq((SELECT array_agg(round(public.roi_ratio(public.roi_revenue(r, rv, s), public.roi_cost(c, cv, 0, p)), 4) ORDER BY k)
                FROM (VALUES (1, 1500, 300, 1000, 200, true, false), (2, 1500, 300, 1000, 200, false, true), (3, 1500, 300, 1000, 200, true, true), (4, 1500, 300, 1000, 200, false, false)) v(k, r, rv, c, cv, s, p)),
             ARRAY[0.8::numeric, 0.25, 0.5, 0.5], 'ROI1 of the example: sale VAT only 80 %, purchase VAT only 25 %, both 50 %, none 50 %');

-- the lines: t3 = a material line WITH a vendor (plan 1000) and a revenue line (plan 1500); t4 = a Time line of a person with no vendor (plan 100, own cost) and a material line with a vendor (plan 40)
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', :'t3', 'materialGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 10, 'priceTaskLine', 100, 'vatRatioTaskLine', 20, 'sumForBudget', 1000, 'taskLinePartnerItem', 'rv-1', 'taskLinePartnerContract', 'rvc-1')),
  ('eeeeeeee-0000-0000-0000-000000000002', :'t3', 'revenueGenus',  2, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 15, 'priceTaskLine', 100, 'vatRatioTaskLine', 20, 'sumForBudget', 1500, 'taskLinePartnerItem', 'rcu-1', 'taskLinePartnerContract', 'rcc-1')),
  ('eeeeeeee-0000-0000-0000-000000000003', :'t4', 'timeGenus',     1, jsonb_build_object('resourceRoleItem', :'role1', 'taskResourceKind', 'person', 'taskResourceItem', 'p-boris', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 5, 'priceTaskLine', 20, 'sumForBudget', 100)),
  ('eeeeeeee-0000-0000-0000-000000000004', :'t4', 'materialGenus', 2, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 4, 'priceTaskLine', 10, 'sumForBudget', 40, 'taskLinePartnerItem', 'rv-1', 'taskLinePartnerContract', 'rvc-1'));
INSERT INTO public."legalEntityTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('rle-1', 'empty', '{"title": "Acme SIA", "isActive": true}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES
  ('rv-1',  '{"partnerTitle": "Acme Supplies", "partnerKind": "company", "isActive": true, "partnerIsSupplier": true}'),
  ('rcu-1', '{"partnerTitle": "Big Customer", "partnerKind": "company", "isActive": true}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('rvc-1', 'rv-1',  'partner', '{"contractPartyType": "partner", "contractNumber": "S-1", "contractTitle": "Supply", "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "rle-1"}'),
  ('rcc-1', 'rcu-1', 'partner', '{"contractPartyType": "partner", "contractNumber": "C-1", "contractTitle": "Sales",  "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "rle-1"}');

-- does a line have a vendor? (the rule of the vendor invoice)
SELECT tt.eq(public.pm_line_has_vendor('materialGenus', '{"taskLinePartnerItem": "rv-1"}'::jsonb), true, 'a vendor on the line');
SELECT tt.eq(public.pm_line_has_vendor('materialGenus', '{"taskLinePartnerContract": "rvc-1"}'::jsonb), true, 'the partner of the contract of the line');
SELECT tt.eq(public.pm_line_has_vendor('timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "p-boris"}'::jsonb), false, 'the Time of a person with no contract: no vendor = own cost');
SELECT tt.eq(public.pm_line_has_vendor('expenseGenus', '{}'::jsonb), false, 'an expense with no vendor: own cost');

-- 1. the plan: the Revenue line is in the register, but NOT in Monitor01 ----------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t3', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'eeeeeeee-0000-0000-0000-000000000001', 'qtyTaskLine', 10, 'sumForBudget', 1000, 'sumForContract', 1000, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))),
  jsonb_build_object('lineGUID', 'eeeeeeee-0000-0000-0000-000000000002', 'qtyTaskLine', 15, 'sumForBudget', 1500, 'sumForContract', 1500, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1)))))) AS p3 \gset
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t4', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'eeeeeeee-0000-0000-0000-000000000003', 'qtyTaskLine', 5, 'sumForBudget', 100, 'sumForContract', 100, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-09-03', 'c', 1))),
  jsonb_build_object('lineGUID', 'eeeeeeee-0000-0000-0000-000000000004', 'qtyTaskLine', 4, 'sumForBudget', 40, 'sumForContract', 40, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-09-03', 'c', 1)))))) AS p4 \gset
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowOwnerGUID" = :'t3' AND "rowMovementKind" = 'plan' AND "genusGUID" = 'revenueGenus'), 1::bigint, 'the register has the plan of the Revenue line');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'revenueGenus'), 0::bigint, 'Monitor01 does NOT get a row for it (the Revenue genus is there only through the customer invoices)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'revenueGenus'), 0::bigint, '... nor the turnover');
SELECT tt.eq((SELECT "sumForBudget" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'materialGenus'), 1000::numeric, 'the Budget column of Monitor01 is the cost plan, as before');
SELECT tt.eq(public.monitor01_verify(), 0, 'monitor01_verify: no difference (the Revenue plan changed no Monitor01 number)');
SELECT tt.eq((SELECT ("costPlanNet", "revenuePlanNet")::text FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t3' AND "rowTurnoverMonth" = '2026-10-01'), '(1000.00,1500.00)', 'ROI task month: cost plan 1000, revenue plan 1500');
SELECT tt.eq((SELECT ("costPlanNet", "revenuePlanNet")::text FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t4' AND "rowTurnoverMonth" = '2026-09-01'), '(140.00,0.00)', 't4: cost plan 140 in September');
SELECT tt.eq((SELECT ("costPlanNet", "revenuePlanNet", "taskCount")::text FROM public.project_status_month_totals WHERE "rowProjectGUID" = :'p1' AND "rowTurnoverMonth" = '2026-10-01'), '(1000.00,1500.00,1)', 'month totals of the project: October = the task month');
SELECT tt.eq((SELECT "costPlanNet" FROM public.project_status_month_totals WHERE "rowProjectGUID" = :'p1' AND "rowTurnoverMonth" = '2026-09-01'), 140::numeric, '... September');
SELECT tt.eq(public.roi_verify(), 0, 'roi_verify: the tables equal a full re-sum of the register');
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_task_month WHERE "rowProjectGUID" = :'pm'), 0::bigint, 'the other user''s project has no ROI rows (no ROI numbers there)');

-- 2. the fact input: the Revenue line (ROI2) and the cost that has no vendor (ROI4) ------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_fact_document_create(:'t3') AS f3 \gset
UPDATE public.task_fact_usage_timeline SET "qtyForContract" = 11, "rowPeriodDatetime" = '2026-10-15 00:00:00+00' WHERE "rowHeaderGUID" = :'f3' AND "genusGUID" = 'revenueGenus';
UPDATE public.task_fact_usage_timeline SET "rowPeriodDatetime" = '2026-10-15 00:00:00+00' WHERE "rowHeaderGUID" = :'f3' AND "genusGUID" = 'materialGenus';
SELECT public.post_task_fact_document(:'f3') AS r_f3 \gset
SELECT tt.eq(:'r_f3'::jsonb->>'status', 'posted', 'the fact document of t3 is posted');
SELECT public.task_fact_document_create(:'t4') AS f4 \gset
UPDATE public.task_fact_usage_timeline SET "rowPeriodDatetime" = '2026-09-04 00:00:00+00' WHERE "rowHeaderGUID" = :'f4';
SELECT public.post_task_fact_document(:'f4') AS r_f4 \gset
SELECT tt.eq(:'r_f4'::jsonb->>'status', 'posted', 'the fact document of t4 is posted');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'f3' AND "genusGUID" = 'revenueGenus' AND "rowMovementKind" = 'used'), 1::bigint, 'the Revenue line of the fact document is a used movement (it was dropped before)');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "revenueUsedNet" FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t3' AND "rowTurnoverMonth" = '2026-10-01'), 1100::numeric, 'ROI2 revenue: the fact input of the Revenue line, 11 x 100 = 1100');
SELECT tt.eq((SELECT "costOwnNet" FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t3' AND "rowTurnoverMonth" = '2026-10-01'), 0::numeric, 'the material line of t3 HAS a vendor: its fact input is not "own cost"');
SELECT tt.eq((SELECT "costOwnNet" FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t4' AND "rowTurnoverMonth" = '2026-09-01'), 100::numeric, 'the Time line of a person with no vendor is own cost (5 h x 20); the material line of t4 has a vendor and is not');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'revenueGenus'), 0::bigint, 'Monitor01 still has no row for the Revenue line');
SELECT tt.eq((SELECT "qtyUsed" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'materialGenus'), 10::numeric, 'the "Actually used" column of Monitor01 is as before');
SELECT tt.eq(public.monitor01_verify(), 0, 'monitor01_verify: still no difference');
SELECT tt.eq(public.roi_verify(), 0, 'roi_verify: still no difference');
-- unpost = the movements go, the ROI rows follow
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_task_fact_document(:'f4');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT coalesce(sum("costOwnNet"), 0) FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t4'), 0::numeric, 'unposted: the own cost is gone');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_task_fact_document(:'f4');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("costOwnNet") FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t4'), 100::numeric, 'posted again: the own cost is back');

-- 3. the vendor invoice (900) and the customer invoice (1200) -------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.vendor_invoice_candidates(:'t3') AS vc \gset
SELECT jsonb_agg(jsonb_build_object('partnerGUID', r->>'partnerGUID', 'contractGUID', r->>'contractGUID', 'lineGUIDs', r->'lineGUIDs')) AS vsel FROM jsonb_array_elements(:'vc'::jsonb->'rows') r \gset
SELECT public.create_vendor_invoices(:'t3', :'vsel'::jsonb, 'rle-1') AS vmade \gset
SELECT (:'vmade'::jsonb->'documents'->0->>'documentGUID')::uuid AS dv \gset
SELECT public.vendor_invoice_set_header(:'dv', '{"vendorInvoiceNumber": "INV-1", "vendorInvoiceDateTime": "2026-10-16T00:00:00Z"}'::jsonb);
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 9, "priceInvoiced" = 100, "vatRatioInvoiced" = 20 WHERE "rowHeaderGUID" = :'dv';
SELECT tt.eq(public.post_vendor_invoice(:'dv')->>'status', 'posted', 'the vendor invoice (9 x 100, VAT 20 %) is posted');
SELECT public.customer_invoice_candidates(:'t3') AS cc \gset
SELECT jsonb_agg(jsonb_build_object('partnerGUID', r->>'partnerGUID', 'contractGUID', r->>'contractGUID', 'lineGUIDs', r->'lineGUIDs')) AS csel FROM jsonb_array_elements(:'cc'::jsonb->'rows') r \gset
SELECT public.create_customer_invoices(:'t3', :'csel'::jsonb, 'rle-1') AS cmade \gset
SELECT (:'cmade'::jsonb->'documents'->0->>'documentGUID')::uuid AS dc \gset
SELECT public.customer_invoice_set_header(:'dc', '{"customerInvoiceNumber": "CINV-1", "customerInvoiceDateTime": "2026-10-17T00:00:00Z"}'::jsonb);
UPDATE public.customer_invoice_lines SET "qtyInvoiced" = 12, "priceInvoiced" = 100, "vatRatioInvoiced" = 20 WHERE "rowHeaderGUID" = :'dc';
SELECT tt.eq(public.post_customer_invoice(:'dc')->>'status', 'posted', 'the customer invoice (12 x 100, VAT 20 %) is posted');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT ("costInvoicedNet", "costInvoicedVat", "costInvoicedVatInCost")::text FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t3' AND "rowTurnoverMonth" = '2026-10-01'), '(900.00,180.00,0.00)', 'vendor invoices: 900 net, VAT 180, none of it cost (a recoverable rate)');
SELECT tt.eq((SELECT ("revenueInvoicedNet", "revenueInvoicedVat")::text FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t3' AND "rowTurnoverMonth" = '2026-10-01'), '(1200.00,240.00)', 'customer invoices: 1200 net, VAT 240');
SELECT tt.eq(public.monitor01_verify(), 0, 'monitor01_verify: no difference');
SELECT tt.eq(public.roi_verify(), 0, 'roi_verify: no difference');

-- 4. the four ROI kinds of the task (the fixture of the page) and the tax switches ----------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT ("planCost", "factCost", "planRevenue", "usedRevenue", "billedRevenue")::text FROM public.roi_project(:'p1')), '(1140.00,1000.00,1500.00,1100.00,1200.00)',
             'the PROJECT: plan cost 1000 + 140, cost fact = vendor invoices 900 + own cost 100, revenue plan 1500 / fact input 1100 / invoiced 1200');
SELECT tt.eq((SELECT ("planCost", "factCost")::text FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), '(1000.00,900.00)', 'a PERIOD (October): the months in range only');
SELECT tt.eq((SELECT ("planCost", "factCost")::text FROM public.roi_project(:'p1', NULL, '2026-09-15')), '(140.00,100.00)', '... up to September (any day of the month counts for the whole month)');
SELECT tt.eq((SELECT round("roi4", 4) FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), 0.3333::numeric, 'ROI4 of October = (1200 - 900) / 900 = 33.3 %');
SELECT tt.eq((SELECT round("roi3", 4) FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), 0.2::numeric, 'ROI3 of October = (1200 - 1000) / 1000 = 20 %');
SELECT tt.eq((SELECT round("roi2", 4) FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), 0.1::numeric, 'ROI2 of October = (1100 - 1000) / 1000 = 10 % (the fact input of the Revenue line)');
SELECT tt.eq((SELECT round("roi1", 4) FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), 0.5::numeric, 'ROI1 of October = (1500 - 1000) / 1000 = 50 %');
SELECT tt.eq((SELECT "roi1" IS NULL FROM public.roi_project(:'p1', '2027-01-01', '2027-01-31')), true, 'a period with no cost: ROI is NULL, not 0');
-- the tax switches of the project (a missing key = OFF)
SELECT tt.eq(public.roi_include_vat(:'p1', 'sale'), false, 'sale VAT: OFF by default');
SELECT tt.eq(public.roi_include_vat(:'p1', 'purchase'), false, 'purchase VAT: OFF by default');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectROIIncludeSaleVAT": true}' WHERE "rowGUID" = :'p1';
SELECT tt.eq((SELECT ("billedRevenue", round("roi3", 4), round("roi4", 4))::text FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), '(1440.00,0.4400,0.6000)', 'sale VAT ON: revenue 1200 + 240 -> ROI3 44 %, ROI4 60 %');
UPDATE public.project_table SET "rowJSON" = ("rowJSON" - 'projectROIIncludeSaleVAT') || '{"projectROIIncludePurchaseVAT": true}' WHERE "rowGUID" = :'p1';
SELECT tt.eq((SELECT ("factCost", round("roi4", 4))::text FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), '(1080.00,0.1111)', 'purchase VAT ON: cost fact 900 + 180 -> ROI4 11.1 %');
UPDATE public.project_table SET "rowJSON" = ("rowJSON" - 'projectROIIncludePurchaseVAT') || '{"projectROIIncludeAllTaxes": true}' WHERE "rowGUID" = :'p1';
SELECT tt.eq((SELECT ("billedRevenue", "factCost")::text FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), '(1440.00,1080.00)', 'the master switch turns both ON');
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'projectROIIncludeAllTaxes' WHERE "rowGUID" = :'p1';
SELECT tt.eq((SELECT "billedRevenue" FROM public.roi_project(:'p1', '2026-10-01', '2026-10-31')), 1200::numeric, 'all OFF again: the numbers go back (the tables hold the components; nothing stored went stale)');

-- 5. the views ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT ("planCost", "factCost", "billedRevenue")::text FROM public.project_status_totals WHERE "rowProjectGUID" = :'p1'), '(1140.00,1000.00,1200.00)', 'project_status_totals: ONE line per project = the sum of its months');
SELECT tt.eq((SELECT ("firstMonth", "lastMonth")::text FROM public.project_status_totals WHERE "rowProjectGUID" = :'p1'), '(2026-09-01,2026-10-01)', '... with the first and the last month');
SELECT tt.eq((SELECT array_agg("planCost" ORDER BY "rowTurnoverMonth") FROM public.project_status_month_roi WHERE "rowProjectGUID" = :'p1'), ARRAY[140.00::numeric, 1140.00], 'project_status_month_roi: the CUMULATIVE plan cost per month (September 140, then October 1140)');
SELECT tt.eq((SELECT array_agg("factCost" ORDER BY "rowTurnoverMonth") FROM public.project_status_month_roi WHERE "rowProjectGUID" = :'p1'), ARRAY[100.00::numeric, 1000.00], '... the cumulative cost fact (September 100 own cost, then + 900 invoiced)');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_status_totals), 0::bigint, 'marko sees no totals of anna''s project (security_invoker: the policies apply)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_totals), 0::bigint, '... nor the month totals');
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_task_month), 0::bigint, '... nor the task months');
SELECT tt.fails($q$INSERT INTO public.project_status_month_totals ("rowProjectGUID", "rowTurnoverMonth") VALUES (gen_random_uuid(), '2026-10-01')$q$, 'permission denied', 'nobody writes the totals by hand');
SELECT tt.fails($q$UPDATE public.project_status_roi_task_month SET "costPlanNet" = 1$q$, 'permission denied', '... nor the task months');

-- 6. the task switch roiForTasksFunctionalityEnabled: OFF = no task lines, no project in the report ---------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public.roi_task_lines(:'p1')), 0::bigint, 'switch OFF (the default): the task lines are not calculated at all');
SELECT tt.eq((SELECT count(*) FROM public.roi_report_projects()), 0::bigint, '... and the project is not in Monitor02');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"roiForTasksFunctionalityEnabled": true}' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public.roi_task_lines(:'p1')), 2::bigint, 'switch ON: one line per task (t3 and t4)');
SELECT tt.eq((SELECT array_agg("rowOwnerGUID") FROM public.roi_report_projects() "rowOwnerGUID"), ARRAY[:'p1'::uuid], '... and the project is in Monitor02');
SELECT tt.eq((SELECT ("planCost", "factCost", "planRevenue", "usedRevenue", "billedRevenue", round("roi1", 4), round("roi2", 4), round("roi3", 4), round("roi4", 4))::text FROM public.roi_task_lines(:'p1') WHERE "rowOwnerGUID" = :'t3'),
             '(1000.00,900.00,1500.00,1100.00,1200.00,0.5000,0.1000,0.2000,0.3333)', 'the task t3 = the fixture of the page: ROI1 50 %, ROI2 10 %, ROI3 20 %, ROI4 33.3 %');
SELECT tt.eq((SELECT ("planCost", "factCost", "planRevenue", "costOwnNet")::text FROM public.roi_task_lines(:'p1') WHERE "rowOwnerGUID" = :'t4'), '(140.00,100.00,0.00,100.00)', 'the task t4: cost fact = the own cost 100; no revenue');
SELECT tt.eq((SELECT (round("roi1", 4), round("roi4", 4))::text FROM public.roi_task_lines(:'p1') WHERE "rowOwnerGUID" = :'t4'), '(-1.0000,-1.0000)', 'no revenue at all: ROI1 and ROI4 are -100 % (a value; only a ZERO COST gives NULL)');
SELECT tt.eq((SELECT sum("planCost") FROM public.roi_task_lines(:'p1')), (SELECT "planCost" FROM public.roi_project(:'p1')), 'the tasks add up to the project (the money is added first, the ratio is taken last)');
SELECT tt.eq((SELECT "taskName" FROM public.roi_task_lines(:'p1') WHERE "rowOwnerGUID" = :'t3'), 'Task 112', 'the line carries the name of the task');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.roi_task_lines(:'p1')), 0::bigint, 'marko gets no task lines of anna''s project');

-- 7. the ROI history (PART 34): the switch roiHistoryFunctionalityEnabled -----------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), 0::bigint, 'switch OFF (the default): no history is written');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"roiHistoryFunctionalityEnabled": true}' WHERE "rowGUID" = :'p1';
SELECT tt.eq((SELECT ("reason", "rowSnapshotDay" = CURRENT_DATE, "costPlanNet")::text FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), '("history on",t,1140.00)',
             'turning the switch ON writes the first row at once: today, reason "history on", the totals of that moment');
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), 1::bigint, '... one row');
SELECT tt.eq(public.roi_history_apply(ARRAY[:'p1'::uuid]), 0, 'nothing changed: no new row (the log is written on change only)');
-- a change of the totals: unpost the customer invoice -> the worker -> the day's row is updated, the reasons are joined
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_customer_invoice(:'dc');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), 1::bigint, 'the same day: still ONE row (the last state of the day wins)');
SELECT tt.eq((SELECT ("reason", "revenueInvoicedNet")::text FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), '("customer invoice, history on",0.00)', '... its money follows, the reasons of the day are joined');
-- yesterday's row: the next change is a NEW row with its own reason
UPDATE public.project_status_roi_history SET "rowSnapshotDay" = CURRENT_DATE - 1 WHERE "rowProjectGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_customer_invoice(:'dc');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT array_agg("reason" ORDER BY "rowSnapshotDay") FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), ARRAY['customer invoice, history on', 'customer invoice'], 'a new day: a NEW row, its reason says what changed');
SELECT tt.eq((SELECT ("revenueInvoicedNet", round("roi4", 4))::text FROM public.project_status_roi_history_v WHERE "rowProjectGUID" = :'p1' ORDER BY "rowSnapshotDay" DESC LIMIT 1), '(1200.00,0.2000)', 'the view gives the ratios (ROI4 now: 1200 against 1000 of cost fact = 20 %)');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_history), 0::bigint, 'marko sees no history of anna''s project');
SELECT tt.fails($q$DELETE FROM public.project_status_roi_history$q$, 'permission denied', 'the log is not written by hand');
SELECT tt.as_admin();
-- OFF: nothing more is written, the rows stay
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"roiHistoryFunctionalityEnabled": false}' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_customer_invoice(:'dc');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_history WHERE "rowProjectGUID" = :'p1'), 2::bigint, 'switch OFF again: no new row, the old rows stay');

-- 8. a deleted task takes its ROI rows and the project months with it (the cascade) ------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_totals WHERE "rowProjectGUID" = :'p1' AND "rowTurnoverMonth" = '2026-09-01'), 1::bigint, 'before: September has a month total (t4 only)');
DELETE FROM public.project_task_table WHERE "rowGUID" = :'t4';
SELECT tt.eq((SELECT count(*) FROM public.project_status_roi_task_month WHERE "rowOwnerGUID" = :'t4'), 0::bigint, 'the task rows go with the task');
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_totals WHERE "rowProjectGUID" = :'p1' AND "rowTurnoverMonth" = '2026-09-01'), 0::bigint, 'the project month that had only this task is gone');
SELECT tt.eq((SELECT "costPlanNet" FROM public.project_status_month_totals WHERE "rowProjectGUID" = :'p1' AND "rowTurnoverMonth" = '2026-10-01'), 1000::numeric, '... October is untouched');
SELECT tt.eq(public.roi_verify(), 0, 'roi_verify: no difference after the delete');
-- a rebuild heals a wrong row
UPDATE public.project_status_roi_task_month SET "costPlanNet" = 5 WHERE "rowOwnerGUID" = :'t3';
SELECT tt.eq(public.roi_verify(:'p1') > 0, true, 'roi_verify sees a wrong row');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.roi_rebuild(:'p1');
SELECT tt.as_admin();
SELECT tt.eq(public.roi_verify(:'p1'), 0, 'roi_rebuild heals it');
SELECT tt.eq((SELECT "costPlanNet" FROM public.project_status_month_totals WHERE "rowProjectGUID" = :'p1' AND "rowTurnoverMonth" = '2026-10-01'), 1000::numeric, '... also the project month');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.roi_rebuild(%L)$q$, :'p1'), 'not your project', 'marko cannot rebuild anna''s project');
SELECT tt.fails($q$SELECT public.roi_verify()$q$, 'permission denied', 'roi_verify is a maintenance function (not for users)');

ROLLBACK;
