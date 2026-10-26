-- PART 40: TASK TEMPLATES (documentation/TASK_TEMPLATE_WBS.html): save a task / a stage with everything inside it, the organization sees it, fill another task (single | tree, add | replace), the guards
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('outsider@other.test', '33333333-3333-3333-3333-333333333333', 'Out', 'S');
-- bob is invited by anna and joins her organization
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('bob@acme.test');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('bob@acme.test', '22222222-2222-2222-2222-222222222222', 'Bob', 'B');
SELECT tt.eq(public.organization_of_user('22222222-2222-2222-2222-222222222222'), public.organization_of_user('11111111-1111-1111-1111-111111111111'), 'bob is in the organization of anna');

CREATE FUNCTION tt.mk_project(p_guid uuid, p_name text, p_owner uuid) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES (p_guid, public.pm_ltree_label(p_guid), p_owner, jsonb_build_object('name', p_name));
  RETURN p_guid;
END $$;

-- p_parent NULL = a row of the project root
CREATE FUNCTION tt.mk_task(p_project uuid, p_parent uuid, p_kind text, p_name text, p_extra jsonb DEFAULT '{}', p_order numeric DEFAULT 0) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid(); v_path ltree; v_owner uuid;
BEGIN
  SELECT "rowOwnerGUID" INTO v_owner FROM public.project_table WHERE "rowGUID" = p_project;
  v_path := COALESCE((SELECT "treePath" FROM public.project_task_table WHERE "rowGUID" = p_parent), public.pm_ltree_label(p_project)) || public.pm_ltree_label(v);
  INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
  VALUES (v, v_path, p_project, v_owner, p_order, jsonb_build_object('taskDescription', p_name, 'rowKind', p_kind, 'durationDays', 3) || p_extra);
  RETURN v;
END $$;

CREATE FUNCTION tt.mk_line(p_task uuid, p_genus text, p_qty numeric, p_order numeric DEFAULT 0) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
  VALUES (v, p_task, p_genus, p_order, jsonb_build_object('taskManagementGenusLine', p_genus, 'qtyTaskLine', p_qty, 'priceTaskLine', 10, 'sumForContract', p_qty * 10,
          'sumForBudget', p_qty * 10, 'sumForAccounting', p_qty * 10, 'fxSnapshotTaskLine', '{"day": "2026-01-01"}'::jsonb, 'taskIsPosted', true, 'baseOfDistribution', 1));
  RETURN v;
END $$;

-- the source project of anna: stage S { T1 (Time 2 lines, Material 1), T2 (Expense 1) } with T2 waiting for T1; and a single task X with 2 lines
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000a', 'Source', '11111111-1111-1111-1111-111111111111') AS psrc \gset
SELECT tt.mk_task(:'psrc', NULL, 'stage', 'Stage S', '{"notes": "all of it"}') AS s \gset
SELECT tt.mk_task(:'psrc', :'s', 'task', 'T1', '{"startAt": "2026-03-02T00:00:00Z", "manualStartAt": "2026-03-02T00:00:00Z", "taskManualStartAt": "2026-03-04T00:00:00Z", "taskConstraintDate": "2026-03-05T00:00:00Z", "taskDeadline": "2026-04-01T00:00:00Z", "actualStartAt": "2026-03-03T00:00:00Z", "baselines": {"0": {"startAt": "2026-03-02T00:00:00Z"}}, "externalPredecessors": [{"taskGUID": "x"}], "taskScheduleMode": "manual", "taskConstraintType": "MSO", "taskPriority": 800, "customColumns": {"x": 1}, "lastEditPlace": {"surface": "taskPage"}}', 1) AS t1 \gset
SELECT tt.mk_task(:'psrc', :'s', 'task', 'T2', '{"notes": "second"}', 2) AS t2 \gset
SELECT tt.mk_task(:'psrc', NULL, 'task', 'Task X', '{"notes": "single"}') AS x \gset
SELECT tt.mk_line(:'t1', 'timeGenus', 8, 1) AS l1 \gset
SELECT tt.mk_line(:'t1', 'timeGenus', 4, 2) AS l2 \gset
SELECT tt.mk_line(:'t1', 'materialGenus', 5, 1) AS l3 \gset
SELECT tt.mk_line(:'t2', 'expenseGenus', 2, 1) AS l4 \gset
SELECT tt.mk_line(:'x', 'timeGenus', 6, 1) AS l5 \gset
SELECT tt.mk_line(:'x', 'materialGenus', 1, 1) AS l6 \gset
INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID", "linkType", "lagDays")
VALUES (:'t2', :'t1', :'psrc', '11111111-1111-1111-1111-111111111111', 'SS', 2);
-- a link to a task OUTSIDE the saved stage must not be saved
INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID") VALUES (:'t1', :'x', :'psrc', '11111111-1111-1111-1111-111111111111');

