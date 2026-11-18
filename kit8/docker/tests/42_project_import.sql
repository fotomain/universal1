-- PART 40: project_import_tasks = the tasks of ONE chunk of an imported project file (documentation/CAKE1): bulk insert (parents first by depth), calendar rows of tasks / milestones in one statement,
-- the progress of the project once, the bulk switch off again; the policies decide (another user's project is refused), a project that is not visible is refused
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('other@out.test', '33333333-3333-3333-3333-333333333333', 'Out', 'S');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', public.pm_ltree_label('aaaaaaaa-0000-4000-8000-000000000001'), '11111111-1111-1111-1111-111111111111', '{"name":"Import target","projectStartAt":"2026-01-01T00:00:00.000Z"}');

SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
-- the rows are given CHILD FIRST on purpose: the function inserts parents before children
SELECT tt.eq(public.project_import_tasks('aaaaaaaa-0000-4000-8000-000000000001', jsonb_build_array(
  jsonb_build_object('rowGUID','aaaaaaaa-0000-4000-8000-0000000000c3','treePath', public.pm_ltree_label('aaaaaaaa-0000-4000-8000-000000000001')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000a1')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000b2')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000c3')::text,
    'rowOwnerGUID','11111111-1111-1111-1111-111111111111','rowProgress',100,'orderInList',1024,'rowJSON',jsonb_build_object('rowKind','task','taskDescription','Op','durationDays',1,'manualStartAt','2026-01-05T00:00:00.000Z')),
  jsonb_build_object('rowGUID','aaaaaaaa-0000-4000-8000-0000000000b2','treePath', public.pm_ltree_label('aaaaaaaa-0000-4000-8000-000000000001')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000a1')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000b2')::text,
    'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',1024,'rowJSON',jsonb_build_object('rowKind','stage','taskDescription','Batch','durationDays',0)),
  jsonb_build_object('rowGUID','aaaaaaaa-0000-4000-8000-0000000000a1','treePath', public.pm_ltree_label('aaaaaaaa-0000-4000-8000-000000000001')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000a1')::text,
    'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',1024,'rowJSON',jsonb_build_object('rowKind','stage','taskDescription','Cake','durationDays',0)),
  jsonb_build_object('rowGUID','aaaaaaaa-0000-4000-8000-0000000000d4','treePath', public.pm_ltree_label('aaaaaaaa-0000-4000-8000-000000000001')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000d4')::text,
    'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',2048,'rowJSON',jsonb_build_object('rowKind','milestone','taskDescription','Done','durationDays',0))
)), 4, 'four rows of the chunk are inserted');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = 'aaaaaaaa-0000-4000-8000-000000000001'), 4::bigint, 'they are in the project');
SELECT tt.eq((SELECT count(*) FROM public.user_calendar_event_table WHERE "rowJSON"->>'projectTaskGUID' IN ('aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-0000000000d4')), 2::bigint, 'the calendar rows of the task and of the milestone are made');
SELECT tt.eq((SELECT count(*) FROM public.user_calendar_event_table WHERE "rowJSON"->>'projectTaskGUID' IN ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-0000000000b2')), 0::bigint, 'a stage has no calendar row');
SELECT tt.eq(current_setting('app.task_bulk', true), 'off', 'the bulk switch is off again');
SELECT tt.eq((SELECT "rowProgress" FROM public.project_task_table WHERE "rowGUID" = 'aaaaaaaa-0000-4000-8000-0000000000b2'), 100::numeric, 'the progress of the stage was calculated (its one task is 100 %)');
SELECT tt.eq((SELECT "rowProgress" > 0 AND "rowProgress" < 100 FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-4000-8000-000000000001'), true, 'and of the project (one done task of two rows: more than 0, less than 100)');
-- a link goes in the ordinary way afterwards (cycle check + closure)
INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID", "linkType", "lagDays")
VALUES ('aaaaaaaa-0000-4000-8000-0000000000d4', 'aaaaaaaa-0000-4000-8000-0000000000c3', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'FS', 0);
SELECT tt.eq((SELECT count(*) FROM public.project_task_dependency_closure_table WHERE "projectGUID" = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, 'the closure of the link is kept');

-- the guards
SELECT tt.fails($q$SELECT public.project_import_tasks('aaaaaaaa-0000-4000-8000-000000000099', '[]'::jsonb)$q$, 'does not exist or is not yours', 'a project that does not exist is refused');
SELECT tt.fails($q$SELECT public.project_import_tasks('aaaaaaaa-0000-4000-8000-000000000001', '{"a":1}'::jsonb)$q$, 'json array', 'rows must be an array');
SELECT tt.as_user('other@out.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails($q$SELECT public.project_import_tasks('aaaaaaaa-0000-4000-8000-000000000001', '[]'::jsonb)$q$, 'does not exist or is not yours', 'the project of another user is refused');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT public.project_import_tasks('aaaaaaaa-0000-4000-8000-000000000001', jsonb_build_array(jsonb_build_object('rowGUID','aaaaaaaa-0000-4000-8000-0000000000e5','treePath',public.pm_ltree_label('aaaaaaaa-0000-4000-8000-000000000001')::text||'.'||public.pm_ltree_label('aaaaaaaa-0000-4000-8000-0000000000e5')::text,'rowOwnerGUID','33333333-3333-3333-3333-333333333333','rowJSON','{}'::jsonb)))$q$, '', 'a row owned by somebody else is refused by the policy');
ROLLBACK;
