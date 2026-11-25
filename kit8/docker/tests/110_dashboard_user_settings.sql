-- The last state of the dashboards of a user on a work place: project_dashboard_user_settings_table (was project_user_settings_table until 2026-11-25) and its twin
-- estimation_dashboard_user_settings_table (PART 58). Key: (owner = project | 'dashboard', user, work place); the rows of a user are his alone.
BEGIN;
SELECT tt.as_admin();

SELECT tt.eq(to_regclass('public.project_user_settings_table') IS NULL, true, 'the old table name is gone');
SELECT tt.eq(to_regclass('public.project_dashboard_user_settings_table') IS NOT NULL, true, 'project_dashboard_user_settings_table exists');
SELECT tt.eq(to_regclass('public.estimation_dashboard_user_settings_table') IS NOT NULL, true, 'estimation_dashboard_user_settings_table exists');
SELECT tt.eq((SELECT cardinality(conkey) FROM pg_constraint WHERE conname = 'project_dashboard_user_settings_unique'), 3, 'the unique key of the project table is (project, user, work place)');
SELECT tt.eq((SELECT cardinality(conkey) FROM pg_constraint WHERE conname = 'estimation_dashboard_user_settings_unique'), 3, 'the unique key of the estimation table is (owner, user, work place)');

SELECT public.organization_ensure_user('ann@acme.test', '55555555-5555-5555-5555-555555555555', 'Ann', 'A') AS ann \gset
SELECT :'ann'::jsonb->>'organizationGUID' AS orga \gset
SELECT public.organization_ensure_user('ben@acme.test', '66666666-6666-6666-6666-666666666666', 'Ben', 'B');
SELECT gen_random_uuid() AS pj \gset
SELECT gen_random_uuid() AS other \gset
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'pj', public.pm_ltree_label(:'pj'::uuid), '55555555-5555-5555-5555-555555555555', :'orga', '{"name": "Mine"}');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'other', public.pm_ltree_label(:'other'::uuid), '66666666-6666-6666-6666-666666666666', :'orga', '{"name": "Bens"}');

-- 1. project dashboard: one row per (project, user, work place)
SELECT tt.as_user('ann@acme.test', '55555555-5555-5555-5555-555555555555');
INSERT INTO public.project_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID", "rowJSON") VALUES
  (:'pj', '55555555-5555-5555-5555-555555555555', 'wp-laptop', '{"uxuiSettings": {"tasksTreeWidth": 420, "lastTaskGUID": "t1"}}'),
  (:'pj', '55555555-5555-5555-5555-555555555555', 'wp-phone',  '{"uxuiSettings": {"tasksTreeWidth": 300}}');
