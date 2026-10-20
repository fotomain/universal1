-- PART 31: the CUSTOMER INVOICE (made from the Revenue lines of a task, the twin of the vendor invoice), its 'sold' movements and the group Customer Invoice (Qty, Sum) of Monitor01
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3, t."projectGUID" AS p1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset

-- 1. customers, contracts, legal entity, the Revenue lines of anna's task ---------------------------------------------------------------------------------------------------
INSERT INTO public."legalEntityTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('cle-1', 'empty', '{"title": "Acme SIA", "isActive": true}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES
  ('cu-1', '{"partnerTitle": "Big Customer", "partnerKind": "company", "isActive": true}'),
  ('cu-2', '{"partnerTitle": "Small Customer", "partnerKind": "company", "isActive": true}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cc-1', 'cu-1', 'partner', '{"contractPartyType": "partner", "contractNumber": "C-1", "contractTitle": "Sales", "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "cle-1"}');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('dddddddd-0000-0000-0000-000000000001', :'t3', 'revenueGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 10, 'priceTaskLine', 20, 'vatRatioTaskLine', 21, 'taskLinePartnerItem', 'cu-1', 'taskLinePartnerContract', 'cc-1', 'sumForBudget', 400, 'sumForAccounting', 400)),
  ('dddddddd-0000-0000-0000-000000000002', :'t3', 'revenueGenus', 2, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 5, 'priceTaskLine', 10, 'vatRatioTaskLine', 21, 'taskLinePartnerItem', 'cu-2')),
  ('dddddddd-0000-0000-0000-000000000003', :'t3', 'revenueGenus', 3, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 2, 'priceTaskLine', 7, 'vatRatioTaskLine', 0)),
  ('dddddddd-0000-0000-0000-000000000004', :'t3', 'materialGenus', 4, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 9, 'priceTaskLine', 1, 'taskLinePartnerItem', 'cu-1'));

-- 2. the customers of the Revenue lines (Material / Time / Expense lines are not customer lines) ---------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.customer_invoice_candidates(:'t3') AS cand \gset
SELECT tt.eq(jsonb_array_length(:'cand'::jsonb->'rows'), 2, 'two (customer, contract) pairs: C-1 by the contract of the line, Small Customer by the partner of the line');
SELECT tt.eq((SELECT r->>'contractGUID' FROM jsonb_array_elements(:'cand'::jsonb->'rows') r WHERE r->>'partnerGUID' = 'cu-1'), 'cc-1', 'the contract of the line gives its partner and its contract');
SELECT tt.eq((SELECT r->>'legalEntityGUID' FROM jsonb_array_elements(:'cand'::jsonb->'rows') r WHERE r->>'partnerGUID' = 'cu-1'), 'cle-1', 'the legal entity of the contract is offered');
SELECT tt.eq((:'cand'::jsonb->>'skipped')::int, 1, 'the Revenue line without a customer is skipped (a draft without a customer can still be made of it)');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(:'cand'::jsonb->'rows') r WHERE (r->>'lineCount')::int <> 1), 0::bigint, 'the Material line of cu-1 is NOT a customer line (one line each)');
-- the MAIN CUSTOMER of the project (Project settings → Partners) is the customer of the lines that have none
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"mainCustomerGUID": "cu-2"}' WHERE "rowGUID" = :'p1';
SELECT tt.eq((public.customer_invoice_candidates(:'t3')->>'skipped')::int, 0, 'with a main customer on the project no Revenue line is left without a customer');
SELECT tt.eq((SELECT r->>'lineCount' FROM jsonb_array_elements(public.customer_invoice_candidates(:'t3')->'rows') r WHERE r->>'partnerGUID' = 'cu-2'), '2', '... the line without a customer joins the main customer (with the line that has it as its partner)');
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'mainCustomerGUID' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.customer_invoice_candidates(%L)$q$, :'t3'), 'not your project', 'marko cannot ask for the customers of anna''s task');

