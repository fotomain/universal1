-- PART 39: the PARTNER BALANCE (documentation/PARTNER_BALANCE.html): partner_balance_movements (the register: one signed row per posted invoice / payment line), partner_balance_ledger (the totals),
-- the triggers in the Post transaction, credit notes, the roles / refunds, the reports (dates, filters, sums bigger / smaller than, sort), the business unit roots rule, RLS, backfill, verify.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS t3, t."projectGUID" AS p1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t4 FROM public.project_task_table t WHERE t."projectGUID" = :'p1' AND t."rowGUID" <> :'t3' AND COALESCE(t."rowJSON"->>'rowKind', 'task') = 'task' ORDER BY t."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi_out FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'outboundPaymentGenus' ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT b."rowGUID" AS bi_in  FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'inboundPaymentGenus'  ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT "rowGUID" AS c_usd FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'USD' \gset
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"currencyForContract":"EUR","currencyForAccounting":"EUR","currencyForBudget":"EUR"}' WHERE "rowGUID" = :'p1';

INSERT INTO public."legalEntityTable" ("rowGUID", "rowJSON") VALUES ('le1', '{"title":"Acme Ltd"}'), ('le2', '{"title":"Acme GmbH"}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('pt1', '{"partnerTitle":"Supplier One"}'), ('pt2', '{"partnerTitle":"Supplier Two"}'), ('pt3', '{"partnerTitle":"Customer Three"}');
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('pe1', '{"personFirstName":"Pat","personLastName":"Lee"}');
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('c1', 'pt1', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-1', 'contractFinishDate', '2030-12-31', 'paymentBudgetItemOutbound', :'bi_out')),
  ('c3', 'pt2', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-3', 'contractFinishDate', '2030-06-30')),
  ('c4', 'pt3', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-4', 'paymentBudgetItemInbound', :'bi_in')),
  ('c5', 'pt1', 'partner', jsonb_build_object('contractPartyType', 'partner', 'contractSumBeforeVAT', 0, 'contractCurrency', 'USD', 'contractNumber', 'C-5')),
  ('cp1', 'pe1', 'person', jsonb_build_object('contractPartyType', 'person', 'contractSumBeforeVAT', 0, 'contractCurrency', 'EUR', 'contractNumber', 'C-P1', 'paymentBudgetItemOutbound', :'bi_out'));
INSERT INTO public."moneyAccountTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES
  ('ma-eur', 'le1', '{"moneyAccountTitle":"Bank EUR","moneyAccountKind":"bank","moneyAccountCurrency":"EUR"}'),
  ('ma-eur2', 'le2', '{"moneyAccountTitle":"Bank EUR 2","moneyAccountKind":"bank","moneyAccountCurrency":"EUR"}');
INSERT INTO public."businessUnitTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES
  ('bur1', 'empty', '{"title":"Root 1"}'), ('buc1', 'bur1', '{"title":"Child of root 1"}'), ('buc2', 'bur1', '{"title":"Another child of root 1"}'), ('bur2', 'empty', '{"title":"Root 2"}');
INSERT INTO public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'c_usd', '2030-01-01', jsonb_build_object('startingDate', '2030-01-01', 'currencyRatio', 1.25, 'rateType', 'Default')),
  (:'c_usd', '2030-01-01|Budget', jsonb_build_object('startingDate', '2030-01-01', 'currencyRatio', 1.25, 'rateType', 'Budget'));

-- helpers of this test: the partners / contracts of a report in the order it came, one number of a row
CREATE OR REPLACE FUNCTION tt.names(p_report jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(r->>'partnerTitle' || '/' || COALESCE(NULLIF(r->>'contractTitle', ''), '-') || '/' || (r->>'currencyForContract'), ',' ORDER BY ord), '') FROM jsonb_array_elements(p_report) WITH ORDINALITY AS x(r, ord)
$$;
CREATE OR REPLACE FUNCTION tt.num(p_report jsonb, p_partner text, p_contract text, p_field text, p_cur text DEFAULT 'EUR') RETURNS numeric LANGUAGE sql AS $$
  SELECT (r->>p_field)::numeric FROM jsonb_array_elements(p_report) r WHERE r->>'partner' = p_partner AND r->>'contract' = p_contract AND r->>'currencyForContract' = p_cur
$$;

-- the documents are written straight into their tables as the user anna (the header trigger takes her organization), then POSTED by the real Post functions
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'anna@acme.test', 'sub', '11111111-1111-1111-1111-111111111111')::text, true);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
INSERT INTO public.vendor_invoice_header ("rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'le1', 'x', jsonb_build_object('vendorInvoicePartner', 'pt1', 'vendorInvoiceContract', 'c1', 'vendorInvoiceNumber', 'VI-1', 'vendorInvoiceDateTime', '2030-01-03T00:00:00Z', 'documentHeader', jsonb_build_object('documentStatus', 'draft'))),
  ('eeeeeeee-0000-0000-0000-000000000003', 'le1', 'x', jsonb_build_object('vendorInvoicePartner', 'pt2', 'vendorInvoiceContract', 'c3', 'vendorInvoiceNumber', 'VI-3', 'vendorInvoiceDateTime', '2030-01-04T00:00:00Z', 'documentHeader', jsonb_build_object('documentStatus', 'draft'))),
  ('eeeeeeee-0000-0000-0000-000000000004', 'le1', 'x', jsonb_build_object('vendorInvoicePartner', 'pt2', 'vendorInvoiceNumber', 'VI-4', 'vendorInvoiceDateTime', '2030-01-04T00:00:00Z', 'documentHeader', jsonb_build_object('documentStatus', 'draft')));
INSERT INTO public.vendor_invoice_lines ("rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "orderInList", "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "rowJSON") VALUES
  ('eeeeeeee-1000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', :'p1', :'t3', 'materialGenus', 1, 2, 100, 10, '{"priceTaskLine":1,"unitSumForAccounting":1,"unitSumForBudget":1}'),
  ('eeeeeeee-1000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', :'p1', :'t4', 'expenseGenus', 2, 1, 50, 10, '{"priceTaskLine":1,"unitSumForAccounting":1,"unitSumForBudget":1}'),
  ('eeeeeeee-1000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000003', :'p1', :'t3', 'materialGenus', 1, 1, 60, 0, '{"priceTaskLine":1,"unitSumForAccounting":1,"unitSumForBudget":1}'),
  ('eeeeeeee-1000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000004', :'p1', :'t3', 'materialGenus', 1, 1, 25, 0, '{"priceTaskLine":1,"unitSumForAccounting":1,"unitSumForBudget":1}');
INSERT INTO public.customer_invoice_header ("rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES
  ('eeeeeeee-0000-0000-0000-0000000000c1', 'le1', 'x', jsonb_build_object('customerInvoicePartner', 'pt3', 'customerInvoiceContract', 'c4', 'customerInvoiceNumber', 'CI-1', 'customerInvoiceDateTime', '2030-01-06T00:00:00Z', 'documentHeader', jsonb_build_object('documentStatus', 'draft')));
INSERT INTO public.customer_invoice_lines ("rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "orderInList", "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "rowJSON") VALUES
  ('eeeeeeee-1000-0000-0000-0000000000c1', 'eeeeeeee-0000-0000-0000-0000000000c1', :'p1', :'t3', 'revenueGenus', 1, 4, 100, 0, '{"priceTaskLine":1,"unitSumForAccounting":1,"unitSumForBudget":1}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 1. a DRAFT invoice makes no row; Post makes one signed row per line -------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements), 0::bigint, 'nothing is posted: no row');
SELECT tt.eq(public.post_vendor_invoice('eeeeeeee-0000-0000-0000-000000000001')->>'status', 'posted', 'the vendor invoice VI-1 is posted');
SELECT tt.eq((SELECT string_agg("partnerBalanceOperationType" || ':' || "balanceRole" || ':' || "sumForContract"::text || ':' || "sumForAccounting"::text || ':' || "sumForBudget"::text, ',' ORDER BY "sumForContract") FROM public.partner_balance_movements),
             'vendorCredit:vendor:-220.00:-220.00:-220.00,vendorCredit:vendor:-55.00:-55.00:-55.00', 'a vendor invoice: vendorCredit, NEGATIVE, WITH VAT (200 + 20 and 50 + 5), the accounting and budget sums follow');
SELECT tt.eq((SELECT string_agg(DISTINCT "periodDay"::text || ':' || "balanceLegalEntity" || ':' || "balancePartner" || ':' || "balancePartnerContract" || ':' || "currencyForContract", ',') FROM public.partner_balance_movements), '2030-01-03:le1:pt1:c1:EUR', 'the day of the invoice, its legal entity, partner, contract and the currency of the contract');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "projectPaymentPlanLineGUID" IS NULL AND "projectPaymentPlanTaskGUID" IN (:'t3'::uuid, :'t4'::uuid)), 2::bigint, 'the rows carry the task of the line and no plan payment');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_ledger), -275.00::numeric, 'the ledger holds the total');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_ledger), 2::bigint, '... one ledger row per project + task');
SELECT tt.eq(public.post_vendor_invoice('eeeeeeee-0000-0000-0000-000000000003')->>'status', 'posted', 'VI-3 (Supplier Two, contract C-3, 60) is posted');
SELECT tt.eq(public.post_vendor_invoice('eeeeeeee-0000-0000-0000-000000000004')->>'status', 'posted', 'VI-4 (Supplier Two, NO contract, 25) is posted: the contract of an invoice is optional');
SELECT tt.eq((SELECT "balancePartnerContract" || '|' || "currencyForContract" FROM public.partner_balance_movements WHERE "registratorLineGUID" = 'eeeeeeee-1000-0000-0000-000000000004'), '|EUR', 'no contract: the key is empty and the currency is the one of the project');
SELECT tt.eq(public.post_vendor_invoice('eeeeeeee-0000-0000-0000-000000000001')->>'status', 'refused', 'posted twice is refused ...');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "registratorGUID" = 'eeeeeeee-0000-0000-0000-000000000001'), 2::bigint, '... and writes no second row');
SELECT tt.eq(public.post_customer_invoice('eeeeeeee-0000-0000-0000-0000000000c1')->>'status', 'posted', 'the customer invoice CI-1 (4 x 100) is posted');
SELECT tt.eq((SELECT "partnerBalanceOperationType" || ':' || "balanceRole" || ':' || "sumForContract"::text FROM public.partner_balance_movements WHERE "registratorKind" = 'customerInvoice'), 'customerDebit:customer:400.00', 'a customer invoice: customerDebit, POSITIVE');

