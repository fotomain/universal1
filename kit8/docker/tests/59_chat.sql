-- PART 50: the CHAT (documentation/CHAT_WBS.html): Main + themes of a user, the chat of a task (members = the RACI of its Time lines), messages, unread counts, the rules of the members (add: owner /
-- project manager / administrator; exclude: project manager / administrator only), the limit of a chat attachment, the scope chat of the file attachments, deletes, the project switch.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@chat.test',  '59111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@chat.test', '59222222-2222-2222-2222-222222222222', 'Boris', 'M');
SELECT public.organization_ensure_user('clara@chat.test', '59333333-3333-3333-3333-333333333333', 'Clara', 'S');
SELECT public.organization_ensure_user('erik@chat.test',  '59555555-5555-5555-5555-555555555555', 'Erik', 'P');
SELECT public.organization_ensure_user('fred@chat.test',  '59666666-6666-6666-6666-666666666666', 'Fred', 'R');
SELECT public.organization_ensure_user('dora@other.test', '59444444-4444-4444-4444-444444444444', 'Dora', 'O');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON")
SELECT :'orga', jsonb_build_object('userEmailForInvitation', e) FROM unnest(ARRAY['boris@chat.test', 'clara@chat.test', 'erik@chat.test', 'fred@chat.test']) e;
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" IN ('boris@chat.test', 'clara@chat.test', 'erik@chat.test', 'fred@chat.test');
INSERT INTO public."personTable" ("rowGUID", "rowJSON") VALUES ('person-boris', '{"personEmail": "boris@chat.test"}'), ('person-clara', '{"personEmail": "clara@chat.test"}'), ('person-erik', '{"personEmail": "erik@chat.test"}');

-- anna's project (she is its owner = project manager and the administrator of her organization) with one task; boris is its Responsible, clara Consulted
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000059', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000059'), '59111111-1111-1111-1111-111111111111', '{"name": "Bridge works"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000591', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000059') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000591'), 'aaaaaaaa-0000-0000-0000-000000000059', '59111111-1111-1111-1111-111111111111', '{"taskDescription": "Pour concrete", "rowKind": "task", "durationDays": 5, "notes": "Check the weather"}');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000591', 'bbbbbbbb-0000-0000-0000-000000000591', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-boris", "raciItem": "raciResponsibleGUID"}'),
  ('cccccccc-0000-0000-0000-000000000592', 'bbbbbbbb-0000-0000-0000-000000000591', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-clara", "raciItem": "raciConsultedGUID"}');

SELECT gen_random_uuid()::text AS th1, gen_random_uuid()::text AS m1, gen_random_uuid()::text AS m2, gen_random_uuid()::text AS m3 \gset
SELECT set_config('tt.th1', :'th1', true), set_config('tt.m2', :'m2', true), set_config('tt.m3', :'m3', true);

-- ================================================ Scenario 1: Main and a theme ================================================
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT public.chat_main_ensure()->>'rowGUID' AS mainA \gset
SELECT tt.eq(public.chat_main_ensure()->>'rowGUID', :'maina', 'Main: one chat object per user, the second call returns the same');
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public."chatObjectTable" WHERE "rowGUID" = :'maina'), 'Main', '... titled Main');
SELECT tt.eq(jsonb_array_length(public.chat_member_candidates()), 4, 'candidates: the 4 other active members of the organization (not herself, not the other organization)');

SELECT tt.fails($q$SELECT public.chat_theme_create(gen_random_uuid()::text, 'x', NULL, NULL, ARRAY['59444444-4444-4444-4444-444444444444'])$q$, 'active member', 'a member of ANOTHER organization cannot be added');
SELECT tt.fails($q$SELECT public.chat_theme_create(gen_random_uuid()::text, '   ', NULL, NULL, '{}')$q$, 'title is required', 'a theme needs a title');
SELECT public.chat_theme_create(:'th1', 'Budget talk', 'About the budget', 'Hello team', ARRAY['59222222-2222-2222-2222-222222222222']) AS t1 \gset
SELECT tt.eq(public.chat_theme_create(:'th1', 'Other title', NULL, NULL, '{}')->>'rowGUID', :'th1', 'create with the same theme id returns the first one (idempotent)');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable"), 1::bigint, '... one theme');
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'th1'), 2::bigint, 'the owner and boris are members');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable" WHERE "rowParentGUID" = :'th1'), 1::bigint, 'the first message was made');
SELECT tt.eq(public.chat_unread_counts(), '[]'::jsonb, 'the author has nothing unread');

SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable"), 1::bigint, 'boris (a member) sees the theme');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable"), 1::bigint, '... and its message');
SELECT tt.eq(public.chat_unread_counts()->0->>'n', '1', '... with 1 unread');
SELECT tt.eq(public.chat_theme_list()->0->>'unread', '1', 'the list says 1 unread, title and description of a user theme');
SELECT tt.eq(public.chat_theme_list()->0->>'title', 'Budget talk', '... title');
SELECT tt.fails($q$INSERT INTO public."chatMessagesTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('59222222-2222-2222-2222-222222222222', current_setting('tt.th1'), '{"text":"direct"}')$q$, 'permission denied', 'a client never writes a chat table directly');
SELECT public.chat_mark_read(:'th1');
SELECT tt.eq(public.chat_unread_counts(), '[]'::jsonb, 'mark read: nothing unread any more');

SELECT tt.as_user('clara@chat.test', '59333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable"), 0::bigint, 'clara (not a member) sees no theme');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable"), 0::bigint, '... no message');
SELECT tt.eq((SELECT count(*) FROM public."chatObjectTable"), 0::bigint, '... no chat object');
SELECT tt.fails($q$SELECT public.chat_message_send(gen_random_uuid()::text, current_setting('tt.th1'), 'let me in')$q$, 'not a member', 'clara cannot write into it');

-- messages
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.chat_message_send(:'m2', :'th1', 'Numbers attached')->>'rowGUID', :'m2', 'boris sends a message');
SELECT tt.eq(public.chat_message_send(:'m2', :'th1', 'Numbers attached')->>'rowGUID', :'m2', 'the same message id again is the same message');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable"), 2::bigint, '... not two rows');
SELECT tt.fails($q$SELECT public.chat_message_send(gen_random_uuid()::text, current_setting('tt.th1'), '   ')$q$, 'empty message', 'an empty message is refused');
SELECT tt.fails($q$SELECT public.chat_message_send(gen_random_uuid()::text, current_setting('tt.th1'), 'see', '[{"url":"javascript:alert(1)"}]')$q$, 'link must be', 'javascript: is not a link');
SELECT tt.fails($q$SELECT public.chat_message_send(gen_random_uuid()::text, current_setting('tt.th1'), 'see', '[{"url":"data:text/html,x"}]')$q$, 'link must be', 'data: is not a link');
SELECT public.chat_message_send(:'m3', :'th1', NULL, '[{"url":"https://example.com/a?b=1","title":"Example"},{"url":"/files/view?post=1"}]');
SELECT tt.eq(jsonb_array_length((SELECT "rowJSON"->'urls' FROM public."chatMessagesTable" WHERE "rowGUID" = :'m3')), 2, 'a message of urls only: https and an address of this app');

SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.chat_unread_counts()->0->>'n', '2', 'anna has 2 unread (m2 and m3)');
SELECT tt.fails($q$SELECT public.chat_message_edit(current_setting('tt.m2'), 'hijacked')$q$, 'only the author', 'only the author edits');
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.chat_message_edit(:'m2', 'Numbers attached (v2)')->'rowJSON'->>'text', 'Numbers attached (v2)', 'the author edits');
SELECT tt.eq(((SELECT "rowJSON" FROM public."chatMessagesTable" WHERE "rowGUID" = :'m2') ? 'editedAt'), true, '... editedAt is set');
SELECT public.chat_message_delete(:'m3');
SELECT tt.eq((SELECT "rowJSON"->>'deleted' FROM public."chatMessagesTable" WHERE "rowGUID" = :'m3'), 'true', 'delete = the message is marked deleted');
SELECT tt.eq((SELECT "rowJSON" ? 'urls' FROM public."chatMessagesTable" WHERE "rowGUID" = :'m3'), false, '... and its content is gone');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.chat_unread_counts()->0->>'n', '1', 'a deleted message is not unread');