-- 3. create: ONE document per customer + contract ----------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT jsonb_agg(jsonb_build_object('partnerGUID', r->>'partnerGUID', 'contractGUID', r->>'contractGUID', 'lineGUIDs', r->'lineGUIDs')) AS sel FROM jsonb_array_elements(:'cand'::jsonb->'rows') r \gset
SELECT tt.fails(format($q$SELECT public.create_customer_invoices(%L, %L::jsonb)$q$, :'t3', :'sel'), 'choose the legal entity', 'Small Customer has no contract and no legal entity: the user must choose one');
SELECT public.create_customer_invoices(:'t3', :'sel'::jsonb, 'cle-1') AS made \gset
SELECT tt.eq(jsonb_array_length(:'made'::jsonb->'documents'), 2, 'two documents were made');
SELECT tt.eq((SELECT h."rowJSON"->'documentHeader'->>'documentNumber' ~ '^CI-[0-9]{5}$' FROM public.customer_invoice_header h LIMIT 1), true, 'document numbers CI-nnnnn');
SELECT h."rowGUID" AS d1 FROM public.customer_invoice_header h WHERE h."rowJSON"->>'customerInvoicePartner' = 'cu-1' \gset
SELECT h."rowGUID" AS d2 FROM public.customer_invoice_header h WHERE h."rowJSON"->>'customerInvoicePartner' = 'cu-2' \gset
SELECT tt.eq((SELECT "rowJSON"->>'customerInvoiceCurrency' FROM public.customer_invoice_header WHERE "rowGUID" = :'d1'), 'EUR', 'the currency of the contract is a snapshot in the document');
SELECT tt.eq((SELECT ("genusGUID", "qtyInvoiced", "priceInvoiced", "sumForContract", "vatForContract", "sumForBudget")::text FROM public.customer_invoice_lines WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001'),
             '(revenueGenus,10.00,20.0000,200.00,42.00,400.00)', 'a line: the quantity of the plan, its price and VAT %; the budget sum by the rate of the plan');
SELECT tt.eq((SELECT count(*) FROM public.customer_invoice_lines WHERE "genusGUID" <> 'revenueGenus'), 0::bigint, 'only Revenue lines');
SELECT tt.fails($q$UPDATE public.customer_invoice_lines SET "genusGUID" = 'timeGenus' WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001'$q$, 'only the quantity', 'the identity of a line is frozen');
SELECT tt.fails($q$INSERT INTO public.customer_invoice_header ("rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES ('cle-1', 'x', '{}')$q$, 'permission denied', 'a user cannot write a header (only the RPCs)');
SELECT public.create_customer_invoices(:'t3', :'sel'::jsonb, 'cle-1') AS again \gset
SELECT tt.eq(jsonb_array_length(:'again'::jsonb->'documents'), 0, 'the quantity is already on the invoices: no new document');
-- a draft without a customer and an independent line
SELECT public.create_customer_invoices(:'t3', jsonb_build_array(jsonb_build_object('partnerGUID', NULL, 'contractGUID', NULL, 'lineGUIDs', :'cand'::jsonb->'skippedLineGUIDs')), 'cle-1') AS free \gset
SELECT tt.eq(jsonb_array_length(:'free'::jsonb->'documents'), 1, 'a draft WITHOUT a customer is made of the lines without one');
SELECT (:'free'::jsonb->'documents'->0->>'documentGUID')::uuid AS d3 \gset
SELECT public.customer_invoice_add_line(:'d3') AS l_free \gset
SELECT tt.eq((SELECT "genusGUID" FROM public.customer_invoice_lines WHERE "rowGUID" = :'l_free'), 'revenueGenus', 'an independent line is a Revenue line');
SELECT tt.fails(format($q$SELECT public.customer_invoice_add_line(%L, 'timeGenus')$q$, :'d3'), 'unknown kind of line', 'only Revenue lines can be added');

-- 4. post: the number and the date, the customer and the legal entity -----------------------------------------------------------------------------------------------------------
SELECT public.post_customer_invoice(:'d1') AS r0 \gset
SELECT tt.eq(:'r0'::jsonb->>'status', 'refused', 'Post is refused without the number and the date');
SELECT public.customer_invoice_set_header(:'d1', '{"customerInvoiceNumber": " CINV-9 ", "customerInvoiceDateTime": "2026-10-20T00:00:00Z"}'::jsonb);
SELECT public.post_customer_invoice(:'d3') AS r3 \gset
SELECT tt.eq((SELECT p->>'problem' FROM jsonb_array_elements(:'r3'::jsonb->'problems') p WHERE p->>'problem' = 'customerMissing'), 'customerMissing', 'a draft without a customer cannot be posted');
UPDATE public.customer_invoice_lines SET "qtyInvoiced" = 4, "priceInvoiced" = 25 WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT ("sumForContract", "vatForContract", "sumForBudget")::text FROM public.customer_invoice_lines WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001'), '(100.00,21.00,200.00)', 'the sums follow the quantity and the price (budget sum = contract sum at the plan rate)');
-- VAT basis: even a NOT recoverable rate gives no cost on a customer invoice (the VAT is collected for the tax authority, IFRS 15)
INSERT INTO public."valueAddedTaxTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES ('vat_nd10', 'valueAddedTaxCatalog', 'empty', 9000, '{"vatTableTitle": "10 % not deductible", "vatTablePercent": 10, "vatRecoverablePercent": 0}') ON CONFLICT ("rowGUID") DO NOTHING;
UPDATE public.customer_invoice_lines SET "rowJSON" = "rowJSON" || '{"vatRateGUID": "vat_nd10"}' WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT ("vatRatioInvoiced", "vatForContract", "vatInCostForBudget")::text FROM public.customer_invoice_lines WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001'), '(10.000,10.00,0.00)', 'customer invoice: the rate comes from the catalog, the VAT that is cost is always 0');
UPDATE public.customer_invoice_lines SET "rowJSON" = "rowJSON" || '{"vatRateGUID": "vat_21"}' WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "vatForContract" FROM public.customer_invoice_lines WHERE "taskLineGUID" = 'dddddddd-0000-0000-0000-000000000001'), 21::numeric, '... back to 21 %');
SELECT public.post_customer_invoice(:'d1') AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'status', 'posted', 'the invoice is posted');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' AND "rowMovementKind" = 'sold' AND "rowRegistratorType" = 'customerInvoiceHeader'), 1::bigint, 'register: a sold movement, registrator = the document (same transaction)');
SELECT tt.eq((SELECT ("partnerGUID", "contractGUID", "legalEntityGUID", "genusGUID")::text FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), '(cu-1,cc-1,cle-1,revenueGenus)', 'the customer, the contract and the legal entity are dimensions of the movement');
SELECT tt.eq(public.post_customer_invoice(:'d1')->>'status', 'refused', 'a posted document cannot be posted again');
SELECT tt.fails(format($q$SELECT public.delete_customer_invoice(%L)$q$, :'d1'), 'unpost it first', 'a posted invoice is not deleted');
SELECT tt.fails(format($q$SELECT public.customer_invoice_set_header(%L, '{"customerInvoiceNumber": "X"}'::jsonb)$q$, :'d1'), 'unpost it first', 'a posted invoice is not changed');

-- 5. Monitor01: the group Customer Invoice (Qty, Sum) -----------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtySold") || '/' || sum("sumForBudgetSold") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), '4.00/200.00', 'the turnover has the sold numbers');
SELECT tt.eq((SELECT "qtyCustomerInvoiced" || '/' || "sumCustomerInvoiced" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'revenueGenus'), '4.00/200.00', 'monitor01_view: Customer Invoice Qty and Sum on a row of the Revenue genus');
SELECT tt.eq((SELECT ("qtyPlanned", "qtyContracted", "sumForBudget", "qtyUsed", "qtyVendorInvoiced", "qtyOrdered", "qtyReceived")::text FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'revenueGenus'), '(0.00,0.00,0.00,0.00,0.00,0.00,0.00)', 'the Revenue row has nothing else: no plan, no Budget (revenue is in the report only through the customer invoices)');
SELECT tt.eq((SELECT sum(f."qtyCustomerInvoiced") || '/' || sum(f."sumCustomerInvoiced") FROM public.monitor01_fresh_rows(ARRAY[:'t3'::uuid]) f), '4.00/200.00', 'monitor01_fresh_rows: the same numbers');
SELECT tt.eq(public.monitor01_verify(), 0, 'monitor01_verify: no difference');
SELECT tt.eq((SELECT sum("qtyVendorInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'a customer invoice is not a vendor invoice (the Vendor Invoice columns stay 0)');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.monitor01_sum_sources('customerInvoiced', jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 1, 'the drill-down of "customerInvoiced" lists the movement of the posted invoice');
SELECT tt.eq((public.monitor01_sum_sources('customerInvoiced', jsonb_build_object('taskGUID', :'t3'))->'rows'->0->>'documentNumber'), 'CINV-9', '... with the number of the invoice');
SELECT tt.eq((public.monitor01_sum_sources('customerInvoiced', jsonb_build_object('taskGUID', :'t3'))->>'sum')::numeric, 4::numeric, '... and its sum is the number of the cell');

-- 6. unpost, delete ------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.unpost_customer_invoice(:'d1') AS u \gset
SELECT tt.eq(:'u'::jsonb->>'status', 'draft', 'unposted');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), 0::bigint, 'the movements are gone');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'revenueGenus'), 0::bigint, 'after Unpost the Revenue row disappears from the report');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.delete_customer_invoice(:'d2');
SELECT tt.eq((SELECT count(*) FROM public.customer_invoice_header WHERE "rowGUID" = :'d2'), 0::bigint, 'a draft is deleted (its lines with it)');

