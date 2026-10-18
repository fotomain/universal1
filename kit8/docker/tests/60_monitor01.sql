-- PART 25: Monitor01 (documentation/MONITOR01_WBS.html): the dirty queue, the worker, monitor01_view = the example of the sheet "W1 1-MONITOR01", the fact sums, the drill-down, the policies
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
DELETE FROM public.monitor01_dirty;     -- the demo projects queued their own lines
-- the example of the sheet: Data Analyst task01 and task03 (October), 10m pipe section task03 and task04
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."rowGUID" AS t3 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 112' \gset
SELECT t."rowGUID" AS t4 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 113' \gset
SELECT t."rowGUID" AS tm FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."projectGUID" AS pa FROM public.project_task_table t WHERE t."rowGUID" = :'t1' \gset
SELECT r."rowGUID" AS role1, r."rowJSON"->>'title' AS role1name FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset
SELECT r."rowGUID" AS role2 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" OFFSET 1 LIMIT 1 \gset

INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  -- Data Analyst, task01: 24 h planned, a resource contract IS selected
  ('bbbbbbbb-0000-0000-0000-000000000001', :'t1', 'timeGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'taskResourceKind', 'person', 'taskResourceItem', 'p-boris', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 24, 'priceTaskLine', 10, 'taskResourceContract', 'c-1')),
  -- Data Analyst, task03: 24 h planned, NO contract
  ('bbbbbbbb-0000-0000-0000-000000000002', :'t3', 'timeGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'taskResourceKind', 'person', 'taskResourceItem', 'p-boris', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 24, 'priceTaskLine', 10)),
  -- pipe sections, task03: 65 under a contract + 35 without = 100 planned, 65 contracted
  ('bbbbbbbb-0000-0000-0000-000000000003', :'t3', 'materialGenus', 2, jsonb_build_object('resourceRoleItem', :'role2', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 65, 'priceTaskLine', 2, 'taskLinePartnerItem', 'partner-1', 'taskLinePartnerContract', 'c-2')),
  ('bbbbbbbb-0000-0000-0000-000000000004', :'t3', 'materialGenus', 3, jsonb_build_object('resourceRoleItem', :'role2', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 35, 'priceTaskLine', 2)),
  -- pipe sections, task04: 200 planned, 80 contracted over two months
  ('bbbbbbbb-0000-0000-0000-000000000005', :'t4', 'materialGenus', 1, jsonb_build_object('resourceRoleItem', :'role2', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 80, 'priceTaskLine', 2, 'taskLinePartnerItem', 'partner-1', 'taskLinePartnerContract', 'c-3')),
  ('bbbbbbbb-0000-0000-0000-000000000006', :'t4', 'materialGenus', 2, jsonb_build_object('resourceRoleItem', :'role2', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 120, 'priceTaskLine', 2)),
  -- a revenue line is never in Monitor01
  ('bbbbbbbb-0000-0000-0000-000000000007', :'t1', 'revenueGenus', 9, jsonb_build_object('measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 1, 'priceTaskLine', 500)),
  -- a line of another user
  ('bbbbbbbb-0000-0000-0000-000000000008', :'tm', 'timeGenus', 1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 8, 'priceTaskLine', 10));

SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty), 4::bigint, 'the line triggers queue the TASKS (4 tasks, not 8 lines)');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view), 0::bigint, 'nothing is in the view before the worker runs (no movements yet)');

