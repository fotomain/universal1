-- PART 60: the functions of the initial program data (initial_data_tables / _status / _install / _fill_calendars / _bootstrap_admin) on an EMPTY database (start1 + start2, NO seeds):
-- test_initial_data.sh runs it. One transaction, rolled back.
BEGIN;
SELECT tt.as_admin();

-- 0. the list, the grants ----------------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public.initial_data_tables())::int, 20, 'the whitelist has 20 tables');
SELECT tt.eq(has_function_privilege('anon', 'public.initial_data_install(text, jsonb)', 'EXECUTE'), false, 'anon cannot install');
SELECT tt.eq(has_function_privilege('anon', 'public.initial_data_status(jsonb)', 'EXECUTE'), false, 'anon cannot ask the status');
SELECT tt.eq(has_function_privilege('authenticated', 'public.initial_data_install(text, jsonb)', 'EXECUTE'), true, 'authenticated may call install (the function checks the rights)');
SELECT tt.eq((SELECT count(*) FROM public."managementGenusTable")::int, 0, 'the database is empty: no genus rows');

-- 1. nobody is signed in (the SQL editor): the status says so, the install is refused -------------------------------------------------------------------------
SELECT tt.eq(public.initial_data_status('{"managementGenusTable": ["costsGenus"]}'::jsonb)->>'signedIn', 'false', 'no session: signedIn is false');
SELECT tt.eq(public.initial_data_status('{}'::jsonb)->>'canWrite', 'false', 'no session: canWrite is false');
SELECT tt.fails($q$SELECT public.initial_data_install('managementGenusTable', '[]'::jsonb)$q$, 'no permission', 'no session: install is refused');

-- 2. the first user of a new database -------------------------------------------------------------------------------------------------------------------------
SELECT public.organization_ensure_user('ann@new.test', '55555555-5555-5555-5555-555555555555', 'Ann', 'A');
SELECT tt.as_user('ann@new.test', '55555555-5555-5555-5555-555555555555');
SELECT public.initial_data_status('{"managementGenusTable": ["costsGenus", "timeGenus"], "currencyTable": ["EUR"], "managementCalendarDaysTable": ["workingDaysCalendar"], "application_permission_table": []}'::jsonb) AS st \gset
SELECT tt.eq(:'st'::jsonb->>'signedIn', 'true', 'Ann is signed in');
SELECT tt.eq(:'st'::jsonb->>'canWrite', 'true', 'Ann is the administrator of her own organization: she may write the catalogs');
SELECT tt.eq(:'st'::jsonb->>'bootstrap', 'true', 'nobody is an application administrator and Ann is the only user: bootstrap is possible');
SELECT tt.eq(:'st'::jsonb->>'canWriteApplication', 'true', 'so she may write the three read only catalogs');
SELECT tt.eq(:'st'::jsonb->>'isApplicationAdmin', 'false', 'she is not an application administrator yet');
SELECT tt.eq(:'st'::jsonb->'tables'->'managementGenusTable'->'found', '[]'::jsonb, 'nothing found in an empty table');
SELECT tt.eq((:'st'::jsonb->>'year')::int, extract(year FROM current_date)::int, 'the status names the year of the calendar days');
SELECT tt.fails($q$SELECT public.initial_data_status('{"userTable": ["x"]}'::jsonb)$q$, 'not in the list', 'status refuses a table outside the list');
SELECT tt.fails($q$SELECT public.initial_data_status('{"managementGenusTable": "costsGenus"}'::jsonb)$q$, 'must be a JSON array', 'status wants an array of keys');

-- 3. install: insert only ---------------------------------------------------------------------------------------------------------------------------------------
SELECT public.initial_data_install('managementGenusTable', '[
  {"rowGUID":"costsGenus","rowOwnerGUID":"managementGenusCatalog","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":1000,"rowJSON":{"title":"Costs"}},
  {"rowGUID":"timeGenus","rowOwnerGUID":"managementGenusCatalog","rowParentGUID":"costsGenus","rowFolderGUID":"empty","orderInList":2000,"rowJSON":{"title":"Time"}}]'::jsonb) AS r1 \gset
SELECT tt.eq((:'r1'::jsonb->>'inserted')::int, 2, 'two rows inserted');
SELECT public.initial_data_install('managementGenusTable', '[
  {"rowGUID":"costsGenus","rowOwnerGUID":"managementGenusCatalog","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":1000,"rowJSON":{"title":"Costs"}},
  {"rowGUID":"materialGenus","rowOwnerGUID":"managementGenusCatalog","rowParentGUID":"costsGenus","rowFolderGUID":"empty","orderInList":3000,"rowJSON":{"title":"Material"}}]'::jsonb) AS r2 \gset