-- 2. payments: the cash movement turned round -------------------------------------------------------------------------------------------------------------------------------------------------
-- an OUTBOUND payment of 100 to Supplier One on C-1
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS pf1 \gset
SELECT public.payment_fact_set_header(:'pf1', '{"paymentFactNumber":"BANK-1","paymentFactDate":"2030-01-08","moneyAccountFact":"ma-eur","paymentFactPartner":"pt1"}');
SELECT public.payment_fact_add_line(:'pf1', :'t3') AS pl1 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c1","sumForContract":100}' WHERE "rowGUID" = :'pl1';
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "registratorKind" = 'paymentFact'), 0::bigint, 'a draft payment fact makes no row');
SELECT tt.eq(public.post_payment_fact(:'pf1')->>'status', 'posted', 'the payment fact BANK-1 is posted');
SELECT tt.eq((SELECT "partnerBalanceOperationType" || ':' || "balanceRole" || ':' || "sumForContract"::text || ':' || "sumForAccounting"::text || ':' || "balanceLegalEntity" || ':' || "periodDay"::text FROM public.partner_balance_movements WHERE "registratorKind" = 'paymentFact'),
             'paymentToVendor:vendor:100.00:100.00:le1:2030-01-08', 'an OUTBOUND payment: paymentToVendor, POSITIVE (the cash sign turned round), the legal entity of the money account');
