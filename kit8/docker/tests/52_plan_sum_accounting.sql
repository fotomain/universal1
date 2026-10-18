-- sumForAccounting in the Post of the plan (create_task_line_plan): distributed like sumForBudget, Correct033 (100.00 on 3 equal days = 33.33 + 33.33 + 33.34), also in task_line_plan_timeline
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000001', :'t1', 'materialGenus', 1, '{"measureUnitTaskLine":"unit_pcs","qtyTaskLine":30,"priceTaskLine":3}'),
  ('cccccccc-0000-0000-0000-000000000002', :'t1', 'expenseGenus',  2, '{"measureUnitTaskLine":"unit_pcs","qtyTaskLine":3,"priceTaskLine":1}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t1', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000001', 'qtyTaskLine', 30, 'sumForBudget', 90, 'sumForContract', 90, 'sumForAccounting', 100, 'baseOfDistribution', 1,
    'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 0.3333333333), jsonb_build_object('d', '2026-10-15', 'c', 0.3333333333), jsonb_build_object('d', '2026-10-16', 'c', 0.3333333334))),
  -- no accounting sum (no accounting currency in the project): stays null
  jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000002', 'qtyTaskLine', 3, 'sumForBudget', 3, 'sumForContract', 3, 'baseOfDistribution', 1,
    'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))))));
SELECT tt.eq((SELECT sum("sumForAccounting") FROM public.task_line_plan_movements WHERE "rowParentGUID" = 'cccccccc-0000-0000-0000-000000000001'), 100::numeric, 'the movements add up to the accounting sum of the line (Correct033)');
SELECT tt.eq((SELECT "sumForAccounting" FROM public.task_line_plan_movements WHERE "rowParentGUID" = 'cccccccc-0000-0000-0000-000000000001' ORDER BY "rowPeriodDatetime" LIMIT 1), 33.33::numeric, 'a day: 100.00 x 0.3333333333 = 33.33');
SELECT tt.eq((SELECT "sumForAccounting" FROM public.task_line_plan_movements WHERE "rowParentGUID" = 'cccccccc-0000-0000-0000-000000000001' ORDER BY "rowPeriodDatetime" DESC LIMIT 1), 33.34::numeric, '... and the last day takes the rounding difference');
SELECT tt.eq((SELECT sum("sumForAccounting") FROM public.task_line_plan_timeline WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), 100::numeric, 'task_line_plan_timeline has it too');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_timeline WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001' AND "sumForAccounting" IS NOT NULL), 3::bigint, '... on each of the 3 days');
SELECT tt.eq((SELECT "sumForAccounting" IS NULL FROM public.task_line_plan_movements WHERE "rowParentGUID" = 'cccccccc-0000-0000-0000-000000000002'), true, 'a line without one stays null (never 0)');
SELECT tt.eq((SELECT "sumForAccounting" IS NULL FROM public.task_line_plan_timeline WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000002'), true, '... also in the timeline');
-- posted again with another amount: the rows are replaced
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t1', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000001', 'qtyTaskLine', 30, 'sumForBudget', 90, 'sumForContract', 90, 'sumForAccounting', 60, 'baseOfDistribution', 1,
    'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 0.5), jsonb_build_object('d', '2026-10-15', 'c', 0.5))))));
SELECT tt.eq((SELECT sum("sumForAccounting") FROM public.task_line_plan_timeline WHERE "taskLineGUID" = 'cccccccc-0000-0000-0000-000000000001'), 60::numeric, 'a new Post replaces the accounting sums');
ROLLBACK;
