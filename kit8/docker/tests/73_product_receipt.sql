-- PART 30 + 28 + 26: a PRODUCT RECEIPT is made from a POSTED purchase order, posted ('received' movements -> the column Delivered of Monitor01), and a VENDOR INVOICE is made from the posted receipt
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

-- 5. a purchase order of the two lines, posted ------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT jsonb_build_array(jsonb_build_object('partnerGUID', 'vp-1', 'contractGUID', 'vc-1', 'lineGUIDs', jsonb_build_array('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002'))) AS sel \gset
SELECT (public.create_purchase_orders(:'t3', :'sel'::jsonb)->'documents'->0->>'documentGUID')::uuid AS po \gset
UPDATE public.purchase_order_lines SET "qtyOrdered" = 7 WHERE "rowHeaderGUID" = :'po' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT public.purchase_order_set_header(:'po', '{"purchaseOrderNumber": "ORD-5", "purchaseOrderDateTime": "2026-10-18T00:00:00Z"}'::jsonb);
SELECT tt.fails(format($q$SELECT public.create_product_receipt_from_order(%L)$q$, :'po'), 'post the purchase order first', 'a product receipt is made from a POSTED purchase order only');
SELECT tt.eq(public.post_purchase_order(:'po')->>'status', 'posted', 'the purchase order is posted (7 + 4 ordered)');

-- 6. Create based on -> Product receipt ---------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.create_product_receipt_from_order(%L)$q$, :'po'), 'does not exist', 'another organization does not see the purchase order');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_product_receipt_from_order(:'po') AS made \gset
SELECT (:'made'::jsonb->'documents'->0->>'documentGUID')::uuid AS pr \gset
SELECT tt.eq((:'made'::jsonb->'documents'->0->>'lineCount')::int, 2, 'a product receipt with a line for every order line');
SELECT tt.eq((SELECT h."rowJSON"->'documentHeader'->>'documentNumber' ~ '^PR-[0-9]{5}$' FROM public.product_receipt_header h WHERE h."rowGUID" = :'pr'), true, 'the number of the product receipt: PR-nnnnn');
SELECT tt.eq((SELECT h."rowJSON"->>'productReceiptPurchaseOrder' FROM public.product_receipt_header h WHERE h."rowGUID" = :'pr'), :'po'::text, 'the receipt remembers its purchase order');
SELECT tt.eq((SELECT concat_ws('/', h."rowJSON"->>'productReceiptPartner', h."rowJSON"->>'productReceiptContract', h."rowOwnerGUID") FROM public.product_receipt_header h WHERE h."rowGUID" = :'pr'), 'vp-1/vc-1/le-1', 'vendor, contract and legal entity of the order');
SELECT tt.eq((SELECT sum("qtyReceived") FROM public.product_receipt_lines WHERE "rowHeaderGUID" = :'pr'), 11::numeric, 'the quantity starts as ordered (7 + 4)');
SELECT tt.eq((SELECT count(*) FROM public.product_receipt_lines WHERE "rowHeaderGUID" = :'pr' AND "purchaseOrderLineGUID" IS NOT NULL), 2::bigint, 'every line points to its purchase order line');
SELECT tt.eq((SELECT "sumForContract" || '/' || "vatForContract" FROM public.product_receipt_lines WHERE "rowHeaderGUID" = :'pr' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), '35.00/7.35', 'the sums of a line follow quantity x price and the VAT %');
UPDATE public.product_receipt_lines SET "qtyReceived" = 5 WHERE "rowHeaderGUID" = :'pr' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "sumForContract" FROM public.product_receipt_lines WHERE "rowHeaderGUID" = :'pr' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), 25::numeric, 'the sum follows the edited quantity (5 x 5)');
SELECT tt.fails(format($q$UPDATE public.product_receipt_lines SET "genusGUID" = 'expenseGenus' WHERE "rowHeaderGUID" = %L$q$, :'pr'), 'only the quantity', 'the kind of a line is frozen');
SELECT tt.fails(format($q$UPDATE public.product_receipt_lines SET "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000003' WHERE "rowHeaderGUID" = %L$q$, :'pr'), 'only the quantity', 'the task line of a line is frozen');
SELECT tt.eq(public.post_product_receipt(:'pr')->'problems'->0->>'problem', 'receiptNumberMissing', 'Post asks for the number of the receipt');
SELECT public.product_receipt_set_header(:'pr', '{"productReceiptNumber": "GRN-1", "productReceiptDateTime": "2026-10-20T00:00:00Z"}'::jsonb);
SELECT tt.fails(format($q$SELECT public.create_vendor_invoice_from_receipt(%L)$q$, :'pr'), 'post the product receipt first', 'a vendor invoice is made from a POSTED receipt only');
SELECT tt.eq(public.post_product_receipt(:'pr')->>'status', 'posted', 'the product receipt is posted');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'received' AND "rowRegistratorType" = 'productReceiptHeader'), 2::bigint, 'the register: 2 received movements, registrator type productReceiptHeader');
SELECT tt.eq((SELECT "rowTurnoverDay" FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'pr' LIMIT 1), '2026-10-20'::date, 'the moment of a received movement = the date of the receipt');
SELECT tt.fails(format($q$SELECT public.product_receipt_set_header(%L, '{"productReceiptNumber": "X"}')$q$, :'pr'), 'posted', 'a posted receipt cannot be changed');