-- post the plan of the tasks (the movements are the base of the view)
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t1', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'bbbbbbbb-0000-0000-0000-000000000001', 'qtyTaskLine', 24, 'sumForBudget', 240, 'sumForContract', 240, 'baseOfDistribution', 1,
    'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 0.3333333333), jsonb_build_object('d', '2026-10-15', 'c', 0.3333333333), jsonb_build_object('d', '2026-10-16', 'c', 0.3333333334)))))) AS p1 \gset
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t3', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'bbbbbbbb-0000-0000-0000-000000000002', 'qtyTaskLine', 24, 'sumForBudget', 240, 'sumForContract', 240, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))),
  jsonb_build_object('lineGUID', 'bbbbbbbb-0000-0000-0000-000000000003', 'qtyTaskLine', 65, 'sumForBudget', 130, 'sumForContract', 130, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))),
  jsonb_build_object('lineGUID', 'bbbbbbbb-0000-0000-0000-000000000004', 'qtyTaskLine', 35, 'sumForBudget', 70, 'sumForContract', 70, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-15', 'c', 1)))))) AS p3 \gset
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'t4', 'timeZone', 'Europe/Riga', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'bbbbbbbb-0000-0000-0000-000000000005', 'qtyTaskLine', 80, 'sumForBudget', 160, 'sumForContract', 160, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-30', 'c', 1))),
  jsonb_build_object('lineGUID', 'bbbbbbbb-0000-0000-0000-000000000006', 'qtyTaskLine', 120, 'sumForBudget', 240, 'sumForContract', 240, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-03', 'c', 1)))))) AS p4 \gset
SELECT tt.as_admin();

-- 1. the worker: the numbers of the sheet -------------------------------------------------------------------------------------------------------------
SELECT public.monitor01_process_batch() AS taken \gset
SELECT tt.eq(:'taken'::int >= 3, true, 'one batch takes the queued tasks');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty), 0::bigint, 'the queue is empty after the batch');
SELECT tt.eq((SELECT "qtyPlanned" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 24::numeric, 'sheet: Data Analyst task01 planned 24');
SELECT tt.eq((SELECT "qtyContracted" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 24::numeric, 'sheet: ... contracted 24 (a resource contract is selected)');
SELECT tt.eq((SELECT "qtyRestToContract" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 0::numeric, 'sheet: ... rest to contract 0');
SELECT tt.eq((SELECT "periodMonth" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), '2026-10-01'::date, 'the month is the first day of October');
SELECT tt.eq((SELECT ("qtyPlanned", "qtyContracted", "qtyRestToContract") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus')::text, '(24.00,0.00,24.00)', 'sheet: Data Analyst task03 24 / 0 / 24 (no contract)');
SELECT tt.eq((SELECT ("qtyPlanned", "qtyContracted", "qtyRestToContract", "lineCount") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'materialGenus')::text, '(100.00,65.00,35.00,2)', 'sheet: pipe sections task03 100 / 65 / 35 (two lines in one row)');
SELECT tt.eq((SELECT sum("qtyPlanned") || '/' || sum("qtyContracted") || '/' || sum("qtyRestToContract") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t4'), '200.00/80.00/120.00', 'sheet: pipe sections task04 200 / 80 / 120');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t4'), 2::bigint, 'task04: two months = two rows');
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1'), (SELECT sum(COALESCE(m."sumForBudget", 0)) FROM public.task_line_plan_movements m JOIN public.task_line_table l ON l."rowGUID" = m."rowParentGUID" WHERE m."rowOwnerGUID" = :'t1' AND m."planMovementStatus" AND l."rowParentGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus')), 'sumForBudget of the view = the budget sum of the plan movements (task01)');
SELECT tt.eq((SELECT sum("sumForBudget") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t4'), (SELECT sum(COALESCE(m."sumForBudget", 0)) FROM public.task_line_plan_movements m JOIN public.task_line_table l ON l."rowGUID" = m."rowParentGUID" WHERE m."rowOwnerGUID" = :'t4' AND m."planMovementStatus" AND l."rowParentGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus')), 'sumForBudget of the view = the budget sum of the plan movements (task04, two months)');
SELECT tt.eq((SELECT sum("sumForBudget") > 0 FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1'), true, 'the plan of task01 has a budget sum');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "genusGUID" NOT IN ('timeGenus', 'materialGenus', 'expenseGenus')), 0::bigint, 'revenue is not in the view');
SELECT tt.eq((SELECT ("qtyReceived", "qtyUsed", "qtyOnHand") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1')::text, '(0.00,0.00,0.00)', 'received / used / on-hand are drawn without data');
SELECT tt.eq((SELECT "resourceRoleName" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), :'role1name', 'the role name is copied');
SELECT tt.eq((SELECT "taskName" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 'Task 111', 'the task name is copied');
SELECT tt.eq((SELECT "rowOwnerUserGUID" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' LIMIT 1), '11111111-1111-1111-1111-111111111111'::uuid, 'the owner of the project is copied into the row (the one-column policy)');
SELECT tt.eq(public.monitor01_process_batch(), 0, 'an empty queue: the worker does nothing');

-- 2. only changed rows are written ---------------------------------------------------------------------------------------------------------------------
SELECT "updated_at" AS u0 FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus' \gset
SELECT public.monitor01_rebuild(:'pa');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "updated_at" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), :'u0'::timestamptz, 'a re-computation that finds nothing new does not touch the row (no realtime event)');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_refresh_log WHERE "tasksTaken" > 0), 2::bigint, 'the log has a row per run that did work (the first batch and the rebuild)');

-- 3. changes: a line, a movement, names, a deleted task ------------------------------------------------------------------------------------------------
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskResourceContract": "c-9"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000002';
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty), 1::bigint, 'selecting a contract on a line queues its task');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "qtyContracted" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus'), 24::numeric, 'a contract selected on the line: contracted = the quantity');
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" - 'taskResourceContract' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000002';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "qtyContracted" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus'), 0::numeric, 'the contract removed: contracted 0 again');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "Renamed task"}' WHERE "rowGUID" = :'t1';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "taskName" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 'Renamed task', 'a renamed task: the name follows');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"name": "Renamed project"}' WHERE "rowGUID" = :'pa';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "projectName" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 'Renamed project', 'a renamed project: the name follows');
UPDATE public."resourceRoleTable" SET "rowJSON" = "rowJSON" || '{"title": "Renamed role"}' WHERE "rowGUID" = :'role1';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "resourceRoleName" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 'Renamed role', 'a renamed role: the name follows');
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"measureUnitTaskLine": "unit_day"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "measureUnit" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1' AND "genusGUID" = 'timeGenus'), 'unit_day', 'a changed unit moves the row');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t1'), 1::bigint, '... and the old row is gone');
DELETE FROM public.task_line_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000006';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t4'), 80::numeric, 'a deleted line: its numbers and the empty month row go');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t4'), 1::bigint, '... the November row is gone');
DELETE FROM public.project_task_table WHERE "rowGUID" = :'t4';
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t4'), 0::bigint, 'a deleted task removes its rows (FK cascade)');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'t4'), 0::bigint, 'a deleted task leaves nothing in the queue after the worker');

