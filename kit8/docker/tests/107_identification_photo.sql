-- PART 49 slice (2026-11-23): the owner photo of an ID card / passport = the file scope `identification`: p_guid = the media post of the reading (rowJSON.idCardFolder idcard | passport);
-- only the AUTHOR of the post adds / reads it; the file row is invisible to every other member (also the administrator) and to the organization file list; it goes with the post.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@files.test', '10710710-7107-1071-8107-107107107101', 'Anna', 'F') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@files.test', '10710710-7107-1071-8107-107107107102', 'Boris', 'M');
SELECT tt.as_user('anna@files.test', '10710710-7107-1071-8107-107107107101');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@files.test"}');
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" = 'boris@files.test';
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"organizationGoogleDriveRootFolderId": "ROOT1", "organizationGoogleDriveAccountEmail": "drive@gmail.test"}' WHERE "rowGUID" = :'orga';

-- ================= 1. the post and files_authorize ===========================================================================================================================
SELECT tt.as_user('anna@files.test', '10710710-7107-1071-8107-107107107101');
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('1a000000-0000-4000-8000-000000000001', '10710710-7107-1071-8107-107107107101', '{"mediaPostTitle": "JANA ZVEJNIEKS", "idCardFolder": "idcard"}'),
  ('1a000000-0000-4000-8000-000000000002', '10710710-7107-1071-8107-107107107101', '{"mediaPostTitle": "A PASSPORT", "idCardFolder": "passport"}'),
  ('1a000000-0000-4000-8000-000000000003', '10710710-7107-1071-8107-107107107101', '{"mediaPostTitle": "just a recording"}');
SELECT tt.eq(public.files_authorize('add', 'identification', '1a000000-0000-4000-8000-000000000001')->>'allowed', 'true', 'the author may add the owner photo of his ID card post');
SELECT tt.eq(public.files_authorize('add', 'identification', '1a000000-0000-4000-8000-000000000001')->>'idKind', 'idcard', '... the answer names the folder: idcard');
SELECT tt.eq(public.files_authorize('add', 'identification', '1a000000-0000-4000-8000-000000000002')->>'idKind', 'passport', '... passport for a passport post');
SELECT tt.eq(public.files_authorize('add', 'identification', '1a000000-0000-4000-8000-000000000003')->>'reason', 'scope', 'a post that is not an ID card post: refused');
SELECT tt.eq(public.files_authorize('add', 'identification', 'no-such-post')->>'reason', 'scope', 'no such post: refused');
SELECT tt.eq(public.files_authorize('add', 'identification')->>'reason', 'scope', 'no post guid: refused');
SELECT tt.eq(public.files_authorize('move', 'identification', '1a000000-0000-4000-8000-000000000001')->>'allowed', 'false', 'the photo never moves');
SELECT tt.as_user('boris@files.test', '10710710-7107-1071-8107-107107107102');
SELECT tt.eq(public.files_authorize('add', 'identification', '1a000000-0000-4000-8000-000000000001')->>'reason', 'scope', 'ANOTHER member (even of the same organization) cannot add to it');
SELECT tt.eq(public.files_authorize('read', 'identification', '1a000000-0000-4000-8000-000000000001')->>'reason', 'scope', '... nor read it');

