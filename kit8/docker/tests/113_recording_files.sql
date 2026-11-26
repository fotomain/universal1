-- PART 49 slice (2026-11-26): the files of a recording / a photo = the file scope `recording`: p_guid = the media post (rowJSON.recordingFolder audio | video | photo);
-- the folder in the storage is kit8root/media/<folder>; only the AUTHOR of the post adds / reads the files; the rows are invisible to every other member and to the organization list;
-- a post may have SEVERAL files (a video cut in parts); they go with the post.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@rec.test', '11311311-3113-1131-8113-113113113101', 'Anna', 'R') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@rec.test', '11311311-3113-1131-8113-113113113102', 'Boris', 'M');
SELECT tt.as_user('anna@rec.test', '11311311-3113-1131-8113-113113113101');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@rec.test"}');
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" = 'boris@rec.test';
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"organizationGoogleDriveRootFolderId": "ROOT1", "organizationGoogleDriveAccountEmail": "drive@gmail.test"}' WHERE "rowGUID" = :'orga';

-- ================= 1. the post and files_authorize ===========================================================================================================================
SELECT tt.as_user('anna@rec.test', '11311311-3113-1131-8113-113113113101');
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('3a000000-0000-4000-8000-000000000001', '11311311-3113-1131-8113-113113113101', '{"mediaPostTitle": "Video 1", "mediaKind": "video", "recordingFolder": "video"}'),
  ('3a000000-0000-4000-8000-000000000002', '11311311-3113-1131-8113-113113113101', '{"mediaPostTitle": "Audio 1", "mediaKind": "audio", "recordingFolder": "audio"}'),
  ('3a000000-0000-4000-8000-000000000003', '11311311-3113-1131-8113-113113113101', '{"mediaPostTitle": "Photo 1", "recordingFolder": "photo"}'),
  ('3a000000-0000-4000-8000-000000000004', '11311311-3113-1131-8113-113113113101', '{"mediaPostTitle": "an old recording with no folder", "mediaKind": "video"}'),
  ('3a000000-0000-4000-8000-000000000005', '11311311-3113-1131-8113-113113113101', '{"mediaPostTitle": "bad folder", "recordingFolder": "../x"}');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000001')->>'allowed', 'true', 'the author may add the file of his video post');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000001')->>'idKind', 'video', '... the answer names the folder: video');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000002')->>'idKind', 'audio', '... audio for an audio post');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000003')->>'idKind', 'photo', '... photo for a photo post');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000004')->>'reason', 'scope', 'a post with no recordingFolder: refused');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000005')->>'reason', 'scope', 'a folder that is not audio / video / photo: refused');
SELECT tt.eq(public.files_authorize('add', 'recording', 'no-such-post')->>'reason', 'scope', 'no such post: refused');
SELECT tt.eq(public.files_authorize('add', 'recording')->>'reason', 'scope', 'no post guid: refused');
SELECT tt.eq(public.files_authorize('move', 'recording', '3a000000-0000-4000-8000-000000000001')->>'allowed', 'false', 'the files never move');
SELECT tt.as_user('boris@rec.test', '11311311-3113-1131-8113-113113113102');
SELECT tt.eq(public.files_authorize('add', 'recording', '3a000000-0000-4000-8000-000000000001')->>'reason', 'scope', 'ANOTHER member (even of the same organization) cannot add to it');
SELECT tt.eq(public.files_authorize('read', 'recording', '3a000000-0000-4000-8000-000000000001')->>'reason', 'scope', '... nor read it');