-- 1. save ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.task_template_save(%L, '   ')$q$, :'s'), 'title of the template is empty', 'an empty title is refused');
SELECT public.task_template_save(:'s', 'Build a stage', 'T1 then T2') AS tpl \gset
SELECT public.task_template_save(:'x', 'One task') AS tplx \gset
SELECT tt.eq((SELECT "rowJSON"->>'templateTitle' FROM public.task_template_header WHERE "rowGUID" = :'tpl'), 'Build a stage', 'the template has its title');
SELECT tt.eq((SELECT ("rowJSON"->>'templateRowCount')::int FROM public.task_template_header WHERE "rowGUID" = :'tpl'), 3, 'the stage + its 2 tasks are saved (3 rows)');
SELECT tt.eq((SELECT ("rowJSON"->>'templateLineCount')::int FROM public.task_template_header WHERE "rowGUID" = :'tpl'), 4, 'the 4 lines of the tasks are saved');
SELECT tt.eq((SELECT "rowJSON"->>'templateKind' FROM public.task_template_header WHERE "rowGUID" = :'tpl'), 'stage', 'the kind of the top row is kept');
SELECT tt.eq((SELECT "rowJSON"->>'templateSourceTaskGUID' FROM public.task_template_header WHERE "rowGUID" = :'tpl'), :'s', 'the template remembers the task it was saved from');
SELECT tt.eq((SELECT count(*) FROM public.task_template_header WHERE "rowJSON"->>'templateSourceTaskGUID' = :'s'), 1::bigint, '... so "Templates saved" of that task finds exactly this one');
SELECT tt.eq((SELECT count(*) FROM public.task_template_dependency WHERE "rowTemplateGUID" = :'tpl'), 1::bigint, 'the link inside the stage is saved, the link to a task outside it is not');
SELECT tt.eq((SELECT count(*) FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl' AND "rowParentGUID" IS NULL), 1::bigint, 'one top row');
SELECT tt.eq((SELECT "rowGUID" FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl' AND "rowParentGUID" IS NULL), :'s'::uuid, '... the row that was saved');
SELECT tt.eq((SELECT count(*) FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl' AND "rowParentGUID" = :'s'), 2::bigint, '... the two tasks have it as the parent');
SELECT tt.eq((SELECT "rowJSON" ? 'startAt' OR "rowJSON" ? 'manualStartAt' OR "rowJSON" ? 'taskManualStartAt' OR "rowJSON" ? 'taskConstraintDate' OR "rowJSON" ? 'taskDeadline' OR "rowJSON" ? 'actualStartAt' OR "rowJSON" ? 'baselines' OR "rowJSON" ? 'externalPredecessors' OR "rowJSON" ? 'customColumns' OR "rowJSON" ? 'lastEditPlace' FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl' AND "rowGUID" = :'t1'), false, 'the dates of the scheduler, the custom column values and the edit place are not saved');
SELECT tt.eq((SELECT "rowJSON"->>'durationDays' FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl' AND "rowGUID" = :'t1'), '3', '... the duration is');
SELECT tt.eq((SELECT ("rowJSON"->>'taskScheduleMode') || '/' || ("rowJSON"->>'taskConstraintType') || '/' || ("rowJSON"->>'taskPriority') FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl' AND "rowGUID" = :'t1'), 'manual/MSO/800', '... the schedule mode, the constraint TYPE and the priority are kept (only the dates belong to one project)');
SELECT tt.eq((SELECT bool_and(("rowJSON"->>'taskIsPosted')::boolean = false AND NOT ("rowJSON" ? 'sumForBudget') AND NOT ("rowJSON" ? 'sumForAccounting') AND NOT ("rowJSON" ? 'fxSnapshotTaskLine') AND NOT ("rowJSON" ? 'baseOfDistribution') AND "rowJSON" ? 'sumForContract')
                FROM public.task_template_line WHERE "rowTemplateGUID" = :'tpl'), true, 'the lines are saved UNPOSTED, without the sums in the currencies of the project (the sum for the contract stays)');
SELECT tt.eq((SELECT count(*) FROM public.task_template_header), 2::bigint, 'two templates');
SELECT tt.as_user('outsider@other.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails(format($q$SELECT public.task_template_save(%L, 'stolen')$q$, :'s'), 'task not found', 'a user cannot save a task of a project he does not own');

-- a stage with more than 5 000 rows inside is refused (a fill of it would not finish in the time a request may take); the rows are made with the triggers off
SELECT tt.as_admin();
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-0000000000ff', 'Huge project', '11111111-1111-1111-1111-111111111111') AS phuge \gset
SELECT tt.mk_task(:'phuge', NULL, 'stage', 'Huge') AS huge \gset
SET LOCAL session_replication_role = replica;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT g, (SELECT "treePath" FROM public.project_task_table WHERE "rowGUID" = :'huge') || public.pm_ltree_label(g), :'phuge', '11111111-1111-1111-1111-111111111111', '{"taskDescription": "x", "rowKind": "task"}'
  FROM (SELECT gen_random_uuid() AS g FROM generate_series(1, 5001)) q;
SET LOCAL session_replication_role = origin;
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.task_template_save(%L, 'Too big')$q$, :'huge'), 'more than 5000 rows', 'a stage with more than 5000 rows inside is refused');
SELECT tt.eq((SELECT count(*) FROM public.task_template_header), 2::bigint, '... and no template was made');
SELECT tt.as_user('outsider@other.test', '33333333-3333-3333-3333-333333333333');

-- 2. the organization ---------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.task_template_header), 0::bigint, 'another organization sees no template');
SELECT tt.eq((SELECT count(*) FROM public.task_template_task) + (SELECT count(*) FROM public.task_template_line) + (SELECT count(*) FROM public.task_template_dependency), 0::bigint, '... nor its rows');
SELECT tt.fails(format($q$SELECT public.task_template_fill(%L, gen_random_uuid())$q$, :'tpl'), 'task not found', 'fill: a task that is not his');
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.task_template_header), 2::bigint, 'bob (same organization) sees both templates');
SELECT tt.eq((SELECT count(*) FROM public.task_template_task WHERE "rowTemplateGUID" = :'tpl'), 3::bigint, '... and their rows');
SELECT tt.eq((SELECT count(*) FROM public.task_template_line WHERE "rowTemplateGUID" = :'tpl'), 4::bigint, '... and their lines');
SELECT tt.fails($q$INSERT INTO public.task_template_header ("rowOrganizationGUID", "rowOwnerGUID", "rowJSON") VALUES ('x', gen_random_uuid(), '{"templateTitle": "x"}')$q$, 'permission denied', 'no direct insert');
SELECT tt.fails(format($q$UPDATE public.task_template_header SET "rowJSON" = '{}' WHERE "rowGUID" = %L$q$, :'tpl'), 'permission denied', 'no direct update');
SELECT tt.fails(format($q$SELECT public.task_template_set_title(%L, 'bob renames')$q$, :'tpl'), 'only the creator', 'bob is not the creator and not the administrator: no rename');
SELECT tt.eq(tt.rows_of(format($q$DELETE FROM public.task_template_header WHERE "rowGUID" = %L$q$, :'tpl')), 0::bigint, '... no delete (RLS filters it)');

-- 3. fill: tree, into a task of ANOTHER user (bob) ----------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.mk_project('bbbbbbbb-0000-0000-0000-00000000000b', 'Bob project', '22222222-2222-2222-2222-222222222222') AS pb \gset
SELECT tt.mk_task(:'pb', NULL, 'task', 'Target', '{"notes": "keep me"}', 5) AS tg \gset
SELECT tt.mk_task(:'pb', :'tg', 'task', 'old kid', '{}', 7) AS oldkid \gset
SELECT tt.mk_line(:'oldkid', 'timeGenus', 1, 1) AS oldline \gset
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.task_template_fill(gen_random_uuid(), %L)$q$, :'tg'), 'template not found', 'fill: a template that does not exist');
SELECT public.task_template_fill(:'tpl', :'tg') AS res \gset
SELECT tt.eq(:'res'::jsonb->>'mode', 'tree', 'a stage template fills as a tree');
SELECT tt.eq((:'res'::jsonb->>'tasks')::int, 2, '2 rows are created inside the target (the top row itself is not copied)');
SELECT tt.eq((:'res'::jsonb->>'lines')::int, 4, '4 lines');
SELECT tt.eq((:'res'::jsonb->>'dependencies')::int, 1, '1 link');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table c, public.project_task_table g WHERE g."rowGUID" = :'tg' AND c."projectGUID" = :'pb' AND c."treePath" <@ g."treePath" AND c."rowGUID" <> g."rowGUID"), 3::bigint, 'the target has the old kid + the 2 new rows inside it');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = :'pb' AND "rowJSON"->>'taskDescription' IN ('T1', 'T2')), 2::bigint, 'T1 and T2 are in the project of bob');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "rowGUID" IN (:'t1', :'t2') AND "projectGUID" = :'psrc'), 2::bigint, 'the source rows are untouched (the copies have new ids)');
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public.project_task_table WHERE "projectGUID" = :'pb' AND "rowJSON"->>'taskDescription' = 'T1'), '22222222-2222-2222-2222-222222222222'::uuid, 'the copies belong to the owner of the project');
SELECT tt.eq((SELECT max("orderInList") FROM public.project_task_table WHERE "projectGUID" = :'pb' AND "rowJSON"->>'taskDescription' = 'T1') > 7, true, '... after the rows that were there (order)');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table l JOIN public.project_task_table k ON k."rowGUID" = l."rowOwnerGUID" WHERE k."projectGUID" = :'pb' AND k."rowJSON"->>'taskDescription' = 'T1'), 3::bigint, 'T1 has its 3 lines');
SELECT tt.eq((SELECT bool_and(l."rowProjectGUID" = :'pb') FROM public.task_line_table l JOIN public.project_task_table k ON k."rowGUID" = l."rowOwnerGUID" WHERE k."projectGUID" = :'pb' AND k."rowJSON"->>'taskDescription' IN ('T1', 'T2')), true, 'the lines know the project of bob');
SELECT tt.eq((SELECT bool_and((l."rowJSON"->>'taskIsPosted')::boolean = false) FROM public.task_line_table l JOIN public.project_task_table k ON k."rowGUID" = l."rowOwnerGUID" WHERE k."projectGUID" = :'pb' AND k."rowJSON"->>'taskDescription' IN ('T1', 'T2')), true, 'the copied lines are unposted');
SELECT tt.eq((SELECT d."linkType" || d."lagDays" FROM public.project_task_dependencies_table d JOIN public.project_task_table a ON a."rowGUID" = d."rowGUID" WHERE d."projectGUID" = :'pb' AND a."rowJSON"->>'taskDescription' = 'T2'), 'SS2', 'the link T2 waits for T1 (type and lag kept)');
SELECT tt.eq((SELECT count(*) FROM public.project_task_dependency_closure_table WHERE "projectGUID" = :'pb'), 1::bigint, '... and the closure was built by the triggers');
SELECT tt.eq((SELECT "rowJSON"->>'notes' FROM public.project_task_table WHERE "rowGUID" = :'tg'), 'keep me', 'the target keeps its own data');
-- the target has now rows inside it: it cannot take a task template without the replace; and a tree again is added after the rows
SELECT tt.fails(format($q$SELECT public.task_template_fill(%L, %L)$q$, :'tplx', :'tg'), 'Replace what the row has now', 'a row with rows inside it is refused a task template (no replace)');
SELECT public.task_template_fill(:'tpl', :'tg') IS NOT NULL AS again \gset
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = :'pb' AND "rowJSON"->>'taskDescription' = 'T1'), 2::bigint, 'filling twice adds the rows twice (a template is a recipe, not a link)');

