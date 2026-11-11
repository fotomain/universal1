-- PART 47: the permission matrix is ENFORCED (documentation/PERMISSIONS_WBS.html, section 7): the policies of the project tables next to the owner floor, the catalogs (administrator writes, project
-- manager inserts), create-project, the RPC guards (perm_can_in), the field locks of the task profiles (responsible: progress only; task manager: six disabled actions; financial manager (plan): no person /
-- RACI change), the schedule write-back, the delete of a draft header.
BEGIN;
SELECT tt.as_admin();

-- ---- the world --------------------------------------------------------------------------------------------------------------------------------
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orgA \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'M');
SELECT public.organization_ensure_user('clara@acme.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'S');
SELECT public.organization_ensure_user('erik@acme.test',  '55555555-5555-5555-5555-555555555555', 'Erik', 'P');
SELECT public.organization_ensure_user('fred@acme.test',  '66666666-6666-6666-6666-666666666666', 'Fred', 'R');
SELECT public.organization_ensure_user('gina@acme.test',  '77777777-7777-7777-7777-777777777777', 'Gina', 'T');
SELECT public.organization_ensure_user('hank@acme.test',  '88888888-8888-8888-8888-888888888888', 'Hank', 'F');
SELECT public.organization_ensure_user('dora@other.test', '44444444-4444-4444-4444-444444444444', 'Dora', 'O');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON")
SELECT :'orga', jsonb_build_object('userEmailForInvitation', e) FROM unnest(ARRAY['boris@acme.test', 'clara@acme.test', 'erik@acme.test', 'fred@acme.test', 'gina@acme.test', 'hank@acme.test']) e;
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" IN ('boris@acme.test', 'clara@acme.test', 'erik@acme.test', 'fred@acme.test', 'gina@acme.test', 'hank@acme.test');
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('person-fred', '{"personEmail": "fred@acme.test"}'), ('person-gina', '{"personEmail": "gina@acme.test"}');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('partner-1', '{"partnerTitle": "Existing partner"}');

-- anna's project (she is its owner = project manager) with two tasks and lines
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000053', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000053'), '11111111-1111-1111-1111-111111111111', '{"name": "P53"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000531', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000053') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000531'), 'aaaaaaaa-0000-0000-0000-000000000053', '11111111-1111-1111-1111-111111111111', '{"taskDescription": "T1", "rowKind": "task", "durationDays": 5}'),
  ('bbbbbbbb-0000-0000-0000-000000000532', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000053') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000532'), 'aaaaaaaa-0000-0000-0000-000000000053', '11111111-1111-1111-1111-111111111111', '{"taskDescription": "T2", "rowKind": "task", "durationDays": 3}');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000531', 'bbbbbbbb-0000-0000-0000-000000000531', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-fred", "raciItem": "raciResponsibleGUID"}'),
  ('cccccccc-0000-0000-0000-000000000532', 'bbbbbbbb-0000-0000-0000-000000000531', 'materialGenus', '{"qtyTaskLine": 5}'),
  ('cccccccc-0000-0000-0000-000000000533', 'bbbbbbbb-0000-0000-0000-000000000532', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-gina", "raciItem": "raciResponsibleGUID"}');
-- the assignments: boris read only, erik project manager, gina task manager, hank financial manager (plan), clara financial manager (fact); fred is the Responsible of T1 by his Time line (derived)
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000053', '22222222-2222-2222-2222-222222222222', '{"permissionProfileGUID": "permissionProjectReadOnly"}'),
  ('aaaaaaaa-0000-0000-0000-000000000053', '55555555-5555-5555-5555-555555555555', '{"permissionProfileGUID": "permissionProjectManager"}'),
  ('aaaaaaaa-0000-0000-0000-000000000053', '77777777-7777-7777-7777-777777777777', '{"permissionProfileGUID": "permissionTaskManager"}'),
  ('aaaaaaaa-0000-0000-0000-000000000053', '88888888-8888-8888-8888-888888888888', '{"permissionProfileGUID": "permissionFinancialManagerPlan"}'),
  ('aaaaaaaa-0000-0000-0000-000000000053', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionFinancialManagerFact"}');
SELECT tt.eq((SELECT count(*) FROM public.task_user_permission_table), 2::bigint, 'derived: fred Responsible of T1, gina Responsible of T2');

-- ---- who sees what -----------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.project_table), 1::bigint, 'boris (read only) sees the project');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table), 2::bigint, '... its tasks');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table), 3::bigint, '... its task lines');
SELECT tt.as_user('fred@acme.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table), 2::bigint, 'fred (derived member) sees the project''s tasks');
SELECT tt.as_user('dora@other.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq((SELECT count(*) FROM public.project_table), 0::bigint, 'dora (another organization) sees no project');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table), 0::bigint, '... no task');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table), 0::bigint, '... no line');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public.project_table), 1::bigint, 'anna sees her project');

-- ---- read only: no write at all ----------------------------------------------------------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 10$q$), 0::bigint, 'read only: no task is updated');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_task_table$q$), 0::bigint, '... or deleted');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 99}'$q$), 0::bigint, '... a line is not updated');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.task_line_table$q$), 0::bigint, '... or deleted');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_table SET "rowProgress" = 1$q$), 0::bigint, '... the project is not updated');
SELECT tt.fails($q$INSERT INTO public.project_task_table ("treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES (public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000053') || public.pm_ltree_label(gen_random_uuid()), 'aaaaaaaa-0000-0000-0000-000000000053', '22222222-2222-2222-2222-222222222222', '{"taskDescription": "x"}')$q$, 'row-level security', '... no task is added');
SELECT tt.fails($q$SELECT public.task_fact_document_create('bbbbbbbb-0000-0000-0000-000000000531')$q$, 'not your project', 'the RPC refuses (the old text: it asks the matrix now)');
SELECT tt.fails($q$SELECT public.create_task_line_plan('{"taskGUID": "bbbbbbbb-0000-0000-0000-000000000531", "lines": []}')$q$, 'is not yours', 'the plan is not posted by a reader');

-- ---- the project manager (assigned, not the owner) --------------------------------------------------------------------------------------
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "T1 by erik"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$), 1::bigint, 'the assigned project manager updates a task');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000533', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000053') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000533'), 'aaaaaaaa-0000-0000-0000-000000000053', '55555555-5555-5555-5555-555555555555', '{"taskDescription": "T3", "rowKind": "task"}');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table), 3::bigint, '... adds a task and sees it');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('cccccccc-0000-0000-0000-000000000534', 'bbbbbbbb-0000-0000-0000-000000000533', 'materialGenus', '{"qtyTaskLine": 1}');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000534'$q$), 1::bigint, '... works with lines');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000533'$q$), 1::bigint, '... and deletes a task');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_table SET "rowProgress" = 7$q$), 1::bigint, '... and updates the project');
SELECT public.task_fact_document_create('bbbbbbbb-0000-0000-0000-000000000531') IS NOT NULL AS ok \gset
SELECT tt.eq(:'ok', true, '... makes a fact input document (RPC guard)');
SELECT tt.eq(public.perm_can('project_table', 'C'), false, 'but a project level manager may NOT create projects');
SELECT tt.fails($q$INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000099', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000099'), '55555555-5555-5555-5555-555555555555', '{"name": "no"}')$q$, 'row-level security', 'create project: refused without the right');

