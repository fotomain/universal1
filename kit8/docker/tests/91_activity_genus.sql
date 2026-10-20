-- PART 32: the ACTIVITY GENUS (documentation/ACTIVITY_GENUS.html): the matrix activity x management genus (14 keys), the catalogs with every field of the tree stored (3 activities, 14 keys,
-- 36 budget items), the obligatory budgetItemGenericKey / direction of a budget item (default, checks, correction), read-only catalogs for the signed-in user
BEGIN;
SELECT tt.as_admin();

-- ---- the matrix --------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.kit8_budget_item_key_matrix()), 14::bigint, 'the matrix has 14 allowed keys');
SELECT tt.eq((SELECT count(*) FROM public.kit8_budget_item_key_matrix() WHERE "activityGenus" = 'financingActivity'), 2::bigint, 'financing has the two payments genus only');
SELECT tt.eq((SELECT count(*) FROM public.kit8_budget_item_key_matrix() WHERE "activityGenus" <> 'financingActivity'), 12::bigint, 'operating and investing have all six genus');
SELECT tt.eq((SELECT count(*) FROM public.kit8_budget_item_key_matrix() m
               JOIN public."managementGenusTable" g ON g."rowGUID" = m."managementGenusItem" AND g."rowParentGUID" <> 'empty'), 14::bigint, 'every key points at a level 2 row of managementGenusTable');
SELECT tt.eq(public.kit8_budget_item_key_direction('operatingActivity.revenueGenus'), 'inbound', 'revenue is inbound');
SELECT tt.eq(public.kit8_budget_item_key_direction('investingActivity.materialGenus'), 'outbound', 'material is outbound');
SELECT tt.eq(public.kit8_budget_item_key_direction('financingActivity.timeGenus'), NULL::text, 'financing x time is not a key');

-- ---- the catalogs: every field of the tree is stored ---------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public."managementActivityGenusTable"), 3::bigint, '3 activities');
SELECT tt.eq((SELECT count(*) FROM public."managementActivityGenusTable" WHERE "rowParentGUID" = 'empty'
                AND coalesce("rowJSON"->>'title', '') <> '' AND coalesce("rowJSON"->>'webIfrsName', '') <> '' AND coalesce("rowJSON"->>'d365foName', '') <> '' AND coalesce("rowJSON"->>'sapName', '') <> ''), 3::bigint,
             'every activity has title, Web + IFRS, D365 FO and SAP');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemGenericKeyTable"), 14::bigint, '14 keys');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemGenericKeyTable" k JOIN public.kit8_budget_item_key_matrix() m
               ON m."key" = k."rowGUID" AND m."activityGenus" = k."rowJSON"->>'activityGenus' AND m."managementGenusItem" = k."rowJSON"->>'managementGenusItem' AND m."directionDefault" = k."rowJSON"->>'directionDefault'),
             14::bigint, 'the key rows are the matrix');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemGenericKeyTable" WHERE coalesce("rowJSON"->>'d365foName', '') <> '' AND coalesce("rowJSON"->>'sapName', '') <> ''), 14::bigint, 'every key has the D365 FO and SAP text of its genus row');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemTable" WHERE "rowParentGUID" <> 'empty' AND "rowJSON" ? 'webIfrsName'), 36::bigint, '36 possible budget items are stored');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemTable" WHERE "rowParentGUID" <> 'empty' AND "rowJSON" ? 'webIfrsName'
                AND coalesce("rowJSON"->>'webIfrsName', '') <> '' AND coalesce("rowJSON"->>'d365foName', '') <> '' AND coalesce("rowJSON"->>'sapName', '') <> '' AND "rowJSON" ? 'isPolicyItem'), 36::bigint,
             'every possible budget item has Web + IFRS, D365 FO, SAP and the policy flag');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemTable" WHERE "rowJSON"->>'isPolicyItem' = 'true'), 4::bigint, 'four policy items (interest and dividends, received and paid)');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemTable" WHERE "rowParentGUID" <> 'empty'), 42::bigint, '6 default items + 36 possible items');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty'
                AND public.kit8_budget_item_key_direction(b."rowJSON"->>'budgetItemGenericKey') = b."rowJSON"->>'direction'
                AND split_part(b."rowJSON"->>'budgetItemGenericKey', '.', 2) = b."rowJSON"->>'managementGenusItem'), 42::bigint, 'every item: allowed key, genus of the key, default direction');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemTable" WHERE "rowGUID" IN ('timeBudgetItem', 'materialBudgetItem', 'expenseBudgetItem', 'revenueBudgetItem', 'inboundPaymentBudgetItem', 'outboundPaymentBudgetItem')
                AND "rowJSON"->>'budgetItemGenericKey' = 'operatingActivity.' || ("rowJSON"->>'managementGenusItem')), 6::bigint, 'the six default items are operating (old items stay what they were)');
SELECT tt.eq((SELECT "rowJSON"->>'budgetItemGenericKey' FROM public."budgetItemTable" WHERE "rowGUID" = 'purchaseOfPpeBudgetItem'), 'investingActivity.materialGenus', 'purchase of PP&E is investing material');
SELECT tt.eq((SELECT "rowJSON"->>'direction' FROM public."budgetItemTable" WHERE "rowGUID" = 'borrowingProceedsBudgetItem'), 'inbound', 'borrowing proceeds are inbound');
SELECT tt.eq((SELECT "rowParentGUID" FROM public."budgetItemTable" WHERE "rowGUID" = 'loanRepaymentBudgetItem'), 'paymentsBudgetFolder', 'a payment item is in the payments folder');