SELECT tt.eq((:'r2'::jsonb->>'inserted')::int, 1, 'the second call inserts only the new row');
SELECT tt.eq((:'r2'::jsonb->>'skipped')::int, 1, 'and skips the one that exists');
SELECT tt.as_admin();
UPDATE public."managementGenusTable" SET "rowJSON" = '{"title":"Edited by the user"}' WHERE "rowGUID" = 'costsGenus';
SELECT tt.as_user('ann@new.test', '55555555-5555-5555-5555-555555555555');
SELECT public.initial_data_install('managementGenusTable', '[{"rowGUID":"costsGenus","rowOwnerGUID":"managementGenusCatalog","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":1000,"rowJSON":{"title":"Costs"}}]'::jsonb) AS r3 \gset
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public."managementGenusTable" WHERE "rowGUID" = 'costsGenus'), 'Edited by the user', 'a row the user changed is never overwritten');
SELECT tt.eq(public.initial_data_status('{"managementGenusTable": ["costsGenus", "timeGenus", "nope"]}'::jsonb)->'tables'->'managementGenusTable'->>'rows', '3', 'the status counts the rows');
SELECT tt.eq((SELECT jsonb_agg(x ORDER BY x) FROM jsonb_array_elements_text(public.initial_data_status('{"managementGenusTable": ["costsGenus", "timeGenus", "nope"]}'::jsonb)->'tables'->'managementGenusTable'->'found') x), '["costsGenus","timeGenus"]'::jsonb, 'and names the keys that exist');

-- 4. natural key tables: the rowGUID differs from database to database ----------------------------------------------------------------------------------------
SELECT public.initial_data_install('currencyTable', '[
  {"rowOwnerGUID":"empty","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":1024,"rowJSON":{"currencyCode":"EUR","currencyName":"Euro"}},
  {"rowOwnerGUID":"empty","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":2048,"rowJSON":{"currencyCode":"USD","currencyName":"US Dollar"}}]'::jsonb) AS r4 \gset
SELECT tt.eq((:'r4'::jsonb->>'inserted')::int, 2, 'currencies without a rowGUID: both inserted');
SELECT tt.eq((SELECT count(*) FROM public."currencyTable" WHERE "rowGUID" IS NOT NULL AND length("rowGUID") > 10)::int, 2, 'the database made the rowGUIDs');
SELECT public.initial_data_install('currencyTable', '[{"rowOwnerGUID":"empty","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":1,"rowJSON":{"currencyCode":"eur","currencyName":"again"}}]'::jsonb) AS r5 \gset
SELECT tt.eq((:'r5'::jsonb->>'inserted')::int, 0, 'the same currency code in another case is not inserted again');
SELECT tt.eq(public.initial_data_status('{"currencyTable": ["EUR", "gbp"]}'::jsonb)->'tables'->'currencyTable'->'found', '["eur"]'::jsonb, 'the status finds a natural key in lower case');

-- 5. the checks ------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$SELECT public.initial_data_install('userTable', '[]'::jsonb)$q$, 'not in the list', 'a table outside the list is refused');
SELECT tt.fails($q$SELECT public.initial_data_install('managementGenusTable', '{}'::jsonb)$q$, 'JSON array', 'rows must be an array');
SELECT tt.fails($q$SELECT public.initial_data_install('managementGenusTable', (SELECT jsonb_agg(jsonb_build_object('rowGUID', 'x' || g, 'rowJSON', '{}'::jsonb)) FROM generate_series(1, 1001) g))$q$, 'at most 1000', 'more than 1000 rows in one call are refused');
SELECT tt.eq((public.initial_data_install('managementGenusTable', '[]'::jsonb)->>'inserted')::int, 0, 'an empty list is fine');

