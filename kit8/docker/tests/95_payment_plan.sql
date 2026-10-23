-- PART 37: the PAYMENT PLAN of a task (documentation/PAYMENTS_PLAN_WBS.html): task_payment_plan_lines (the planned payments), the budget item of the payments genus, the guards, RLS, Post -> task_payment_plan_movements, the unpost of a changed payment / of a moved task
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
SELECT b."rowGUID" AS bi_time FROM public."budgetItemTable" b WHERE b."rowParentGUID" <> 'empty' AND b."rowJSON"->>'managementGenusItem' = 'timeGenus' ORDER BY b."rowGUID" LIMIT 1 \gset
SELECT tt.eq(:'bi_out' <> '' AND :'bi_in' <> '' AND :'bi_time' <> '', true, 'the seeds have an outbound payment item, an inbound payment item and a Time item');
-- no currency of the project to convert into (sumForAccounting / sumForBudget are not required) - switched on again in section 7
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'currencyForAccounting' - 'currencyForBudget' - 'paymentPlanAfterTaskFinishEnabled' WHERE "rowGUID" = :'p1';

-- 1. a payment: the project comes from the task, the budget item is of the payments genus of the direction ------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.task_payment_plan_lines ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', :'t3', 'outbound', jsonb_build_object('paymentPlanBudgetItem', :'bi_out', 'paymentPlanPartner', 'pt1', 'paymentPlanContract', 'c1', 'paymentPlanCurrency', 'EUR',
     'paymentPlanTimelineAnchor', 'taskStart', 'paymentPlanTimelineShiftDays', 5, 'paymentPlannedTransactionDate', '2026-10-06', 'sumForContract', 100, 'paymentPlanPaymentDirection', 'outbound'));
SELECT tt.eq((SELECT "rowProjectGUID" FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), :'p1'::uuid, 'the project of a payment is the project of its task');
SELECT tt.eq((SELECT "rowJSON"->>'paymentIsPosted' FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'false', 'a new payment is unposted');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', jsonb_build_object('paymentPlanBudgetItem', %L))$f$, :'t3', :'bi_time'),
  'payment genus', 'a cost budget item (Time) is refused');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', jsonb_build_object('paymentPlanBudgetItem', %L))$f$, :'t3', :'bi_in'),
  'payment genus', 'an inbound payment item on an Outbound payment is refused');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'inbound', jsonb_build_object('paymentPlanBudgetItem', %L))$f$, :'t3', :'bi_out'),
  'payment genus', 'an outbound payment item on an Inbound payment is refused');

-- 2. the guards ------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'sideways', '{}')$f$, :'t3'), 'task_payment_plan_direction_chk', 'the direction is inbound or outbound');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{"paymentPlanTimelineShiftDays": -1}')$f$, :'t3'), 'task_payment_plan_shift_chk', 'the shift is positive only');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{"paymentPlanTimelineAnchor": "taskMiddle"}')$f$, :'t3'), 'task_payment_plan_anchor_chk', 'the anchor is taskStart or taskEnd');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{"paymentPlanPartner": "pt1", "paymentPlanPerson": "pe1"}')$f$, :'t3'), 'task_payment_plan_payee_chk', 'the payee is a partner OR a person');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'inbound', '{"paymentPlanPerson": "pe1"}')$f$, :'t3'), 'task_payment_plan_person_dir_chk', 'a person is paid (Outbound), never an Inbound payee');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{"paymentPlanPaymentDirection": "inbound"}')$f$, :'t3'), 'task_payment_plan_direction_json_chk', 'the direction in rowJSON equals the row direction');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{"paymentPlannedTransactionDate": "06.10.2026"}')$f$, :'t3'), 'task_payment_plan_date_chk', 'the date is YYYY-MM-DD');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{"sumForContract": -5}')$f$, :'t3'), 'task_payment_plan_sum_chk', 'the sum is not negative');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{}')$f$, gen_random_uuid()), 'does not exist', 'a payment needs an existing task');

