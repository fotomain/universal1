-- PART 49, second slice (documentation/FILE_ATTACHMENT_WBS.html, section 12): the three row rules of mediaPostTable (author only / project posts / organization files), files_authorize, the verified-upload
-- flow (files_add), list / update / reorder / delete, the storage limit, the delete triggers + the cleanup queue (task, project, organization), first_per_task, count_for_delete.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@files.test', '56565656-5656-5656-5656-565656565601', 'Anna', 'F') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@files.test', '56565656-5656-5656-5656-565656565602', 'Boris', 'M');
SELECT public.organization_ensure_user('dora@other.test', '56565656-5656-5656-5656-565656565603', 'Dora', 'O') AS dora \gset
SELECT :'dora'::jsonb->>'organizationGUID' AS orgb \gset
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@files.test"}');
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" = 'boris@files.test';

SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000056', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000056'), '56565656-5656-5656-5656-565656565601', '{"name": "P56"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000561', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000056') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000561'), 'aaaaaaaa-0000-0000-0000-000000000056', '56565656-5656-5656-5656-565656565601', '{"taskDescription": "T1"}'),
  ('bbbbbbbb-0000-0000-0000-000000000562', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000056') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000561') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000562'), 'aaaaaaaa-0000-0000-0000-000000000056', '56565656-5656-5656-5656-565656565601', '{"taskDescription": "T1.1"}');

-- ================= 1. a post outside a project: its author only ==============================================================================================================
SELECT tt.as_user('boris@files.test', '56565656-5656-5656-5656-565656565602');
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('rec-boris', '56565656-5656-5656-5656-565656565602', '{"mediaPostTitle": "boris recording"}');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowGUID" = 'rec-boris'), 1::bigint, 'the author reads his recording');
SELECT tt.fails($q$INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('rec-fake', '56565656-5656-5656-5656-565656565601', '{}')$q$, 'row-level security', 'a post cannot be made in the name of another user');
SELECT tt.fails($q$INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('file-direct', current_setting('tt.orga'), '{"fileSourceKind": "organization"}')$q$, 'row-level security', 'a client cannot write a file row directly');
SELECT tt.fails($q$UPDATE public."mediaPostTable" SET "rowJSON" = '{"fileSourceKind": "organization"}' WHERE "rowGUID" = 'rec-boris'$q$, 'row-level security', 'a recording cannot be turned into a file row');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowGUID" = 'rec-boris'), 0::bigint, 'another user, even the administrator, does not see it');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public."mediaPostTable" WHERE "rowGUID" = 'rec-boris'$q$), 0::bigint, '... and cannot delete it');
SELECT tt.as_admin();
SET LOCAL ROLE anon;
SELECT tt.fails('SELECT count(*) FROM public."mediaPostTable"', 'permission denied', 'anon sees nothing');
RESET ROLE;

-- ================= 2. files_authorize =========================================================================================================================================
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq(public.files_authorize('add', 'project', 'aaaaaaaa-0000-0000-0000-000000000056')->>'allowed', 'true', 'the administrator (project owner) may add a project file');
SELECT tt.eq(public.files_authorize('add', 'task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')->>'allowed', 'true', '... a task file');
SELECT tt.eq(public.files_authorize('add', 'organization')->>'allowed', 'true', '... an organization file (projectFileManager)');
SELECT tt.eq(public.files_authorize('connect', 'organization')->>'allowed', 'true', '... and may connect Google Drive');
SELECT tt.eq(public.files_authorize('add', 'task', 'bbbbbbbb-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000056')->>'reason', 'task', 'a task that is not in the project');
SELECT tt.eq(public.files_authorize('add', 'galaxy')->>'reason', 'scope', 'a wrong scope');
SELECT tt.eq(public.files_authorize('add', 'document')->>'reason', 'scope', 'a document scope needs the document GUID');
SELECT tt.as_user('boris@files.test', '56565656-5656-5656-5656-565656565602');
SELECT tt.eq(public.files_authorize('read', 'organization')->>'allowed', 'true', 'a plain member may read');
SELECT tt.eq(public.files_authorize('add', 'organization')->>'reason', 'noPermission', '... but not add an organization file');
SELECT tt.eq(public.files_authorize('connect', 'organization')->>'reason', 'noPermission', '... nor connect Google Drive');
SELECT tt.fails($q$SELECT public.files_require('delete', 'organization')$q$, 'No permission: files', 'files_require raises');
SELECT tt.as_user('dora@other.test', '56565656-5656-5656-5656-565656565603');
SELECT tt.eq(public.files_authorize('read', 'project', 'aaaaaaaa-0000-0000-0000-000000000056')->>'reason', 'project', 'another organization: not our project');
SELECT tt.as_admin();
SELECT tt.eq(public.files_authorize('read', 'organization')->>'reason', 'signIn', 'no session: signIn');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"filesFunctionalityEnabled": false}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000056';
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq(public.files_authorize('add', 'project', 'aaaaaaaa-0000-0000-0000-000000000056')->>'reason', 'switchOff', 'the project switch filesFunctionalityEnabled = false');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'filesFunctionalityEnabled' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000056';