-- members: add = owner / project manager / administrator; exclude = project manager / administrator ONLY
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.chat_member_add(current_setting('tt.th1'), ARRAY['59333333-3333-3333-3333-333333333333'])$q$, 'only the owner', 'a plain member cannot add');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.chat_member_add(:'th1', ARRAY['59333333-3333-3333-3333-333333333333']), 1, 'the owner adds clara');
SELECT tt.fails($q$SELECT public.chat_member_add(current_setting('tt.th1'), ARRAY['59444444-4444-4444-4444-444444444444'])$q$, 'active member', 'but not a user of another organization');
SELECT tt.as_user('clara@chat.test', '59333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable"), 1::bigint, 'clara sees the theme now');
SELECT tt.eq(public.chat_unread_counts(), '[]'::jsonb, '... the history is there but not unread (she joined later)');
SELECT tt.fails($q$SELECT public.chat_member_remove(current_setting('tt.th1'), '59222222-2222-2222-2222-222222222222')$q$, 'only a project manager', 'a member cannot exclude anybody');
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.chat_member_remove(current_setting('tt.th1'), '59333333-3333-3333-3333-333333333333')$q$, 'only a project manager', 'boris cannot exclude clara either');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT public.chat_member_remove(current_setting('tt.th1'), '59111111-1111-1111-1111-111111111111')$q$, 'owner of the theme stays', 'the owner cannot be excluded');
SELECT tt.eq(public.chat_member_remove(:'th1', '59333333-3333-3333-3333-333333333333'), true, 'anna (project manager / administrator) excludes clara');
SELECT tt.as_user('clara@chat.test', '59333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowGUID" = current_setting('tt.th1')), 0::bigint, 'clara sees it no more');

-- ================================================ Scenario 2: the chat of a task ================================================
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591') AS ens \gset
SELECT :'ens'::jsonb->>'themeGUID' AS tht \gset
SELECT set_config('tt.tht', :'tht', true);
SELECT tt.eq(:'ens'::jsonb->>'created', 'true', 'the first call makes the chat of the task');
SELECT tt.eq(public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591')->>'created', 'false', '... the second call opens the same one');
SELECT tt.eq(public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591')->>'themeGUID', :'tht', '... the same theme');
SELECT tt.eq((SELECT count(*) FROM public."chatObjectTable" WHERE "rowJSON"->>'chatKind' = 'task'), 1::bigint, '1 task = 1 chat object');
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht'), 3::bigint, 'members: the creator + boris (Responsible) + clara (Consulted) from Time -> RACI');
SELECT tt.eq((SELECT x->>'title' FROM jsonb_array_elements(public.chat_theme_list()) x WHERE x->>'themeGUID' = :'tht'), 'BRID Pour concrete', 'title = prefix (first 4 letters of the project) + task name');
SELECT tt.eq((SELECT x->>'description' FROM jsonb_array_elements(public.chat_theme_list()) x WHERE x->>'themeGUID' = :'tht'), 'Check the weather', 'description = the task notes, read live');
SELECT tt.eq((SELECT "rowJSON" ? 'title' FROM public."chatThemeTable" WHERE "rowGUID" = :'tht'), false, 'a task theme stores NO title (never copied)');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectInnerPrefix": "abcd"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000059';
UPDATE public.project_task_table SET "rowJSON" = "rowJSON" || '{"taskDescription": "Pour the slab", "notes": "Rain tomorrow"}' WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000591';
SELECT tt.eq((SELECT x->>'title' FROM jsonb_array_elements(public.chat_theme_list()) x WHERE x->>'themeGUID' = :'tht'), 'ABCD Pour the slab', 'a new prefix and a task rename are in the title at once');
SELECT tt.eq((SELECT x->>'description' FROM jsonb_array_elements(public.chat_theme_list()) x WHERE x->>'themeGUID' = :'tht'), 'Rain tomorrow', '... and the description');

-- RACI follows
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowGUID" = current_setting('tt.tht')), 1::bigint, 'boris (RACI) sees the task chat');
SELECT tt.eq(public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591')->>'created', 'false', '... and opens it');
SELECT tt.as_user('erik@chat.test', '59555555-5555-5555-5555-555555555555');
SELECT tt.fails($q$SELECT public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591')$q$, 'No permission', 'erik: no profile in the project, no chat');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000593', 'bbbbbbbb-0000-0000-0000-000000000591', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "person-erik", "raciItem": "raciInformedGUID"}');
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht' AND "rowOwnerGUID" = '59555555-5555-5555-5555-555555555555'), 1::bigint, 'a new Time line adds its user to the chat at once');
DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000592';
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht' AND "rowOwnerGUID" = '59333333-3333-3333-3333-333333333333'), 0::bigint, 'a deleted Time line removes its user (clara) from the chat');
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskResourceItem": "person-clara"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000593';
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht' AND "rowOwnerGUID" = '59555555-5555-5555-5555-555555555555'), 0::bigint, 'a changed person: the old one leaves ...');
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht' AND "rowOwnerGUID" = '59333333-3333-3333-3333-333333333333'), 1::bigint, '... the new one joins');
SELECT tt.fails($q$SELECT public.chat_member_remove(current_setting('tt.tht'), '59333333-3333-3333-3333-333333333333')$q$, 'comes from Time', 'a member from the RACI is not excluded by hand');
SELECT tt.eq(public.chat_member_add(:'tht', ARRAY['59666666-6666-6666-6666-666666666666']), 1, 'a member added by hand (fred) ...');
DELETE FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000593';
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht' AND "rowOwnerGUID" = '59666666-6666-6666-6666-666666666666'), 1::bigint, '... stays when the RACI changes');
SELECT tt.eq(public.chat_member_remove(:'tht', '59666666-6666-6666-6666-666666666666'), true, '... and is excluded by the project manager');
SELECT tt.eq(public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591')->>'themeGUID', :'tht', 'ensure puts the RACI right again (self-healing)');
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht' AND "rowOwnerGUID" = '59222222-2222-2222-2222-222222222222'), 1::bigint, 'boris is still there');

-- the project switch
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT public.chat_message_send(gen_random_uuid()::text, :'tht', 'task chat message');
SELECT tt.eq(public.chat_unread_counts(), '[]'::jsonb, 'own message: not unread');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT x->>'n' FROM jsonb_array_elements(public.chat_unread_counts()) x WHERE x->>'theme' = :'tht'), '1', 'anna has the task message unread (and the Main message of boris, 2 themes)');
SELECT tt.eq(jsonb_array_length(public.chat_unread_counts()), 2, '... two themes with unread');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"chatFunctionalityEnabled": false}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000059';
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowJSON"->>'themeKind' = 'task'), 0::bigint, 'switch off: the task chat is hidden');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(public.chat_unread_counts()) x WHERE x->>'theme' = :'tht'), 0::bigint, '... not counted (only the Main message stays)');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowJSON"->>'themeKind' = 'user'), 1::bigint, '... the Main chat is not affected');
SELECT tt.fails($q$SELECT public.chat_task_ensure('bbbbbbbb-0000-0000-0000-000000000591')$q$, 'switched off', '... and cannot be opened');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"chatFunctionalityEnabled": true}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000059';
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowJSON"->>'themeKind' = 'task'), 1::bigint, 'switch on again: the data is all there');