-- 6. the read only catalogs: the first user (bootstrap), then an application administrator only -------------------------------------------------------------------
SELECT public.initial_data_install('language_catalog', '[{"rowGUID":"en","rowOwnerGUID":"languageCatalog","rowParentGUID":"empty","rowFolderGUID":"empty","orderInList":1000,"rowJSON":{"title":"English","code":"en"}}]'::jsonb) AS r6 \gset
SELECT tt.eq((:'r6'::jsonb->>'inserted')::int, 1, 'the first user of an empty database may write a read only catalog');
SELECT tt.eq(public.initial_data_bootstrap_admin(), true, 'the first user becomes the application administrator');
SELECT tt.eq(public.initial_data_bootstrap_admin(), false, 'the second call does nothing');
SELECT tt.as_admin();
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public.application_permission_table), 'ann@new.test', 'the e-mail is the one of the session');
SELECT tt.as_user('ann@new.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq(public.initial_data_status('{"application_permission_table": []}'::jsonb)->'tables'->'application_permission_table'->'found', '["permissionApplicationAdmin"]'::jsonb, 'the status finds the administrator');
SELECT tt.eq(public.initial_data_status('{}'::jsonb)->>'isApplicationAdmin', 'true', 'Ann is an application administrator now');
SELECT tt.eq(public.initial_data_status('{}'::jsonb)->>'bootstrap', 'false', 'bootstrap is closed');

-- 7. a second user: an administrator of his own organization, not an application administrator -----------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.organization_ensure_user('ben@new.test', '66666666-6666-6666-6666-666666666666', 'Ben', 'B');
SELECT tt.as_user('ben@new.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq(public.initial_data_status('{}'::jsonb)->>'canWrite', 'true', 'Ben may write the catalogs the client may write anyway');
SELECT tt.eq(public.initial_data_status('{}'::jsonb)->>'canWriteApplication', 'false', 'but not the read only ones');
SELECT tt.fails($q$SELECT public.initial_data_install('language_catalog', '[{"rowGUID":"xx","rowJSON":{}}]'::jsonb)$q$, 'no permission', 'Ben cannot add a language');
SELECT tt.fails($q$SELECT public.initial_data_install('managementRACIGenusTable', '[{"rowGUID":"raciFake","rowJSON":{}}]'::jsonb)$q$, 'no permission', 'Ben cannot add a RACI item');
SELECT tt.fails($q$SELECT public.initial_data_install('project_permission_profile_catalog', '[{"rowGUID":"permissionFake","rowJSON":{}}]'::jsonb)$q$, 'no permission', 'Ben cannot add a permission profile');
SELECT tt.eq(public.initial_data_bootstrap_admin(), false, 'Ben cannot become an application administrator');
SELECT tt.eq((public.initial_data_install('valueAddedTaxTable', '[{"rowGUID":"vat_0","rowOwnerGUID":"valueAddedTaxCatalog","rowJSON":{"vatTableTitle":"0 %","vatTablePercent":0}}]'::jsonb)->>'inserted')::int, 1, 'Ben may add a VAT rate (a catalog he may write)');

-- 8. bootstrap is for the FIRST sign-up only: with two users and no administrator it is closed ------------------------------------------------------------------------
SELECT tt.as_admin();
DELETE FROM public.application_permission_table;
SELECT tt.as_user('ben@new.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq(public.initial_data_bootstrap_admin(), false, 'two users and nobody an administrator: nobody can claim it from the app');
SELECT tt.eq(public.initial_data_status('{}'::jsonb)->>'bootstrap', 'false', 'the status says so');

-- 9. calendars: the days of last / this / next year, once --------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('ben@new.test', '66666666-6666-6666-6666-666666666666');
SELECT public.initial_data_install('managementCalendarTable', '[
  {"rowGUID":"workingDaysCalendar","rowOwnerGUID":"managementCalendarCatalog","rowParentGUID":"projectCalendarFolder","rowFolderGUID":"empty","orderInList":1100,"rowJSON":{"title":"Working days"}},
  {"rowGUID":"standardWorkWeekCalendar","rowOwnerGUID":"managementCalendarCatalog","rowParentGUID":"personCalendarFolder","rowFolderGUID":"empty","orderInList":3100,"rowJSON":{"title":"Standard work week","kind":"resource","hoursPerDay":8,"weekDays":5,"workFrom":"08:00","workTo":"16:00","mode":"quantity"}}]'::jsonb) AS r7 \gset
SELECT tt.eq(public.initial_data_status('{"managementCalendarDaysTable": ["workingDaysCalendar", "standardWorkWeekCalendar"]}'::jsonb)->'tables'->'managementCalendarDaysTable'->'found', '[]'::jsonb, 'no days yet');
SELECT tt.eq(public.initial_data_fill_calendars(), 6, 'two calendars x three years');
SELECT tt.eq(public.initial_data_fill_calendars(), 0, 'the second call makes nothing');
SELECT tt.eq((SELECT jsonb_agg(x ORDER BY x) FROM jsonb_array_elements_text(public.initial_data_status('{"managementCalendarDaysTable": ["workingDaysCalendar", "standardWorkWeekCalendar", "sixDayWeekCalendar"]}'::jsonb)->'tables'->'managementCalendarDaysTable'->'found') x), '["standardWorkWeekCalendar","workingDaysCalendar"]'::jsonb, 'the days of this year are found for the calendars that exist');
SELECT tt.eq((SELECT count(DISTINCT "rowParentGUID") FROM public."managementCalendarDaysTable" WHERE "rowOwnerGUID" = 'workingDaysCalendar')::int, 3, 'three years of days');
SELECT tt.as_admin();
SELECT tt.fails($q$SELECT public.initial_data_fill_calendars()$q$, 'no permission', 'no session: the calendars are not filled');

ROLLBACK;