-- ---- the administrator reads, but does not take part -----------------------------------------------------------------------------------------
SELECT tt.as_admin();
-- a project of erik (who has the organization level right) that anna neither owns nor is assigned to
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orga', '55555555-5555-5555-5555-555555555555', '{"permissionProfileGUID": "permissionProjectManager"}');
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000054', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000054'), '55555555-5555-5555-5555-555555555555', '{"name": "P54 of erik"}');
SELECT tt.eq((SELECT "rowParentGUID" FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000054'), :'orga', 'the organization level manager creates a project of the organization');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000541', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000054') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000541'), 'aaaaaaaa-0000-0000-0000-000000000054', '55555555-5555-5555-5555-555555555555', '{"taskDescription": "E1", "rowKind": "task"}');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public.project_table), 2::bigint, 'the administrator reads the project of erik too');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = 'aaaaaaaa-0000-0000-0000-000000000054'), 1::bigint, '... and its tasks');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 5 WHERE "projectGUID" = 'aaaaaaaa-0000-0000-0000-000000000054'$q$), 0::bigint, 'but does not change them (R only)');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000054'$q$), 0::bigint, '... nor delete the project');
SELECT tt.fails($q$SELECT public.task_fact_document_create('bbbbbbbb-0000-0000-0000-000000000541')$q$, 'not your project', '... nor make a document in it');
SELECT tt.eq(public.perm_can('project_table', 'C'), true, 'the administrator may create projects');

