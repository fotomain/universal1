-- VAT basis (documentation/VENDOR_INVOICE_DOC.html): the three accounting columns of a document line, the VAT rate from the catalog, the manual edit and the price calculated back,
-- the register (net sums + VAT + the VAT that is cost) and Monitor01 (vatVendorInvoiced ...). The line triggers of the four documents share vat_line_calc.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset

INSERT INTO public."legalEntityTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('le-1', 'empty', '{"title": "Acme SIA", "isActive": true}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('vp-1', '{"partnerTitle": "Acme Supplies", "partnerKind": "company", "isActive": true, "partnerIsSupplier": true}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('vc-1', 'vp-1', 'partner', '{"contractPartyType": "partner", "contractNumber": "S-1", "contractTitle": "Supply", "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "le-1"}');
-- the catalog: vat_21 comes with the seeds (recoverable), a rate that is NOT recoverable is a row of its own
INSERT INTO public."valueAddedTaxTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('vat_21', 'valueAddedTaxCatalog', 'empty', 1000, '{"vatTableTitle": "21 %", "vatTablePercent": 21}'),
  ('vat_nd10', 'valueAddedTaxCatalog', 'empty', 9000, '{"vatTableTitle": "10 % not deductible", "vatTablePercent": 10, "vatRecoverablePercent": 0}')
ON CONFLICT ("rowGUID") DO NOTHING;
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000001', :'t3', 'materialGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 10, 'priceTaskLine', 5, 'vatRatioTaskLine', 21, 'taskLinePartnerItem', 'vp-1', 'taskLinePartnerContract', 'vc-1', 'sumForBudget', 100, 'sumForAccounting', 80));