-- 3. who sees what ---------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_lines), 0::bigint, 'another user sees none of the payments');
SELECT tt.fails(format($f$INSERT INTO public.task_payment_plan_lines ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'outbound', '{}')$f$, :'t3'), 'row-level security', 'another user cannot add a payment to the task');
SELECT tt.fails(format($f$SELECT public.post_task_payment_plan(%L, '2026-10-01', '2026-10-10')$f$, :'t3'), 'not yours', 'another user cannot post the payments');
SELECT tt.fails(format($f$SELECT public.unpost_task_payment_plan(%L)$f$, :'t3'), 'not yours', '... or unpost them');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($f$INSERT INTO public.task_payment_plan_movements ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "periodDay", "paymentDirection", "sumForContract")
  SELECT "rowProjectGUID", "rowOwnerGUID", "rowGUID", '2026-10-06', 'outbound', 1 FROM public.task_payment_plan_lines$f$, 'permission denied', 'the client cannot write a movement');

-- 4. Post refuses an incomplete payment: ALL OR NOTHING, with the list --------------------------------------------------------------------------------------------------------
INSERT INTO public.task_payment_plan_lines ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000002', :'t3', 'inbound', '{}');
SELECT public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10') AS r \gset
SELECT tt.eq(:'r'::jsonb->>'status', 'refused', 'an incomplete payment refuses the Post');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(:'r'::jsonb->'problems') p WHERE p->>'lineGUID' = 'aaaaaaaa-0000-0000-0000-000000000002'), 6::bigint,
  'the list names what the payment lacks (budget item, payee, contract, currency, sum, date)');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 0::bigint, 'nothing was written, also not for the complete payment');