-- ---- catalogs: the administrator writes, the project manager inserts, the others read ------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public."partnerTable" WHERE "rowGUID" = 'partner-1'), 1::bigint, 'everybody reads a catalog');
SELECT tt.fails($q$INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('partner-b', '{"partnerTitle": "by boris"}')$q$, 'row-level security', 'a reader does not insert a catalog row');
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('partner-e', '{"partnerTitle": "by erik"}');
SELECT tt.eq((SELECT count(*) FROM public."partnerTable" WHERE "rowGUID" IN ('partner-1', 'partner-e')), 2::bigint, 'the project manager inserts a catalog row (RC)');
SELECT tt.eq(tt.rows_of($q$UPDATE public."partnerTable" SET "rowJSON" = "rowJSON" || '{"x": 1}' WHERE "rowGUID" = 'partner-1'$q$), 0::bigint, '... but changes none');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."partnerTable" WHERE "rowGUID" = 'partner-1'$q$), 0::bigint, '... nor deletes one');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(tt.rows_of($q$UPDATE public."partnerTable" SET "rowJSON" = "rowJSON" || '{"x": 1}' WHERE "rowGUID" IN ('partner-1', 'partner-e')$q$), 2::bigint, 'the administrator changes catalog rows');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."partnerTable" WHERE "rowGUID" = 'partner-e'$q$), 1::bigint, '... and deletes them');
SELECT tt.as_user('dora@other.test', '44444444-4444-4444-4444-444444444444');
INSERT INTO public."partnerTable" ("rowGUID", "rowJSON") VALUES ('partner-d', '{"partnerTitle": "by dora"}');
SELECT tt.eq((SELECT count(*) FROM public."partnerTable" WHERE "rowGUID" = 'partner-d'), 1::bigint, 'the catalogs are shared by ALL organizations (risk R3 of the plan): the administrator of another organization writes them too');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."partnerTable" WHERE "rowGUID" = 'partner-d'$q$), 1::bigint, '... that is the existing behaviour, narrowed to administrators');