-- 4. the fact sums: only POSTED documents -----------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_fact_document_create(:'t3') AS fd \gset
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_turnover WHERE "qtyUsed" <> 0), 0::bigint, 'a draft document is not summed (no used quantity in the turnover)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'used'), 0::bigint, 'a draft document has no movements in the register');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_task_fact_document(:'fd')->>'status' AS fstatus \gset
SELECT tt.eq(:'fstatus'::text, 'posted', 'the fact document is posted');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty), 1::bigint, 'Post queues the task');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'materialGenus'), 100::numeric, 'project_status_month_turnover: the material facts of task03 (65 + 35)');
SELECT tt.eq((SELECT ("qtyUsed", "lineCount", "documentCount") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus')::text, '(24.00,1,1)', 'project_status_month_turnover: the time fact, 1 line, 1 document');
SELECT tt.eq((SELECT "rowTurnoverMonth" FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus'), date_trunc('month', current_date)::date, '... in the month of the date of the fact (today)');
SELECT tt.eq((SELECT ("qtyReceived", "qtyUsed", "qtyOnHand") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus' LIMIT 1)::text, '(0.00,24.00,-24.00)', 'the POSTED fact fills qtyUsed (24); received has no data; on-hand = received - used');
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'materialGenus'), 100::numeric, 'the material facts of task03 (65 + 35) are qtyUsed');
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), (SELECT sum("qtyUsed") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), 'the view and project_status_month_turnover agree');
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus'), 24::numeric, 'the plan numbers did not change');
SELECT public.monitor01_verify(1000) AS v_after_fact \gset
SELECT tt.eq(:'v_after_fact'::int, 0, 'verify: the view with qtyUsed is exactly the fresh numbers');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_task_fact_document(:'fd');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_turnover WHERE "qtyUsed" <> 0), 0::bigint, 'Unpost: the sums go');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'used'), 0::bigint, 'Unpost: the movements of the document go (same transaction)');
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3'), 0::numeric, 'Unpost: qtyUsed goes back to 0');
-- a fact of a role that has NO plan still gets its row (plan 0, used 24)
SELECT "rowJSON"->>'resourceRoleItem' AS orig_role FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'fd' AND "genusGUID" = 'timeGenus' \gset
UPDATE public.task_fact_usage_timeline SET "rowJSON" = jsonb_set("rowJSON", '{resourceRoleItem}', to_jsonb('role-without-plan'::text)) WHERE "rowHeaderGUID" = :'fd' AND "genusGUID" = 'timeGenus';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_task_fact_document(:'fd');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT ("qtyPlanned", "qtyUsed", "lineCount") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus' AND "resourceRoleGUID" = 'role-without-plan')::text, '(0.00,24.00,1)', 'a fact without a plan: its own row (planned 0, used 24)');
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus' AND "resourceRoleGUID" <> 'role-without-plan'), 24::numeric, '... the planned row stays');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.unpost_task_fact_document(:'fd');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "resourceRoleGUID" = 'role-without-plan'), 0::bigint, 'Unpost: the row that only the fact made is gone');
UPDATE public.task_fact_usage_timeline SET "rowJSON" = jsonb_set("rowJSON", '{resourceRoleItem}', to_jsonb(:'orig_role'::text)) WHERE "rowHeaderGUID" = :'fd' AND "genusGUID" = 'timeGenus' AND "rowJSON"->>'resourceRoleItem' = 'role-without-plan';
SELECT public.monitor01_process_batch();

