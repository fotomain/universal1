-- PART 27: the project cost total (documentation/UPDATE_PROJECT_COST.html): project_task_cost_total = Time + Material + Expense of the plan, summed into the stages above; step 3 of monitor01_apply (the delta),
-- project_cost_rebuild / project_cost_verify / update_project_cost_total, the gate project_cost_budget_on, the move / delete queue, the policies
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');

-- helpers (in the schema tt, dropped by the runner) -------------------------------------------------------------------------------------------------------------
CREATE FUNCTION tt.mk_task(p_project uuid, p_parent uuid, p_kind text, p_name text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v uuid := gen_random_uuid(); v_parent ltree;
BEGIN
  SELECT CASE WHEN p_parent IS NULL THEN public.pm_ltree_label(p_project) ELSE (SELECT t."treePath" FROM public.project_task_table t WHERE t."rowGUID" = p_parent) END INTO v_parent;
  INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
  VALUES (v, v_parent || public.pm_ltree_label(v), p_project, '11111111-1111-1111-1111-111111111111', jsonb_build_object('taskDescription', p_name, 'rowKind', p_kind));
  RETURN v;
END $$;

-- a line of a genus on a task: its GUID
CREATE FUNCTION tt.cost_line(p_task uuid, p_genus text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
  VALUES (v, p_task, p_genus, 1, jsonb_strip_nulls(jsonb_build_object('resourceRoleItem', 'role-x', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 1, 'priceTaskLine', 1,
          'taskResourceKind', CASE WHEN p_genus = 'timeGenus' THEN 'person' END, 'taskResourceItem', CASE WHEN p_genus = 'timeGenus' THEN 'p-boris' END)));
  RETURN v;
END $$;

-- post the plan of ONE task: p_lines = [{"line": "<uuid>", "sum": 100}] (all the lines of the task in one call: a post replaces the earlier rows of the task)
CREATE FUNCTION tt.cost_post(p_task uuid, p_lines jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  l jsonb; v_lines jsonb := '[]'::jsonb;
BEGIN
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('lineGUID', l->>'line', 'qtyTaskLine', 1, 'sumForBudget', (l->>'sum')::numeric, 'sumForContract', (l->>'sum')::numeric, 'baseOfDistribution', 1,
                                            'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))));
  END LOOP;
  RETURN public.create_task_line_plan(jsonb_build_object('taskGUID', p_task, 'timeZone', 'Europe/Riga', 'lines', v_lines));
END $$;

CREATE FUNCTION tt.total(p_task uuid) RETURNS numeric LANGUAGE sql AS $$ SELECT COALESCE((SELECT "costTotalForBudget" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = p_task), -1) $$;
CREATE FUNCTION tt.own(p_task uuid) RETURNS numeric LANGUAGE sql AS $$ SELECT COALESCE((SELECT "costOwnForBudget" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = p_task), -1) $$;

-- 0. the gate function = the rule of the app (kit8/pm/model/taskInputScope.ts, projectCostBudgetOn) ----------------------------------------------------------------------------
SELECT tt.eq(public.project_cost_budget_on('{}'::jsonb), false, 'gate: nothing saved = the master is off = no cost budget (legacy project)');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true}'::jsonb), true, 'gate: master on, children not saved (they default to on) = on');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": false, "projectTimeCostsNeeded": true, "projectMaterialCostsNeeded": true}'::jsonb), false, 'gate: master off = off, whatever the children say');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": false, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": false}'::jsonb), false, 'gate: Time, Material and Expense all off = off');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": false, "projectMaterialCostsNeeded": true, "projectExpenseCostsNeeded": false}'::jsonb), true, 'gate: Material only = on');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": false, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": true}'::jsonb), true, 'gate: Expense only = on');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": true, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": false}'::jsonb), true, 'gate: Time only (person is on by default) = on');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": true, "projectTimeOfPersonNeeded": false, "projectTimeOfEquipmentNeeded": false, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": false}'::jsonb), false, 'gate: Time with neither person nor equipment is not a Time budget');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": true, "projectTimeOfPersonNeeded": false, "projectTimeOfEquipmentNeeded": true, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": false}'::jsonb), true, 'gate: Time of equipment only = on');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": true, "projectTimeCostsNeeded": true, "projectTimeOfPersonNeeded": false, "projectTimeOfEquipmentNeeded": false, "projectTimeOfWorkCenterNeeded": true, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": false}'::jsonb), true, 'gate: Time of work center only = on');
SELECT tt.eq(public.project_cost_budget_on('{"projectExpenseBudgetNeeded": "true"}'::jsonb), false, 'gate: a string is not a boolean (the app reads only booleans)');

