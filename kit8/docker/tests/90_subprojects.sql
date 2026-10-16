-- PART 29: SUBPROJECTS (documentation/SUBPROJECTS_BRD_TRD.html): the settings, the task flag + the subproject, no recursion, the dates of the origin task, many origins, the guards,
-- the aggregation of Time / Material / Expense into the origin task in Monitor01 (+ its drill-down), the repair function and the install defaults
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('outsider@other.test', '33333333-3333-3333-3333-333333333333', 'Out', 'S');

CREATE FUNCTION tt.mk_project(p_guid uuid, p_name text, p_extra jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
  VALUES (p_guid, public.pm_ltree_label(p_guid), '11111111-1111-1111-1111-111111111111', jsonb_build_object('name', p_name) || p_extra);
  RETURN p_guid;
END $$;

CREATE FUNCTION tt.mk_task(p_project uuid, p_kind text, p_name text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
  VALUES (v, public.pm_ltree_label(p_project) || public.pm_ltree_label(v), p_project, '11111111-1111-1111-1111-111111111111', jsonb_build_object('name', p_name, 'rowKind', p_kind));
  RETURN v;
END $$;

-- the project A, B, C, D; A, B, C have the functionality on
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000a', 'Project A', '{"subprojectsFunctionalityEnabled": true}') AS pa \gset
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000b', 'Project B', '{"subprojectsFunctionalityEnabled": true}') AS pb \gset
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000c', 'Project C', '{"subprojectsFunctionalityEnabled": true}') AS pc \gset
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000d', 'Project D') AS pd \gset
SELECT tt.mk_task(:'pa', 'task', 'a1') AS a1 \gset
SELECT tt.mk_task(:'pa', 'task', 'a3') AS a3 \gset
SELECT tt.mk_task(:'pa', 'stage', 'a-stage') AS astage \gset
SELECT tt.mk_task(:'pb', 'task', 'b1') AS b1 \gset
SELECT tt.mk_task(:'pb', 'task', 'b2') AS b2 \gset
SELECT tt.mk_task(:'pc', 'task', 'c1') AS c1 \gset
SELECT tt.mk_task(:'pc', 'task', 'c2') AS c2 \gset
SELECT tt.mk_task(:'pd', 'task', 'd1') AS d1 \gset

-- 0. defaults: nothing is on for an old project -------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.subproject_enabled(:'pd'), false, 'defaults: a project without the key has the functionality OFF');
SELECT tt.eq(public.subproject_enabled(:'pa'), true, 'the functionality is ON when stored true');
SELECT tt.eq(public.subproject_auto_change(:'pa'), true, 'autoChangeOriginTaskBasedOnSubprojects: true when not stored');
SELECT tt.eq(public.subproject_dates_on(:'pa'), true, 'autoChangeStartAndFinishDatesForOriginTask: true when not stored');
SELECT tt.eq(public.subproject_aggregate_on(:'pa', 'timeGenus'), false, 'aggregateTimeFromSubprojectToTheOriginTask: false when not stored');
SELECT tt.eq(public.subproject_aggregate_on(:'pa', 'materialGenus'), false, 'aggregateMaterialFromSubprojectToTheOriginTask: false when not stored');
SELECT tt.eq(public.subproject_aggregate_on(:'pa', 'expenseGenus'), false, 'aggregateExpenceFromSubprojectToTheOriginTask: false when not stored');
SELECT tt.eq(public.subproject_dates_on(:'pd'), false, 'the switches are off while the functionality is off');
SELECT tt.eq((SELECT count(*) FROM public.project_subproject_link), 0::bigint, 'no link');

-- 1. the flag and the subproject ----------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskIsSubproject": true}' WHERE "rowGUID" = %L$q$, :'d1'), 'SUBPROJECT_DISABLED', 'the flag is refused while the functionality of the project is off');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskIsSubproject": true}' WHERE "rowGUID" = %L$q$, :'astage'), 'SUBPROJECT_BAD_TASK', 'a stage cannot stand for a subproject');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', %L) WHERE "rowGUID" = %L$q$, 'bbbbbbbb-0000-0000-0000-00000000dead', :'a1'), 'SUBPROJECT_NOT_FOUND', 'a project that does not exist');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', %L) WHERE "rowGUID" = %L$q$, :'pa', :'a1'), 'SUBPROJECT_CYCLE', 'a project cannot be its own subproject');
-- flag first (no subproject yet) = allowed: the task waits for its choice
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskIsSubproject": true}' WHERE "rowGUID" = :'a1';
SELECT tt.eq((SELECT count(*) FROM public.project_subproject_link), 0::bigint, 'a flag without a subproject makes no link');
SELECT tt.eq((SELECT count(*) FROM public.subproject_candidates(:'pa') WHERE "projectName" IN ('Project B', 'Project C', 'Project D')), 3::bigint, 'the picker offers B, C and D to A');
SELECT tt.eq((SELECT count(*) FROM public.subproject_candidates(:'pa') WHERE "projectGUID" = :'pa'), 0::bigint, 'the picker never offers the project itself');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskSubprojectGUID', :'pb') WHERE "rowGUID" = :'a1';
SELECT tt.eq((SELECT "rowSubprojectGUID" FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'a1'), :'pb'::uuid, 'the link row of A.a1 -> B exists');
SELECT tt.eq((SELECT "rowProjectGUID" FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'a1'), :'pa'::uuid, '... and knows the origin project');

