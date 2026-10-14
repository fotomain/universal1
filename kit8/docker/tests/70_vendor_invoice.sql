-- PART 26: the legal entity catalog, the main vendor, the vendor invoice (one vendor + one contract per document), its posting into the project status register
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'name' = 'Task 112' \gset
SELECT t."rowGUID" AS tm FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'name' = 'Task 112' \gset
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset
SELECT c."rowGUID" AS country1 FROM public."countryTable" c ORDER BY c."orderInList" LIMIT 1 \gset

-- 1. the legal entity catalog: folder = a country or 'empty' ---------------------------------------------------------------------------------------------------------
INSERT INTO public."legalEntityTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES
  ('le-1', :'country1', '{"title": "Acme SIA", "isActive": true}'),
  ('le-2', 'empty', '{"title": "Acme Holding", "isActive": true}');
SELECT tt.eq((SELECT count(*) FROM public."legalEntityTable"), 2::bigint, 'two legal entities: one in a country folder, one without');
SELECT tt.fails($q$INSERT INTO public."legalEntityTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('le-bad', 'no-such-country', '{}')$q$, 'country', 'the folder of a legal entity must be a country');

-- 2. partners and contracts of the vendors ---------------------------------------------------------------------------------------------------------------------------
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES
  ('vp-1', '{"partnerTitle": "Acme Supplies", "partnerKind": "company", "isActive": true, "partnerIsSupplier": true}'),
  ('vp-2', '{"partnerTitle": "Beta Trade", "partnerKind": "company", "isActive": true, "partnerIsSupplier": true}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('vc-1', 'vp-1', 'partner', '{"contractPartyType": "partner", "contractNumber": "S-1", "contractTitle": "Supply", "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "le-1"}'),
  ('vc-2', 'vp-1', 'partner', '{"contractPartyType": "partner", "contractNumber": "S-2", "contractTitle": "Services", "contractCurrency": "USD", "contractSumBeforeVAT": 0}'),
  ('vc-3', 'vp-2', 'partner', '{"contractPartyType": "partner", "contractNumber": "B-1", "contractTitle": "Trade", "contractCurrency": "EUR", "contractSumBeforeVAT": 0, "legalEntityGUID": "le-1"}');
SELECT tt.fails($q$INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('vc-bad', 'vp-1', 'partner', '{"contractPartyType": "partner", "contractSumBeforeVAT": 0, "legalEntityGUID": "le-none"}')$q$, 'legal entity', 'a contract with a legal entity that does not exist is refused');
SELECT tt.eq((SELECT "rowJSON"->>'legalEntityGUID' IS NULL FROM public."contractTable" WHERE "rowGUID" = 'vc-2'), true, 'the legal entity of a contract is NOT obligatory');
SELECT tt.fails($q$DELETE FROM public."legalEntityTable" WHERE "rowGUID" = 'le-1'$q$, 'used by a contract', 'a legal entity of a contract is not deleted');

-- 3. the main vendor of a product / equipment / partner ------------------------------------------------------------------------------------------------------------
SELECT p."rowGUID" AS prod1 FROM public."productTable" p ORDER BY p."rowGUID" LIMIT 1 \gset
SELECT e."rowGUID" AS equip1 FROM public."equipmentTable" e ORDER BY e."rowGUID" LIMIT 1 \gset
UPDATE public."productTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID": "vp-2", "mainVendorContractGUID": "vc-3"}' WHERE "rowGUID" = :'prod1';
SELECT tt.eq((SELECT "rowJSON"->>'mainVendorContractGUID' FROM public."productTable" WHERE "rowGUID" = :'prod1'), 'vc-3', 'main vendor + its contract in a product');
SELECT tt.fails(format($q$UPDATE public."productTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID": "vp-2", "mainVendorContractGUID": "vc-1"}' WHERE "rowGUID" = %L$q$, :'prod1'), 'not a contract of the main vendor', 'the contract of ANOTHER vendor is refused');
SELECT tt.fails(format($q$UPDATE public."productTable" SET "rowJSON" = ("rowJSON" - 'mainVendorGUID') || '{"mainVendorContractGUID": "vc-3"}' WHERE "rowGUID" = %L$q$, :'prod1'), 'needs mainVendorGUID', 'a contract without the vendor is refused');
SELECT tt.fails(format($q$UPDATE public."productTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID": "no-such-partner"}' WHERE "rowGUID" = %L$q$, :'prod1'), 'is not a partner', 'a vendor that is not a partner is refused');
UPDATE public."equipmentTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID": "vp-1"}' WHERE "rowGUID" = :'equip1';
SELECT tt.eq((SELECT "rowJSON"->>'mainVendorGUID' FROM public."equipmentTable" WHERE "rowGUID" = :'equip1'), 'vp-1', 'main vendor of equipment (no contract: allowed)');
SELECT tt.fails($q$UPDATE public."partnerTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID": "vp-1"}' WHERE "rowGUID" = 'vp-1'$q$, 'own main vendor', 'a partner is not its own main vendor');
UPDATE public."partnerTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID": "vp-2", "mainVendorContractGUID": "vc-3"}' WHERE "rowGUID" = 'vp-1';
SELECT tt.eq((SELECT "rowJSON"->>'mainVendorGUID' FROM public."partnerTable" WHERE "rowGUID" = 'vp-1'), 'vp-2', 'main vendor of a partner');

-- 4. the task lines of anna's task ------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000001', :'t3', 'materialGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 10, 'priceTaskLine', 5, 'vatRatioTaskLine', 21, 'taskLinePartnerItem', 'vp-1', 'taskLinePartnerContract', 'vc-1', 'sumForBudget', 100, 'sumForAccounting', 80)),
  ('cccccccc-0000-0000-0000-000000000002', :'t3', 'materialGenus', 2, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 4, 'priceTaskLine', 2, 'vatRatioTaskLine', 21, 'taskLinePartnerItem', 'vp-1', 'taskLinePartnerContract', 'vc-1')),
  ('cccccccc-0000-0000-0000-000000000003', :'t3', 'materialGenus', 3, jsonb_build_object('resourceRoleItem', :'role1', 'taskResourceItem', :'prod1', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 6, 'priceTaskLine', 3, 'vatRatioTaskLine', 21)),
  ('cccccccc-0000-0000-0000-000000000004', :'t3', 'expenseGenus', 4, jsonb_build_object('measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 1, 'priceTaskLine', 100, 'vatRatioTaskLine', 0, 'taskLinePartnerItem', 'vp-1', 'taskLinePartnerContract', 'vc-2')),
  ('cccccccc-0000-0000-0000-000000000005', :'t3', 'timeGenus', 5, jsonb_build_object('resourceRoleItem', :'role1', 'taskResourceKind', 'person', 'taskResourceItem', 'p-boris', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 8, 'priceTaskLine', 10));

-- 5. the vendors of the task lines ------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.vendor_invoice_candidates(:'t3') AS cand \gset
SELECT tt.eq(jsonb_array_length(:'cand'::jsonb->'rows'), 3, 'three (vendor, contract) pairs: S-1 (2 lines), B-1 by the main vendor of the product, S-2');
SELECT tt.eq((SELECT (r->>'lineCount')::int FROM jsonb_array_elements(:'cand'::jsonb->'rows') r WHERE r->>'contractGUID' = 'vc-1'), 2, 'the contract of the line wins: both lines of S-1 are ONE document');
SELECT tt.eq((SELECT r->>'partnerGUID' FROM jsonb_array_elements(:'cand'::jsonb->'rows') r WHERE r->>'contractGUID' = 'vc-3'), 'vp-2', 'a line without a contract: the main vendor of its product and ITS main contract');
SELECT tt.eq((SELECT r->>'contractInfo' FROM jsonb_array_elements(:'cand'::jsonb->'rows') r WHERE r->>'contractGUID' = 'vc-2'), 'S-2 · Services', 'the contract info = number · title');
SELECT tt.eq((:'cand'::jsonb->>'skipped')::int, 1, 'the Time line of a person has no vendor: skipped');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.vendor_invoice_candidates(%L)$q$, :'t3'), 'not your project', 'marko cannot ask for the vendors of anna''s task');

-- 6. create: ONE document per vendor + contract ------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT jsonb_agg(jsonb_build_object('partnerGUID', r->>'partnerGUID', 'contractGUID', r->>'contractGUID', 'lineGUIDs', r->'lineGUIDs')) AS sel FROM jsonb_array_elements(:'cand'::jsonb->'rows') r \gset
SELECT tt.fails(format($q$SELECT public.create_vendor_invoices(%L, %L::jsonb)$q$, :'t3', :'sel'), 'choose the legal entity', 'S-2 has no legal entity: the user must choose one');
SELECT public.create_vendor_invoices(:'t3', :'sel'::jsonb, 'le-2') AS made \gset
SELECT tt.eq(jsonb_array_length(:'made'::jsonb->'documents'), 3, 'three documents were made');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_header), 3::bigint, '... three headers');
SELECT tt.eq((SELECT count(DISTINCT (h."rowJSON"->>'vendorInvoicePartner') || '/' || COALESCE(h."rowJSON"->>'vendorInvoiceContract', '')) FROM public.vendor_invoice_header h), 3::bigint, 'each document has its own vendor + contract');
SELECT tt.eq((SELECT h."rowJSON"->'documentHeader'->>'documentNumber' ~ '^VI-[0-9]{5}$' FROM public.vendor_invoice_header h LIMIT 1), true, 'document numbers VI-nnnnn');
SELECT h."rowGUID" AS d1 FROM public.vendor_invoice_header h WHERE h."rowJSON"->>'vendorInvoiceContract' = 'vc-1' \gset
SELECT h."rowGUID" AS d2 FROM public.vendor_invoice_header h WHERE h."rowJSON"->>'vendorInvoiceContract' = 'vc-3' \gset
SELECT h."rowGUID" AS d3 FROM public.vendor_invoice_header h WHERE h."rowJSON"->>'vendorInvoiceContract' = 'vc-2' \gset
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1'), 'le-2', 'the legal entity given is the owner of the document (not unique)');
SELECT tt.eq((SELECT "rowJSON"->>'vendorInvoiceCurrency' FROM public.vendor_invoice_header WHERE "rowGUID" = :'d3'), 'USD', 'the currency of the contract is a snapshot in the document');
SELECT tt.eq((SELECT "rowJSON"->>'vendorInvoiceFolder' FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1'), 'le-2:vp-1', 'the folder = legal entity : vendor');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), 2::bigint, 'S-1 has its 2 lines');
SELECT tt.eq((SELECT ("qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "sumForContract", "vatForContract")::text FROM public.vendor_invoice_lines WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'),
             '(10.00,5.0000,21.000,50.00,10.50)', 'a line: quantity 10 (all of the plan), price 5, VAT 21 % -> 50.00 + 10.50');
SELECT tt.eq((SELECT ("sumForBudget", "sumForAccounting", "vatForAccounting")::text FROM public.vendor_invoice_lines WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'),
             '(100.00,80.00,16.80)', 'the budget / accounting sums by the rate of the plan of the line');
-- nothing left to invoice: the second creation makes nothing
SELECT public.create_vendor_invoices(:'t3', :'sel'::jsonb, 'le-2') AS again \gset
SELECT tt.eq(jsonb_array_length(:'again'::jsonb->'documents'), 0, 'the quantity is already on the invoices: no new document');
SELECT tt.eq(jsonb_array_length(:'again'::jsonb->'skipped'), 3, '... all three pairs are reported as nothing left to invoice');

-- 7. the lines of a draft: quantity, price, VAT % ----------------------------------------------------------------------------------------------------------------------
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 4 WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT ("sumForContract", "vatForContract")::text FROM public.vendor_invoice_lines WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), '(20.00,4.20)', 'the sums follow the quantity');
UPDATE public.vendor_invoice_lines SET "priceInvoiced" = 6, "vatRatioInvoiced" = 10 WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT ("sumForContract", "vatForContract", "sumForBudget")::text FROM public.vendor_invoice_lines WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), '(24.00,2.40,48.00)', 'a price of the vendor different from the plan: contract sum 24, VAT 10 %, budget sum 48 = 24 x (plan 10 per unit / plan price 5)');
SELECT tt.fails($q$UPDATE public.vendor_invoice_lines SET "genusGUID" = 'timeGenus' WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'$q$, 'only the quantity', 'the identity of a line is frozen');
SELECT tt.fails($q$UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = -1 WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'$q$, 'vendor_invoice_lines_qty_chk', 'a negative quantity is refused');
SELECT tt.fails($q$INSERT INTO public.vendor_invoice_header ("rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES ('le-1', 'x', '{}')$q$, 'permission denied', 'a user cannot write a header (only the RPCs)');
SELECT tt.fails($q$INSERT INTO public.vendor_invoice_lines ("rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID") SELECT "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID" FROM public.vendor_invoice_lines LIMIT 1$q$, 'permission denied', 'a user cannot insert a line (the lines come from the task lines)');
-- the second line of S-1 is made as small as the example below
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 4, "priceInvoiced" = 2, "vatRatioInvoiced" = 10 WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000002';

-- 8. the header of a draft + post ---------------------------------------------------------------------------------------------------------------------------------------
SELECT public.post_vendor_invoice(:'d1') AS r0 \gset
SELECT tt.eq(:'r0'::jsonb->>'status', 'refused', 'Post is refused without the number and the date printed on the invoice');
SELECT tt.eq((SELECT p->>'problem' FROM jsonb_array_elements(:'r0'::jsonb->'problems') p WHERE p->>'problem' = 'invoiceNumberMissing'), 'invoiceNumberMissing', '... the problem says which');
SELECT public.vendor_invoice_set_header(:'d1', '{"vendorInvoiceNumber": " INV-77 ", "vendorInvoiceDateTime": "2026-10-20T00:00:00Z"}'::jsonb);
SELECT tt.eq((SELECT "rowJSON"->>'vendorInvoiceNumber' FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1'), 'INV-77', 'the number is trimmed and saved');
SELECT tt.fails(format($q$SELECT public.vendor_invoice_set_header(%L, '{"vendorInvoiceDateTime": "not a date"}'::jsonb)$q$, :'d1'), 'invalid input syntax', 'an unreadable date is refused');
SELECT tt.as_admin();
SELECT tt.fails(format($q$UPDATE public.vendor_invoice_header SET "rowJSON" = jsonb_set("rowJSON", '{vendorInvoicePartner}', '"vp-2"') WHERE "rowGUID" = %L$q$, :'d1'), 'cannot be changed', 'the vendor of a document never changes');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_vendor_invoice(:'d1') AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'status', 'posted', 'the invoice is posted');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' AND "rowMovementKind" = 'invoiced' AND "rowRegistratorType" = 'vendorInvoiceHeader'), 2::bigint, 'register: 2 invoiced movements, registrator = the document (same transaction)');
SELECT tt.eq((SELECT ("partnerGUID", "contractGUID", "legalEntityGUID")::text FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' LIMIT 1), '(vp-1,vc-1,le-2)', 'the vendor, the contract and the legal entity are dimensions of the movement');
SELECT tt.eq((SELECT sum("qtyProjectStatus") || '/' || sum("sumForContract") || '/' || sum("vatForContract") FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), '8.00/32.00/3.20', 'qtyProjectStatus, sum and VAT of the movements = the lines (4 x 6 + 4 x 2; VAT 10 % of 24 + 10 % of 8)');
SELECT tt.eq((SELECT "rowTurnoverDay" FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1' LIMIT 1), '2026-10-20'::date, 'the moment of the movement = the date of the invoice');
SELECT tt.eq(public.post_vendor_invoice(:'d1')->>'status', 'refused', 'a posted document cannot be posted again');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), 2::bigint, 'the lines of a posted invoice are still readable');
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 1 WHERE "rowHeaderGUID" = :'d1';
SELECT tt.eq((SELECT sum("qtyInvoiced") FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d1'), 8::numeric, 'the lines of a POSTED invoice are read only (the update changed nothing)');
SELECT tt.fails(format($q$SELECT public.delete_vendor_invoice(%L)$q$, :'d1'), 'unpost it first', 'a posted invoice is not deleted');
SELECT tt.fails(format($q$SELECT public.vendor_invoice_set_header(%L, '{"vendorInvoiceNumber": "X"}'::jsonb)$q$, :'d1'), 'unpost it first', 'a posted invoice is not changed');

-- 9. the turnover: the worker sums the register ---------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtyInvoiced") || '/' || sum("sumForContractInvoiced") || '/' || sum("vatForContractInvoiced") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), '8.00/32.00/3.20', 'project_status_month_turnover: qtyInvoiced, sumForContractInvoiced, vatForContractInvoiced');
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'invoiced is not used: the other kinds stay 0');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.monitor01_sum_sources('invoiced', jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 2, 'the drill-down of "invoiced" lists the movements of the posted invoice');
SELECT tt.eq((public.monitor01_sum_sources('invoiced', jsonb_build_object('taskGUID', :'t3'))->'rows'->0->>'documentNumber'), 'INV-77', '... with the number of the invoice');
SELECT tt.eq((public.monitor01_sum_sources('invoiced', jsonb_build_object('taskGUID', :'t3'))->>'sum')::numeric, 8::numeric, '... and its sum is the number of the cell');

-- 10. the list ------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.vendor_invoice_list() AS lst \gset
SELECT tt.eq((:'lst'::jsonb->>'totalCount')::int, 3, 'the list: 3 documents');
SELECT tt.eq((SELECT (r->>'sumBeforeVAT') || '/' || (r->>'sumVAT') || '/' || (r->>'sumWithVAT') FROM jsonb_array_elements(:'lst'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'::text), '32.00/3.20/35.20', 'the totals of a document: before VAT / VAT / with VAT');
SELECT tt.eq((SELECT jsonb_agg(t->>'currency' ORDER BY t->>'currency')::text FROM jsonb_array_elements(:'lst'::jsonb->'totalsByCurrency') t), '["EUR", "USD"]', 'totals per currency: EUR and USD are never added');
SELECT tt.eq((public.vendor_invoice_list('{"partnerGUID": "vp-2"}')->>'totalCount')::int, 1, 'filter: vendor');
SELECT tt.eq((public.vendor_invoice_list('{"currency": "USD"}')->>'totalCount')::int, 1, 'filter: currency of the contract');
SELECT tt.eq((public.vendor_invoice_list('{"status": "posted"}')->>'totalCount')::int, 1, 'filter: status');
SELECT tt.eq((public.vendor_invoice_list('{"number": "inv-77"}')->>'totalCount')::int, 1, 'filter: number (contains, any case)');
SELECT tt.eq((public.vendor_invoice_list('{"fromDay": "2026-10-20", "toDay": "2026-10-20"}')->>'totalCount')::int, 1, 'filter: the date of the invoice');
SELECT tt.eq((public.vendor_invoice_list('{"legalEntityGUID": "le-2"}')->>'totalCount')::int, 3, 'filter: legal entity');
SELECT tt.eq((public.vendor_invoice_list('{"author": "anna"}')->>'totalCount')::int, 3, 'filter: author (contains)');
SELECT tt.eq(jsonb_array_length(public.vendor_invoice_list('{}', 2, 0)->'rows'), 2, 'paging: 2 of 3');
SELECT tt.eq((public.vendor_invoice_list(jsonb_build_object('documentGUIDs', jsonb_build_array(:'d1', :'d3')))->>'totalCount')::int, 2, 'filter: a list of document GUIDs (the tabs of the form)');

-- 11. another organization sees nothing and may not post ------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_header), 0::bigint, 'marko (another organization) sees no invoice');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_lines), 0::bigint, '... and no line');
SELECT tt.eq((public.vendor_invoice_list()->>'totalCount')::int, 0, '... and the list is empty');
SELECT tt.fails(format($q$SELECT public.post_vendor_invoice(%L)$q$, :'d2'), 'does not exist', 'marko cannot post a document of another organization');
SELECT tt.fails(format($q$SELECT public.delete_vendor_invoice(%L)$q$, :'d2'), 'does not exist', '... nor delete it');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'invoiced'), 0::bigint, 'the register of anna is not readable for marko');
DELETE FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1'), 1::bigint, 'marko cannot delete a document of another organization directly either');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
DELETE FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1';
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_header WHERE "rowGUID" = :'d1'), 1::bigint, 'a POSTED document is not deleted directly (the policy refuses, nothing changed)');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');

-- 12. unpost and delete -----------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_vendor_invoice(:'d1') AS r2 \gset
SELECT tt.eq(:'r2'::jsonb->>'status', 'draft', 'Unpost: back to a draft');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'d1'), 0::bigint, '... the movements are gone in the same transaction');
SELECT public.delete_vendor_invoice(:'d2');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_header), 2::bigint, 'a draft is deleted');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_header), 2::bigint, 'a draft is deleted');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'d2'), 0::bigint, '... with its lines');
SELECT public.create_vendor_invoices(:'t3', :'sel'::jsonb, 'le-2') AS regen \gset
SELECT tt.eq(jsonb_array_length(:'regen'::jsonb->'documents'), 2, 'after the delete the quantity is free again (B-1 is made again) and the part of S-1 that the first document did not take (10 - 4 = 6) gets its own document');
SELECT tt.eq((SELECT sum("qtyInvoiced") FROM public.vendor_invoice_lines l JOIN public.vendor_invoice_header h ON h."rowGUID" = l."rowHeaderGUID" WHERE l."taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), 10::numeric, 'all of the plan quantity of the line is on invoices, never more');
SELECT tt.as_admin();
SELECT tt.fails($q$DELETE FROM public."legalEntityTable" WHERE "rowGUID" = 'le-2'$q$, 'used by a contract or a vendor invoice', 'a legal entity of an invoice is not deleted');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT COALESCE(sum("qtyInvoiced"), 0) FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'the turnover loses the invoiced numbers after Unpost (the row itself goes: nothing else in it)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), 0::bigint, '... no empty row stays');

ROLLBACK;
