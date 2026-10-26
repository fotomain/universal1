-- PART 41: the ROUTE VISITS (kit8/catalog/user/visit): app_route_visits_turnover = one row per user and route (rowOwnerGUID = user GUID, rowParentGUID = route,
-- rowJSON.number_of_route_visits); written only by route_visit_register; the Organization switch numberOfVisitsFunctionalityEnabled (true by default); route_visits_clear; RLS.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');

-- 1. a visit makes the row, the next one counts up: one row per user and route
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.route_visits_enabled(), true, 'the switch is on by default (nothing stored)');
SELECT tt.eq(public.route_visit_register('/home'), 1, 'first visit of /home = 1');
SELECT tt.eq(public.route_visit_register('/home'), 2, 'second visit of /home = 2');
SELECT tt.eq(public.route_visit_register('  /home  '), 3, 'the route is trimmed');
SELECT tt.eq(public.route_visit_register('/catalog/money/account'), 1, 'another route has its own row');
SELECT tt.eq(public.route_visit_register(''), NULL::integer, 'an empty route is not counted');
SELECT tt.eq((SELECT count(*)::int FROM public.app_route_visits_turnover), 2, 'two rows for anna');
SELECT tt.eq((SELECT "rowJSON"->>'number_of_route_visits' FROM public.app_route_visits_turnover WHERE "rowParentGUID" = '/home'), '3', 'rowJSON.number_of_route_visits of /home');
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public.app_route_visits_turnover WHERE "rowParentGUID" = '/home'), '11111111-1111-1111-1111-111111111111', 'rowOwnerGUID = the user GUID');
SELECT tt.eq((SELECT ("rowJSON"->>'last_visit_at') IS NOT NULL FROM public.app_route_visits_turnover WHERE "rowParentGUID" = '/home'), true, 'last_visit_at is stored');

-- 2. a user sees and counts only his own rows
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*)::int FROM public.app_route_visits_turnover), 0, 'marko sees none of anna''s rows');
SELECT tt.eq(public.route_visit_register('/home'), 1, 'marko starts at 1');
SELECT tt.eq((SELECT count(*)::int FROM public.app_route_visits_turnover), 1, 'marko sees his own row only');

-- 3. a client cannot write the table by itself (only the RPC does)
SELECT tt.fails($$INSERT INTO public.app_route_visits_turnover ("rowOwnerGUID", "rowParentGUID") VALUES ('22222222-2222-2222-2222-222222222222', '/x')$$, 'permission denied', 'no direct INSERT');
SELECT tt.fails($$UPDATE public.app_route_visits_turnover SET "rowJSON" = '{"number_of_route_visits": 99}'$$, 'permission denied', 'no direct UPDATE');

-- 4. the Organization switch off: nothing is counted any more
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"numberOfVisitsFunctionalityEnabled": false}'
 WHERE "rowGUID" = public.organization_of_user('11111111-1111-1111-1111-111111111111');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.route_visits_enabled(), false, 'the switch is off');
SELECT tt.eq(public.route_visit_register('/home'), NULL::integer, 'switched off: not counted');
SELECT tt.eq((SELECT "rowJSON"->>'number_of_route_visits' FROM public.app_route_visits_turnover WHERE "rowParentGUID" = '/home'), '3', '/home stays at 3');
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.route_visit_register('/home'), 2, 'the switch of anna''s organization does not touch marko''s');

-- 5. clear: one route, then all of the user, never the rows of another user
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.route_visits_clear('/home'), 1, 'clear one route');
SELECT tt.eq((SELECT count(*)::int FROM public.app_route_visits_turnover), 1, 'one row left');
SELECT tt.eq(public.route_visits_clear(), 1, 'clear all of anna');
SELECT tt.eq((SELECT count(*)::int FROM public.app_route_visits_turnover), 0, 'anna has none');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*)::int FROM public.app_route_visits_turnover WHERE "rowOwnerGUID" = '22222222-2222-2222-2222-222222222222'), 1, 'marko''s row is untouched');

-- 6. without a session nothing works
SELECT tt.as_admin();
SET LOCAL ROLE authenticated;
SELECT tt.fails($$SELECT public.route_visit_register('/home')$$, 'sign in first', 'no session: register refused');
SELECT tt.fails($$SELECT public.route_visits_clear()$$, 'sign in first', 'no session: clear refused');
RESET ROLE;

ROLLBACK;