-- 2. no recursion ---------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', %L) WHERE "rowGUID" = %L$q$, :'pa', :'b1'), 'SUBPROJECT_CYCLE: Project B -> Project A -> Project B', 'A -> B, so B -> A is a cycle (the message names the chain)');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', :'pc') WHERE "rowGUID" = :'b1';
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', %L) WHERE "rowGUID" = %L$q$, :'pa', :'c1'), 'SUBPROJECT_CYCLE', 'A -> B -> C, so C -> A is a cycle');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', %L) WHERE "rowGUID" = %L$q$, :'pb', :'c1'), 'SUBPROJECT_CYCLE', 'B -> C, so C -> B is a cycle');
SELECT tt.eq((SELECT count(*) FROM public.subproject_candidates(:'pc') WHERE "projectGUID" IN (:'pa', :'pb')), 0::bigint, 'the picker of C does not offer A and B (they would close a cycle)');
SELECT tt.eq((SELECT count(*) FROM public.subproject_candidates(:'pc') WHERE "projectGUID" = :'pd'), 1::bigint, '... but offers D');
-- many origins for one subproject (rule 1)
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', :'pb') WHERE "rowGUID" = :'a3';
SELECT tt.eq((SELECT count(*) FROM public.project_subproject_link WHERE "rowSubprojectGUID" = :'pb'), 2::bigint, 'one project is the subproject of two tasks of the same project');
SELECT tt.eq((SELECT "usedByCount" FROM public.subproject_candidates(:'pd') WHERE "projectGUID" = :'pb'), 2, 'usedByCount in the picker');
-- the flag off clears the subproject and the link
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskIsSubproject": false}' WHERE "rowGUID" = :'a3';
SELECT tt.eq((SELECT "rowJSON"->>'taskSubprojectGUID' FROM public.project_task_table WHERE "rowGUID" = :'a3'), NULL::text, 'flag off: taskSubprojectGUID is cleared');
SELECT tt.eq((SELECT count(*) FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'a3'), 0::bigint, 'flag off: the link is gone');
SELECT tt.eq(public.organization_has_subprojects_enabled(), true, 'the Monitor01 radio is wanted: a project of the organization has the functionality on');
SELECT tt.as_user('outsider@other.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.organization_has_subprojects_enabled(), false, 'another organization sees no project with the functionality: no radio');
SELECT tt.eq((SELECT count(*) FROM public.project_subproject_link), 0::bigint, 'the links of another organization are not visible');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 3. Post is refused for a project in a cycle (a cycle that got in by direct data) -------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
INSERT INTO public.project_subproject_link ("rowOwnerGUID", "rowProjectGUID", "rowSubprojectGUID") VALUES (:'c1', :'pc', :'pa');
SELECT tt.eq(public.subproject_in_cycle(:'pa'), true, 'the damaged graph A -> B -> C -> A is a cycle');
SELECT tt.eq(public.subproject_in_cycle(:'pd'), false, 'D is not in a cycle');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES ('cccccccc-0000-0000-0000-000000000001', :'a3', 'materialGenus', 1, jsonb_build_object('resourceRoleItem', 'role-x', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 1, 'priceTaskLine', 1));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', %L, 'timeZone', 'UTC', 'lines', jsonb_build_array(jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000001', 'qtyTaskLine', 1, 'sumForBudget', 1, 'sumForContract', 1, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))))))$q$, :'a3'),
                'SUBPROJECT_CYCLE', 'Post of a task of a project in a cycle is refused');