-- an INBOUND payment of 150 + 250 from the customer
SELECT public.payment_fact_create(:'t3', 'inbound', NULL) AS pf2 \gset
SELECT public.payment_fact_set_header(:'pf2', '{"paymentFactNumber":"BANK-2","paymentFactDate":"2030-01-09","moneyAccountFact":"ma-eur","paymentFactPartner":"pt3"}');
SELECT public.payment_fact_add_line(:'pf2', :'t3') AS pl2 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c4","sumForContract":150}' WHERE "rowGUID" = :'pl2';
SELECT tt.eq(public.post_payment_fact(:'pf2')->>'status', 'posted', 'the INBOUND payment BANK-2 (150) is posted');
SELECT tt.eq((SELECT "partnerBalanceOperationType" || ':' || "sumForContract"::text FROM public.partner_balance_movements WHERE "registratorGUID" = :'pf2'), 'customerPayment:-150.00', 'an INBOUND payment: customerPayment, NEGATIVE');
-- a payment to a PERSON has no partner: no row
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS pf3 \gset
SELECT public.payment_fact_set_header(:'pf3', '{"paymentFactNumber":"BANK-3","paymentFactDate":"2030-01-09","moneyAccountFact":"ma-eur","paymentFactPerson":"pe1"}');
SELECT public.payment_fact_add_line(:'pf3', :'t3') AS pl3 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"cp1","sumForContract":7}' WHERE "rowGUID" = :'pl3';
SELECT public.post_payment_fact(:'pf3') AS r \gset
SELECT tt.eq(:'r'::jsonb->>'status' || (:'r'::jsonb->>'problems'), 'posted[]', 'a payment to a person is posted ...');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "registratorGUID" = :'pf3'), 0::bigint, '... and changes no partner balance');
SELECT tt.eq((SELECT count(*) FROM public.cash_account_ledger_movements WHERE "rowHeaderGUID" = :'pf3'), 1::bigint, '... (the cash ledger has it)');
-- the second inbound payment closes the customer
SELECT public.payment_fact_create(:'t3', 'inbound', NULL) AS pf4 \gset
SELECT public.payment_fact_set_header(:'pf4', '{"paymentFactNumber":"BANK-4","paymentFactDate":"2030-01-10","moneyAccountFact":"ma-eur","paymentFactPartner":"pt3"}');
SELECT public.payment_fact_add_line(:'pf4', :'t3') AS pl4 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c4","sumForContract":250}' WHERE "rowGUID" = :'pl4';
SELECT tt.eq(public.post_payment_fact(:'pf4')->>'status', 'posted', 'BANK-4 (250) is posted');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_movements WHERE "balancePartner" = 'pt3'), 0.00::numeric, 'the customer: 400 - 150 - 250 = 0');

-- 3. a credit note: ONE negative factor -------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT set_config('request.jwt.claims', jsonb_build_object('email', 'anna@acme.test', 'sub', '11111111-1111-1111-1111-111111111111')::text, true);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
INSERT INTO public.vendor_invoice_header ("rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON") VALUES
  ('eeeeeeee-0000-0000-0000-000000000002', 'le1', 'x', jsonb_build_object('vendorInvoicePartner', 'pt1', 'vendorInvoiceContract', 'c1', 'vendorInvoiceNumber', 'VI-2 (credit note)', 'vendorInvoiceDateTime', '2030-01-12T00:00:00Z', 'documentHeader', jsonb_build_object('documentStatus', 'draft')));