-- ================= 2. two verified uploads (a video in two parts) -> two file rows ============================================================================================
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '11311311-3113-1131-8113-113113113101', 'up-r1', jsonb_build_object('scope', 'recording', 'scopeGUID', '3a000000-0000-4000-8000-000000000001', 'name', '3a000000-0000-4000-8000-000000000001.mp4', 'mime', 'video/mp4', 'size', 2000, 'expiresAt', (now() + interval '1 hour')));
SELECT public.files_upload_pending_verify('up-r1', 'VID1', 1999, 'FOLDER-VIDEO', 'media/video') IS NOT NULL;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '11311311-3113-1131-8113-113113113101', 'up-r2', jsonb_build_object('scope', 'recording', 'scopeGUID', '3a000000-0000-4000-8000-000000000001', 'name', '3a000000-0000-4000-8000-000000000001-2.mp4', 'mime', 'video/mp4', 'size', 500, 'expiresAt', (now() + interval '1 hour')));
SELECT public.files_upload_pending_verify('up-r2', 'VID2', 500, 'FOLDER-VIDEO', 'media/video') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('boris@rec.test', '11311311-3113-1131-8113-113113113102');
SELECT tt.fails($q$SELECT public.files_add('up-r1', 'recording', '3a000000-0000-4000-8000-000000000001')$q$, 'No permission', 'another member cannot register the upload');
SELECT tt.as_user('anna@rec.test', '11311311-3113-1131-8113-113113113101');
SELECT public.files_add('up-r1', 'recording', '3a000000-0000-4000-8000-000000000001') AS f1 \gset
SELECT public.files_add('up-r2', 'recording', '3a000000-0000-4000-8000-000000000001') AS f2 \gset
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'fileSourceKind', 'recording', 'the file row has the kind recording');
SELECT tt.eq(:'f1'::jsonb->>'rowParentGUID', '3a000000-0000-4000-8000-000000000001', '... its parent is the media post');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'googleDriveRelativePath', 'media/video', '... the path in the storage is media/video');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'fileKind', 'video', '... a video');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'mediaPostOrigin', 'https://drive.google.com/file/d/VID1/view', '... the Google Drive address of the file is in the row');
SELECT tt.eq(:'f2'::jsonb->'rowJSON'->>'googleDriveFileId', 'VID2', 'a post may have a second file (a video in parts)');
SELECT set_config('tt.f1', :'f1'::jsonb->>'rowGUID', true);

-- ================= 3. who sees it ============================================================================================================================================
SELECT tt.eq(jsonb_array_length(public.files_list('recording', '3a000000-0000-4000-8000-000000000001')), 2, 'the author lists the two files of his post');
SELECT tt.eq(jsonb_array_length(public.files_list('organization')), 0, 'the organization file list does NOT show them (also for the administrator)');
SELECT tt.eq(public.files_get(current_setting('tt.f1'))->'rowJSON'->>'googleDriveFileId', 'VID1', 'files_get answers the author (the download link)');
-- the author can write the Drive address into his own post
UPDATE public."mediaPostTable" SET "rowJSON" = "rowJSON" || '{"googleDriveURLToFile": "https://drive.google.com/file/d/VID1/view"}' WHERE "rowGUID" = '3a000000-0000-4000-8000-000000000001';
SELECT tt.eq((SELECT "rowJSON"->>'googleDriveURLToFile' FROM public."mediaPostTable" WHERE "rowGUID" = '3a000000-0000-4000-8000-000000000001'), 'https://drive.google.com/file/d/VID1/view', 'the post keeps googleDriveURLToFile');
SELECT tt.as_user('boris@rec.test', '11311311-3113-1131-8113-113113113102');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'recording'), 0::bigint, 'ANOTHER member of the organization sees no row by a direct select');
SELECT tt.fails($q$SELECT public.files_get(current_setting('tt.f1'))$q$, 'No permission', '... cannot get it for a download link');
SELECT tt.fails($q$SELECT public.files_list('recording', '3a000000-0000-4000-8000-000000000001')$q$, 'No permission', '... cannot list it');
SELECT tt.fails($q$SELECT public.files_delete(current_setting('tt.f1'))$q$, 'No permission', '... nor delete it');
SELECT tt.as_admin();
SET LOCAL ROLE anon;
SELECT tt.fails('SELECT count(*) FROM public."mediaPostTable"', 'permission denied', 'anon sees nothing');
RESET ROLE;

-- ================= 4. the files go with the post ==============================================================================================================================
SELECT tt.as_user('anna@rec.test', '11311311-3113-1131-8113-113113113101');
DELETE FROM public."mediaPostTable" WHERE "rowGUID" = '3a000000-0000-4000-8000-000000000001';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' = 'recording'), 0::bigint, 'deleting the post deletes the file rows');
SELECT tt.eq((SELECT string_agg("rowJSON"->>'driveItemId', ',' ORDER BY "rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'state' = 'waiting'), 'VID1,VID2', '... and queues both storage files for deletion');
SELECT tt.as_user('anna@rec.test', '11311311-3113-1131-8113-113113113101');
DELETE FROM public."mediaPostTable" WHERE "rowGUID" = '3a000000-0000-4000-8000-000000000004';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.files_drive_cleanup_table), 2::bigint, 'deleting an ordinary post queues nothing');

ROLLBACK;