-- 4. fill: single, add and replace -----------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.mk_task(:'pb', NULL, 'task', 'Plain', '{"taskColor": "#112233"}', 9) AS pl \gset
SELECT tt.mk_line(:'pl', 'timeGenus', 3, 4) AS plline \gset
SELECT tt.mk_task(:'pb', NULL, 'stage', 'A stage', '{}', 10) AS st \gset
SELECT tt.mk_task(:'pb', NULL, 'milestone', 'A milestone', '{"durationDays": 0}', 11) AS ms \gset
SELECT tt.as_user('bob@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.task_template_fill(:'tplx', :'pl') AS res2 \gset
SELECT tt.eq(:'res2'::jsonb->>'mode', 'single', 'a task template fills as a single task');
SELECT tt.eq((:'res2'::jsonb->>'lines')::int, 2, '2 lines');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table WHERE "rowOwnerGUID" = :'pl'), 3::bigint, 'the old line stays, the 2 new ones are added');
SELECT tt.eq((SELECT "rowJSON"->>'taskDescription' FROM public.project_task_table WHERE "rowGUID" = :'pl'), 'Plain', 'the name of the target stays');
SELECT tt.eq((SELECT "rowJSON"->>'notes' FROM public.project_task_table WHERE "rowGUID" = :'pl'), 'single', 'the data of the template (notes) go into the target');
SELECT tt.eq((SELECT min("orderInList") FROM public.task_line_table WHERE "rowOwnerGUID" = :'pl' AND "rowParentGUID" = 'timeGenus' AND "rowGUID" <> :'plline') > 4, true, 'the new Time line is after the old one (order)');
SELECT tt.fails(format($q$SELECT public.task_template_fill(%L, %L)$q$, :'tplx', :'st'), 'a stage has no lines', 'a stage cannot take a task template');
SELECT tt.fails(format($q$SELECT public.task_template_fill(%L, %L)$q$, :'tpl', :'ms'), 'milestone', 'a milestone cannot take rows');
SELECT tt.fails(format($q$SELECT public.task_template_fill(%L, %L)$q$, :'tpl', :'pl'), 'Replace what the row has now', 'a task with lines is refused a tree template (no replace)');
SELECT public.task_template_fill(:'tpl', :'pl', true) AS res3 \gset
SELECT tt.eq((SELECT count(*) FROM public.task_line_table WHERE "rowOwnerGUID" = :'pl'), 0::bigint, 'replace: the lines of the target are gone');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table c, public.project_task_table g WHERE g."rowGUID" = :'pl' AND c."treePath" <@ g."treePath" AND c."rowGUID" <> g."rowGUID"), 2::bigint, '... and its 2 new rows are inside it');
SELECT public.task_template_fill(:'tplx', :'pl', true) AS res4 \gset
SELECT tt.eq((SELECT count(*) FROM public.project_task_table c, public.project_task_table g WHERE g."rowGUID" = :'pl' AND c."treePath" <@ g."treePath" AND c."rowGUID" <> g."rowGUID"), 0::bigint, 'replace with a task template: the rows inside the target are deleted');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table WHERE "rowOwnerGUID" = :'pl'), 2::bigint, '... and the 2 lines of the template are there');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = :'pb' AND "rowJSON"->>'taskDescription' IN ('T1', 'T2')) >= 2, true, 'the other rows of the project are untouched');