-- ================= 3. the verified upload -> a file row ========================================================================================================================
SELECT public.organization_ensure_user('anna@files.test', '56565656-5656-5656-5656-565656565601', 'Anna', 'F') IS NOT NULL AS x \gset
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"organizationGoogleDriveRootFolderId": "ROOT1", "organizationGoogleDriveAccountEmail": "drive@gmail.test"}' WHERE "rowGUID" = :'orga';
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '56565656-5656-5656-5656-565656565601', 'up-1', jsonb_build_object('scope', 'task', 'scopeGUID', 'bbbbbbbb-0000-0000-0000-000000000561', 'projectGUID', 'aaaaaaaa-0000-0000-0000-000000000056', 'name', 'plan.pdf', 'mime', 'application/pdf', 'size', 3000, 'expiresAt', (now() + interval '1 hour')));
RESET ROLE;
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.fails($q$SELECT public.files_add('up-1', 'task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')$q$, 'not finished', 'an upload the function did not verify is refused');
SELECT tt.as_admin();
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_verify('up-1', 'FILE1', 2999, 'FOLDER1', 'project/aaaaaaaa/task/bbbbbbbb/files') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('boris@files.test', '56565656-5656-5656-5656-565656565602');
SELECT tt.fails($q$SELECT public.files_add('up-1', 'task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')$q$, 'No permission', 'a plain member cannot register a file');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.fails($q$SELECT public.files_add('up-1', 'project', 'aaaaaaaa-0000-0000-0000-000000000056')$q$, 'another place', 'the upload was made for the task, not the project');
SELECT public.files_add('up-1', 'task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056', '{"paperDocumentPlace": "Cabinet 3"}') AS f1 \gset
SELECT tt.eq(:'f1'::jsonb->>'rowOwnerGUID', current_setting('tt.orga'), 'the file row is owned by the organization');
SELECT tt.eq(:'f1'::jsonb->>'rowParentGUID', 'bbbbbbbb-0000-0000-0000-000000000561', '... its parent is the task');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'fileKind', 'pdf', '... kind pdf by the MIME type');
SELECT tt.eq((:'f1'::jsonb->'rowJSON'->>'fileSizeBytes'), '2999', '... the size is the one the function verified in Drive (not the 3000 asked)');
SELECT tt.eq((:'f1'::jsonb->'rowJSON'->>'googleDriveAccountEmail') || '|' || (:'f1'::jsonb->'rowJSON'->>'googleDriveRootFolderId'), 'drive@gmail.test|ROOT1', '... the account and the root of the organization');
SELECT tt.eq(:'f1'::jsonb->'rowJSON'->>'paperDocumentPlace', 'Cabinet 3', '... the paper place');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.files_upload_pending_table), 0::bigint, 'the pending upload is used up');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.fails($q$SELECT public.files_add('up-1', 'task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')$q$, 'not finished', '... and cannot be used twice');
SELECT set_config('tt.f1', :'f1'::jsonb->>'rowGUID', true);