-- ---- the trigger: default, checks, correction ---------------------------------------------------------------------------------------
INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_noKey', 'costsBudgetFolder', '{"title": "no key", "managementGenusItem": "materialGenus"}');
SELECT tt.eq((SELECT "rowJSON"->>'budgetItemGenericKey' FROM public."budgetItemTable" WHERE "rowGUID" = 't_noKey'), 'operatingActivity.materialGenus', 'a missing key becomes operatingActivity.<genus>');
SELECT tt.eq((SELECT "rowJSON"->>'direction' FROM public."budgetItemTable" WHERE "rowGUID" = 't_noKey'), 'outbound', 'a missing direction becomes the default of the key');

INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES
  ('t_inv', 'costsBudgetFolder', '{"title": "investing material", "managementGenusItem": "materialGenus", "budgetItemGenericKey": "investingActivity.materialGenus"}');
SELECT tt.eq((SELECT "rowJSON"->>'budgetItemGenericKey' FROM public."budgetItemTable" WHERE "rowGUID" = 't_inv'), 'investingActivity.materialGenus', 'an explicit key is kept');

SELECT tt.fails($$INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_bad1', 'costsBudgetFolder', '{"title": "x", "managementGenusItem": "timeGenus", "budgetItemGenericKey": "financingActivity.timeGenus"}')$$,
                'not an allowed activity', 'financing x time is refused');
SELECT tt.fails($$INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_bad2', 'costsBudgetFolder', '{"title": "x", "managementGenusItem": "timeGenus", "budgetItemGenericKey": "operatingActivity.materialGenus"}')$$,
                'not a key of the management genus', 'the key of another genus is refused');
SELECT tt.fails($$INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_bad3', 'costsBudgetFolder', '{"title": "x", "managementGenusItem": "timeGenus", "budgetItemGenericKey": "salesActivity.timeGenus"}')$$,
                'not an allowed activity', 'an unknown activity is refused');
SELECT tt.fails($$INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_bad4', 'revenuesBudgetFolder', '{"title": "x", "managementGenusItem": "revenueGenus", "direction": "outbound"}')$$,
                'differs from the direction', 'revenue as outbound is refused');
SELECT tt.fails($$INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_bad5', 'costsBudgetFolder', '{"title": "x", "managementGenusItem": "timeGenus", "direction": "sideways"}')$$,
                'must be inbound or outbound', 'a direction that is neither is refused');

INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES
  ('t_credit', 'costsBudgetFolder', '{"title": "credit note", "managementGenusItem": "materialGenus", "direction": "inbound", "isCorrection": true}');
SELECT tt.eq((SELECT "rowJSON"->>'direction' FROM public."budgetItemTable" WHERE "rowGUID" = 't_credit'), 'inbound', 'a correction may go the other way');

-- the genus changes but the key stays: refused; the key cleared: becomes the default of the NEW genus
SELECT tt.fails($$UPDATE public."budgetItemTable" SET "rowJSON" = jsonb_set("rowJSON", '{managementGenusItem}', '"timeGenus"') WHERE "rowGUID" = 't_inv'$$,
                'not a key of the management genus', 'a genus change that leaves the key is refused');
UPDATE public."budgetItemTable" SET "rowJSON" = jsonb_set("rowJSON" - 'budgetItemGenericKey', '{managementGenusItem}', '"timeGenus"') WHERE "rowGUID" = 't_inv';
SELECT tt.eq((SELECT "rowJSON"->>'budgetItemGenericKey' FROM public."budgetItemTable" WHERE "rowGUID" = 't_inv'), 'operatingActivity.timeGenus', 'a cleared key is the default of the new genus');

-- a folder needs neither key nor direction
INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_folder', 'empty', '{"title": "a folder"}');
SELECT tt.eq((SELECT "rowJSON" ? 'budgetItemGenericKey' FROM public."budgetItemTable" WHERE "rowGUID" = 't_folder'), false, 'a folder has no key');

-- the CHECK is there as well (the trigger fills the values, a disabled trigger would not)
SELECT tt.eq((SELECT count(*) FROM pg_constraint WHERE conname = 'budgetItemTable_key_chk' AND conrelid = 'public."budgetItemTable"'::regclass), 1::bigint, 'the CHECK budgetItemTable_key_chk exists');
ALTER TABLE public."budgetItemTable" DISABLE TRIGGER "trg_budgetItemTable_key";
SELECT tt.fails($$INSERT INTO public."budgetItemTable" ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('t_chk', 'costsBudgetFolder', '{"title": "x", "managementGenusItem": "timeGenus"}')$$,
                'budgetItemTable_key_chk', 'without the trigger the CHECK refuses an item with no key');
ALTER TABLE public."budgetItemTable" ENABLE TRIGGER "trg_budgetItemTable_key";

-- ---- the signed-in user reads, does not write ------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test');
SELECT tt.eq((SELECT count(*) FROM public."managementActivityGenusTable"), 3::bigint, 'a signed-in user reads the activities');
SELECT tt.eq((SELECT count(*) FROM public."budgetItemGenericKeyTable"), 14::bigint, 'a signed-in user reads the keys');
SELECT tt.fails($$INSERT INTO public."managementActivityGenusTable" ("rowGUID", "rowJSON") VALUES ('x', '{}')$$, 'permission denied', 'the activities are read-only');
SELECT tt.fails($$UPDATE public."budgetItemGenericKeyTable" SET "orderInList" = 1$$, 'permission denied', 'the keys are read-only');
SELECT tt.as_admin();

ROLLBACK;
