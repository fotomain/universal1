-- PART 28 + 26: a PURCHASE ORDER and a VENDOR INVOICE on the same task lines - separate documents, separate register kinds (ordered / invoiced), two columns of Monitor01
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;
SELECT t."rowGUID" AS t3 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS tm FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
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

-- 5. one document of each kind for the same lines ------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT jsonb_build_array(jsonb_build_object('partnerGUID', 'vp-1', 'contractGUID', 'vc-1', 'lineGUIDs', jsonb_build_array('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002'))) AS sel \gset
SELECT public.create_purchase_orders(:'t3', :'sel'::jsonb) AS po_made \gset
SELECT public.create_vendor_invoices(:'t3', :'sel'::jsonb) AS vi_made \gset
SELECT tt.eq(jsonb_array_length(:'po_made'::jsonb->'documents'), 1, 'a purchase order is made for S-1');
SELECT tt.eq(jsonb_array_length(:'vi_made'::jsonb->'documents'), 1, '... and a vendor invoice for the SAME lines: the quantity of a purchase order is not taken from the invoices (nor the other way round)');
SELECT (:'po_made'::jsonb->'documents'->0->>'documentGUID')::uuid AS po \gset
SELECT (:'vi_made'::jsonb->'documents'->0->>'documentGUID')::uuid AS vi \gset
SELECT tt.eq((SELECT h."rowJSON"->'documentHeader'->>'documentNumber' ~ '^PO-[0-9]{5}$' FROM public.purchase_order_header h WHERE h."rowGUID" = :'po'), true, 'the number of the purchase order: PO-nnnnn');
SELECT tt.eq((SELECT h."rowJSON"->'documentHeader'->>'documentNumber' ~ '^VI-[0-9]{5}$' FROM public.vendor_invoice_header h WHERE h."rowGUID" = :'vi'), true, 'the number of the vendor invoice: VI-nnnnn (its own sequence)');
SELECT tt.eq((SELECT sum("qtyOrdered") FROM public.purchase_order_lines WHERE "rowHeaderGUID" = :'po'), 14::numeric, 'the purchase order takes all the plan quantity (10 + 4)');
UPDATE public.purchase_order_lines SET "qtyOrdered" = 7 WHERE "rowHeaderGUID" = :'po' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 4 WHERE "rowHeaderGUID" = :'vi' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT public.purchase_order_set_header(:'po', '{"purchaseOrderNumber": "ORD-5", "purchaseOrderDateTime": "2026-10-18T00:00:00Z"}'::jsonb);
SELECT public.vendor_invoice_set_header(:'vi', '{"vendorInvoiceNumber": "INV-9", "vendorInvoiceDateTime": "2026-10-25T00:00:00Z"}'::jsonb);
SELECT tt.eq(public.post_purchase_order(:'po')->>'status', 'posted', 'the purchase order is posted');
SELECT tt.eq(public.post_vendor_invoice(:'vi')->>'status', 'posted', 'the vendor invoice is posted');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'ordered' AND "rowRegistratorType" = 'purchaseOrderHeader'), 2::bigint, 'the register: 2 ordered movements, registrator type purchaseOrderHeader');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'invoiced' AND "rowRegistratorType" = 'vendorInvoiceHeader'), 2::bigint, '... and the 2 invoiced movements of the invoice');
SELECT tt.eq((SELECT "rowTurnoverDay" FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'po' LIMIT 1), '2026-10-18'::date, 'the moment of an ordered movement = the date of the purchase order');

-- 6. Monitor01: the column Ordered next to VendorInvoiced ----------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtyOrdered") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 11::numeric, 'monitor01_view.qtyOrdered = the quantity of the posted purchase order (7 + 4)');
SELECT tt.eq((SELECT sum("qtyVendorInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 8::numeric, '... qtyVendorInvoiced = the quantity of the posted vendor invoice (4 + 4): the two columns do not mix');
SELECT tt.eq((SELECT sum("qtyOrdered") || '/' || sum("sumForContractOrdered") || '/' || sum("vatForContractOrdered") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), '11.00/43.00/9.03', 'the turnover: qtyOrdered, sumForContractOrdered, vatForContractOrdered (7 x 5 + 4 x 2 = 43; VAT 21 % of the task lines = 9.03)');
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'ordered is not used');
SELECT tt.eq((SELECT sum(f."qtyOrdered") FROM public.monitor01_fresh_rows(ARRAY[:'t3'::uuid]) f), 11::numeric, 'monitor01_fresh_rows carries qtyOrdered, so monitor01_verify compares it');
SELECT tt.eq(public.monitor01_verify(500), 0, 'monitor01_verify finds nothing to repair: the view equals the fresh numbers');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.monitor01_sum_sources('ordered', jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 2, 'the drill-down of "ordered" lists the movements of the purchase order');
SELECT tt.eq((public.monitor01_sum_sources('ordered', jsonb_build_object('taskGUID', :'t3'))->'rows'->0->>'documentNumber'), 'ORD-5', '... with the number of the purchase order');
SELECT tt.eq((public.monitor01_sum_sources('ordered', jsonb_build_object('taskGUID', :'t3'))->>'sum')::numeric, 11::numeric, '... and its sum is the number of the cell');
SELECT tt.eq((public.monitor01_sum_sources('vendorInvoiced', jsonb_build_object('taskGUID', :'t3'))->>'sum')::numeric, 8::numeric, 'the drill-down of "vendorInvoiced" is not touched by the purchase order');

-- 7. unpost the purchase order: only the Ordered column goes ---------------------------------------------------------------------------------------------------------------
SELECT public.unpost_purchase_order(:'po');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT COALESCE(sum("qtyOrdered"), 0) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'after Unpost the column Ordered is 0');
SELECT tt.eq((SELECT sum("qtyVendorInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 8::numeric, '... the invoiced numbers stay');
SELECT public.monitor01_rebuild(NULL);
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT COALESCE(sum("qtyVendorInvoiced"), 0) || '/' || COALESCE(sum("qtyOrdered"), 0) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), '8.00/0.00', 'a rebuild of the report gives the same numbers');

ROLLBACK;
