-- PART 42: RESOURCE OPTIMIZATION (documentation/RESOURCE_LEVELING_WBS.html section 8): the inputs of a run (capacity + the posted hours of the OTHER projects, no titles), apply (the delays on the
-- tasks + the history, ONE transaction), the check of the delay, clear, undo, RLS (the owner only), the template strips the delay.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('bob@acme.test');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('bob@acme.test', '22222222-2222-2222-2222-222222222222', 'Bob', 'B');
SELECT public.organization_ensure_user('outsider@other.test', '33333333-3333-3333-3333-333333333333', 'Out', 'S');

CREATE FUNCTION tt.mk_project(p_guid uuid, p_name text, p_owner uuid) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES (p_guid, public.pm_ltree_label(p_guid), p_owner, jsonb_build_object('name', p_name));
  RETURN p_guid;
END $$;

CREATE FUNCTION tt.mk_task(p_project uuid, p_kind text, p_name text, p_extra jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid(); v_owner uuid;
BEGIN
  SELECT "rowOwnerGUID" INTO v_owner FROM public.project_table WHERE "rowGUID" = p_project;
  INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
  VALUES (v, public.pm_ltree_label(p_project) || public.pm_ltree_label(v), p_project, v_owner, jsonb_build_object('taskDescription', p_name, 'rowKind', p_kind, 'durationDays', 3) || p_extra);
  RETURN v;
END $$;

SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000a', 'P1', '11111111-1111-1111-1111-111111111111') AS p1 \gset
SELECT tt.mk_project('bbbbbbbb-0000-0000-0000-00000000000b', 'P2', '22222222-2222-2222-2222-222222222222') AS p2 \gset
SELECT tt.mk_project('cccccccc-0000-0000-0000-00000000000c', 'POut', '33333333-3333-3333-3333-333333333333') AS pout \gset
SELECT tt.mk_task(:'p1', 'task', 'A') AS ta \gset
SELECT tt.mk_task(:'p1', 'task', 'B') AS tb \gset
SELECT tt.mk_task(:'p1', 'stage', 'Stage') AS ts \gset
SELECT tt.mk_task(:'p1', 'milestone', 'M') AS tm \gset
SELECT tt.mk_task(:'p2', 'task', 'C') AS tc \gset

-- 1. the check of the delay on the task rows ----------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": 2}' WHERE "rowGUID" = :'ta';
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ta'), '2', 'a whole delay on a task is accepted');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": -1}' WHERE "rowGUID" = %L$q$, :'ta'), 'whole number of working days', 'a negative delay is refused');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": 1.5}' WHERE "rowGUID" = %L$q$, :'ta'), 'whole number of working days', 'a fraction is refused');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": "x"}' WHERE "rowGUID" = %L$q$, :'ta'), 'must be a number', 'a text is refused');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": 1}' WHERE "rowGUID" = %L$q$, :'ts'), 'cannot have a leveling delay', 'a stage cannot have a delay');
SELECT tt.fails(format($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": 1}' WHERE "rowGUID" = %L$q$, :'tm'), 'cannot have a leveling delay', 'a milestone cannot have a delay');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskLevelingDelayDays": 0}' WHERE "rowGUID" = :'ts';
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ts'), '0', 'a delay of 0 is accepted anywhere');
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" - 'taskLevelingDelayDays' WHERE "rowGUID" IN (:'ta', :'ts');

-- 2. the inputs: the capacity of the calendar, the posted hours of the OTHER projects, nothing of the own project, no titles ---------------------------------------------------
SELECT tt.as_admin();
SELECT 'person' AS k, "rowGUID"::text AS g FROM public."personTable" LIMIT 1 \gset p_
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.project_resource_leveling_inputs(:'p1', '2026-10-05', '2026-10-11', jsonb_build_array(jsonb_build_object('k', 'person', 'g', :'p_g'))) AS inp \gset
SELECT tt.eq(jsonb_array_length(:'inp'::jsonb->'capacity') > 0, true, 'the standard week gives capacity rows');
SELECT tt.eq((SELECT (e->>'h')::numeric FROM jsonb_array_elements(:'inp'::jsonb->'capacity') e WHERE e->>'d' = '2026-10-05'), 8::numeric, 'a Monday has 8 hours (the standard work week)');
SELECT tt.eq((SELECT (e->>'h')::numeric FROM jsonb_array_elements(:'inp'::jsonb->'capacity') e WHERE e->>'d' = '2026-10-10'), 0::numeric, 'a Saturday has 0 hours (a known day off, not unknown)');
SELECT tt.eq(jsonb_array_length(:'inp'::jsonb->'foreign'), 0, 'no other project holds the person');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_inputs(%L, '2026-10-05', '2026-10-11', '[]')$q$, :'p2'), 'not yours', 'the inputs of another user''s project are refused');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_inputs(%L, '2026-10-11', '2026-10-05', '[]')$q$, :'p1'), 'give the first and the last day', 'a backwards range is refused');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_inputs(%L, '2026-01-01', '2031-01-01', '[]')$q$, :'p1'), 'longer than 1500', 'a range over 1500 days is refused');