SELECT tt.fails($f$INSERT INTO public.vendor_invoice_lines ("rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "orderInList", "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "rowJSON")
  VALUES ('eeeeeeee-0000-0000-0000-000000000002', (SELECT "rowGUID" FROM public.project_table WHERE "rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' LIMIT 1), (SELECT "rowGUID" FROM public.project_task_table WHERE "rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' LIMIT 1), 'materialGenus', 1, -1, -40, 0, '{}')$f$,
  'vendor_invoice_lines_qty_chk', 'a line with BOTH factors negative is refused');
INSERT INTO public.vendor_invoice_lines ("rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "orderInList", "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "rowJSON") VALUES
  ('eeeeeeee-1000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000002', :'p1', :'t3', 'materialGenus', 1, -1, 40, 0, '{"priceTaskLine":1,"unitSumForAccounting":1,"unitSumForBudget":1}');
SELECT tt.eq((SELECT "sumForContract" FROM public.vendor_invoice_lines WHERE "rowGUID" = 'eeeeeeee-1000-0000-0000-000000000005'), -40.00::numeric, 'a negative quantity makes a negative sum');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.post_vendor_invoice('eeeeeeee-0000-0000-0000-000000000002')->>'status', 'posted', 'the credit note is posted (a negative amount is allowed)');
SELECT tt.eq((SELECT "partnerBalanceOperationType" || ':' || "sumForContract"::text FROM public.partner_balance_movements WHERE "registratorGUID" = 'eeeeeeee-0000-0000-0000-000000000002'), 'vendorCredit:40.00', 'a vendor credit note flips the sign: +40 (the vendor owes us back)');
SELECT tt.eq(public.payment_fact_invoice_open('vendor', 'eeeeeeee-1000-0000-0000-000000000005') < 0, true, 'the open amount of a credit note is negative: it is never offered to a payment');

-- 4. the totals ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_verify()), 0::bigint, 'verify: the ledger equals the register, every posted document has its rows');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_ledger WHERE "balancePartner" = 'pt1'), -135.00::numeric, 'Supplier One: -220 - 55 + 100 + 40 = -135 (we owe 135)');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_ledger WHERE "balancePartner" = 'pt2'), -85.00::numeric, 'Supplier Two: -60 - 25 = -85');

-- 5. the reports ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.partner_balance_report('vendor', NULL, NULL) AS rv \gset
SELECT tt.eq(tt.names(:'rv'::jsonb), 'Supplier One/C-1/EUR,Supplier Two/-/EUR,Supplier Two/C-3/EUR', 'the vendor report: a row per partner + contract (by name; the no-contract row comes first inside the partner)');
SELECT tt.eq(tt.num(:'rv'::jsonb, 'pt1', 'c1', 'sumForContractEnd'), 135.00::numeric, 'the vendor report shows the sign turned round: we owe 135 (positive)');
SELECT tt.eq(tt.num(:'rv'::jsonb, 'pt1', 'c1', 'sumForContractPlus') || ':' || tt.num(:'rv'::jsonb, 'pt1', 'c1', 'sumForContractMinus') || ':' || tt.num(:'rv'::jsonb, 'pt1', 'c1', 'sumForContractBegin'), '275.00:140.00:0.00', 'Plus = the invoices 275, Minus = the payment 100 + the credit note 40, Begin = 0');
SELECT tt.eq(tt.num(:'rv'::jsonb, 'pt1', 'c1', 'sumForAccountingEnd') || ':' || tt.num(:'rv'::jsonb, 'pt1', 'c1', 'sumForBudgetEnd'), '135.00:135.00', 'the accounting and the budget sums are in the row too');
SELECT public.partner_balance_report('customer', NULL, NULL) AS rc \gset
SELECT tt.eq(tt.names(:'rc'::jsonb), 'Customer Three/C-4/EUR', 'the customer report has only the customers');
SELECT tt.eq(tt.num(:'rc'::jsonb, 'pt3', 'c4', 'sumForContractPlus') || ':' || tt.num(:'rc'::jsonb, 'pt3', 'c4', 'sumForContractMinus') || ':' || tt.num(:'rc'::jsonb, 'pt3', 'c4', 'sumForContractEnd'), '400.00:400.00:0.00', 'customer: Plus 400 (invoice), Minus 400 (the two payments), End 0');
-- the period: Begin, Plus, Minus, End for the days given (both borders included)
SELECT public.partner_balance_report('vendor', DATE '2030-01-05', DATE '2030-01-31', jsonb_build_object('partnerFilter', 'pt1')) AS rp \gset
SELECT tt.eq(tt.num(:'rp'::jsonb, 'pt1', 'c1', 'sumForContractBegin') || ':' || tt.num(:'rp'::jsonb, 'pt1', 'c1', 'sumForContractPlus') || ':' || tt.num(:'rp'::jsonb, 'pt1', 'c1', 'sumForContractMinus') || ':' || tt.num(:'rp'::jsonb, 'pt1', 'c1', 'sumForContractEnd'),
             '275.00:0.00:140.00:135.00', 'from 5 Jan: Begin 275 (the invoices of 3 Jan), Plus 0, Minus 140, End 135');