-- 4b. big templates: the progress is calculated once, the calendar rows and the closure are made / repaired by the fill itself ---------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq(current_setting('app.task_bulk', true), 'off', 'the bulk switch is off again after a fill');
SELECT tt.eq((SELECT count(*) FROM public.user_calendar_event_table e WHERE e."rowJSON"->>'projectTaskGUID' IN (SELECT t."rowGUID"::text FROM public.project_task_table t WHERE t."projectGUID" = :'pb' AND COALESCE(t."rowJSON"->>'rowKind', 'task') IN ('task', 'milestone'))),
              (SELECT count(*) FROM public.project_task_table t WHERE t."projectGUID" = :'pb' AND COALESCE(t."rowJSON"->>'rowKind', 'task') IN ('task', 'milestone')),
              'every task / milestone of the project of bob has its calendar row (also the filled ones)');
SELECT tt.eq((SELECT count(*) FROM public.user_calendar_event_table e WHERE e."rowJSON" ? 'projectTaskGUID' AND NOT EXISTS (SELECT 1 FROM public.project_task_table t WHERE t."rowGUID"::text = e."rowJSON"->>'projectTaskGUID')), 0::bigint, 'no calendar row of a deleted task is left (Replace deleted rows)');
SELECT tt.eq((SELECT count(*) FROM public.project_task_dependency_closure_table WHERE "projectGUID" = :'pb'), (SELECT count(*) FROM public.project_task_dependencies_table WHERE "projectGUID" = :'pb'), 'the closure matches the links (a Replace rebuilt it once)');