INSERT INTO public.project_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'pj', '55555555-5555-5555-5555-555555555555', '{"uxuiSettings": {}}');
SELECT tt.eq((SELECT "userWorkPlaceGUID" FROM public.project_dashboard_user_settings_table WHERE "rowJSON" = '{"uxuiSettings": {}}'::jsonb), 'empty', 'a row without a work place gets the default "empty"');
SELECT tt.eq((SELECT count(*) FROM public.project_dashboard_user_settings_table)::int, 3, 'three work places = three rows of the same project and user');
SELECT tt.fails(format($q$INSERT INTO public.project_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID") VALUES (%L, '55555555-5555-5555-5555-555555555555', 'wp-laptop')$q$, :'pj'), 'duplicate key', 'the same work place twice is refused');
INSERT INTO public.project_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID", "rowJSON") VALUES (:'pj', '55555555-5555-5555-5555-555555555555', 'wp-laptop', '{"uxuiSettings": {"tasksTreeWidth": 450}}')
  ON CONFLICT ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";
SELECT tt.eq((SELECT ("rowJSON"->'uxuiSettings'->>'tasksTreeWidth') FROM public.project_dashboard_user_settings_table WHERE "userWorkPlaceGUID" = 'wp-laptop'), '450', 'the upsert on the triple changes the row of the work place');
SELECT tt.fails(format($q$INSERT INTO public.project_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID") VALUES (%L, '66666666-6666-6666-6666-666666666666', 'wp-x')$q$, :'pj'), 'row-level security', 'a row of ANOTHER user is refused');

-- 2. nobody reads the rows of another user
SELECT tt.as_user('ben@acme.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq((SELECT count(*) FROM public.project_dashboard_user_settings_table)::int, 0, 'Ben sees none of the rows of Ann');

-- 3. estimation dashboard: the row of the whole dashboard + the row of a project, per work place
SELECT tt.as_user('ann@acme.test', '55555555-5555-5555-5555-555555555555');
INSERT INTO public.estimation_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID", "rowJSON") VALUES
  ('dashboard', '55555555-5555-5555-5555-555555555555', 'wp-laptop', jsonb_build_object('estimationSettings', jsonb_build_object('lastProjectGUID', :'pj', 'lastTab', 'norms'))),
  (:'pj',      '55555555-5555-5555-5555-555555555555', 'wp-laptop', '{"estimationSettings": {"layout": "advanced", "tasksTreeWidth": 400}}'),
  (:'pj',      '55555555-5555-5555-5555-555555555555', 'wp-phone',  '{"estimationSettings": {"layout": "simple"}}');
SELECT tt.eq((SELECT count(*) FROM public.estimation_dashboard_user_settings_table)::int, 3, 'the dashboard row and two project rows are kept');
SELECT tt.eq((SELECT "userWorkPlaceGUID" FROM (SELECT * FROM public.estimation_dashboard_user_settings_table WHERE "rowOwnerGUID" = 'dashboard') d), 'wp-laptop', 'the dashboard row belongs to its work place');
SELECT tt.fails(format($q$INSERT INTO public.estimation_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID") VALUES (%L, '55555555-5555-5555-5555-555555555555', 'wp-laptop')$q$, :'pj'), 'duplicate key', 'the same (project, user, work place) twice is refused');
SELECT tt.fails(format($q$INSERT INTO public.estimation_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID") VALUES (%L, '66666666-6666-6666-6666-666666666666', 'wp-x')$q$, :'pj'), 'row-level security', 'a row of another user is refused');
SELECT tt.fails(format($q$INSERT INTO public.estimation_dashboard_user_settings_table ("rowOwnerGUID", "rowParentGUID", "userWorkPlaceGUID") VALUES ('not-a-project', '55555555-5555-5555-5555-555555555555', 'wp-z')$q$), 'row-level security', 'an owner that is neither "dashboard" nor a project of the user is refused');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.estimation_dashboard_user_settings_table SET "rowJSON" = '{}'::jsonb WHERE "rowParentGUID" = '66666666-6666-6666-6666-666666666666'$q$)), 0::bigint, 'nobody changes the rows of another user');
SELECT tt.as_user('ben@acme.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq((SELECT count(*) FROM public.estimation_dashboard_user_settings_table)::int, 0, 'Ben sees none of the estimation rows of Ann');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.estimation_dashboard_user_settings_table$q$), 0::bigint, 'Ben deletes none of them');

-- 4. a deleted project takes its estimation settings (all work places) with it; the dashboard row stays
SELECT tt.as_admin();
DELETE FROM public.project_table WHERE "rowGUID" = :'pj';
SELECT tt.eq((SELECT count(*) FROM public.estimation_dashboard_user_settings_table WHERE "rowOwnerGUID" = :'pj')::int, 0, 'the estimation rows of the deleted project are gone');
SELECT tt.eq((SELECT count(*) FROM public.estimation_dashboard_user_settings_table WHERE "rowOwnerGUID" = 'dashboard')::int, 1, 'the row of the whole dashboard stays');
SELECT tt.eq((SELECT count(*) FROM public.project_dashboard_user_settings_table WHERE "rowOwnerGUID" = :'pj')::int, 0, 'the project rows go with the project (cascade)');
ROLLBACK;