-- ================= 4. list, read by members, update, reorder, link, delete ======================================================================================================
SELECT public.files_add_link('task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056', 'https://youtu.be/abc', 'A video') AS f2 \gset
SELECT tt.fails($q$SELECT public.files_add_link('task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056', 'http://insecure.test')$q$, 'https', 'a link must be https');
SELECT set_config('tt.f2', :'f2'::jsonb->>'rowGUID', true);
SELECT tt.eq(jsonb_array_length(public.files_list('task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')), 2, 'two files on the task');
SELECT tt.eq(jsonb_array_length(public.files_list('project', 'aaaaaaaa-0000-0000-0000-000000000056')), 2, '... also in the project scope');
SELECT tt.eq(jsonb_array_length(public.files_list('organization')), 2, '... and in the organization scope');
SELECT tt.as_user('boris@files.test', '56565656-5656-5656-5656-565656565602');
SELECT tt.eq(jsonb_array_length(public.files_list('task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')), 2, 'a plain member reads the files');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON" ? 'fileSourceKind'), 2::bigint, '... also by a direct select (every member of the organization)');
SELECT tt.eq(public.files_get(current_setting('tt.f1'))->'rowJSON'->>'googleDriveFileId', 'FILE1', 'a plain member gets the row of a file (files_get)');
SELECT tt.fails(format($q$SELECT public.files_update(%L, '{"mediaPostTitle": "hacked"}')$q$, current_setting('tt.f1')), 'No permission', 'a plain member cannot change a file');
SELECT tt.fails(format($q$SELECT public.files_delete(%L)$q$, current_setting('tt.f1')), 'No permission', '... nor delete it');
SELECT tt.fails(format($q$SELECT public.files_reorder(ARRAY[%L, %L])$q$, current_setting('tt.f2'), current_setting('tt.f1')), 'No permission', '... nor reorder');
SELECT tt.as_user('dora@other.test', '56565656-5656-5656-5656-565656565603');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON" ? 'fileSourceKind'), 0::bigint, 'another organization sees no file');
SELECT tt.fails(format($q$SELECT public.files_get(%L)$q$, current_setting('tt.f1')), 'No permission', '... and gets no row by files_get');
SELECT tt.fails($q$SELECT public.files_list('task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')$q$, 'No permission', '... and cannot list');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq(public.files_update(current_setting('tt.f1'), '{"mediaPostTitle": "Plan v2", "paperDocumentPlace": null, "rowOwnerGUID": "x", "googleDriveFileId": "EVIL"}')->'rowJSON'->>'mediaPostTitle', 'Plan v2', 'the administrator renames');
SELECT tt.eq((SELECT "rowJSON"->>'googleDriveFileId' FROM public."mediaPostTable" WHERE "rowGUID" = current_setting('tt.f1')), 'FILE1', '... other keys (the Drive id) are not changeable');
SELECT tt.eq((SELECT "rowJSON" ? 'paperDocumentPlace' FROM public."mediaPostTable" WHERE "rowGUID" = current_setting('tt.f1')), false, '... the paper place can be cleared');
SELECT public.files_reorder(ARRAY[current_setting('tt.f2'), current_setting('tt.f1')]);
SELECT tt.eq((public.files_list('task', 'bbbbbbbb-0000-0000-0000-000000000561', 'aaaaaaaa-0000-0000-0000-000000000056')->0->>'rowGUID'), current_setting('tt.f2'), 'reorder: the link is first now');
SELECT tt.eq(public.files_first_per_task('aaaaaaaa-0000-0000-0000-000000000056')->0->>'count', '2', 'first_per_task: 2 files on the task');
SELECT tt.eq(public.files_count_for_delete('task', 'bbbbbbbb-0000-0000-0000-000000000561'), 2::bigint, 'count_for_delete of the task');
SELECT tt.eq(public.files_count_for_delete('project', 'aaaaaaaa-0000-0000-0000-000000000056'), 2::bigint, '... of the project');
SELECT tt.eq(public.files_count_for_delete('organization'), 2::bigint, '... of the organization');
SELECT tt.eq(public.files_delete(current_setting('tt.f2'))->>'deleted', 'true', 'a link is deleted');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.files_drive_cleanup_table), 0::bigint, '... a link has no Drive file: no cleanup line');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');

-- ================= 5. the storage limit =======================================================================================================================================
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"filesStorageLimitMegabytes": 1}' WHERE "rowGUID" = :'orga';
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '56565656-5656-5656-5656-565656565601', 'up-big', jsonb_build_object('scope', 'project', 'scopeGUID', 'aaaaaaaa-0000-0000-0000-000000000056', 'projectGUID', 'aaaaaaaa-0000-0000-0000-000000000056', 'name', 'big.bin', 'mime', 'application/octet-stream', 'size', 5000000, 'expiresAt', (now() + interval '1 hour')));
SELECT public.files_upload_pending_verify('up-big', 'FILE2', 5000000, 'FOLDER2', 'x') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.fails($q$SELECT public.files_add('up-big', 'project', 'aaaaaaaa-0000-0000-0000-000000000056')$q$, 'storage limit', 'an upload over the organization limit is refused');
SELECT tt.as_admin();
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" - 'filesStorageLimitMegabytes' WHERE "rowGUID" = :'orga';
DELETE FROM public.files_upload_pending_table;