-- the progress formula (pm_recalc_project_progress was made index-friendly for big projects): T1 100 %, T2 0 %, X 0 %, all of duration 3 -> the stage 50, the project 33.3
UPDATE public.project_task_table SET "rowProgress" = 100 WHERE "rowGUID" = :'t1';
SELECT tt.eq((SELECT "rowProgress" FROM public.project_task_table WHERE "rowGUID" = :'s'), 50.0, 'progress: the stage is the weighted average of the tasks inside it');
SELECT tt.eq((SELECT "rowProgress" FROM public.project_table WHERE "rowGUID" = :'psrc'), 33.3, 'progress: the project is the weighted average of all its leaves');

-- 5. rename and delete: the creator (and the administrator of the organization); the filled rows do not depend on the template ----------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_template_set_title(:'tpl', ' Build a stage v2 ', 'new text');
SELECT tt.eq((SELECT "rowJSON"->>'templateTitle' FROM public.task_template_header WHERE "rowGUID" = :'tpl'), 'Build a stage v2', 'the creator renames the template (trimmed)');
SELECT tt.eq((SELECT "rowJSON"->>'templateDescription' FROM public.task_template_header WHERE "rowGUID" = :'tpl'), 'new text', '... and changes the description');
SELECT tt.fails(format($q$SELECT public.task_template_set_title(%L, '  ')$q$, :'tpl'), 'title of the template is empty', 'an empty title is refused');
SELECT tt.eq(tt.rows_of(format($q$DELETE FROM public.task_template_header WHERE "rowGUID" = %L$q$, :'tplx')), 1::bigint, 'the creator deletes a template');
SELECT tt.eq((SELECT count(*) FROM public.task_template_task WHERE "rowTemplateGUID" = :'tplx') + (SELECT count(*) FROM public.task_template_line WHERE "rowTemplateGUID" = :'tplx'), 0::bigint, '... its rows go with it');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.task_line_table WHERE "rowOwnerGUID" = :'pl'), 2::bigint, 'the rows that were filled from it stay');

ROLLBACK;