-- ================================================ the limit and the scope chat of the files ================================================
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.chat_set_max_attachment_size(20)$q$, 'only a project manager or an administrator', 'a plain member cannot change the attachment limit');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT public.chat_set_max_attachment_size(0)$q$, 'from 1 to 100', 'the limit is 1..100 MB');
SELECT tt.fails($q$SELECT public.chat_set_max_attachment_size(101)$q$, 'from 1 to 100', '... also not 101');
SELECT tt.eq((public.files_authorize('add', 'chat', :'th1')->>'maxBytes')::bigint, 10485760::bigint, 'files_authorize(chat): the default limit is 10 MB');
SELECT tt.eq(public.chat_set_max_attachment_size(5), 5, 'the administrator sets 5 MB');
SELECT tt.eq((public.files_authorize('add', 'chat', :'th1')->>'maxBytes')::bigint, 5242880::bigint, '... maxBytes follows');
SELECT tt.eq(public.files_authorize('add', 'chat', :'th1')->>'chatKind', 'user', 'the answer names the chat kind (the folder: chat/user/<userGUID>/theme/<theme>/files) ...');
SELECT tt.eq(public.files_authorize('add', 'chat', :'th1')->>'chatRefGUID', '59111111-1111-1111-1111-111111111111', '... and the user guid of Main');
SELECT tt.eq(public.files_authorize('add', 'chat', :'tht')->>'chatKind', 'task', 'a task chat: kind task ...');
SELECT tt.eq(public.files_authorize('add', 'chat', :'tht')->>'chatRefGUID', 'bbbbbbbb-0000-0000-0000-000000000591', '... and the task guid (chat/task/<task>/theme/<theme>/files)');
SELECT tt.eq(public.files_authorize('add', 'chat', :'tht')->>'provider', 'googleDrive', '... the storage of the project (Google by default)');
SELECT tt.as_user('clara@chat.test', '59333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.files_authorize('read', 'chat', :'th1')->>'reason', 'noPermission', 'a non-member may not even read the files of a theme');
SELECT tt.eq(public.files_authorize('add', 'chat', :'th1')->>'allowed', 'false', '... nor add');

-- a verified upload becomes a file row of the theme (files_add): above the limit it is refused
SELECT tt.as_admin();
SELECT public.files_upload_pending_add(:'orga', '59222222-2222-2222-2222-222222222222', 'up-small', jsonb_build_object('scope', 'chat', 'scopeGUID', :'th1', 'name', 'small.txt', 'mime', 'text/plain', 'size', 1000, 'folderId', 'f1', 'relativePath', 'chat/user/x/theme/y/files', 'expiresAt', (now() + interval '1 hour')::text, 'provider', 'googleDrive'));
SELECT public.files_upload_pending_add(:'orga', '59222222-2222-2222-2222-222222222222', 'up-big', jsonb_build_object('scope', 'chat', 'scopeGUID', :'th1', 'name', 'big.bin', 'mime', 'application/octet-stream', 'size', 6000000, 'folderId', 'f1', 'relativePath', 'chat/user/x/theme/y/files', 'expiresAt', (now() + interval '1 hour')::text, 'provider', 'googleDrive'));
SELECT public.files_upload_pending_verify('up-small', 'drive-small', 1000, 'f1', 'chat/user/x/theme/y/files');
SELECT public.files_upload_pending_verify('up-big', 'drive-big', 6000000, 'f1', 'chat/user/x/theme/y/files');
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.files_add('up-big', 'chat', current_setting('tt.th1'), NULL, '{}'::jsonb)$q$, 'at most 5 MB', 'a chat attachment above the organization limit is refused');
SELECT public.files_add('up-small', 'chat', :'th1', NULL, '{}'::jsonb)->>'rowGUID' AS f1 \gset
SELECT set_config('tt.f1', :'f1', true);
SELECT tt.eq((SELECT "rowJSON"->>'fileSourceKind' FROM public."mediaPostTable" WHERE "rowGUID" = :'f1'), 'chat', 'the file row has the kind chat ...');
SELECT tt.eq((SELECT "rowParentGUID" FROM public."mediaPostTable" WHERE "rowGUID" = :'f1'), :'th1', '... and the theme as its parent');
SELECT tt.eq(jsonb_array_length(public.files_list('chat', :'th1')), 1, 'files_list(chat) lists the files of the theme');