SELECT public.partner_balance_report('vendor', DATE '2030-01-03', DATE '2030-01-08', jsonb_build_object('partnerFilter', 'pt1')) AS rp2 \gset
SELECT tt.eq(tt.num(:'rp2'::jsonb, 'pt1', 'c1', 'sumForContractBegin') || ':' || tt.num(:'rp2'::jsonb, 'pt1', 'c1', 'sumForContractPlus') || ':' || tt.num(:'rp2'::jsonb, 'pt1', 'c1', 'sumForContractMinus') || ':' || tt.num(:'rp2'::jsonb, 'pt1', 'c1', 'sumForContractEnd'),
             '0.00:275.00:100.00:175.00', '3 Jan - 8 Jan, both days included: Begin 0, Plus 275, Minus 100, End 175 (the credit note of 12 Jan is not yet)');
SELECT tt.fails($f$SELECT public.partner_balance_report('vendor', DATE '2030-02-01', DATE '2030-01-01')$f$, 'dateFrom is after dateTo', 'dateFrom after dateTo is refused');
SELECT tt.fails($f$SELECT public.partner_balance_report('boss', NULL, NULL)$f$, 'customer or vendor', 'the role is customer or vendor');
-- the filters
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('partnerFilter', 'pt2'))), 'Supplier Two/-/EUR,Supplier Two/C-3/EUR', 'partnerFilter');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('partnerFilter', 'pt2', 'partnerContractFilter', 'c3'))), 'Supplier Two/C-3/EUR', 'partnerContractFilter');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('partnerFilter', 'pt2', 'partnerContractFilter', 'none'))), 'Supplier Two/-/EUR', 'partnerContractFilter "none" = the rows without a contract');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('projectFilter', :'p1', 'taskFilter', :'t4'))), 'Supplier One/C-1/EUR', 'projectFilter + taskFilter: only the rows of that task (VI-1 line 2)');
SELECT tt.eq(tt.num(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('projectFilter', :'p1', 'taskFilter', :'t4')), 'pt1', 'c1', 'sumForContractEnd'), 55.00::numeric, '... 55');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('legalEntityFilter', 'le2'))), '', 'legalEntityFilter: nothing is posted for the second legal entity');
-- sumBiggerThan / sumSmallerThan: the interval, borders INCLUDED, on the End balance of the partner + contract
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('sumBiggerThan', 100))), 'Supplier One/C-1/EUR', 'sumBiggerThan 100: only the contract that is over 100');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('sumBiggerThan', 135))), 'Supplier One/C-1/EUR', 'sumBiggerThan 135: the border (135) is INCLUDED');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('sumSmallerThan', 60))), 'Supplier Two/-/EUR,Supplier Two/C-3/EUR', 'sumSmallerThan 60: 25 and 60 (the border is included)');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('sumBiggerThan', 30, 'sumSmallerThan', 100))), 'Supplier Two/C-3/EUR', 'the interval 30 .. 100: only C-3 (60)');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('sumBiggerThan', 61, 'sumSmallerThan', 134))), '', '... an interval with nothing in it');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('sumBiggerThan', 100, 'sumKind', 'budget'))), 'Supplier One/C-1/EUR', 'sumKind budget: the End budget balance is compared');
-- the sort: by partner name / by sumForBudgetEnd / by the finish date of the contract
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, '{}', jsonb_build_object('sortBy', 'partnerName', 'sortDir', 'desc'))), 'Supplier Two/C-3/EUR,Supplier Two/-/EUR,Supplier One/C-1/EUR', 'sort by partner name, descending (the contracts follow in the same direction)');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, '{}', jsonb_build_object('sortBy', 'sumForBudgetEnd'))), 'Supplier One/C-1/EUR,Supplier Two/C-3/EUR,Supplier Two/-/EUR', 'sort by sumForBudgetEnd: the biggest first (default descending): 135, then Supplier Two (85: C-3 60, no contract 25)');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, '{}', jsonb_build_object('sortBy', 'sumForBudgetEnd', 'sortDir', 'asc'))), 'Supplier Two/-/EUR,Supplier Two/C-3/EUR,Supplier One/C-1/EUR', '... ascending');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, '{}', jsonb_build_object('sortBy', 'contractFinishDate'))), 'Supplier Two/C-3/EUR,Supplier Two/-/EUR,Supplier One/C-1/EUR', 'sort by the finish date of the contract: C-3 (30 Jun 2030) before C-1 (31 Dec 2030); a contract with no date comes last inside its partner');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, '{}', jsonb_build_object('sortBy', 'contractFinishDate', 'sortDir', 'desc'))), 'Supplier One/C-1/EUR,Supplier Two/C-3/EUR,Supplier Two/-/EUR', '... the latest first');
SELECT tt.fails($f$SELECT public.partner_balance_report('vendor', NULL, NULL, '{}', '{"sortBy":"colour"}')$f$, 'unknown sortBy', 'an unknown sort is refused');
SELECT tt.eq((public.partner_balance_report('vendor', NULL, NULL, '{}', '{}')->0->>'contractFinishDate'), '2030-12-31', 'the row carries the finish date of its contract');
-- the drill-down: a row per project + task
SELECT public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('partnerFilter', 'pt1', 'partnerContractFilter', 'c1'), '{}', 'task') AS rt \gset
SELECT tt.eq(jsonb_array_length(:'rt'::jsonb), 2, 'the task group: a row per task (t3 and t4)');
SELECT tt.eq((SELECT sum((r->>'sumForContractEnd')::numeric) FROM jsonb_array_elements(:'rt'::jsonb) r), 135.00::numeric, '... the tasks add up to the contract');
SELECT tt.fails($f$SELECT public.partner_balance_report('vendor', NULL, NULL, '{}', '{}', 'task')$f$, 'needs the partner and the contract', 'the task group needs the partner and the contract');
-- the lists of the filters and the movements behind a sum
SELECT public.partner_balance_filter_items('vendor', :'p1'::uuid, 'pt1') AS fi \gset
SELECT tt.eq(jsonb_array_length(:'fi'::jsonb->'partners'), 2, 'filter items: the vendors that have rows (not the customer)');
SELECT tt.eq(jsonb_array_length(:'fi'::jsonb->'tasks'), 2, '... the tasks of the project that have rows');
SELECT tt.eq(:'fi'::jsonb->'contracts'->0->>'title', 'C-1', '... the contracts of the partner');
SELECT tt.eq(jsonb_array_length(public.partner_balance_filter_items('vendor', NULL, 'pt2')->'contracts'), 2, '... Supplier Two has a contract and "(no contract)"');
SELECT tt.eq(jsonb_array_length(public.partner_balance_movements_list('vendor', 'pt1', 'c1')), 4, 'movements list: the 4 rows behind Supplier One / C-1 (2 invoice lines, the payment, the credit note)');
SELECT tt.eq(public.partner_balance_movements_list('vendor', 'pt1', 'c1')->0->>'documentNumber', 'VI-2 (credit note)', '... the newest first, with the number of the document');
SELECT tt.eq(public.partner_balance_movements_list('vendor', 'pt1', 'c1', NULL, NULL, DATE '2030-01-08', DATE '2030-01-08')->0->>'sumForContract', '-100.00', '... in the display sign of the report (a payment lowers what we owe)');