SELECT tt.as_admin();
DELETE FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'c1';
SELECT tt.eq(public.subproject_in_cycle(:'pa'), false, 'the cycle is removed');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT (public.create_task_line_plan(jsonb_build_object('taskGUID', :'a3', 'timeZone', 'UTC', 'lines', jsonb_build_array(jsonb_build_object('lineGUID', 'cccccccc-0000-0000-0000-000000000001', 'qtyTaskLine', 1, 'sumForBudget', 1, 'sumForContract', 1, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-10-14', 'c', 1))))))->>'lines')::int AS posted \gset
SELECT tt.eq(:'posted', 1, 'Post works again without the cycle');

-- 4. working days = the twin of workDaysBetween ------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.subproject_work_days('2026-11-02T00:00:00Z', '2026-11-10T00:00:00Z', false), 8, 'work days: calendar days when weekends are worked');
SELECT tt.eq(public.subproject_work_days('2026-11-02T00:00:00Z', '2026-11-10T00:00:00Z', true), 6, 'work days: Mon 2 Nov .. Mon 9 Nov without Sat and Sun = 6');
SELECT tt.eq(public.subproject_work_days('2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z', true), 0, 'work days: an empty range = 0');
SELECT tt.eq(public.subproject_work_days('2026-11-10T00:00:00Z', '2026-11-02T00:00:00Z', false), 0, 'work days: finish before start = 0');
SELECT tt.eq(public.subproject_work_days('2026-11-07T00:00:00Z', '2026-11-09T00:00:00Z', true), 0, 'work days: a weekend only = 0');

-- 5. the dates of the origin task follow the subproject ---------------------------------------------------------------------------------------------------------------------------------
-- B is scheduled by its client (pm_apply_schedule): b2 2 Nov .. 10 Nov
SELECT public.pm_apply_schedule(:'pb', jsonb_build_array(jsonb_build_object('rowGUID', :'b2', 'startAt', '2026-11-02T00:00:00Z', 'finishAt', '2026-11-10T00:00:00Z')), '2026-11-10T00:00:00Z', NULL);
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-11-10T00:00:00Z'::timestamptz, 'the origin task takes the finish of the subproject');
SELECT tt.eq((SELECT ("rowJSON"->>'startAt')::timestamptz FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-11-02T00:00:00Z'::timestamptz, '... and its start');
SELECT tt.eq((SELECT ("rowJSON"->>'manualStartAt')::timestamptz FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-11-02T00:00:00Z'::timestamptz, '... manualStartAt = the start (what the client CPM reads)');
SELECT tt.eq((SELECT ("rowJSON"->>'durationDays')::int FROM public.project_task_table WHERE "rowGUID" = :'a1'), 8, '... durationDays = the working days');
SELECT tt.eq((SELECT "linkFinishAt" FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'a1'), '2026-11-10T00:00:00Z'::timestamptz, 'the link remembers the dates it copied');
-- the next write of the same dates changes nothing (no loop, no needless write)
SELECT "updated_at" AS upd FROM public.project_task_table WHERE "rowGUID" = :'a1' \gset
SELECT tt.eq(public.subproject_sync_origin_task(:'a1'), false, 'the same dates again: nothing is written');
SELECT tt.eq((SELECT "updated_at" = :'upd'::timestamptz FROM public.project_task_table WHERE "rowGUID" = :'a1'), true, '... updated_at is untouched');
-- the subproject finishes later: the origin task follows
SELECT public.pm_apply_schedule(:'pb', jsonb_build_array(jsonb_build_object('rowGUID', :'b2', 'startAt', '2026-11-02T00:00:00Z', 'finishAt', '2026-11-20T00:00:00Z')), '2026-11-20T00:00:00Z', NULL);
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-11-20T00:00:00Z'::timestamptz, 'the subproject end moved: the origin task end moved');
SELECT tt.eq((SELECT ("rowJSON"->>'durationDays')::int FROM public.project_task_table WHERE "rowGUID" = :'a1'), 18, '... 18 days');
-- a calendar with weekends off in the ORIGIN project: the days are counted in its calendar
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"skipWeekends": true}' WHERE "rowGUID" = :'pa';
SELECT public.subproject_sync_origin_task(:'a1') AS changed \gset
SELECT tt.eq((SELECT ("rowJSON"->>'durationDays')::int FROM public.project_task_table WHERE "rowGUID" = :'a1'), 14, 'weekends off in the origin project: 2 Nov .. 20 Nov = 14 working days');
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'skipWeekends' WHERE "rowGUID" = :'pa';
-- the switch autoChangeStartAndFinishDatesForOriginTask = false: the origin task keeps its dates
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"autoChangeStartAndFinishDatesForOriginTask": false}' WHERE "rowGUID" = :'pa';
SELECT public.pm_apply_schedule(:'pb', jsonb_build_array(jsonb_build_object('rowGUID', :'b2', 'startAt', '2026-11-02T00:00:00Z', 'finishAt', '2026-12-01T00:00:00Z')), '2026-12-01T00:00:00Z', NULL);
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-11-20T00:00:00Z'::timestamptz, 'dates switch OFF: the origin task keeps its own dates');
SELECT tt.eq((SELECT "linkFinishAt" FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'a1'), '2026-12-01T00:00:00Z'::timestamptz, '... the link still sees the new subproject end (a warning can be shown)');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"autoChangeStartAndFinishDatesForOriginTask": true}' WHERE "rowGUID" = :'pa';
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-12-01T00:00:00Z'::timestamptz, 'dates switch ON again: the origin task is resynchronised at once');
-- the parent switch off: the same
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"autoChangeOriginTaskBasedOnSubprojects": false}' WHERE "rowGUID" = :'pa';
SELECT public.pm_apply_schedule(:'pb', jsonb_build_array(jsonb_build_object('rowGUID', :'b2', 'startAt', '2026-11-02T00:00:00Z', 'finishAt', '2026-12-15T00:00:00Z')), '2026-12-15T00:00:00Z', NULL);
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-12-01T00:00:00Z'::timestamptz, 'autoChangeOriginTaskBasedOnSubprojects false: nothing follows');
SELECT tt.eq(public.subproject_dates_on(:'pa'), false, '... also the child switches are off');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"autoChangeOriginTaskBasedOnSubprojects": true}' WHERE "rowGUID" = :'pa';
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a1'), '2026-12-15T00:00:00Z'::timestamptz, 'true again: resynchronised');

-- 6. a chain: D -> A -> B (levels) and one subproject for many tasks -------------------------------------------------------------------------------------------------------------------
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"subprojectsFunctionalityEnabled": true}' WHERE "rowGUID" = :'pd';
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', :'pa') WHERE "rowGUID" = :'d1';
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'d1'), '2026-12-15T00:00:00Z'::timestamptz, 'D.d1 -> A: the first copy comes from A, which got its dates from B through a1');
SELECT public.pm_apply_schedule(:'pb', jsonb_build_array(jsonb_build_object('rowGUID', :'b2', 'startAt', '2026-11-02T00:00:00Z', 'finishAt', '2026-12-31T00:00:00Z')), '2026-12-31T00:00:00Z', NULL);
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'d1'), '2026-12-31T00:00:00Z'::timestamptz, 'a change in B reaches D through two levels (B -> a1 -> A -> d1)');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', :'pb') WHERE "rowGUID" = :'a3';
SELECT tt.eq((SELECT "rowDuration" FROM public.project_task_table WHERE "rowGUID" = :'a3'), '2026-12-31T00:00:00Z'::timestamptz, 'a second task of A for the same subproject B follows too');