-- 7. the second receipt of the same order gets what is left ----------------------------------------------------------------------------------------------------------
SELECT public.create_product_receipt_from_order(:'po') AS made2 \gset
SELECT (:'made2'::jsonb->'documents'->0->>'documentGUID')::uuid AS pr2 \gset
SELECT tt.eq((SELECT string_agg("qtyReceived"::text, ',' ORDER BY "orderInList") FROM public.product_receipt_lines WHERE "rowHeaderGUID" = :'pr2'), '2.00', 'the second receipt: ordered 7 - received 5 = 2 (the other line is fully received: no line)');
SELECT public.delete_product_receipt(:'pr2');
SELECT tt.eq((SELECT count(*) FROM public.product_receipt_header WHERE "rowGUID" = :'pr2'), 0::bigint, 'a draft receipt is deleted with its lines');

-- 8. Monitor01: the column Delivered ----------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtyDelivered") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 9::numeric, 'monitor01_view.qtyDelivered = the quantity of the posted receipt (5 + 4)');
SELECT tt.eq((SELECT sum("qtyOrdered") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 11::numeric, '... qtyOrdered stays the quantity of the purchase order (the columns do not mix)');
SELECT tt.eq((SELECT sum("qtyInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, '... and nothing is invoiced yet');
SELECT tt.eq((SELECT sum("qtyOnHand") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 9::numeric, 'on hand = delivered - used');
SELECT tt.eq((SELECT sum("qtyReceived") || '/' || sum("sumForContractReceived") || '/' || sum("vatForContractReceived") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), '9.00/33.00/6.93', 'the turnover: qtyReceived, sumForContractReceived, vatForContractReceived');
SELECT tt.eq((SELECT sum(f."qtyDelivered") FROM public.monitor01_fresh_rows(ARRAY[:'t3'::uuid]) f), 9::numeric, 'monitor01_fresh_rows carries qtyDelivered, so monitor01_verify compares it');
SELECT tt.eq(public.monitor01_verify(500), 0, 'monitor01_verify finds nothing to repair');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.monitor01_sum_sources('delivered', jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 2, 'the drill-down of "delivered" lists the movements of the receipt');
SELECT tt.eq((public.monitor01_sum_sources('delivered', jsonb_build_object('taskGUID', :'t3'))->'rows'->0->>'documentNumber'), 'GRN-1', '... with the number of the receipt');
SELECT tt.eq((public.monitor01_sum_sources('delivered', jsonb_build_object('taskGUID', :'t3'))->>'sum')::numeric, 9::numeric, '... and its sum is the number of the cell');

-- 9. the list --------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((public.product_receipt_list('{}'::jsonb)->>'totalCount')::int, 1, 'product_receipt_list: one document');
SELECT tt.eq(public.product_receipt_list(jsonb_build_object('purchaseOrderGUID', :'po'))->'rows'->0->>'purchaseOrderNumber', 'ORD-5', 'the list row shows the order number');
SELECT tt.eq((public.product_receipt_list(jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 1, 'filter taskGUID');
SELECT tt.eq((public.product_receipt_list(jsonb_build_object('taskLineGUID', 'cccccccc-0000-0000-0000-000000000002'))->>'totalCount')::int, 1, 'filter taskLineGUID');
SELECT tt.eq((public.product_receipt_list(jsonb_build_object('purchaseOrderGUID', gen_random_uuid()))->>'totalCount')::int, 0, 'filter purchaseOrderGUID: another order has no receipt');
SELECT tt.eq(public.product_receipt_list('{}'::jsonb)->'totalsByCurrency'->0->>'sumWithVAT', '39.93', 'totals per currency (33.00 + 6.93)');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((public.product_receipt_list('{}'::jsonb)->>'totalCount')::int, 0, 'another organization sees no receipt');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 10. Create based on -> Vendor invoice -----------------------------------------------------------------------------------------------------------------------------------
SELECT public.create_vendor_invoice_from_receipt(:'pr') AS made3 \gset
SELECT (:'made3'::jsonb->'documents'->0->>'documentGUID')::uuid AS vi \gset
SELECT tt.eq((:'made3'::jsonb->'documents'->0->>'lineCount')::int, 2, 'a vendor invoice with a line for every received line');
SELECT tt.eq((SELECT h."rowJSON"->'documentHeader'->>'documentNumber' ~ '^VI-[0-9]{5}$' FROM public.vendor_invoice_header h WHERE h."rowGUID" = :'vi'), true, 'the number of the invoice: VI-nnnnn');
SELECT tt.eq((SELECT concat_ws('/', h."rowJSON"->>'vendorInvoicePartner', h."rowJSON"->>'vendorInvoiceContract', h."rowOwnerGUID", h."rowJSON"->>'vendorInvoiceProductReceipt') FROM public.vendor_invoice_header h WHERE h."rowGUID" = :'vi'), 'vp-1/vc-1/le-1/' || :'pr', 'vendor, contract, legal entity and the receipt of the invoice');
SELECT tt.eq((SELECT sum("qtyInvoiced") FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'vi'), 9::numeric, 'the invoice quantity = the received quantity (5 + 4)');
SELECT tt.eq((SELECT count(*) FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = :'vi' AND "rowJSON" ? 'productReceiptLineGUID' AND "taskLineGUID" IS NOT NULL), 2::bigint, 'every invoice line keeps its receipt line and its task line');
SELECT public.create_vendor_invoice_from_receipt(:'pr') AS made4 \gset
SELECT tt.eq(:'made4'::jsonb->'skipped'->0->>'reason', 'nothingLeftToInvoice', 'a second invoice of the same receipt: nothing is left to invoice');
UPDATE public.vendor_invoice_lines SET "qtyInvoiced" = 3 WHERE "rowHeaderGUID" = :'vi' AND "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT public.create_vendor_invoice_from_receipt(:'pr') AS made5 \gset
SELECT tt.eq((SELECT string_agg("qtyInvoiced"::text, ',') FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = (:'made5'::jsonb->'documents'->0->>'documentGUID')::uuid), '2.00', 'after 3 of 5 were invoiced the next invoice gets the 2 that are left');
SELECT public.vendor_invoice_set_header(:'vi', '{"vendorInvoiceNumber": "INV-9", "vendorInvoiceDateTime": "2026-10-25T00:00:00Z"}'::jsonb);
SELECT tt.eq(public.post_vendor_invoice(:'vi')->>'status', 'posted', 'the invoice made from the receipt is posted');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtyDelivered") || '/' || sum("qtyInvoiced") || '/' || sum("qtyOrdered") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), '9.00/7.00/11.00', 'Monitor01: Ordered 11 · Delivered 9 · Invoiced 7 (3 + 4) - three columns, three documents');

-- 11. unpost the receipt: only the Delivered column goes ---------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.unpost_product_receipt(:'pr')->>'status', 'draft', 'the receipt is unposted');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT COALESCE(sum("qtyDelivered"), 0) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'after Unpost the column Delivered is 0');
SELECT tt.eq((SELECT sum("qtyOrdered") || '/' || sum("qtyInvoiced") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), '11.00/7.00', '... Ordered and Invoiced stay');
SELECT public.monitor01_rebuild(NULL);
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT COALESCE(sum("qtyDelivered"), 0) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'a rebuild of the report gives the same numbers');

ROLLBACK;