-- ================= 6. delete a file -> a cleanup line; the service role works the queue ==========================================================================================
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq(public.files_delete(current_setting('tt.f1'))->>'driveFileId', 'FILE1', 'deleting the Drive file row returns the Drive id');
SELECT tt.as_admin();
SELECT tt.eq((SELECT "rowJSON"->>'state' || '|' || ("rowJSON"->>'itemKind') || '|' || ("rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table), 'waiting|file|FILE1', '... and queues it');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq(public.files_cleanup_counts()->>'waiting', '1', 'the Files tab sees 1 waiting');
SELECT tt.as_user('boris@files.test', '56565656-5656-5656-5656-565656565602');
SELECT tt.eq(public.files_cleanup_counts()->>'waiting', '0', '... a plain member sees nothing of the queue');
SELECT tt.fails('SELECT public.files_cleanup_pending(5)', 'permission denied', 'a client cannot work the queue');
SELECT tt.as_admin();
GRANT USAGE ON SCHEMA tt TO service_role;
SET LOCAL ROLE service_role;
SELECT jsonb_array_length(public.files_cleanup_pending(10)) AS taken \gset
RESET ROLE;
SELECT tt.eq(:'taken'::int, 1, 'the service role takes the line');
SELECT tt.eq((SELECT "rowJSON"->>'state' || '|' || ("rowJSON"->>'attempts') FROM public.files_drive_cleanup_table), 'running|1', '... it is running, attempt 1');
SET LOCAL ROLE service_role;
SELECT jsonb_array_length(public.files_cleanup_pending(10)) AS taken2 \gset
RESET ROLE;
SELECT tt.eq(:'taken2'::int, 0, '... and is not taken twice');
SELECT "rowGUID" AS cid FROM public.files_drive_cleanup_table \gset
SET LOCAL ROLE service_role;
SELECT public.files_cleanup_failed(:'cid', 'insufficientFilePermissions');
RESET ROLE;
SELECT tt.eq((SELECT "rowJSON"->>'state' || '|' || ("rowJSON"->>'lastError') FROM public.files_drive_cleanup_table), 'waiting|insufficientFilePermissions', 'a failed try goes back to waiting with the reason');
UPDATE public.files_drive_cleanup_table SET "rowJSON" = "rowJSON" || '{"attempts": 5}';
SET LOCAL ROLE service_role;
SELECT public.files_cleanup_failed(:'cid', 'still no');
RESET ROLE;
SELECT tt.eq((SELECT "rowJSON"->>'state' FROM public.files_drive_cleanup_table), 'failed', '... after 5 tries it stays failed');
SET LOCAL ROLE service_role;
SELECT public.files_cleanup_done(:'cid');
SELECT public.files_folder_set(current_setting('tt.orga'), 'task:bbbbbbbb-0000-0000-0000-000000000561', '{"driveFolderId": "TFOLDER", "projectGUID": "aaaaaaaa-0000-0000-0000-000000000056"}')->>'driveFolderId' AS fs1 \gset
SELECT public.files_folder_set(current_setting('tt.orga'), 'task:bbbbbbbb-0000-0000-0000-000000000561', '{"driveFolderId": "SECOND-WRITER"}')->>'driveFolderId' AS fs2 \gset
SELECT public.files_folder_get(current_setting('tt.orga'), 'task:bbbbbbbb-0000-0000-0000-000000000561')->>'driveFolderId' AS fs3 \gset
RESET ROLE;
SELECT tt.eq((SELECT "rowJSON"->>'state' FROM public.files_drive_cleanup_table), 'done', 'done');
SELECT tt.eq(:'fs1'::text, 'TFOLDER'::text, 'a folder is recorded');
SELECT tt.eq(:'fs2'::text, 'TFOLDER'::text, '... the first writer wins');
SELECT tt.eq(:'fs3'::text, 'TFOLDER'::text, '... files_folder_get returns it');
DELETE FROM public.files_drive_cleanup_table;

-- ================= 7. the delete triggers =====================================================================================================================================
-- a file on the task and one on the subtask, a project file; the task folder row
SELECT tt.as_admin();
INSERT INTO public."mediaPostTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  (:'orga', 'bbbbbbbb-0000-0000-0000-000000000561', '{"fileSourceKind": "task", "fileSourceProjectGUID": "aaaaaaaa-0000-0000-0000-000000000056", "googleDriveFileId": "TF1"}'),
  (:'orga', 'bbbbbbbb-0000-0000-0000-000000000562', '{"fileSourceKind": "task", "fileSourceProjectGUID": "aaaaaaaa-0000-0000-0000-000000000056", "googleDriveFileId": "TF2"}'),
  (:'orga', 'aaaaaaaa-0000-0000-0000-000000000056', '{"fileSourceKind": "project", "fileSourceProjectGUID": "aaaaaaaa-0000-0000-0000-000000000056", "googleDriveFileId": "PF1"}');
SELECT tt.as_user('anna@files.test', '56565656-5656-5656-5656-565656565601');
SELECT tt.eq(public.files_count_for_delete('task', 'bbbbbbbb-0000-0000-0000-000000000561'), 2::bigint, 'count_for_delete counts the task and the subtask');
DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000561';
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON"->>'fileSourceKind' IN ('task', 'stage')), 0::bigint, 'deleting a task tree removes the file rows of the task and of its subtask');
SELECT tt.eq((SELECT string_agg("rowJSON"->>'driveItemId', ',' ORDER BY "rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'itemKind' = 'file'), 'TF1,TF2', '... and queues their Drive files');
SELECT tt.eq((SELECT "rowJSON"->>'driveItemId' FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'itemKind' = 'folder'), 'TFOLDER', '... and the task folder');
SELECT tt.eq((SELECT count(*) FROM public.files_folder_table), 0::bigint, '... the folder row is gone');
DELETE FROM public.files_drive_cleanup_table;
SELECT public.files_folder_set(:'orga', 'project:aaaaaaaa-0000-0000-0000-000000000056', '{"driveFolderId": "PFOLDER", "projectGUID": "aaaaaaaa-0000-0000-0000-000000000056"}') IS NOT NULL;
SELECT public.files_folder_set(:'orga', 'task:cccccccc-0000-0000-0000-000000000099', '{"driveFolderId": "OLDTASKFOLDER", "projectGUID": "aaaaaaaa-0000-0000-0000-000000000056"}') IS NOT NULL;
DELETE FROM public.project_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000056';
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON" ? 'fileSourceKind'), 0::bigint, 'deleting a project removes its file rows');
SELECT tt.eq((SELECT string_agg("rowJSON"->>'driveItemId', ',' ORDER BY "rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table), 'PF1,PFOLDER', '... and queues the project file and ONLY the project folder (the tree below goes with it)');
SELECT tt.eq((SELECT count(*) FROM public.files_folder_table), 0::bigint, '... all folder rows of the project are gone');
DELETE FROM public.files_drive_cleanup_table;
INSERT INTO public."mediaPostTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orgb', :'orgb', '{"fileSourceKind": "organization", "googleDriveFileId": "OF1"}');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"organizationGoogleDriveRootFolderId": "ROOT-B"}' WHERE "rowGUID" = :'orgb';
INSERT INTO public.files_google_connection_table ("rowOwnerGUID", "rowJSON") VALUES (:'orgb', '{"role": "current", "state": "ok"}');
DELETE FROM public."organizationTable" WHERE "rowGUID" = :'orgb';
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowOwnerGUID" = :'orgb'), 0::bigint, 'deleting an organization removes its file rows');
SELECT tt.eq((SELECT "rowJSON"->>'driveItemId' || '|' || ("rowJSON"->>'itemKind') || '|' || ("rowJSON"->>'allowRoot') FROM public.files_drive_cleanup_table WHERE "rowOwnerGUID" = :'orgb'), 'ROOT-B|folder|true', '... and queues the root folder named in the url (allowRoot)');
SELECT tt.eq((SELECT count(*) FROM public.files_google_connection_table WHERE "rowOwnerGUID" = :'orgb'), 1::bigint, '... the connection stays until the Edge Function has cleaned up and revoked');

ROLLBACK;
