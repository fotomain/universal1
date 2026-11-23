-- PART 56: the TRANSLATIONS of catalog items (kit8/catalog/translation): language_catalog (15 languages, read only) + catalogTranslationTable (item + language + field, unique) and
-- the permission permissionTranslateCatalog: held AUTOMATICALLY by the organization administrator, a project manager and an application administrator, or given by hand; everybody reads.
BEGIN;
SELECT tt.as_admin();

SELECT tt.eq((SELECT count(*) FROM public.language_catalog)::int, 15, 'start4 seeded the 15 languages');
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public.language_catalog WHERE "rowGUID" = 'lv'), 'Latvian', 'rowGUID = the language code');

SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'B') AS boris \gset
SELECT :'boris'::jsonb->>'organizationGUID' AS orgA \gset
SELECT public.organization_ensure_user('clara@acme.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'C') AS clara \gset
SELECT public.organization_ensure_user('erik@acme.test', '55555555-5555-5555-5555-555555555555', 'Erik', 'E') AS erik \gset
SELECT public.organization_ensure_user('foto888999@gmail.com', '44444444-4444-4444-4444-444444444444', 'Foto', 'F') AS foto \gset
SELECT set_config('tt.orga', :'orga', true);

-- boris (administrator of A) invites clara and erik: they become members of A (no administrators) and switch to it
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.organization_invite_user('clara@acme.test');
SELECT public.organization_invite_user('erik@acme.test');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT public.organization_switch(:'orga');
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT public.organization_switch(:'orga');

-- 1. the administrator of the organization writes a translation (title + description, two languages)
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.permission_translate_catalog(), true, 'the organization administrator has permissionTranslateCatalog');
SELECT tt.eq(((public.perm_my_matrix()->>'canTranslateCatalog')), 'true', 'perm_my_matrix: canTranslateCatalog true');
SELECT tt.eq(((public.perm_my_matrix()->'profiles') ? 'permissionTranslateCatalog'), true, '... and the permission is listed');
INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('prod-x', 'lv', '{"translationField": "title", "translationText": "  Planšete  "}'),
  ('prod-x', 'lv', '{"translationField": "description", "translationText": "Viedā planšete"}'),
  ('prod-x', 'ru', '{"translationField": "title", "translationText": "Планшет"}');
SELECT tt.eq((SELECT "rowJSON"->>'translationText' FROM public."catalogTranslationTable" WHERE "rowOwnerGUID" = 'prod-x' AND "rowParentGUID" = 'lv' AND "rowJSON"->>'translationField' = 'title'), 'Planšete', 'the text is trimmed');
SELECT tt.fails($q$INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('prod-x', 'lv', '{"translationField": "title", "translationText": "again"}')$q$, 'duplicate key', 'one row per item + language + field');
SELECT tt.fails($q$INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('prod-x', 'xx', '{"translationField": "title", "translationText": "x"}')$q$, 'foreign key', 'the language must be a row of language_catalog');
SELECT tt.fails($q$INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('prod-x', 'de', '{"translationField": "price", "translationText": "x"}')$q$, 'catalogTranslation_field_chk', 'only title and description can be translated');
SELECT tt.fails($q$INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('empty', 'de', '{"translationField": "title", "translationText": "x"}')$q$, 'needs the catalog item', 'a translation belongs to a catalog item');
SELECT tt.fails($q$UPDATE public."catalogTranslationTable" SET "rowOwnerGUID" = 'prod-y' WHERE "rowOwnerGUID" = 'prod-x'$q$, 'not changed', 'the item of a translation is not moved');
-- the language / field of a row may be changed (the Translate tab selects them in the row)
SELECT tt.eq(tt.rows_of($q$UPDATE public."catalogTranslationTable" SET "rowParentGUID" = 'de' WHERE "rowOwnerGUID" = 'prod-x' AND "rowParentGUID" = 'ru'$q$), 1::bigint, 'the language of a row can be changed');
-- the languages are read only for every client
SELECT tt.fails($q$INSERT INTO public.language_catalog ("rowGUID", "rowJSON") VALUES ('xx', '{"title": "X"}')$q$, 'permission denied', 'a client does not add a language');

-- 2. a plain member reads, but writes nothing
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.organization_is_admin(public.organization_of_current_user()), false, 'clara is no administrator of A');
SELECT tt.eq(public.permission_translate_catalog(), false, 'a plain member has no permissionTranslateCatalog');
SELECT tt.eq(((public.perm_my_matrix()->>'canTranslateCatalog')), 'false', 'perm_my_matrix: canTranslateCatalog false');
SELECT tt.eq((SELECT count(*) FROM public."catalogTranslationTable" WHERE "rowOwnerGUID" = 'prod-x')::int, 3, 'she reads the translations');
SELECT tt.fails($q$INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('prod-x', 'fr', '{"translationField": "title", "translationText": "Tablette"}')$q$, 'row-level security', 'she cannot add one');
SELECT tt.eq(tt.rows_of($q$UPDATE public."catalogTranslationTable" SET "rowJSON" = '{"translationField": "title", "translationText": "hacked"}' WHERE "rowOwnerGUID" = 'prod-x'$q$), 0::bigint, 'she cannot change one');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."catalogTranslationTable" WHERE "rowOwnerGUID" = 'prod-x'$q$), 0::bigint, 'she cannot delete one');

-- 3. the administrator GIVES her the permission (organization level assignment row) -> she writes, and the permission is listed
SELECT tt.as_admin();
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orga', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionTranslateCatalog"}');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.permission_translate_catalog(), true, 'given by hand: clara may translate');
INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('prod-x', 'fr', '{"translationField": "title", "translationText": "Tablette"}');
SELECT tt.eq((SELECT count(*) FROM public."catalogTranslationTable" WHERE "rowOwnerGUID" = 'prod-x')::int, 4, 'she added a translation');

-- 4. a project manager has it automatically (here: the organization level right to create projects = permissionProjectManager)
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq(public.permission_translate_catalog(), false, 'erik: a plain member');
SELECT tt.as_admin();
SELECT tt.may_create_projects('erik@acme.test');
SELECT tt.as_user('erik@acme.test', '55555555-5555-5555-5555-555555555555');
SELECT tt.eq(public.permission_translate_catalog(), true, 'a project manager has permissionTranslateCatalog automatically');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."catalogTranslationTable" WHERE "rowOwnerGUID" = 'prod-x' AND "rowParentGUID" = 'fr'$q$), 1::bigint, '... and may delete a translation');

-- 5. the application administrator
SELECT tt.as_user('foto888999@gmail.com', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq(public.permission_application_admin(), true, 'foto888999@gmail.com is an application administrator');
SELECT tt.eq(public.permission_translate_catalog(), true, '... and has permissionTranslateCatalog');

-- 6. a signed-out caller has nothing
SELECT tt.as_user('nobody@acme.test', NULL);
SELECT tt.eq(public.permission_translate_catalog(), false, 'a user with no organization has no permissionTranslateCatalog');
ROLLBACK;