-- 7. the guards -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"subprojectsFunctionalityEnabled": false}' WHERE "rowGUID" = %L$q$, :'pa'), 'SUBPROJECT_IN_USE', 'the functionality cannot be switched off while tasks use subprojects');
SELECT tt.fails(format($q$DELETE FROM public.project_table WHERE "rowGUID" = %L$q$, :'pb'), 'SUBPROJECT_IN_USE', 'a project that is a subproject cannot be deleted (the message names the tasks)');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskIsSubproject": false}' WHERE "rowGUID" IN (:'a1', :'a3', :'d1');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"subprojectsFunctionalityEnabled": false}' WHERE "rowGUID" = :'pa';
SELECT tt.eq(public.subproject_enabled(:'pa'), false, 'switched off once no task uses a subproject');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"subprojectsFunctionalityEnabled": true}' WHERE "rowGUID" = :'pa';

-- 8. the repair function ----------------------------------------------------------------------------------------------------------------------------------------------------------------
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', :'pb') WHERE "rowGUID" = :'a1';
SELECT tt.as_admin();
DELETE FROM public.project_subproject_link;
SELECT public.subproject_link_rebuild() AS n \gset
SELECT tt.eq(:'n', 2, 'subproject_link_rebuild makes the links again from the tasks (a1 -> B and b1 -> C)');
SELECT tt.eq(public.subproject_link_rebuild(), 2, '... and a second run changes nothing');