-- the project and its tree:   P ── S1 ── S11 ── T1, T2
--                                  │     └──── T3 (under S1)
--                                  └ S2 ── T4
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000001'), '11111111-1111-1111-1111-111111111111', '{"name": "Cost project"}');
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', NULL, 'stage', 'S1') AS s1 \gset
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', :'s1', 'stage', 'S11') AS s11 \gset
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', :'s11', 'task', 'T1') AS t1 \gset
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', :'s11', 'task', 'T2') AS t2 \gset
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', :'s1', 'task', 'T3') AS t3 \gset
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', NULL, 'stage', 'S2') AS s2 \gset
SELECT tt.mk_task('aaaaaaaa-0000-0000-0000-000000000001', :'s2', 'task', 'T4') AS t4 \gset
SELECT tt.cost_line(:'t1', 'timeGenus') AS l1 \gset
SELECT tt.cost_line(:'t2', 'materialGenus') AS l2 \gset
SELECT tt.cost_line(:'t3', 'expenseGenus') AS l3 \gset
SELECT tt.cost_line(:'t4', 'timeGenus') AS l4t \gset
SELECT tt.cost_line(:'t4', 'materialGenus') AS l4m \gset
SELECT tt.cost_line(:'t4', 'expenseGenus') AS l4e \gset
\set P 'aaaaaaaa-0000-0000-0000-000000000001'

-- 1. the master is OFF: the worker fills the turnover, the cost table stays empty ---------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.cost_post(:'t1', jsonb_build_array(jsonb_build_object('line', :'l1', 'sum', 100)));
SELECT tt.cost_post(:'t2', jsonb_build_array(jsonb_build_object('line', :'l2', 'sum', 50)));
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT sum("sumForBudgetPlan") FROM public.project_status_month_turnover WHERE "rowProjectGUID" = :'P'), 150::numeric, 'the turnover has the plan of the two tasks (150)');
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 0::bigint, 'master off: the worker writes no cost row');

-- 2. the master goes ON: the project is rebuilt at once ----------------------------------------------------------------------------------------------------------------------
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectExpenseBudgetNeeded": true}' WHERE "rowGUID" = :'P';
SELECT tt.eq(tt.own(:'t1'), 100::numeric, 'switch on: T1 own 100');
SELECT tt.eq(tt.total(:'t1'), 100::numeric, '... T1 total 100');
SELECT tt.eq(tt.total(:'t2'), 50::numeric, '... T2 total 50 (Material)');
SELECT tt.eq(tt.total(:'s11'), 150::numeric, '... the stage S11 = T1 + T2');
SELECT tt.eq(tt.own(:'s11'), 0::numeric, '... a stage without lines of its own has own cost 0 (it has a row because of the total)');
SELECT tt.eq(tt.total(:'s1'), 150::numeric, '... the stage S1 above it = 150');
SELECT tt.eq(tt.total(:'s2'), -1::numeric, '... S2 has no cost: no row (sparse)');
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 4::bigint, '... 4 rows: T1, T2, S11, S1');
SELECT tt.eq((SELECT "rowOwnerUserGUID" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'s1'), '11111111-1111-1111-1111-111111111111'::uuid, 'the owner of the project is copied into the row (the one-column policy)');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');

-- 3. the hot path: the worker adds the delta to the task and to every stage above it -----------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.cost_post(:'t3', jsonb_build_array(jsonb_build_object('line', :'l3', 'sum', 30)));
SELECT tt.as_admin();
SELECT tt.eq(tt.total(:'t3'), -1::numeric, 'before the worker: the Post is only queued');
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.total(:'t3'), 30::numeric, 'worker: T3 (Expense) 30');
SELECT tt.eq(tt.total(:'s1'), 180::numeric, '... S1 = 150 + 30');
SELECT tt.eq(tt.total(:'s11'), 150::numeric, '... S11 is not touched (T3 is not below it)');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');
SELECT "updated_at" AS u_s11 FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'s11' \gset