-- ---- the task responsible: progress only --------------------------------------------------------------------------------------------------
SELECT tt.as_user('fred@acme.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 30 WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$), 1::bigint, 'the responsible changes the progress of HIS task');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 30 WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000532'$q$), 0::bigint, '... not of another task');
SELECT tt.fails($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "renamed"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'No permission: project_task_table, U (taskDescription)', '... but does not rename it');
SELECT tt.fails($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"manualStartAt": "2030-01-01T00:00:00Z"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'manualStartAt', '... nor move it');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$), 0::bigint, '... nor delete it');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 99}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000532'$q$), 0::bigint, 'the task lines are read only for him');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000531'$q$), 0::bigint, '... and he cannot delete himself from the Responsible line');
SELECT tt.eq(public.pm_apply_schedule('aaaaaaaa-0000-0000-0000-000000000053', '[{"rowGUID": "bbbbbbbb-0000-0000-0000-000000000531", "startAt": "2031-01-01T00:00:00Z", "finishAt": "2031-01-09T00:00:00Z", "rowProgress": 40}]'::jsonb), 1, 'the schedule write-back of a responsible writes ...');
SELECT tt.as_admin();
SELECT tt.eq((SELECT "rowProgress" FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'), 40::numeric, '... the progress');
SELECT tt.eq((SELECT "rowJSON"->>'startAt' IS NULL FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'), true, '... and not the dates');
SELECT tt.as_user('fred@acme.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq(public.perm_can('task_fact_header', 'C', 'aaaaaaaa-0000-0000-0000-000000000053', 'bbbbbbbb-0000-0000-0000-000000000531'), true, 'he makes the fact input of his task');
SELECT public.task_fact_document_create('bbbbbbbb-0000-0000-0000-000000000531') IS NOT NULL AS ok \gset
SELECT tt.eq(:'ok', true, '... through the RPC (the guard asks the task profile too)');

-- ---- the task manager: all but six actions -------------------------------------------------------------------------------------------------
SELECT tt.as_user('gina@acme.test', '77777777-7777-7777-7777-777777777777');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"notes": "gina was here"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$), 1::bigint, 'the task manager changes the data of the task');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 50 WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$), 1::bigint, '... the progress');
SELECT tt.fails($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "renamed by gina"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'taskDescription', 'disabled: change the task name');
SELECT tt.fails($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"rowKind": "milestone"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'rowKind', 'disabled: change the task to a milestone');
SELECT tt.fails($q$UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"durationDays": 9}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'durationDays', 'disabled: change the dates (duration)');
SELECT tt.fails($q$UPDATE public.project_task_table SET "rowDuration" = now() WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'rowDuration', 'disabled: change the dates (finish)');
SELECT tt.fails($q$UPDATE public.project_task_table SET "treePath" = public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000053') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000532') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000531') WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$, 'treePath', 'disabled: change the position in the tree');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000531'$q$), 0::bigint, 'he cannot delete a task');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 6}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000532'$q$), 1::bigint, 'he changes the lines of the task (CRUD)');
SELECT tt.fails($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000533'$q$, 'cannot delete yourself', 'disabled: delete himself from RACI Responsible (the Time line of his person)');
SELECT tt.fails($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"raciItem": "raciInformedGUID"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000533'$q$, 'your own Responsible line', '... or change his own Responsible line');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000532'$q$), 1::bigint, 'another line of the task he may delete');
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000533'$q$), 1::bigint, 'the project manager has no such lock');

-- ---- the financial manager (plan): lines yes, the person / RACI item no -------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000535', 'bbbbbbbb-0000-0000-0000-000000000531', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-fred", "raciItem": "raciConsultedGUID", "qtyTaskLine": 2}'),
  ('cccccccc-0000-0000-0000-000000000536', 'bbbbbbbb-0000-0000-0000-000000000531', 'materialGenus', '{"qtyTaskLine": 1}');