-- 6. hide settled ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(tt.names(public.partner_balance_report('customer', DATE '2030-02-01', NULL, '{}')), 'Customer Three/C-4/EUR', 'a settled contract with no movement in the period is shown ...');
SELECT tt.eq(tt.names(public.partner_balance_report('customer', DATE '2030-02-01', NULL, jsonb_build_object('hideSettled', true))), '', '... and hidden by hideSettled');
SELECT tt.eq(tt.names(public.partner_balance_report('customer', NULL, NULL, jsonb_build_object('hideSettled', true))), 'Customer Three/C-4/EUR', 'a contract with movements in the period stays');

-- 7. Unpost takes the rows and the totals away ----------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.unpost_payment_fact(:'pf4')->>'status', 'draft', 'unpost BANK-4');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_movements WHERE "balancePartner" = 'pt3'), 250.00::numeric, '... the customer owes 250 again');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_ledger WHERE "balancePartner" = 'pt3'), 250.00::numeric, '... also in the ledger');
SELECT tt.eq(public.post_payment_fact(:'pf4')->>'status', 'posted', 'post it again');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_ledger WHERE "balancePartner" = 'pt3'), 0.00::numeric, '... 0 again');
SELECT tt.eq(public.unpost_vendor_invoice('eeeeeeee-0000-0000-0000-000000000002')->>'status', 'draft', 'unpost the credit note');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "registratorGUID" = 'eeeeeeee-0000-0000-0000-000000000002'), 0::bigint, '... its row is gone');
SELECT tt.eq(public.post_vendor_invoice('eeeeeeee-0000-0000-0000-000000000002')->>'status', 'posted', '... post again');

