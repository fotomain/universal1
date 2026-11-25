-- PART 59: userSettingsTable (one row per user + device type + OS, common for all work places) and the column rowFolderGUID of the universal schema.
BEGIN;
SELECT tt.as_admin();

-- 1. rowFolderGUID is in the universal schema: every table with the five generic columns has it (default 'empty')
SELECT tt.eq((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'rowFolderGUID')::int > 50, true, 'the column rowFolderGUID is on many tables');
SELECT tt.eq((SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizationTable' AND column_name = 'rowFolderGUID'), '''empty''::text', 'organizationTable has rowFolderGUID default empty');
SELECT tt.eq((SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mediaPostTable' AND column_name = 'rowFolderGUID'), 'NO', 'mediaPostTable has rowFolderGUID NOT NULL');
SELECT tt.eq(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relispartition
      AND (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attname IN ('rowGUID', 'rowOwnerGUID', 'rowParentGUID', 'orderInList', 'rowJSON')) = 5
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'rowFolderGUID' AND NOT a.attisdropped))::int,
  0, 'no table of the generic shape is left without rowFolderGUID');

-- 2. the table
SELECT tt.eq(to_regclass('public."userSettingsTable"') IS NOT NULL, true, 'userSettingsTable exists');
SELECT tt.eq((SELECT cardinality(conkey) FROM pg_constraint WHERE conname = 'user_settings_unique'), 3, 'the unique key is (user, device type, OS)');

SELECT public.organization_ensure_user('ann@acme.test', '55555555-5555-5555-5555-555555555555', 'Ann', 'A');
SELECT public.organization_ensure_user('ben@acme.test', '66666666-6666-6666-6666-666666666666', 'Ben', 'B');

-- 3. Ann: upsert twice = ONE row; lastUsedAt is set; the rows of other device keys are other rows
SELECT tt.as_user('ann@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT public.user_settings_upsert('desktop', 'macos', '{"themeSettings": {"fontName": "inter", "fontSize": "large"}}'::jsonb) IS NOT NULL AS a1 \gset
SELECT tt.eq((SELECT count(*) FROM public."userSettingsTable")::int, 1, 'the first upsert makes one row');
SELECT tt.eq((SELECT "rowJSON"->'uxuiState'->'themeSettings'->>'fontName' FROM public."userSettingsTable"), 'inter', 'the uxuiState is stored');
SELECT tt.eq((SELECT ("rowJSON"->>'lastUsedAt') IS NOT NULL FROM public."userSettingsTable"), true, 'lastUsedAt is set');
SELECT tt.eq((SELECT ("rowJSON"->>'lastUsedAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' FROM public."userSettingsTable"), true, 'lastUsedAt is an ISO time stamp (it compares as text)');
SELECT public.user_settings_upsert('desktop', 'macos', '{"themeSettings": {"fontName": "roboto"}}'::jsonb) IS NOT NULL AS a2 \gset
SELECT tt.eq((SELECT count(*) FROM public."userSettingsTable")::int, 1, 'the second upsert changes the same row');
SELECT tt.eq((SELECT "rowJSON"->'uxuiState'->'themeSettings'->>'fontName' FROM public."userSettingsTable"), 'roboto', 'the second upsert replaced the uxuiState');
SELECT public.user_settings_upsert('phone', 'ios', '{"themeSettings": {"fontName": "system"}}'::jsonb) IS NOT NULL AS a3 \gset
SELECT tt.eq((SELECT count(*) FROM public."userSettingsTable")::int, 2, 'another device key = another row');

-- 4. a key of an older row that the app does not know stays (the JSON is merged)
SELECT tt.as_admin();
UPDATE public."userSettingsTable" SET "rowJSON" = "rowJSON" || '{"legacyKey": 7}'::jsonb WHERE "rowParentGUID" = 'desktop';
SELECT tt.as_user('ann@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT public.user_settings_upsert('desktop', 'macos', '{"themeSettings": {"fontName": "selawik"}}'::jsonb) IS NOT NULL AS a4 \gset
SELECT tt.eq((SELECT "rowJSON"->>'legacyKey' FROM public."userSettingsTable" WHERE "rowParentGUID" = 'desktop'), '7', 'an unknown top-level key of the row stays');

-- 5. checks
SELECT tt.fails($q$SELECT public.user_settings_upsert('watch', 'macos', '{}'::jsonb)$q$, 'user_settings_device_chk', 'an unknown device type is refused');
SELECT tt.fails($q$SELECT public.user_settings_upsert('desktop', 'beos', '{}'::jsonb)$q$, 'user_settings_os_chk', 'an unknown OS is refused');
SELECT tt.fails($q$INSERT INTO public."userSettingsTable" ("rowOwnerGUID", "rowParentGUID", "rowFolderGUID", "rowJSON") VALUES ('55555555-5555-5555-5555-555555555555', 'tablet', 'ipados', '[1]')$q$, 'rowJSON must be a JSON object', 'a rowJSON that is not an object is refused');
SELECT tt.fails($q$INSERT INTO public."userSettingsTable" ("rowOwnerGUID", "rowParentGUID", "rowFolderGUID", "rowJSON") VALUES ('55555555-5555-5555-5555-555555555555', 'tablet', 'ipados', '{"uxuiState": 5}')$q$, 'uxuiState must be a JSON object', 'a uxuiState that is not an object is refused');
SELECT tt.fails($q$INSERT INTO public."userSettingsTable" ("rowOwnerGUID", "rowParentGUID", "rowFolderGUID") VALUES ('66666666-6666-6666-6666-666666666666', 'tablet', 'ipados')$q$, 'row-level security', 'a row for ANOTHER user is refused');

-- 6. touch changes only the time stamp
SELECT tt.as_admin();
UPDATE public."userSettingsTable" SET "rowJSON" = jsonb_set("rowJSON", '{lastUsedAt}', '"2026-01-01T00:00:00.000Z"') WHERE "rowParentGUID" = 'phone';
SELECT tt.as_user('ann@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT public.user_settings_touch('phone', 'ios');
SELECT tt.eq((SELECT ("rowJSON"->>'lastUsedAt') > '2026-06-01' FROM public."userSettingsTable" WHERE "rowParentGUID" = 'phone'), true, 'touch moves lastUsedAt forward');
SELECT tt.eq((SELECT "rowJSON"->'uxuiState'->'themeSettings'->>'fontName' FROM public."userSettingsTable" WHERE "rowParentGUID" = 'phone'), 'system', 'touch leaves the settings alone');
SELECT public.user_settings_touch('tablet', 'ipados');
SELECT tt.eq((SELECT count(*) FROM public."userSettingsTable")::int, 2, 'touch of a missing row makes no row');

-- 7. Copy from my other device
SELECT public.user_settings_copy_from('desktop', 'macos', 'tablet', 'ipados') IS NOT NULL AS c1 \gset
SELECT tt.eq((SELECT "rowJSON"->'uxuiState'->'themeSettings'->>'fontName' FROM public."userSettingsTable" WHERE "rowParentGUID" = 'tablet'), 'selawik', 'the target row has the uxuiState of the source');
SELECT tt.eq((SELECT count(*) FROM public."userSettingsTable")::int, 3, 'the copy made the missing target row');
SELECT tt.fails($q$SELECT public.user_settings_copy_from('desktop', 'macos', 'desktop', 'macos')$q$, 'same device', 'a copy onto itself is refused');
SELECT tt.fails($q$SELECT public.user_settings_copy_from('desktop', 'linux', 'tablet', 'ipados')$q$, 'there are no settings', 'a copy from a device without settings is refused');

-- 8. nobody reads or deletes the rows of another user
SELECT tt.as_user('ben@acme.test', '66666666-6666-6666-6666-666666666666');
SELECT tt.eq((SELECT count(*) FROM public."userSettingsTable")::int, 0, 'Ben sees none of the rows of Ann');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."userSettingsTable" RETURNING 1$q$)::int, 0, 'Ben deletes none of the rows of Ann');
SELECT tt.fails($q$SELECT public.user_settings_copy_from('desktop', 'macos', 'phone', 'android')$q$, 'there are no settings', 'Ben cannot copy the settings of Ann');

-- 9. the owner deletes his own rows (the saga deleteNotUsedUserSettings does it)
SELECT tt.as_user('ann@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."userSettingsTable" WHERE "rowParentGUID" = 'tablet' RETURNING 1$q$)::int, 1, 'Ann deletes her own row');

-- 10. no anonymous access
SELECT tt.as_admin();
SELECT tt.eq(has_table_privilege('anon', 'public."userSettingsTable"', 'SELECT'), false, 'anon has no access');

ROLLBACK;