-- a message holds a REFERENCE to the file (its URL); the name and the size come from the file row
SELECT public.chat_message_send(gen_random_uuid()::text, :'th1', 'the file', '[]', jsonb_build_array(jsonb_build_object('fileGUID', :'f1', 'url', '/files/view?post=' || :'f1', 'name', 'LIE.exe', 'size', 1))) AS fm \gset
SELECT tt.eq((:'fm'::jsonb)->'rowJSON'->'files'->0->>'name', 'small.txt', 'the reference takes the name from the file row, not from the caller');
SELECT tt.eq((:'fm'::jsonb)->'rowJSON'->'files'->0->>'size', '1000', '... and the size');
SELECT public.chat_message_send(gen_random_uuid()::text, :'th1', 'the same file again', '[]', jsonb_build_array(jsonb_build_object('fileGUID', :'f1', 'url', '/files/view?post=' || :'f1')));
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable" WHERE "rowParentGUID" = :'th1' AND "rowJSON" @> jsonb_build_object('files', jsonb_build_array(jsonb_build_object('fileGUID', :'f1')))), 2::bigint, 'the same file at two places of the chat: two references, one file');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'chat'), 1::bigint, '... one file row');
SELECT tt.fails($q$SELECT public.chat_message_send(gen_random_uuid()::text, current_setting('tt.th1'), 'x', '[]', jsonb_build_array(jsonb_build_object('fileGUID', 'no-such-file', 'url', '/files/view?post=1')))$q$, 'not a file of this theme', 'a file that is not a file of this theme is refused');
SELECT tt.fails($q$SELECT public.chat_message_send(gen_random_uuid()::text, current_setting('tt.tht'), 'x', '[]', jsonb_build_array(jsonb_build_object('fileGUID', current_setting('tt.f1'), 'url', '/files/view?post=1')))$q$, 'not a file of this theme', '... also not the file of ANOTHER theme');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'chat'), 1::bigint, 'a member reads the file row of the theme (RLS)');
SELECT tt.as_user('clara@chat.test', '59333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'chat'), 0::bigint, 'a non-member of the same organization does NOT see the file row');
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.files_move(current_setting('tt.f1'), 'organization', NULL, NULL, 'f', 'p')$q$, 'No permission', 'a chat file never moves');
-- who may delete a chat file: the uploader yes; another member who is neither the owner nor a project manager no; the owner yes
SELECT tt.as_admin();
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('59f00000-0000-0000-0000-000000000002', :'orga', :'th1',
  jsonb_build_object('fileSourceKind', 'chat', 'fileName', 'anna.txt', 'fileSizeBytes', 10, 'googleDriveFileId', 'drive-anna', 'fileStorageProvider', 'googleDrive', 'fileUploadedByGUID', '59111111-1111-1111-1111-111111111111'));