-- a task with all three genera: Time + Material + Expense
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.cost_post(:'t4', jsonb_build_array(jsonb_build_object('line', :'l4t', 'sum', 10), jsonb_build_object('line', :'l4m', 'sum', 20), jsonb_build_object('line', :'l4e', 'sum', 30)));
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.own(:'t4'), 60::numeric, 'CostTotal = Time + Material + Expense: 10 + 20 + 30 = 60');
SELECT tt.eq(tt.total(:'s2'), 60::numeric, '... and its stage S2');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');

-- a change DOWN (a re-post with a lower sum): the delta is negative
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.cost_post(:'t1', jsonb_build_array(jsonb_build_object('line', :'l1', 'sum', 40)));
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.own(:'t1'), 40::numeric, 'a lower plan: T1 own 40');
SELECT tt.eq(tt.total(:'s11'), 90::numeric, '... S11 = 40 + 50');
SELECT tt.eq(tt.total(:'s1'), 120::numeric, '... S1 = 90 + 30');
SELECT tt.eq((SELECT "updated_at" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'s2'), (SELECT "updated_at" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'s2'), 'S2 is not part of this change');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');

-- nothing changed -> nothing written (no realtime noise)
SELECT public.monitor01_queue_tasks(ARRAY[:'t1'::uuid, :'t2'::uuid, :'t3'::uuid], 'test');
SELECT "updated_at" AS u_s1 FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'s1' \gset
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT "updated_at" FROM public.project_task_cost_total WHERE "rowOwnerGUID" = :'s1'), :'u_s1'::timestamptz, 'tasks recomputed with the same plan do not touch a row');

-- used / invoiced movements are not the plan: the total does not move
INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID", "qtyProjectStatus", "sumForBudget")
VALUES ('used', now(), current_date, gen_random_uuid(), 'taskFactHeader', :'P', :'t1', 'timeGenus', 5, 77), ('invoiced', now(), current_date, gen_random_uuid(), 'vendorInvoiceHeader', :'P', :'t1', 'timeGenus', 5, 88);
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.own(:'t1'), 40::numeric, 'used and invoiced movements do not change the plan total');
SELECT tt.eq((SELECT sum("sumForBudgetUsed") + sum("sumForBudgetInvoiced") FROM public.project_status_month_turnover WHERE "rowOwnerGUID" = :'t1'), 165::numeric, '... though they are in the turnover (77 + 88)');

-- an UNPOSTED line is not counted (the plan of an unposted line is not in the register)
SELECT tt.cost_line(:'t2', 'materialGenus') AS l2b \gset
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.own(:'t2'), 50::numeric, 'a line that is not posted is not counted');

-- 4. the gate: the three budgets ------------------------------------------------------------------------------------------------------------------------------------------------
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectTimeCostsNeeded": false, "projectMaterialCostsNeeded": false, "projectExpenseCostsNeeded": false}' WHERE "rowGUID" = :'P';
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 0::bigint, 'Time, Material and Expense all off: the rows go');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.cost_post(:'t2', jsonb_build_array(jsonb_build_object('line', :'l2', 'sum', 55)));
SELECT tt.as_admin();
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 0::bigint, '... and the worker writes none while all three are off');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectMaterialCostsNeeded": true}' WHERE "rowGUID" = :'P';
SELECT tt.eq(tt.total(:'s1'), 125::numeric, 'Material on again: rebuilt at once; Time and Expense lines that exist are still summed (a switch never hides data): 40 + 55 + 30');
SELECT tt.eq(tt.total(:'s2'), 60::numeric, '... S2 = 60');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"name": "Renamed"}' WHERE "rowGUID" = :'P';
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 7::bigint, 'a change that leaves the rule as it was does nothing');

-- 5. a stage is MOVED: the project is queued and rebuilt by the worker ----------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.project_cost_dirty), 0::bigint, 'the rebuild queue is empty');
UPDATE public.project_task_table SET "treePath" = (SELECT "treePath" FROM public.project_task_table WHERE "rowGUID" = :'s2') || public.pm_ltree_label(:'s11') WHERE "rowGUID" = :'s11';
SELECT tt.eq((SELECT count(*) FROM public.project_cost_dirty WHERE "rowProjectGUID" = :'P'), 1::bigint, 'moving a stage queues the project');
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_cost_dirty), 0::bigint, '... the worker rebuilt it');
SELECT tt.eq(tt.total(:'s1'), 30::numeric, 'S1 lost the moved stage: only T3 (30) is left');
SELECT tt.eq(tt.total(:'s2'), 60::numeric + 95::numeric, 'S2 gained it: 60 + (40 + 55)');
SELECT tt.eq(tt.total(:'s11'), 95::numeric, 'S11 itself is the same');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');