-- 1. the invoice and its line: the unit sums of the task line are 10 (budget) and 8 (accounting) per piece, the plan price 5 -> the rates are 2 and 1.6 ------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.vendor_invoice_candidates(:'t3') AS cand \gset
SELECT jsonb_agg(jsonb_build_object('partnerGUID', r->>'partnerGUID', 'contractGUID', r->>'contractGUID', 'lineGUIDs', r->'lineGUIDs')) AS sel FROM jsonb_array_elements(:'cand'::jsonb->'rows') r \gset
SELECT public.create_vendor_invoices(:'t3', :'sel'::jsonb) AS made \gset
SELECT h."rowGUID" AS d1 FROM public.vendor_invoice_header h \gset
SELECT tt.eq((SELECT ("sumForAccountingBeforeVAT", "sumForAccountingVAT", "sumForAccounting", "vatForAccounting")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'),
             '(80.00,16.80,96.80,16.80)', 'the line: accounting before VAT 80 (from the contract sum), VAT 16.80 (from the contract VAT), the total 96.80');
SELECT tt.eq((SELECT ("sumForBudget", "vatForBudget", "vatInCostForBudget", "vatInCostForAccounting")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'),
             '(100.00,21.00,0.00,0.00)', 'budget sum NET 100, budget VAT 21, a recoverable rate: nothing is cost');

-- 2. the three bases --------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.vat_basis_amount(100, 21, 5, 'cost'), 105::numeric, 'basis cost = net + the VAT that is cost');
SELECT tt.eq(public.vat_basis_amount(100, 21, 5, 'net'), 100::numeric, 'basis net');
SELECT tt.eq(public.vat_basis_amount(100, 21, 5, 'gross'), 121::numeric, 'basis gross = net + all VAT');
SELECT tt.eq(public.vat_basis_amount(NULL, NULL, NULL, 'gross'), 0::numeric, 'missing parts count as 0');
SELECT tt.fails($q$SELECT public.vat_basis_amount(1, 1, 1, 'with')$q$, 'must be cost, net or gross', 'an unknown basis is refused');

-- 3. the VAT rate from the catalog -------------------------------------------------------------------------------------------------------------------------------------------
UPDATE public.vendor_invoice_lines SET "rowJSON" = "rowJSON" || '{"vatRateGUID": "vat_nd10"}' WHERE "rowHeaderGUID" = :'d1';
SELECT tt.eq((SELECT ("vatRatioInvoiced", "vatForContract", "vatForBudget", "vatInCostForBudget", "sumForAccountingVAT", "vatInCostForAccounting")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'),
             '(10.000,5.00,10.00,10.00,8.00,8.00)', 'a rate that is NOT recoverable: the percent comes from the catalog and ALL the VAT is cost');
SELECT tt.eq((SELECT "rowJSON"->>'vatRecoverablePercent' FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), '0', 'the recoverable share is frozen into the line');
SELECT tt.fails($q$UPDATE public.vendor_invoice_lines SET "rowJSON" = "rowJSON" || '{"vatRateGUID": "no-such-rate"}'$q$, 'VAT rate does not exist', 'a rate that is not in the catalog is refused');
SELECT tt.fails($q$UPDATE public.vendor_invoice_lines SET "rowJSON" = "rowJSON" || '{"itemTitle": "x"}'$q$, 'only the quantity', 'any other change of the rowJSON of a task line stays forbidden');
UPDATE public.vendor_invoice_lines SET "rowJSON" = "rowJSON" || '{"vatRateGUID": "vat_21"}' WHERE "rowHeaderGUID" = :'d1';
SELECT tt.eq((SELECT ("vatRatioInvoiced", "vatForBudget", "vatInCostForBudget", "sumForAccounting")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), '(21.000,21.00,0.00,96.80)', 'back to 21 %: recoverable again, nothing is cost');

-- 4. a typed accounting sum before VAT -> the PRICE is calculated back (160 / 1.6 / 10 = 10.0000) ------------------------------------------------------------------------
UPDATE public.vendor_invoice_lines SET "sumForAccountingBeforeVAT" = 160 WHERE "rowHeaderGUID" = :'d1';
SELECT tt.eq((SELECT ("priceInvoiced", "sumForContract", "vatForContract")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), '(10.0000,100.00,21.00)', 'accounting 160 -> price 10 -> contract sum 100 + VAT 21');
SELECT tt.eq((SELECT ("sumForAccountingBeforeVAT", "sumForAccountingVAT", "sumForAccounting", "sumForBudget", "vatForBudget")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'),
             '(160.00,33.60,193.60,200.00,42.00)', '... the typed value stays as typed, the VAT part and the budget sums follow the new price');

-- 5. a typed accounting VAT -> the VAT % is calculated (16 / 160 = 10 %), the price stays ---------------------------------------------------------------------------------
UPDATE public.vendor_invoice_lines SET "sumForAccountingVAT" = 16 WHERE "rowHeaderGUID" = :'d1';
SELECT tt.eq((SELECT ("priceInvoiced", "vatRatioInvoiced", "vatForContract", "sumForAccountingVAT", "sumForAccounting")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'),
             '(10.0000,10.000,10.00,16.00,176.00)', 'VAT 16 on 160 = 10 %: the price does not change, the total is 176');
SELECT tt.eq((SELECT "rowJSON" ? 'vatRateGUID' FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), false, 'a percent that is not a catalog rate removes the rate GUID');
SELECT tt.fails($q$UPDATE public.vendor_invoice_lines SET "sumForAccountingVAT" = 170 WHERE "sumForAccountingBeforeVAT" = 160$q$, 'above 100', 'a VAT above 100 % of the sum is refused');

-- 6. a change of the quantity drops the typed values and calculates everything again --------------------------------------------------------------------------------------
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 5 WHERE "rowHeaderGUID" = :'d1';
SELECT tt.eq((SELECT ("sumForContract", "vatForContract", "sumForAccountingBeforeVAT", "sumForAccountingVAT", "sumForAccounting")::text FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'),
             '(50.00,5.00,80.00,8.00,88.00)', 'quantity 5 at price 10: contract 50 + 5, accounting 80 + 8 = 88 (the typed 160 / 16 are gone)');
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 0 WHERE "rowHeaderGUID" = :'d1';
SELECT tt.fails($q$UPDATE public.vendor_invoice_lines SET "sumForAccountingBeforeVAT" = 100 WHERE "qtyInvoiced" = 0$q$, 'cannot be calculated', 'the price cannot be calculated from a typed sum when the quantity is 0');
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 5 WHERE "rowHeaderGUID" = :'d1';

-- 7. a line with no plan rate (an independent line) cannot take a typed accounting sum; the VAT of a customer invoice is never cost -------------------------------------------------
SELECT tt.fails($q$SELECT public.vat_line_calc(10, 5, 21, '{}'::jsonb, false, true, 10, 5, 21, NULL, NULL, 50, NULL, 'vendor invoice')$q$, 'no plan rate', 'no plan price and unit sum: the accounting sums cannot be typed');
SELECT tt.eq((SELECT (o_in_cost_budget, o_in_cost_acc)::text FROM public.vat_line_calc(10, 5, 21, '{"priceTaskLine": 5, "unitSumForBudget": 10, "unitSumForAccounting": 8, "vatRecoverablePercent": 0}'::jsonb, true, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'customer invoice')),
             '(0.00,0.00)', 'customer invoice: even a not recoverable rate gives no cost (the VAT is collected for the tax authority)');
SELECT tt.eq((SELECT (o_vat_budget, o_in_cost_budget, o_in_cost_acc)::text FROM public.vat_line_calc(10, 5, 21, '{"priceTaskLine": 5, "unitSumForBudget": 10, "unitSumForAccounting": 8, "vatRecoverablePercent": 0}'::jsonb, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'vendor invoice')),
             '(21.00,21.00,16.80)', '... the same line on a vendor invoice: all the VAT is cost');
SELECT tt.eq((SELECT (o_vat_budget, o_in_cost_budget)::text FROM public.vat_line_calc(10, 5, 21, '{"priceTaskLine": 5, "unitSumForBudget": 10, "unitSumForAccounting": 8, "vatRecoverablePercent": 40}'::jsonb, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'vendor invoice')),
             '(21.00,12.60)', 'a rate that is 40 % recoverable: 60 % of the VAT is cost');

-- 8. posting: the register gets the NET sums, the VAT and the VAT that is cost ---------------------------------------------------------------------------------------------------
SELECT public.vendor_invoice_set_header(:'d1', '{"vendorInvoiceNumber": "INV-75", "vendorInvoiceDateTime": "2026-10-20T00:00:00Z"}'::jsonb);
SELECT public.post_vendor_invoice(:'d1') AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'status', 'posted', 'the invoice is posted');
SELECT tt.eq((SELECT ("sumForBudget", "vatForBudget", "vatInCostForBudget", "sumForAccounting", "vatForAccounting", "vatInCostForAccounting")::text FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'),
             '(100.00,10.00,0.00,80.00,8.00,0.00)', 'register: sumForBudget / sumForAccounting are NET (the line shows the total 88), the VAT is beside them');

-- 9. Monitor01: the VAT of the three money columns ------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("sumVendorInvoiced") || '/' || sum("vatVendorInvoiced") || '/' || sum("vatInCostVendorInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), '100.00/10.00/0.00', 'monitor01_view: Vendor Invoice amount NET 100, its VAT 10, the VAT that is cost 0');
SELECT tt.eq((SELECT sum("vatCustomerInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, '... the customer columns stay 0');
SELECT tt.eq(public.monitor01_verify(), 0, 'monitor01_verify: the new columns agree with the register');

-- 10. the project cost total: the COST basis (costTotalForBudget) and With VAT (costTotalForBudgetWithVAT) -------------------------------------------------------------------------------
SELECT t."projectGUID" AS prj FROM public.project_task_table t WHERE t."rowGUID" = :'t3' \gset
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectExpenseBudgetNeeded": true}' WHERE "rowGUID" = :'prj';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t3', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000001', 'qtyTaskLine', 10, 'sumForBudget', 100, 'sumVATForBudget', 21, 'sumForContract', 50, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))))));
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "costOwnForBudget" || '/' || "costOwnForBudgetWithVAT" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'t3'), '100.00/121.00', 'a recoverable VAT: the cost is the net 100, With VAT is 121');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'prj')), 0::bigint, '... the hot path equals a rebuild from scratch (verify)');
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"vatRecoverablePercentTaskLine": 0}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t3', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000001', 'qtyTaskLine', 10, 'sumForBudget', 100, 'sumVATForBudget', 21, 'sumForContract', 50, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))))));
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "costOwnForBudget" || '/' || "costOwnForBudgetWithVAT" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'t3'), '121.00/121.00', 'a NOT recoverable VAT is cost: the cost basis 121 = With VAT');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'prj')), 0::bigint, '... verify: nothing differs');
SELECT tt.eq((SELECT sum("vatForBudgetPlan") || '/' || sum("vatInCostForBudgetPlan") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), '21.00/21.00', 'the turnover carries the plan VAT and the VAT that is cost');
SELECT tt.eq((SELECT sum("vatBudget") || '/' || sum("vatInCostBudget") || '/' || sum("sumForBudget") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), '21.00/21.00/100.00', 'Monitor01 Budget: NET 100, VAT 21, the VAT that is cost 21');