SELECT tt.eq((SELECT "rowJSON"->>'paymentIsPosted' FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'false', '... and the complete one stays unposted');

-- 5. Post ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
UPDATE public.task_payment_plan_lines SET "rowJSON" = jsonb_build_object('paymentPlanBudgetItem', :'bi_in', 'paymentPlanPartner', 'pt2', 'paymentPlanContract', 'c2', 'paymentPlanCurrency', 'EUR',
     'paymentPlanTimelineAnchor', 'taskEnd', 'paymentPlanTimelineShiftDays', 0, 'paymentPlannedTransactionDate', '2026-10-10', 'sumForContract', 200, 'paymentPlanPaymentDirection', 'inbound')
 WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000002';
SELECT tt.eq(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->>'status', 'posted', 'two complete payments are posted');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 2::bigint, 'one movement per payment');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_lines WHERE "rowJSON"->>'paymentIsPosted' = 'true'), 2::bigint, 'both payments are posted');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_lines WHERE "rowJSON"->>'paymentEverPosted' = 'true'), 2::bigint, '... and remember it (paymentEverPosted: "Post needed" later, not "Post")');
SELECT tt.eq((SELECT "sumForContract" FROM public.task_payment_plan_movements WHERE "rowParentGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 100.00::numeric, 'the movement has the sum of the payment (with VAT)');
SELECT tt.eq((SELECT "periodDay" FROM public.task_payment_plan_movements WHERE "rowParentGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), '2026-10-06'::date, '... on the planned date');
SELECT tt.eq((SELECT "paymentDirection" || ':' || "currency" || ':' || COALESCE("partner", '-') FROM public.task_payment_plan_movements WHERE "rowParentGUID" = 'aaaaaaaa-0000-0000-0000-000000000002'), 'inbound:EUR:pt2', '... with direction, currency and payee');
SELECT tt.eq(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->>'status', 'posted', 'Post twice');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 2::bigint, '... gives the same rows');
SELECT tt.eq(public.post_task_payment_plan(:'t4', '2026-10-01', '2026-10-10')->>'status', 'nothing', 'a task with no payments has nothing to post');

-- 6. a change of a posted payment unposts THAT payment -------------------------------------------------------------------------------------------------------------------------
UPDATE public.task_payment_plan_lines SET "rowJSON" = "rowJSON" || '{"sumForContract": 150}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "rowJSON"->>'paymentIsPosted' FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'false', 'a changed payment is unposted again');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 1::bigint, '... and its movement is gone');
SELECT tt.eq((SELECT "rowJSON"->>'paymentEverPosted' FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'true', '... it stays remembered as posted once');
SELECT tt.eq((SELECT "rowJSON"->>'paymentIsPosted' FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000002'), 'true', 'the other payment stays posted');
SELECT public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10');
SELECT tt.eq((SELECT "sumForContract" FROM public.task_payment_plan_movements WHERE "rowParentGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 150.00::numeric, 'Post again: the movement has the new sum');
-- a write that changes nothing but the flag does not unpost (the client may rewrite the same rowJSON)
UPDATE public.task_payment_plan_lines SET "rowJSON" = "rowJSON" WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "rowJSON"->>'paymentIsPosted' FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 'true', 'a write of the same data keeps the payment posted');

-- 7. the dates and the currencies of the project ---------------------------------------------------------------------------------------------------------------------------------
UPDATE public.task_payment_plan_lines SET "rowJSON" = "rowJSON" || '{"paymentPlannedTransactionDate": "2026-09-30"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT p->>'problem' FROM jsonb_array_elements(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->'problems') p LIMIT 1), 'dateBeforeTaskStart', 'a date before the task start is refused');
UPDATE public.task_payment_plan_lines SET "rowJSON" = "rowJSON" || '{"paymentPlannedTransactionDate": "2026-10-20"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->>'status', 'posted', 'after the task end is allowed by default (the project switch is on)');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"paymentPlanAfterTaskFinishEnabled": false}' WHERE "rowGUID" = :'p1';
SELECT tt.eq(public.payment_plan_after_finish_on(:'p1'), false, 'the switch off is read');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT p->>'problem' FROM jsonb_array_elements(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->'problems') p LIMIT 1), 'dateAfterTaskEnd', 'with the switch off a date after the task end is refused');
UPDATE public.task_payment_plan_lines SET "rowJSON" = "rowJSON" || '{"paymentPlannedTransactionDate": "2026-10-10"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT tt.eq(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->>'status', 'posted', '... the last day of the task is fine');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = ("rowJSON" - 'paymentPlanAfterTaskFinishEnabled') || '{"currencyForAccounting": "EUR", "currencyForBudget": "USD"}' WHERE "rowGUID" = :'p1';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->'problems') p WHERE p->>'problem' IN ('sumForAccountingMissing', 'sumForBudgetMissing')), 4::bigint,
  'a project with an accounting and a budget currency needs both converted sums on every payment');
UPDATE public.task_payment_plan_lines SET "rowJSON" = "rowJSON" || '{"sumForAccounting": 150, "sumForBudget": 165}';
SELECT tt.eq(public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10')->>'status', 'posted', '... and posts when they are there');
SELECT tt.eq((SELECT "sumForBudget" FROM public.task_payment_plan_movements WHERE "rowParentGUID" = 'aaaaaaaa-0000-0000-0000-000000000001'), 165.00::numeric, 'the movement carries the three sums');

-- 8. unpost, task dates, cascade -------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.unpost_task_payment_plan(:'t3')->>'status', 'draft', 'unpost');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 0::bigint, '... deletes the movements');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_lines WHERE "rowJSON"->>'paymentIsPosted' = 'true'), 0::bigint, '... and the payments are drafts');
SELECT public.post_task_payment_plan(:'t3', '2026-10-01', '2026-10-10');
SELECT tt.as_admin();
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"startAt": "2026-10-03T00:00:00Z"}' WHERE "rowGUID" = :'t3';
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_lines WHERE "rowOwnerGUID" = :'t3' AND "rowJSON"->>'paymentIsPosted' = 'true'), 0::bigint, 'a change of the task start unposts its payments');
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 0::bigint, '... and deletes the movements');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_task_payment_plan(:'t3', '2026-10-03', '2026-10-10');
DELETE FROM public.task_payment_plan_lines WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000002';
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_movements), 1::bigint, 'deleting a payment deletes its movement');
SELECT tt.as_admin();
DELETE FROM public.project_task_table WHERE "rowGUID" = :'t3';
SELECT tt.eq((SELECT count(*) FROM public.task_payment_plan_lines) + (SELECT count(*) FROM public.task_payment_plan_movements), 0::bigint, 'deleting the task deletes its payments and movements');

ROLLBACK;