-- ================= 2. the verified upload -> the file row ====================================================================================================================
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '10710710-7107-1071-8107-107107107101', 'up-id1', jsonb_build_object('scope', 'identification', 'scopeGUID', '1a000000-0000-4000-8000-000000000001', 'name', '1a000000-0000-4000-8000-000000000001.jpg', 'mime', 'image/jpeg', 'size', 20000, 'expiresAt', (now() + interval '1 hour')));
SELECT public.files_upload_pending_verify('up-id1', 'PHOTO1', 19999, 'FOLDER-IDCARD', 'identification/idcard') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('boris@files.test', '10710710-7107-1071-8107-107107107102');
SELECT tt.fails($q$SELECT public.files_add('up-id1', 'identification', '1a000000-0000-4000-8000-000000000001')$q$, 'No permission', 'another member cannot register the upload');
SELECT tt.as_user('anna@files.test', '10710710-7107-1071-8107-107107107101');
SELECT public.files_add('up-id1', 'identification', '1a000000-0000-4000-8000-000000000001') AS f1 \gset
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'fileSourceKind', 'identification', 'the file row has the kind identification');
SELECT tt.eq(:'f1'::jsonb->>'rowParentGUID', '1a000000-0000-4000-8000-000000000001', '... its parent is the media post');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'googleDriveRelativePath', 'identification/idcard', '... the path in the storage is identification/idcard');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'fileKind', 'image', '... an image');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'fileUploadedByGUID', '10710710-7107-1071-8107-107107107101', '... uploaded by the author');
SELECT set_config('tt.f1', :'f1'::jsonb->>'rowGUID', true);
-- one photo per post
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '10710710-7107-1071-8107-107107107101', 'up-id2', jsonb_build_object('scope', 'identification', 'scopeGUID', '1a000000-0000-4000-8000-000000000001', 'name', 'x.jpg', 'mime', 'image/jpeg', 'size', 100, 'expiresAt', (now() + interval '1 hour')));
SELECT public.files_upload_pending_verify('up-id2', 'PHOTO2', 100, 'FOLDER-IDCARD', 'identification/idcard') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('anna@files.test', '10710710-7107-1071-8107-107107107101');
SELECT tt.fails($q$SELECT public.files_add('up-id2', 'identification', '1a000000-0000-4000-8000-000000000001')$q$, 'already has its owner photo', 'a post has ONE owner photo');

-- ================= 3. who sees it ============================================================================================================================================
SELECT tt.eq(jsonb_array_length(public.files_list('identification', '1a000000-0000-4000-8000-000000000001')), 1, 'the author lists the photo of his post');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'identification'), 1::bigint, '... and reads the row by a direct select');
SELECT tt.eq(jsonb_array_length(public.files_list('organization')), 0, 'the organization file list does NOT show it (also for the administrator)');
SELECT tt.eq(public.files_get(current_setting('tt.f1'))->'rowJSON'->>'fileName', '1a000000-0000-4000-8000-000000000001.jpg', 'files_get answers the author (the download link)');
SELECT tt.as_user('boris@files.test', '10710710-7107-1071-8107-107107107102');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'identification'), 0::bigint, 'ANOTHER member of the organization sees no row by a direct select');
SELECT tt.fails($q$SELECT public.files_get(current_setting('tt.f1'))$q$, 'No permission', '... cannot get it for a download link');
SELECT tt.fails($q$SELECT public.files_list('identification', '1a000000-0000-4000-8000-000000000001')$q$, 'No permission', '... cannot list it');
SELECT tt.fails($q$SELECT public.files_delete(current_setting('tt.f1'))$q$, 'No permission', '... nor delete it');
SELECT tt.eq(jsonb_array_length(public.files_list('organization')), 0, '... and the organization list is empty for him too');
SELECT tt.as_admin();
SET LOCAL ROLE anon;
SELECT tt.fails('SELECT count(*) FROM public."mediaPostTable"', 'permission denied', 'anon sees nothing');
RESET ROLE;

-- ================= 4. the photo goes with the post ===========================================================================================================================
SELECT tt.as_user('anna@files.test', '10710710-7107-1071-8107-107107107101');
DELETE FROM public."mediaPostTable" WHERE "rowGUID" = '1a000000-0000-4000-8000-000000000001';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'identification'), 0::bigint, 'deleting the post deletes the photo row');
SELECT tt.eq((SELECT "rowJSON"->>'state' || '|' || ("rowJSON"->>'itemKind') || '|' || ("rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table), 'waiting|file|PHOTO1', '... and queues the storage file for deletion');
-- a post that is not an ID card post leaves the queue alone
SELECT tt.as_user('anna@files.test', '10710710-7107-1071-8107-107107107101');
DELETE FROM public."mediaPostTable" WHERE "rowGUID" = '1a000000-0000-4000-8000-000000000003';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.files_drive_cleanup_table), 1::bigint, 'deleting an ordinary post queues nothing');

ROLLBACK;