-- 3. apply: the delays go on the tasks, the history is written, in one transaction ---------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.project_resource_leveling_apply(:'p1', jsonb_build_object(
  'kind', 'level', 'mode', 'manual', 'method', 'leveling', 'conflictsBefore', 3, 'conflictsAfter', 0, 'unresolved', 0, 'tasksUnposted', 0,
  'startBefore', '2026-10-05T00:00:00Z', 'startAfter', '2026-10-05T00:00:00Z', 'finishBefore', '2026-10-08T00:00:00Z', 'finishAfter', '2026-10-13T00:00:00Z',
  'tasks', jsonb_build_array(jsonb_build_object('task', :'tb', 'delayBefore', 0, 'delayAfter', 3, 'startBefore', '2026-10-05T00:00:00Z', 'startAfter', '2026-10-08T00:00:00Z',
         'finishBefore', '2026-10-08T00:00:00Z', 'finishAfter', '2026-10-13T00:00:00Z', 'wasPosted', false, 'reason', 'idYield', 'resourceKind', 'person', 'resourceGUID', 'x1', 'conflictDay', '2026-10-05')))) AS run1 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'tb'), '3', 'the delay is on the task');
SELECT tt.eq((SELECT "runKind" || '/' || "runMode" || '/' || "runMethod" FROM public.project_resource_leveling_run WHERE "rowGUID" = :'run1'), 'level/manual/leveling', 'the run is written');
SELECT tt.eq((SELECT "tasksMoved" FROM public.project_resource_leveling_run WHERE "rowGUID" = :'run1'), 1, 'one task moved');
SELECT tt.eq((SELECT "delayAfter" || '/' || "reasonCode" FROM public.project_resource_leveling_task WHERE "rowRunGUID" = :'run1' AND "rowTaskGUID" = :'tb'), '3/idYield', 'the task row of the run');
SELECT tt.eq((SELECT "rowOwnerGUID"::text FROM public.project_resource_leveling_run WHERE "rowGUID" = :'run1'), '11111111-1111-1111-1111-111111111111', 'the run knows who did it');

-- a task of another project, a stale task, a stage: the whole run is refused and nothing changes
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_apply(%L, jsonb_build_object('tasks', jsonb_build_array(jsonb_build_object('task', %L, 'delayAfter', 1))))$q$, :'p1', :'tc'), 'not a task of the project', 'a task of another project is refused');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_apply(%L, jsonb_build_object('tasks', jsonb_build_array(jsonb_build_object('task', %L, 'delayAfter', 1, 'updatedAt', '2000-01-01T00:00:00Z'))))$q$, :'p1', :'ta'), 'changed after the plan was read', 'a task edited after the plan was read stops the run');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_apply(%L, jsonb_build_object('tasks', jsonb_build_array(jsonb_build_object('task', %L, 'delayAfter', 1))))$q$, :'p1', :'ts'), 'cannot have a leveling delay', 'a stage in the run is refused');
SELECT tt.eq((SELECT count(*)::int FROM public.project_resource_leveling_run WHERE "rowProjectGUID" = :'p1'), 1, 'the refused runs wrote no history');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_apply(%L, '{"kind": "clear"}')$q$, :'p1'), 'must be level', 'the kind must be level');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_apply(%L, '{"tasks": []}')$q$, :'p2'), 'not yours', 'apply on a project of another user is refused');

