-- PART 48: the application texts of an organization (documentation/PERMISSIONS_WBS.html section 10): organizationTextTable, who writes, the guard, organization_texts(language)
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'M');
SELECT public.organization_ensure_user('dora@other.test', '44444444-4444-4444-4444-444444444444', 'Dora', 'O');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@acme.test"}');
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" = 'boris@acme.test';

-- ---- the administrator writes -------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public."organizationTextTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  (:'orga', 'LV', '{"textKind": "menu", "textKey": "menu.home", "text": "  Sākums  "}'),
  (:'orga', 'lv', '{"textKind": "title", "textKey": "Organization members", "text": "Mūsu cilvēki"}'),
  (:'orga', 'en', '{"textKind": "column", "textKey": "project_task_table.taskDescription", "text": "Work package"}');
SELECT tt.eq((SELECT count(*) FROM public."organizationTextTable"), 3::bigint, 'three texts');
SELECT tt.eq((SELECT "rowParentGUID" || '|' || ("rowJSON"->>'text') FROM public."organizationTextTable" WHERE ("rowJSON"->>'textKey') = 'menu.home'), 'lv|Sākums', 'the language is lower case, the text trimmed');
SELECT tt.fails($q$INSERT INTO public."organizationTextTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), 'lv', '{"textKind": "menu", "textKey": "menu.home", "text": "again"}')$q$, 'uq_organizationText', 'one text per organization, language, kind and key');
SELECT tt.fails($q$INSERT INTO public."organizationTextTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), 'lv', '{"textKind": "button", "textKey": "x", "text": "y"}')$q$, 'organizationText_kind_chk', 'the kind is menu, column or title');
SELECT tt.fails($q$INSERT INTO public."organizationTextTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), 'lv', '{"textKind": "menu", "textKey": "x", "text": "   "}')$q$, 'organizationText_key_chk', 'an empty text is refused (delete the row to go back to the delivered text)');
SELECT tt.fails($q$INSERT INTO public."organizationTextTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), 'latvian language', '{"textKind": "menu", "textKey": "x", "text": "y"}')$q$, 'is not a language code', 'the language is a code');
UPDATE public."organizationTextTable" SET "rowJSON" = "rowJSON" || '{"text": "Sākums 2"}' WHERE ("rowJSON"->>'textKey') = 'menu.home';
SELECT tt.eq((SELECT "rowJSON"->>'text' FROM public."organizationTextTable" WHERE ("rowJSON"->>'textKey') = 'menu.home'), 'Sākums 2', 'the text can be changed');
SELECT tt.fails($q$UPDATE public."organizationTextTable" SET "rowJSON" = "rowJSON" || '{"textKey": "menu.other"}' WHERE ("rowJSON"->>'textKey') = 'menu.home'$q$, 'not changed', 'the key is not changed');

-- ---- the list of the app ---------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(jsonb_array_length(public.organization_texts('lv')), 2, 'organization_texts(lv): the two Latvian texts');
SELECT tt.eq((public.organization_texts('LV')->0->>'key'), 'menu.home', '... any case of the language, sorted by kind and key');
SELECT tt.eq(jsonb_array_length(public.organization_texts('de')), 0, 'a language with no text: an empty list');
SELECT tt.eq(public.organization_texts('en')->0, '{"kind": "column", "key": "project_task_table.taskDescription", "text": "Work package"}'::jsonb, 'the shape: kind, key, text');

-- ---- who reads, who writes ----------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public."organizationTextTable"), 3::bigint, 'a member reads the texts of his organization');
SELECT tt.eq(jsonb_array_length(public.organization_texts('lv')), 2, '... also through the function');
SELECT tt.fails($q$INSERT INTO public."organizationTextTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (current_setting('tt.orga'), 'lv', '{"textKind": "menu", "textKey": "menu.x", "text": "y"}')$q$, 'row-level security', 'a member who is no administrator writes none');
SELECT tt.eq(tt.rows_of($q$UPDATE public."organizationTextTable" SET "rowJSON" = "rowJSON" || '{"text": "hacked"}'$q$), 0::bigint, '... changes none');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."organizationTextTable"$q$), 0::bigint, '... deletes none');
SELECT tt.as_user('dora@other.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq((SELECT count(*) FROM public."organizationTextTable"), 0::bigint, 'another organization sees none of them');
SELECT tt.eq(jsonb_array_length(public.organization_texts('lv')), 0, '... and its own list is empty');

-- ---- reset to the delivered text, and the organization takes its texts with it ----------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."organizationTextTable" WHERE ("rowJSON"->>'textKey') = 'menu.home'$q$), 1::bigint, 'Reset to delivered = delete the row');
SELECT tt.eq(jsonb_array_length(public.organization_texts('lv')), 1, '... the list shrinks');
SELECT tt.as_admin();
DELETE FROM public."organizationTable" WHERE "rowGUID" = :'orga';
SELECT tt.eq((SELECT count(*) FROM public."organizationTextTable"), 0::bigint, 'deleting the organization deletes its texts');

ROLLBACK;
