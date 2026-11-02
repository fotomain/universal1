-- PART 43: the saved VIEWS of a report (Monitor01): project_report_settings = one row per user, report GUID and ReportViewTitle (rowOwnerGUID = user GUID,
-- rowParentGUID = REPORT GUID, rowJSON { viewTitle, forOtherUsersEnabled, settings }); written only by report_view_save / _share / _delete; read: own views + the views
-- of the same ORGANIZATION marked forOtherUsersEnabled (RLS and report_view_list).
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('clara@other.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'S');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.organization_invite_user('boris@acme.test');
SELECT tt.as_admin();
SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'M');

-- 1. save: a title is obligatory, settings are an object, the same title (any case) replaces the view
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.report_view_save('Monitor01', 'Only hours', '{"hiddenFields": ["costFact"], "filters": {"startDate": "2026-01-01"}}'::jsonb, false) AS v1 \gset
SELECT tt.eq(:'v1' IS NOT NULL, true, 'a view is saved, its GUID is returned');
SELECT tt.eq(public.report_view_save('Monitor01', '  only HOURS ', '{"hiddenFields": []}'::jsonb, false), :'v1', 'the same title (trimmed, any case) replaces the view');
SELECT tt.eq((SELECT count(*)::int FROM public.project_report_settings), 1, 'still one row');
SELECT tt.eq((SELECT "rowJSON"->'settings'->'hiddenFields' FROM public.project_report_settings WHERE "rowGUID" = :'v1'), '[]'::jsonb, 'the settings were replaced');
SELECT tt.eq((SELECT "rowOwnerGUID" || '|' || "rowParentGUID" FROM public.project_report_settings WHERE "rowGUID" = :'v1'), '11111111-1111-1111-1111-111111111111|Monitor01', 'rowOwnerGUID = user GUID, rowParentGUID = REPORT GUID');
SELECT tt.fails($$SELECT public.report_view_save('Monitor01', '   ', '{}'::jsonb, false)$$, 'ReportViewTitle is obligatory', 'an empty title is refused');
SELECT tt.fails($$SELECT public.report_view_save('', 'x', '{}'::jsonb, false)$$, 'report GUID is obligatory', 'an empty report GUID is refused');
SELECT tt.fails($$SELECT public.report_view_save('Monitor01', 'x', '[1]'::jsonb, false)$$, 'must be a JSON object', 'settings must be an object');
SELECT tt.fails($$SELECT public.report_view_save('Monitor01', 'x', NULL, false)$$, 'must be a JSON object', 'settings must not be NULL');

-- 2. another report has its own views, even with the same title
SELECT public.report_view_save('Other01', 'Only hours', '{}'::jsonb, false) AS v2 \gset
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 1, 'Monitor01 lists its own view only');
SELECT tt.eq(jsonb_array_length(public.report_view_list('Other01')), 1, 'Other01 has its own');

-- 3. a private view is invisible to the colleague; shared, it is visible to the same organization only
SELECT public.report_view_save('Monitor01', 'Shared by Anna', '{"tab": "all"}'::jsonb, true) AS v3 \gset
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 1, 'boris sees the shared view only');
SELECT tt.eq((public.report_view_list('Monitor01')->0)->>'viewTitle', 'Shared by Anna', 'it is the shared one');
SELECT tt.eq((public.report_view_list('Monitor01')->0)->>'ownerName', 'Anna K', 'the owner name is shown');
SELECT tt.eq((public.report_view_list('Monitor01')->0)->>'isMine', 'false', 'it is not his');
SELECT tt.eq((SELECT count(*)::int FROM public.project_report_settings), 1, 'RLS: boris reads the shared view only');
SELECT tt.as_user('clara@other.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 0, 'another organization sees none');
SELECT tt.eq((SELECT count(*)::int FROM public.project_report_settings), 0, 'RLS: another organization reads none');

-- 4. only the owner shares, changes and deletes
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$SELECT public.report_view_share(%L, false)$q$, :'v3'), 'only the owner', 'a colleague cannot unshare');
SELECT tt.eq(public.report_view_delete(:'v3'), false, 'a colleague cannot delete');
SELECT tt.fails($$INSERT INTO public.project_report_settings ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('22222222-2222-2222-2222-222222222222', 'Monitor01', '{"viewTitle": "x", "settings": {}}')$$, 'permission denied', 'no direct INSERT');
SELECT tt.fails($$UPDATE public.project_report_settings SET "rowJSON" = '{}'$$, 'permission denied', 'no direct UPDATE');
SELECT tt.fails($$DELETE FROM public.project_report_settings$$, 'permission denied', 'no direct DELETE');
-- boris saves a view with the title of anna's: his own, no clash
SELECT public.report_view_save('Monitor01', 'Shared by Anna', '{"tab": "time"}'::jsonb, false) AS v4 \gset
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 2, 'boris: his own + the shared one');
SELECT tt.eq((public.report_view_list('Monitor01')->0)->>'isMine', 'true', 'his own come first');

SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 2, 'anna: her two views (boris''s private one is invisible)');
SELECT tt.eq(public.report_view_share(:'v3', false), false, 'the owner unshares');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 1, 'boris: only his own view is left');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.report_view_share(:'v3', true), true, 'the owner shares again');
SELECT tt.eq(public.report_view_delete(:'v3'), true, 'the owner deletes');
SELECT tt.eq(public.report_view_delete(:'v3'), false, 'deleting twice finds nothing');
SELECT tt.eq(jsonb_array_length(public.report_view_list('Monitor01')), 1, 'anna: one view is left');

-- 5. the table: exactly one view per user, report and title (the constraint also holds for the administrator)
SELECT tt.as_admin();
SELECT tt.fails($$INSERT INTO public.project_report_settings ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('11111111-1111-1111-1111-111111111111', 'Monitor01', '{"viewTitle": "ONLY hours", "settings": {}}')$$, 'duplicate key', 'a duplicate title is refused by the index');
SELECT tt.fails($$INSERT INTO public.project_report_settings ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('11111111-1111-1111-1111-111111111111', 'Monitor01', '{"viewTitle": "", "settings": {}}')$$, 'project_report_settings_title_chk', 'an empty title is refused by the table');

-- 6. without a session nothing works
SET LOCAL ROLE authenticated;
SELECT tt.fails($$SELECT public.report_view_save('Monitor01', 'x', '{}'::jsonb, false)$$, 'sign in first', 'no session: save refused');
SELECT tt.fails($$SELECT public.report_view_list('Monitor01')$$, 'sign in first', 'no session: list refused');
RESET ROLE;

ROLLBACK;