SELECT tt.as_user('boris@chat.test', '59222222-2222-2222-2222-222222222222');
SELECT tt.fails($q$SELECT public.files_delete('59f00000-0000-0000-0000-000000000002')$q$, 'only the uploader', 'a member who is not the uploader / owner / manager cannot delete a file');
SELECT tt.fails($q$SELECT public.files_update('59f00000-0000-0000-0000-000000000002', '{"mediaPostTitle":"x"}')$q$, 'only the uploader', '... nor change it');
SELECT tt.eq(public.files_delete(:'f1')->>'deleted', 'true', 'the uploader deletes his file');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.files_delete('59f00000-0000-0000-0000-000000000002')->>'deleted', 'true', 'the owner of the theme deletes the file of another');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.files_drive_cleanup_table), 2::bigint, '... both Drive files are queued for the cleanup');
SELECT tt.as_user('anna@chat.test', '59111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable" WHERE "rowParentGUID" = :'th1' AND "rowJSON" ? 'files'), 2::bigint, 'the messages keep their references (the bubble says: file deleted)');

-- ================================================ deletes ================================================
SELECT tt.as_admin();
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('59f00000-0000-0000-0000-000000000003', :'orga', :'tht',
  jsonb_build_object('fileSourceKind', 'chat', 'fileName', 'task.txt', 'fileSizeBytes', 10, 'googleDriveFileId', 'drive-task', 'fileStorageProvider', 'googleDrive', 'fileUploadedByGUID', '59111111-1111-1111-1111-111111111111'));
DELETE FROM public.files_drive_cleanup_table;
DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000591';
SELECT tt.eq((SELECT count(*) FROM public."chatObjectTable" WHERE "rowJSON"->>'chatKind' = 'task'), 0::bigint, 'a deleted task takes its chat object ...');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowJSON"->>'themeKind' = 'task'), 0::bigint, '... its theme ...');
SELECT tt.eq((SELECT count(*) FROM public."chatMembersTable" WHERE "rowParentGUID" = :'tht'), 0::bigint, '... its members ...');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable" WHERE "rowParentGUID" = :'tht'), 0::bigint, '... its messages ...');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowParentGUID" = :'tht'), 0::bigint, '... and its file rows');
SELECT tt.eq((SELECT count(*) FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'driveItemId' = 'drive-task'), 1::bigint, '... the Drive file is queued for the cleanup');
SELECT tt.eq((SELECT count(*) FROM public."chatThemeTable" WHERE "rowJSON"->>'themeKind' = 'user'), 1::bigint, 'the Main chat is untouched');
SELECT public.chat_delete_objects(ARRAY[:'maina'], 'organization deleted');
SELECT tt.eq((SELECT count(*) FROM public."chatMessagesTable"), 0::bigint, 'chat_delete_objects removes the rest (messages, members, themes, the object)');
SELECT tt.eq((SELECT count(*) FROM public."chatObjectTable"), 0::bigint, '... all objects');

ROLLBACK;