-- keepHistory false: the delay is written, no history
SELECT tt.eq(public.project_resource_leveling_apply(:'p1', jsonb_build_object('keepHistory', false, 'tasks', jsonb_build_array(jsonb_build_object('task', :'ta', 'delayAfter', 2)))) IS NULL, true, 'no history: no run GUID');
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ta'), '2', 'the delay is on the task');
SELECT tt.eq((SELECT count(*)::int FROM public.project_resource_leveling_run WHERE "rowProjectGUID" = :'p1'), 1, 'and no run row');

-- 4. RLS: the owner reads, nobody writes by hand -------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*)::int FROM public.project_resource_leveling_run), 1, 'anna sees her run');
SELECT tt.fails($$INSERT INTO public.project_resource_leveling_run ("rowProjectGUID", "rowOwnerGUID", "runKind") VALUES (gen_random_uuid(), gen_random_uuid(), 'level')$$, 'permission denied', 'no direct INSERT');
SELECT tt.fails($$UPDATE public.project_resource_leveling_task SET "delayAfter" = 9$$, 'permission denied', 'no direct UPDATE');
SELECT tt.fails($$DELETE FROM public.project_resource_leveling_run$$, 'permission denied', 'no direct DELETE');
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*)::int FROM public.project_resource_leveling_run), 0, 'bob (same organization, not the owner) sees none of the runs of anna');
SELECT tt.eq((SELECT count(*)::int FROM public.project_resource_leveling_task), 0, 'nor the task rows');

-- 5. clear -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.project_resource_leveling_clear(:'p1', ARRAY[:'tb'::uuid]) AS run_clear1 \gset
SELECT tt.eq((SELECT "rowJSON" ? 'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'tb'), false, 'clear of one task removes its delay');
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ta'), '2', 'the other task keeps its delay');
SELECT tt.eq((SELECT "runKind" || '/' || "tasksMoved" FROM public.project_resource_leveling_run WHERE "rowGUID" = :'run_clear1'), 'clear/1', 'a run of the kind clear');
SELECT public.project_resource_leveling_clear(:'p1') AS run_clear2 \gset
SELECT tt.eq((SELECT count(*)::int FROM public.project_task_table WHERE "projectGUID" = :'p1' AND "rowJSON" ? 'taskLevelingDelayDays'), 0, 'clear of the project removes every delay');
SELECT tt.eq(public.project_resource_leveling_clear(:'p1') IS NULL, true, 'nothing left to clear: NULL');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_clear(%L)$q$, :'p2'), 'not yours', 'clear on a project of another user is refused');

-- 6. undo ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.project_resource_leveling_undo(:'run_clear2')->>'restored', '1', 'undo of the clear gives the delay of A back');
SELECT tt.eq((SELECT "rowJSON"->>'taskLevelingDelayDays' FROM public.project_task_table WHERE "rowGUID" = :'ta'), '2', 'A has its delay again');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_undo(%L)$q$, :'run_clear2'), 'undone already', 'a run is undone once');
-- undo of run1: B was cleared since (its delay is not the one the run left): skipped and named
SELECT public.project_resource_leveling_undo(:'run1') AS u1 \gset
SELECT tt.eq((:'u1'::jsonb)->>'restored', '0', 'run1: nothing restored (B was cleared since)');
SELECT tt.eq((:'u1'::jsonb)->>'skipped', '1', 'run1: one task skipped');
SELECT tt.eq((:'u1'::jsonb->'skippedTasks'->>0) = :'tb', true, 'and it is named');
SELECT tt.eq((SELECT "undoneByGUID" IS NOT NULL FROM public.project_resource_leveling_run WHERE "rowGUID" = :'run1'), true, 'run1 knows it was undone');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_undo(%L)$q$, (:'u1'::jsonb)->>'run'), 'cannot be undone', 'an undo cannot be undone');
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_undo(%L)$q$, :'run1'), 'not yours', 'bob cannot undo a run of a project that is not his');

-- 7. a task template does not carry the delay -------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq(public.task_template_clean_task('{"taskDescription": "x", "taskLevelingDelayDays": 4, "startAt": "2026-01-01"}'::jsonb), '{"taskDescription": "x"}'::jsonb, 'task_template_clean_task strips the leveling delay');

-- 8. without a session nothing works -----------------------------------------------------------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_apply(%L, '{}')$q$, :'p1'), 'sign in first', 'no session: apply refused');
SELECT tt.fails(format($q$SELECT public.project_resource_leveling_clear(%L)$q$, :'p1'), 'sign in first', 'no session: clear refused');
RESET ROLE;

ROLLBACK;