-- 9. Monitor01: the origin task shows the plan of its subproject for the aggregated genera ----------------------------------------------------------------------------------------------------
-- b2 of B: 10 h Time + 5 pcs Material + 3 Expense; the rows are posted by the owner
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('dddddddd-0000-0000-0000-000000000001', :'b2', 'timeGenus', 1, jsonb_build_object('resourceRoleItem', 'role-x', 'taskResourceKind', 'person', 'taskResourceItem', 'p-boris', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 10, 'priceTaskLine', 10)),
  ('dddddddd-0000-0000-0000-000000000002', :'b2', 'materialGenus', 2, jsonb_build_object('resourceRoleItem', 'role-y', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 5, 'priceTaskLine', 2)),
  ('dddddddd-0000-0000-0000-000000000003', :'b2', 'expenseGenus', 3, jsonb_build_object('resourceRoleItem', 'role-z', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 3, 'priceTaskLine', 1));
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'b2', 'timeZone', 'UTC', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'dddddddd-0000-0000-0000-000000000001', 'qtyTaskLine', 10, 'sumForBudget', 100, 'sumForContract', 100, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-03', 'c', 1))),
  jsonb_build_object('lineGUID', 'dddddddd-0000-0000-0000-000000000002', 'qtyTaskLine', 5, 'sumForBudget', 10, 'sumForContract', 10, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-03', 'c', 1))),
  jsonb_build_object('lineGUID', 'dddddddd-0000-0000-0000-000000000003', 'qtyTaskLine', 3, 'sumForBudget', 3, 'sumForContract', 3, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-04', 'c', 1)))))) AS pb2 \gset
SELECT tt.as_admin();
SELECT public.monitor01_process_batch() AS taken \gset
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'b2'), 18::numeric, 'B.b2 has its own 10 + 5 + 3');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1'), 0::bigint, 'all aggregation switches off: the origin task shows nothing of B');
-- aggregateTime on
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"aggregateTimeFromSubprojectToTheOriginTask": true}' WHERE "rowGUID" = :'pa';
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'a1'), 1::bigint, 'the switch queues the origin task');
SELECT public.monitor01_process_batch() AS taken \gset
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1' AND "genusGUID" = 'timeGenus'), 10::numeric, 'aggregateTime: the origin task shows the 10 hours of B');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1' AND "genusGUID" <> 'timeGenus'), 0::bigint, '... and no Material / Expense');
SELECT tt.eq((SELECT "sumForBudget" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1' AND "genusGUID" = 'timeGenus'), 100::numeric, '... with the budget sum');
SELECT tt.eq((SELECT "rowProjectGUID" FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1' AND "genusGUID" = 'timeGenus'), :'pa'::uuid, '... the row belongs to the project of the origin task');
-- material and expense on
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"aggregateMaterialFromSubprojectToTheOriginTask": true, "aggregateExpenceFromSubprojectToTheOriginTask": true}' WHERE "rowGUID" = :'pa';
SELECT public.monitor01_process_batch() AS taken \gset
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1'), 18::numeric, 'Material and Expense on: the origin task shows 10 + 5 + 3');
-- a change in the subproject reaches the origin task through the queue
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.create_task_line_plan(jsonb_build_object('taskGUID', :'b2', 'timeZone', 'UTC', 'lines', jsonb_build_array(
  jsonb_build_object('lineGUID', 'dddddddd-0000-0000-0000-000000000001', 'qtyTaskLine', 20, 'sumForBudget', 200, 'sumForContract', 200, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-03', 'c', 1))),
  jsonb_build_object('lineGUID', 'dddddddd-0000-0000-0000-000000000002', 'qtyTaskLine', 5, 'sumForBudget', 10, 'sumForContract', 10, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-03', 'c', 1))),
  jsonb_build_object('lineGUID', 'dddddddd-0000-0000-0000-000000000003', 'qtyTaskLine', 3, 'sumForBudget', 3, 'sumForContract', 3, 'baseOfDistribution', 1, 'days', jsonb_build_array(jsonb_build_object('d', '2026-11-04', 'c', 1)))))) AS pb3 \gset
SELECT tt.as_admin();
SELECT public.monitor01_process_batch() AS taken1 \gset
SELECT tt.eq((SELECT count(*) FROM public.monitor01_dirty WHERE "rowOwnerGUID" = :'a1'), 1::bigint, 'B.b2 was applied: the worker queued the origin task');
SELECT public.monitor01_process_batch() AS taken2 \gset
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1' AND "genusGUID" = 'timeGenus'), 20::numeric, 'a re-post in B changes the origin task row (10 -> 20)');
-- two levels: D.d1 -> A, A.a1 -> B, D aggregates Time of A; A's own rows contain B's time, so D shows it through the origin task a1 of A
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"aggregateTimeFromSubprojectToTheOriginTask": true}' WHERE "rowGUID" = :'pd';
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || jsonb_build_object('taskIsSubproject', true, 'taskSubprojectGUID', :'pa') WHERE "rowGUID" = :'d1';
SELECT public.monitor01_process_batch() AS taken3 \gset
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'d1' AND "genusGUID" = 'timeGenus'), 20::numeric, 'two levels: D.d1 shows the hours of B (D -> A -> B, counted once)');
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'d1' AND "genusGUID" <> 'timeGenus'), 0::bigint, '... only Time (D aggregates only Time)');
-- the drill-down of the aggregated row shows the movements of B
SELECT (public.monitor01_sum_sources('planned', jsonb_build_object('taskGUID', :'a1', 'genusGUID', 'timeGenus'))->>'sum')::numeric AS drill \gset
SELECT tt.eq(:'drill', 20::numeric, 'the source transactions of the aggregated row are the movements of the subproject');
-- off again: the rows are removed
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"aggregateTimeFromSubprojectToTheOriginTask": false, "aggregateMaterialFromSubprojectToTheOriginTask": false, "aggregateExpenceFromSubprojectToTheOriginTask": false}' WHERE "rowGUID" = :'pa';
SELECT public.monitor01_process_batch() AS taken4 \gset
SELECT tt.eq((SELECT count(*) FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1'), 0::bigint, 'all aggregation off: the rows of the origin task disappear');
-- Refresh now covers an origin task that has no movements of its own
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"aggregateTimeFromSubprojectToTheOriginTask": true}' WHERE "rowGUID" = :'pa';
DELETE FROM public.monitor01_dirty;
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.monitor01_refresh_now(NULL) AS rn \gset
SELECT tt.as_admin();
SELECT tt.eq((SELECT sum("qtyPlanned") FROM public.monitor01_view WHERE "rowOwnerGUID" = :'a1' AND "genusGUID" = 'timeGenus'), 20::numeric, 'Refresh now also computes an origin task without movements of its own');

-- 10. a deleted origin task / project leave no link ---------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM public.project_task_table WHERE "rowGUID" = :'a3';
SELECT tt.eq((SELECT count(*) FROM public.project_subproject_link WHERE "rowOwnerGUID" = :'a3'), 0::bigint, 'a deleted origin task: its link is gone');

ROLLBACK;