-- 7. the list ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.customer_invoice_list('{}'::jsonb) AS l1 \gset
SELECT tt.eq((:'l1'::jsonb->>'totalCount')::int, 2, 'the list: the two documents left');
SELECT tt.eq((public.customer_invoice_list(jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 2, 'filter by task (taskGUID)');
SELECT tt.eq((public.customer_invoice_list(jsonb_build_object('taskLineGUID', 'dddddddd-0000-0000-0000-000000000001'))->>'totalCount')::int, 1, 'filter by task line (taskLineGUID)');
SELECT tt.eq((public.customer_invoice_list(jsonb_build_object('partnerGUID', 'cu-1'))->>'totalCount')::int, 1, 'filter by customer');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((public.customer_invoice_list('{}'::jsonb)->>'totalCount')::int, 0, 'marko (another organization) sees none');

-- 8. the project switch customerInvoiceFunctionalityEnabled ----------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"customerInvoiceFunctionalityEnabled": false}' WHERE "rowGUID" = :'p1';
SELECT tt.fails(format($q$SELECT public.create_customer_invoices(%L, %L::jsonb, 'cle-1')$q$, :'t3', :'sel'), 'switched off', 'with the switch off no customer invoice is made');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"customerInvoiceFunctionalityEnabled": true}' WHERE "rowGUID" = :'p1';
SELECT tt.eq(jsonb_typeof(public.create_customer_invoices(:'t3', :'sel'::jsonb, 'cle-1')->'documents'), 'array', 'with the switch on (or never saved: the default) it works again');
ROLLBACK;