-- 11. fact input: the VAT sums come from the VAT rate of the task line of the line (STRONG input); a free line has none ------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_fact_document_create(:'t3') AS f1 \gset
INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract", "rowPeriodDatetime", "rowJSON") VALUES (:'f1', 'materialGenus', 2, '2026-10-12', '{"measureUnitTaskLine":"unit_pcs","priceTaskLine":5,"unitSumForBudget":10,"unitSumForAccounting":8}');
SELECT tt.eq((SELECT ("sumForBudget", "vatForBudget", "vatForContract")::text FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'f1' AND "qtyForContract" = 2), '(20.00,,)', 'a FREE fact line has no task line, so no VAT rate: its VAT sums are empty (NULL)');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"factStrongInputByTaskLine": true}' WHERE "rowGUID" = :'prj';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_fact_document_create(:'t3') AS f2 \gset
SELECT f."rowGUID" AS fg FROM public.task_fact_usage_timeline f WHERE f."rowHeaderGUID" = :'f2' AND f."taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001' \gset
UPDATE public.task_fact_usage_timeline SET "qtyForContract" = 4 WHERE "rowGUID" = :'fg';
SELECT tt.eq((SELECT ("sumForContract", "sumForBudget", "sumForAccounting")::text FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'fg'), '(20.00,40.00,32.00)', 'strong: the net sums are as before (4 x the unit sums)');
SELECT tt.eq((SELECT ("vatForContract", "vatForBudget", "vatForAccounting")::text FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'fg'), '(4.20,8.40,6.72)', 'strong: the VAT sums = the net sums x the 21 % of the task line');
SELECT tt.eq((SELECT ("vatInCostForBudget", "vatInCostForAccounting")::text FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'fg'), '(8.40,6.72)', '... and the task line is NOT recoverable (0 %), so all of it is cost');
SELECT tt.fails(format($q$UPDATE public.task_fact_usage_timeline SET "rowJSON" = "rowJSON" || '{"vatRatioTaskLine": 5}' WHERE "rowGUID" = %L$q$, :'fg'), 'only the date and the quantity', 'the VAT rate is frozen into the line: it cannot be changed');
ROLLBACK;