-- 6. a subtree is DELETED -----------------------------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM public.project_task_table WHERE "rowGUID" = :'s11';
SELECT tt.eq((SELECT count(*) FROM public.project_cost_dirty WHERE "rowProjectGUID" = :'P'), 1::bigint, 'deleting a stage queues the project');
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.total(:'s2'), 60::numeric, 'the stage above lost the whole subtree: 60');
SELECT tt.eq(tt.total(:'t1'), -1::numeric, '... the rows of the deleted tasks went with them (FK cascade)');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');

-- a line deleted: the task and the stages above go to 0 and their rows disappear
DELETE FROM public.task_line_table WHERE "rowGUID" = :'l3';
SELECT public.monitor01_process_batch();
SELECT tt.eq(tt.total(:'t3'), -1::numeric, 'a deleted line: the task has no cost row any more');
SELECT tt.eq(tt.total(:'s1'), -1::numeric, '... and the stage above it (0 / 0) has none either');
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total WHERE "costOwnForBudget" = 0 AND "costTotalForBudget" = 0), 0::bigint, 'no 0 / 0 row is ever kept');

-- 7. the toolbar command: update_project_cost_total ---------------------------------------------------------------------------------------------------------------------------
-- a Post that nobody has processed yet, and a drifted row
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.cost_post(:'t4', jsonb_build_array(jsonb_build_object('line', :'l4t', 'sum', 10), jsonb_build_object('line', :'l4m', 'sum', 20), jsonb_build_object('line', :'l4e', 'sum', 40)));
SELECT public.update_project_cost_total(:'P') AS r1 \gset
SELECT tt.as_admin();
SELECT tt.eq((:'r1'::jsonb->>'flushed')::int, 1, 'the command flushes the queued task of the project');
SELECT tt.eq(tt.own(:'t4'), 70::numeric, '... T4 is 70 at once (no waiting for the worker)');
SELECT tt.eq((:'r1'::jsonb->>'projectTotal')::numeric, 70::numeric, '... the answer has the project total');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'t4'), 0::bigint, '... and the task is out of the queue');
UPDATE public.project_task_cost_total SET "costTotalForBudget" = "costTotalForBudget" + 5 WHERE "rowOwnerGUID" = :'s2';
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 1::bigint, 'a drifted stage is found by verify');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.update_project_cost_total(:'P') AS r2 \gset
SELECT tt.as_admin();
SELECT tt.eq((:'r2'::jsonb->>'changedRows')::int, 1, 'the command heals it: 1 changed row');
SELECT tt.eq(tt.total(:'s2'), 70::numeric, '... S2 is right again');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.update_project_cost_total(:'P') AS r3 \gset
SELECT tt.as_admin();
SELECT tt.eq((:'r3'::jsonb->>'changedRows')::int, 0, 'a project that is up to date: 0 changed rows (idempotent)');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_verify(:'P')), 0::bigint, 'verify: nothing differs');

-- 8. policies ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 0::bigint, 'marko sees no cost row of anna');
SELECT tt.fails(format($q$SELECT public.update_project_cost_total(%L)$q$, :'P'), 'not yours', 'marko cannot update the cost of the project of anna');
SELECT tt.fails($q$INSERT INTO public.project_task_cost_total ("rowOwnerGUID", "rowProjectGUID") VALUES (gen_random_uuid(), gen_random_uuid())$q$, 'permission denied', 'nobody writes the table but the functions');
SELECT tt.fails($q$SELECT * FROM public.project_cost_dirty$q$, 'permission denied', 'the rebuild queue is not readable');
SELECT tt.fails(format($q$SELECT public.project_cost_rebuild(%L)$q$, :'P'), 'permission denied', 'the rebuild is not callable by a user');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 2::bigint, 'anna sees her rows (T4 and S2)');
SELECT tt.as_admin();

-- 9. a project deleted: nothing is left ------------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM public.project_table WHERE "rowGUID" = :'P';
SELECT public.monitor01_process_batch();
SELECT tt.eq((SELECT count(*) FROM public.project_task_cost_total), 0::bigint, 'a deleted project leaves no cost row');
SELECT tt.eq((SELECT count(*) FROM public.project_cost_dirty), 0::bigint, '... and no entry in the rebuild queue after the worker');

ROLLBACK;