-- 5. the drill-down: the list is the proof of the sum --------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.monitor01_sum_sources('planned', jsonb_build_object('taskGUID', :'t3', 'genusGUID', 'materialGenus', 'roleGUID', :'role2', 'unit', 'unit_pcs', 'month', '2026-10-01')) AS s1 \gset
SELECT tt.eq((:'s1'::jsonb->>'sum')::numeric, 100::numeric, 'drill-down: planned = the cell (100)');
SELECT tt.eq((:'s1'::jsonb->>'totalCount')::int, 2, '... from 2 movements');
SELECT tt.eq(:'s1'::jsonb->'rows'->0->>'sourceName', 'taskLinePlanMovements', '... named by their source table');
SELECT public.monitor01_sum_sources('contracted', jsonb_build_object('taskGUID', :'t3', 'genusGUID', 'materialGenus', 'roleGUID', :'role2', 'unit', 'unit_pcs', 'month', '2026-10-01')) AS s2 \gset
SELECT tt.eq((:'s2'::jsonb->>'sum')::numeric, 65::numeric, 'drill-down: contracted = the cell (65)');
SELECT tt.eq((:'s2'::jsonb->>'totalCount')::int, 1, '... from 1 movement');
SELECT tt.eq(:'s2'::jsonb->'rows'->0->>'contractGUID', 'c-2', '... with its contract');
SELECT tt.eq((public.monitor01_sum_sources('planned', jsonb_build_object('taskGUIDs', jsonb_build_array(:'t3', :'t1')))->>'sum')::numeric, (SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" IN (:'t3', :'t1')), 'drill-down of a subtotal under filters: a list of tasks');
SELECT tt.eq((public.monitor01_sum_sources('planned', jsonb_build_object('roleGUIDs', jsonb_build_array(:'role2'), 'projectGUID', :'pa'))->>'sum')::numeric, (SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "resourceRoleGUID" = :'role2' AND "rowProjectGUID" = :'pa'), '... and a list of roles');
SELECT tt.eq(public.monitor01_sum_sources('planned', jsonb_build_object('taskGUID', :'t3', 'genusGUID', 'timeGenus'))->'rows'->0->>'taskName', 'Task 112', 'drill-down rows carry the task name');
SELECT tt.eq((public.monitor01_sum_sources('planned', jsonb_build_object('projectGUID', :'pa'))->>'sum')::numeric, (SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowProjectGUID" = :'pa'), 'drill-down of a total (the whole project) equals the sum of the rows');
SELECT tt.eq((public.monitor01_sum_sources('planned', jsonb_build_object('taskGUID', :'t3'), 1, 1)->'rows')::jsonb @> '[]'::jsonb AND jsonb_array_length(public.monitor01_sum_sources('planned', jsonb_build_object('taskGUID', :'t3'), 1, 1)->'rows') = 1, true, 'paging: limit 1 offset 1 gives one row');
SELECT tt.eq((public.monitor01_sum_sources('received', '{}'::jsonb)->>'totalCount')::int, 0, 'received has no data yet');
SELECT tt.eq((public.monitor01_sum_sources('used', jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 0, 'used: no posted document at this moment = no lines');
SELECT tt.fails($q$SELECT public.monitor01_sum_sources('nonsense')$q$, 'unknown measure', 'an unknown measure is refused');
-- the facts of a posted document
SELECT public.post_task_fact_document(:'fd');
SELECT public.monitor01_sum_sources('fact', jsonb_build_object('taskGUID', :'t3')) AS s3 \gset
SELECT tt.eq((:'s3'::jsonb->>'totalCount')::int, 3, 'drill-down: the lines of the posted fact document');
SELECT tt.eq(:'s3'::jsonb->'rows'->0->>'documentNumber' LIKE 'FI-%', true, '... with the document number');
SELECT public.monitor01_sum_sources('used', jsonb_build_object('taskGUID', :'t3', 'genusGUID', 'timeGenus')) AS s3u \gset
SELECT tt.eq((:'s3u'::jsonb->>'sum')::numeric, 24::numeric, 'drill-down used = the lines of the posted fact (the number of the cell)');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((public.monitor01_sum_sources('planned', jsonb_build_object('taskGUID', :'t3'))->>'totalCount')::int, 0, 'marko cannot list the transactions of anna');

-- 6. policies ----------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view), 0::bigint, 'marko sees no row of anna (his task has no movement)');
SELECT tt.fails($q$INSERT INTO public.monitor01_view ("rowOwnerGUID", "genusGUID", "periodMonth", "rowProjectGUID", "rowOwnerUserGUID") VALUES (gen_random_uuid(), 'timeGenus', current_date, gen_random_uuid(), gen_random_uuid())$q$, 'permission denied', 'nobody writes the view');
SELECT tt.fails($q$SELECT * FROM public.monitor01_dirty$q$, 'permission denied', 'the queue is not readable');
SELECT tt.fails($q$SELECT public.monitor01_process_batch()$q$, 'permission denied', 'the worker is not callable by a user');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) > 0 FROM public.monitor01_view), true, 'anna sees her rows');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerUserGUID" <> '11111111-1111-1111-1111-111111111111'), 0::bigint, '... only hers');
SELECT tt.as_admin();

-- 6a. the project status REGISTER (project_status_movements) is the source of the turnover and of the report -------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty), 0::bigint, 'the worker rewrites the plan register without queueing itself again (no loop)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'plan'), (SELECT count(*) FROM public.task_line_plan_movements m JOIN public.task_line_table l ON l."rowGUID" = m."rowParentGUID" WHERE m."planMovementStatus" AND l."rowParentGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus')), 'register: one plan movement per posted plan movement (revenue is not in it)');
SELECT tt.eq((SELECT sum("qtyProjectStatus") FROM public.project_status_movements WHERE "rowMovementKind" = 'plan'), (SELECT sum(m."qtyTaskLine") FROM public.task_line_plan_movements m JOIN public.task_line_table l ON l."rowGUID" = m."rowParentGUID" WHERE m."planMovementStatus" AND l."rowParentGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus')), 'register: qtyProjectStatus adds up to the plan quantity');
SELECT tt.eq((SELECT DISTINCT "rowRegistratorType" FROM public.project_status_movements WHERE "rowMovementKind" = 'plan' AND "rowOwnerGUID" = :'t1'), 'projectTask', 'plan registrator type = projectTask');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'plan' AND "rowOwnerGUID" = :'t1' AND "contractGUID" = 'c-1'), 3::bigint, 'the contract of the line is a snapshot dimension of each plan movement');
SELECT tt.eq((SELECT sum("qtyPlan") FROM public.project_status_month_turnover), (SELECT sum("qtyProjectStatus") FROM public.project_status_movements WHERE "rowMovementKind" = 'plan'), 'turnover.qtyPlan = the sum of the plan movements');
SELECT tt.eq((SELECT sum("qtyPlanContracted") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t3'), 65::numeric, 'qtyPlanContracted = the plan movements that have a contract (65 of task03 pipes)');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowMovementKind" = 'used' AND "rowRegistratorGUID" = :'fd' AND "rowRegistratorType" = 'taskFactHeader'), 3::bigint, 'register: the posted fact document = 3 used movements, registrator = the document');
SELECT tt.eq((SELECT sum("qtyUsed") FROM public.project_status_month_turnover), (SELECT sum("qtyProjectStatus") FROM public.project_status_movements WHERE "rowMovementKind" = 'used'), 'turnover.qtyUsed = the sum of the used movements');
SELECT tt.eq((SELECT sum("sumForContractUsed") FROM public.project_status_month_turnover), (SELECT sum("sumForContract") FROM public.project_status_movements WHERE "rowMovementKind" = 'used'), 'turnover.sumForContractUsed = the sum of the used movements');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'fd' AND "rowTurnoverDay" IS NULL), 0::bigint, 'every movement has its day (and the generated month)');
SELECT tt.eq((SELECT bool_and("rowTurnoverMonth" = date_trunc('month', "rowTurnoverDay")::date) FROM public.project_status_movements), true, 'rowTurnoverMonth = the first day of the month of the day');
SELECT tt.fails($q$INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID") SELECT 'nonsense', now(), current_date, gen_random_uuid(), 'x', t."projectGUID", t."rowGUID", 'timeGenus' FROM public.project_task_table t LIMIT 1$q$, 'project_status_movements_kind_chk', 'an unknown movement kind is refused');
-- registering the same document twice leaves the same rows (rewrite by registrator)
SELECT public.project_status_register_fact(:'fd');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowRegistratorGUID" = :'fd'), 3::bigint, 'register twice = the same 3 movements (rewrite by registrator)');
-- who may read: the owner of the project only
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) > 0 FROM public.project_status_movements), true, 'anna reads her movements');
SELECT tt.eq((SELECT count(*) > 0 FROM public.project_status_month_turnover), true, 'anna reads her turnover');
SELECT tt.fails($q$INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID") SELECT 'plan', now(), current_date, gen_random_uuid(), 'x', t."projectGUID", t."rowGUID", 'timeGenus' FROM public.project_task_table t LIMIT 1$q$, 'permission denied', 'a user cannot write the register');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_status_movements WHERE "rowOwnerGUID" = :'t1'), 0::bigint, 'marko sees no movement of anna');
SELECT tt.eq((SELECT count(*) FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t1'), 0::bigint, 'marko sees no turnover of anna');
SELECT tt.as_admin();

-- 6a2. the stamp: the cheap question of the open report (my rows changed? is the worker keeping up?) -------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.monitor01_stamp() AS st \gset
SELECT tt.eq((:'st'::jsonb->>'count')::bigint, (SELECT count(*) FROM public.monitor01_view), 'stamp: the number of MY rows in the view');
SELECT tt.eq((:'st'::jsonb->>'maxUpdatedAt')::timestamptz, (SELECT max("updated_at") FROM public.monitor01_view), 'stamp: the newest updated_at of my rows');
SELECT tt.eq((:'st'::jsonb->>'queued')::int, 0, 'stamp: nothing queued (the worker has run)');
SELECT tt.eq((public.monitor01_stamp(gen_random_uuid())->>'count')::int, 0, 'stamp: a project that is not mine has no rows');
SELECT tt.as_admin();
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 25}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT pg_sleep(1.1);
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.monitor01_stamp()->>'queued')::int >= 1, true, 'stamp: a change queues the task of MY project and the stamp says so');
SELECT tt.eq((public.monitor01_stamp()->>'queuedAgeSeconds')::numeric >= 1, true, 'stamp: ... with how long it waits (the screen computes at once when the worker is late)');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((public.monitor01_stamp()->>'queued')::int, 0, 'stamp: the queue of anna is not marko''s');
SELECT tt.eq((public.monitor01_stamp()->>'count')::int, (SELECT count(*)::int FROM public.monitor01_view), 'stamp: marko counts only his rows');
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();