SELECT tt.as_user('hank@acme.test', '88888888-8888-8888-8888-888888888888');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 7}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000536'$q$), 1::bigint, 'the plan manager changes a Material line');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 3}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000535'$q$), 1::bigint, '... and the hours of a Time line');
SELECT tt.fails($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskResourceItem": "person-gina"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000535'$q$, 'taskResourceItem', 'but not the person of a Time line');
SELECT tt.fails($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"raciItem": "raciResponsibleGUID"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000535'$q$, 'raciItem', '... nor its RACI item');
SELECT tt.fails($q$INSERT INTO public.task_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('bbbbbbbb-0000-0000-0000-000000000531', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-gina"}')$q$, 'No permission', '... nor makes a new Time line');
INSERT INTO public.task_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('bbbbbbbb-0000-0000-0000-000000000531', 'materialGenus', '{"qtyTaskLine": 9}');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 12$q$), 0::bigint, 'the plan manager does not touch the tasks');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000536'$q$), 1::bigint, '... but deletes a Material line');

-- ---- the financial manager (fact): the documents -----------------------------------------------------------------------------------------
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT public.task_fact_document_create('bbbbbbbb-0000-0000-0000-000000000531') IS NOT NULL AS ok \gset
SELECT tt.eq(:'ok', true, 'the fact manager makes a fact input document');
SELECT tt.eq(tt.rows_of($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"qtyTaskLine": 1}'$q$), 0::bigint, '... but does not change a task line');
SELECT tt.as_user('hank@acme.test', '88888888-8888-8888-8888-888888888888');
SELECT tt.fails($q$SELECT public.task_fact_document_create('bbbbbbbb-0000-0000-0000-000000000531')$q$, 'not your project', 'the plan manager makes no fact document');

-- ---- the delete of a draft header needs D on the document ----------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM pg_policies WHERE policyname LIKE '%\_perm\_delete' AND permissive = 'RESTRICTIVE'), 6::bigint, 'six document headers have the restrictive delete policy');

-- ---- the migration kept the old owners working ---------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(tt.rows_of($q$UPDATE public.project_task_table SET "rowProgress" = 60 WHERE "projectGUID" = 'aaaaaaaa-0000-0000-0000-000000000053'$q$), 2::bigint, 'the owner still changes all tasks of her project');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000532'$q$), 1::bigint, '... and deletes one');

-- ---- the document RPCs without a project (organization wide documents) ask for the letter anywhere -------------------------------------------------
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.delete_vendor_invoice('00000000-0000-0000-0000-000000000001')$q$, 'No permission: vendor_invoice_header, D', 'a read only member cannot delete a draft invoice');
SELECT tt.fails($q$SELECT public.vendor_invoice_set_header('00000000-0000-0000-0000-000000000001', '{}')$q$, 'No permission: vendor_invoice_header, U', '... nor change its header');
SELECT tt.fails($q$SELECT public.post_timesheet('00000000-0000-0000-0000-000000000001')$q$, 'No permission: project_timesheet_header, U', '... nor post a time sheet');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails($q$SELECT public.delete_vendor_invoice('00000000-0000-0000-0000-000000000001')$q$, 'does not exist', 'the fact manager passes the matrix (then the document is not found)');

-- ---- the members: the project manager reads them (to give profiles), a reader does not ----------------------------------------------------------------------
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = current_setting('tt.orga')) >= 7, true, 'the project manager reads the members of his organization');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public."organizationMemberTable" WHERE "rowOwnerGUID" = current_setting('tt.orga')), 1::bigint, 'a read only member sees his own row only');

-- ---- coverage (E3): every RPC that writes documents / plans must ask the matrix -------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq((SELECT string_agg(p.proname, ',' ORDER BY p.proname)
                FROM pg_proc p
               WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                 AND (p.proname ~ '^(post_|unpost_|create_|delete_|update_|pm_version_|project_resource_leveling_|task_template_|payment_fact_|monitor01_refresh|roi_)' OR p.proname ~ '_(add_line|set_line_task|set_header|set_title)$')
                 AND p.prosrc !~ 'perm_(can|can_in|require)\('),
             'create_payment_fact_from_customer_invoice,create_payment_fact_from_vendor_invoice,payment_fact_header_after_write,payment_fact_header_before_write,payment_fact_invoice_open,payment_fact_lines_before_write,payment_fact_lines_delete_guard,payment_fact_plan_open,payment_fact_state,roi_include_vat,roi_trg_history_switch,roi_trg_task_month_new,roi_trg_task_month_old,roi_trg_task_month_upd,task_template_set_title,task_template_visible',
             'only wrappers, triggers and read helpers do not ask the matrix themselves: a NEW write RPC without perm_can / perm_require / perm_can_in fails this test');

ROLLBACK;