-- 8. roles: a refund is the other way round; an explicit role ------------------------------------------------------------------------------------------------------------------------------------
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS pf5 \gset
SELECT public.payment_fact_set_header(:'pf5', '{"paymentFactNumber":"BANK-5","paymentFactDate":"2030-01-15","moneyAccountFact":"ma-eur","paymentFactPartner":"pt3"}');
SELECT tt.fails(format($f$SELECT public.payment_fact_set_header(%L, '{"paymentFactBalanceRole":"boss"}')$f$, :'pf5'), 'unknown balance role', 'the balance role is customer or vendor');
SELECT public.payment_fact_set_header(:'pf5', '{"paymentFactBalanceRole":"customer"}');
SELECT public.payment_fact_add_line(:'pf5', :'t3') AS pl5 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c4","sumForContract":30}' || jsonb_build_object('paymentFactBudgetItem', :'bi_out') WHERE "rowGUID" = :'pl5';
SELECT public.post_payment_fact(:'pf5') AS r \gset
SELECT tt.eq(:'r'::jsonb->>'status' || (:'r'::jsonb->>'problems'), 'posted[]', 'an OUTBOUND payment to the customer (a refund) is posted');
SELECT tt.eq((SELECT "partnerBalanceOperationType" || ':' || "balanceRole" || ':' || "sumForContract"::text FROM public.partner_balance_movements WHERE "registratorGUID" = :'pf5'), 'customerRefund:customer:30.00', 'the refund: customerRefund, + (we gave the money back)');
SELECT tt.eq(tt.num(public.partner_balance_report('customer', NULL, NULL), 'pt3', 'c4', 'sumForContractEnd'), 30.00::numeric, 'the customer owes 30 (the refund)');
-- an INBOUND payment from a vendor (a refund of the vendor) with the role set
SELECT public.payment_fact_create(:'t3', 'inbound', NULL) AS pf6 \gset
SELECT public.payment_fact_set_header(:'pf6', '{"paymentFactNumber":"BANK-6","paymentFactDate":"2030-01-16","moneyAccountFact":"ma-eur","paymentFactPartner":"pt2","paymentFactBalanceRole":"vendor"}');
SELECT public.payment_fact_add_line(:'pf6', :'t3') AS pl6 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || jsonb_build_object('paymentFactContract', 'c3', 'sumForContract', 10, 'paymentFactBudgetItem', :'bi_in') WHERE "rowGUID" = :'pl6';
SELECT tt.eq(public.post_payment_fact(:'pf6')->>'status', 'posted', 'an INBOUND payment from a vendor is posted');
SELECT tt.eq((SELECT "partnerBalanceOperationType" || ':' || "sumForContract"::text FROM public.partner_balance_movements WHERE "registratorGUID" = :'pf6'), 'vendorRefund:-10.00', 'vendorRefund, - (the vendor gave money back: we owe more)');
SELECT tt.eq(public.unpost_payment_fact(:'pf6')->>'status', 'draft', 'unpost it (the numbers below are without the vendor refund)');

-- 9. a payment of ANOTHER currency: the contract sum is the truth, the accounting sum is the one of the rate of the day -----------------------------------------------------------------------------------
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS pf7 \gset
SELECT public.payment_fact_set_header(:'pf7', '{"paymentFactNumber":"BANK-7","paymentFactDate":"2030-01-20","moneyAccountFact":"ma-eur","paymentFactPartner":"pt1"}');
SELECT public.payment_fact_add_line(:'pf7', :'t3') AS pl7 \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactContract":"c5","sumForContract":5}' || jsonb_build_object('paymentFactBudgetItem', :'bi_out') WHERE "rowGUID" = :'pl7';
SELECT public.post_payment_fact(:'pf7') AS r \gset
SELECT tt.eq(:'r'::jsonb->>'status' || (:'r'::jsonb->>'problems'), 'posted[]', 'a payment on the USD contract C-5 is posted');
SELECT tt.eq((SELECT "currencyForContract" || ':' || "sumForContract"::text || ':' || "currencyForAccounting" || ':' || "sumForAccounting"::text FROM public.partner_balance_movements WHERE "registratorGUID" = :'pf7'), 'USD:5.00:EUR:4.00', '5 USD in the contract currency, 4.00 EUR in the accounting currency (rate of its day)');
SELECT tt.eq(tt.names(public.partner_balance_report('vendor', NULL, NULL, jsonb_build_object('partnerFilter', 'pt1'))), 'Supplier One/C-1/EUR,Supplier One/C-5/USD', 'two contracts in two currencies are two rows: sums of different currencies are never added');