-- 6b. refresh NOW (no pg_cron needed): the user's own tasks are recomputed at once ---------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT count(*) AS rows_before FROM public.monitor01_view \gset
DELETE FROM public.monitor01_view;
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view), 0::bigint, 'the view is empty (the worker did not run)');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.monitor01_refresh_now() AS rn \gset
SELECT tt.eq((:'rn'::jsonb->>'tasks')::int > 0, true, 'refresh now: it found the tasks of anna');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view), :'rows_before'::bigint, 'refresh now: the PLAN rows are back (all of them), the same as the worker made');
SELECT tt.eq((SELECT sum("qtyPlanned") > 0 FROM public.monitor01_view), true, 'refresh now: plan data without any fact');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((public.monitor01_refresh_now()->>'tasks')::int, 0, 'refresh now: marko has no task of his own - nothing is touched');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.monitor01_refresh_now(gen_random_uuid())->>'tasks')::int, 0, 'refresh now: a project that is not hers = nothing');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "attempts" >= 5), 0::bigint, 'no parked task');

-- 7. verify: the safety net ------------------------------------------------------------------------------------------------------------------------------------
SELECT public.monitor01_process_batch();     -- the Post of the fact document above is still queued
UPDATE public.monitor01_view SET "qtyPlanned" = "qtyPlanned" + 1 WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus';
SELECT tt.eq(public.monitor01_verify(1000) >= 1, true, 'verify finds a damaged row and queues its task');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "qtyPlanned" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'t3' AND "genusGUID" = 'timeGenus'), 24::numeric, '... the worker repairs it');
SELECT tt.eq(public.monitor01_verify(1000), 0, 'verify finds nothing when all is right');