-- 10. a payment of the invoice needs the contract ---------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($f$SELECT public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000004')$f$, 'has no contract', 'a payment made from an invoice without a contract is refused (unpost, choose the contract, post)');
SELECT tt.eq(public.create_payment_fact_from_vendor_invoice('eeeeeeee-0000-0000-0000-000000000003')->'documents'->0->>'lineCount', '1', 'the invoice WITH a contract can be paid');

-- 11. business units: ONE payment, first level roots (project setting paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled, TRUE by default) -------------------------------------------------------
SELECT tt.eq(public.business_unit_root('buc1'), 'bur1', 'the first level root of a child is its root');
SELECT tt.eq(public.business_unit_root('bur2'), 'bur2', '... of a root is itself');
SELECT tt.eq(public.business_unit_root('nobody'), NULL, '... of a unit that does not exist: nothing');
SELECT public.payment_fact_create(:'t3', 'outbound', NULL) AS pf8 \gset
SELECT public.payment_fact_set_header(:'pf8', '{"paymentFactNumber":"BANK-8","paymentFactDate":"2030-01-21","moneyAccountFact":"ma-eur","paymentFactPartner":"pt2"}');
SELECT public.payment_fact_add_line(:'pf8', :'t3') AS pl8a \gset
SELECT public.payment_fact_add_line(:'pf8', :'t4') AS pl8b \gset
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || jsonb_build_object('paymentFactContract', 'c3', 'sumForContract', 10, 'paymentFactBusinessUnit', 'buc1', 'paymentFactBudgetItem', :'bi_out') WHERE "rowGUID" = :'pl8a';
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || jsonb_build_object('paymentFactContract', 'c3', 'sumForContract', 10, 'paymentFactBusinessUnit', 'bur2', 'paymentFactBudgetItem', :'bi_out') WHERE "rowGUID" = :'pl8b';
SELECT public.post_payment_fact(:'pf8') AS r \gset
SELECT tt.eq(:'r'::jsonb->>'status' || (:'r'::jsonb->>'problems'), 'posted[]', 'the setting is TRUE by default: units of two different roots in one payment are allowed');
SELECT tt.eq(public.unpost_payment_fact(:'pf8')->>'status', 'draft', 'unpost it');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled":false}' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_payment_fact(:'pf8') AS r \gset
SELECT tt.eq((SELECT string_agg(p->>'problem', ',') FROM jsonb_array_elements(:'r'::jsonb->'problems') p), 'businessUnitsOfDifferentRoots', 'the project forbids it: Post is refused, nothing else is wrong');
UPDATE public.project_payment_fact_lines SET "rowJSON" = "rowJSON" || '{"paymentFactBusinessUnit":"buc2"}' WHERE "rowGUID" = :'pl8b';
SELECT tt.eq(public.post_payment_fact(:'pf8')->>'status', 'posted', 'two units of the SAME root are fine');
SELECT tt.eq(public.unpost_payment_fact(:'pf8')->>'status', 'draft', 'unpost it');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 12. access --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements) + (SELECT count(*) FROM public.partner_balance_ledger), 0::bigint, 'another organization sees no row');
SELECT tt.eq(public.partner_balance_report('vendor', NULL, NULL), '[]'::jsonb, '... and its report is empty');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($f$INSERT INTO public.partner_balance_movements ("rowOrganizationGUID", "registratorGUID", "registratorKind", "registratorLineGUID", "partnerBalanceOperationType", "balanceRole", "periodDay", "balancePartner", "projectGUID", "sumForContract") VALUES ('x', gen_random_uuid(), 'paymentFact', gen_random_uuid(), 'customerPayment', 'customer', DATE '2030-01-01', 'pt1', gen_random_uuid(), 1)$f$, 'permission denied', 'the client cannot insert into the register');
SELECT tt.fails($f$UPDATE public.partner_balance_ledger SET "sumForContract" = 0$f$, 'permission denied', 'the client cannot update the ledger');
SELECT tt.fails($f$DELETE FROM public.partner_balance_movements$f$, 'permission denied', 'the client cannot delete from the register');
SELECT tt.fails($f$SELECT public.partner_balance_rebuild()$f$, 'permission denied', 'the maintenance functions are not callable by the client');

-- 13. backfill, rebuild, verify ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT count(*) AS before_rows FROM public.partner_balance_movements \gset
SELECT sum("sumForContract") AS before_sum FROM public.partner_balance_ledger \gset
DELETE FROM public.partner_balance_movements;
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_ledger), 0::bigint, 'the rows deleted: the ledger is empty');
SELECT tt.eq((SELECT count(*) > 0 FROM public.partner_balance_verify()), true, 'verify reports the posted documents that have no rows');
SELECT tt.eq(public.partner_balance_register_missing()::bigint, :before_rows::bigint, 'the backfill writes the rows of every posted document again');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_verify()), 0::bigint, 'verify: nothing wrong');
SELECT tt.eq((SELECT sum("sumForContract") FROM public.partner_balance_ledger), :before_sum::numeric, 'the totals are the same as before');
SELECT tt.eq(public.partner_balance_register_missing(), 0, 'the backfill is idempotent');
SELECT tt.eq(public.partner_balance_rebuild(), :before_rows::integer, 'rebuild: the same rows');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_verify()), 0::bigint, 'verify after the rebuild: nothing wrong');
UPDATE public.partner_balance_ledger SET "sumForContract" = "sumForContract" + 1 WHERE ctid = (SELECT ctid FROM public.partner_balance_ledger LIMIT 1);
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_verify()), 1::bigint, 'verify finds a ledger row that was changed by hand');
SELECT tt.fails($f$UPDATE public.partner_balance_movements SET "sumForContract" = 1$f$, 'never changed', 'a register row is never updated');

-- 14. a deleted task takes its rows with it (as the status register does) -----------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "projectPaymentPlanTaskGUID" = :'t4'), 1::bigint, 'one row on the task t4 (VI-1 line 2)');
DELETE FROM public.project_task_table WHERE "rowGUID" = :'t4';
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_movements WHERE "projectPaymentPlanTaskGUID" = :'t4'), 0::bigint, 'the task deleted: its row went with it ...');
SELECT tt.eq((SELECT count(*) FROM public.partner_balance_ledger WHERE "projectPaymentPlanTaskGUID" = :'t4'), 0::bigint, '... and its ledger row');

SELECT 'all partner balance checks passed' AS result;
ROLLBACK;