-- 8. a poisoned task is parked and never blocks the others -------------------------------------------------------------------------------------------------------
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskIsPosted": "not-a-boolean"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000008';
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 25}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000002';
INSERT INTO public.task_line_plan_movements ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "rowPeriodDatetime", "rowCoefficient", "qtyTaskLine")
SELECT p."projectGUID", :'tm', 'bbbbbbbb-0000-0000-0000-000000000008', '2026-10-14 00:00:00+00', 1, 8 FROM public.project_task_table p WHERE p."rowGUID" = :'tm';
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty), 2::bigint, 'the good task and the poisoned task are queued');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "attempts" FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'tm'), 1, 'the poisoned task stays in the queue with attempts 1');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'t3'), 0::bigint, 'the good task of the same batch was processed');
SELECT public.monitor01_process_batch(); SELECT public.monitor01_process_batch(); SELECT public.monitor01_process_batch(); SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "attempts" FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'tm'), 5, 'after 5 attempts the task is parked');
SELECT tt.eq((SELECT "lastError" ILIKE '%boolean%' FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'tm'), true, '... with the reason');
SELECT tt.eq(public.monitor01_process_batch(), 0, 'a parked task is skipped');
SELECT tt.eq((SELECT max("parkedTasks") FROM public.monitor01_refresh_log) >= 1, true, 'the log says how many tasks are parked');

ROLLBACK;
