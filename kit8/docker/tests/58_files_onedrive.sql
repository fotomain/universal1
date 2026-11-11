-- PART 49, fourth slice (documentation/FILE_WITH_OneDrive_WBS.html, task OD4): a SECOND storage, Microsoft OneDrive. The storage of a scope (project setting / organization default),
-- files_authorize says it, the OneDrive connection table, files_org_facts / files_upload_pending_verify / files_health_rows / files_queue with a provider, file rows with OneDrive keys,
-- the queue lines that know their storage, the delete triggers, move, storage used. A Google upload (no provider key) must behave exactly as before.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@od.test', '58585858-5858-5858-5858-585858585801', 'Anna', 'O') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@od.test', '58585858-5858-5858-5858-585858585802', 'Boris', 'M');
SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@od.test"}');
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" = 'boris@od.test';
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"organizationGoogleDriveRootFolderId": "GROOT", "organizationGoogleDriveAccountEmail": "drive@gmail.test",
  "organizationOneDriveRootFolderId": "OROOT", "organizationOneDriveAccountEmail": "owner@outlook.test", "organizationOneDriveRootFolderUrl": "https://onedrive.live.com/?id=OROOT"}' WHERE "rowGUID" = :'orga';

SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('aaaaaaaa-0000-0000-0000-000000000058', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000058'), '58585858-5858-5858-5858-585858585801', '{"name": "P58"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000581', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000058') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000581'), 'aaaaaaaa-0000-0000-0000-000000000058', '58585858-5858-5858-5858-585858585801', '{"taskDescription": "T58"}');

-- ================= 1. the OneDrive connection table: same rules as the Google one =============================================================================================
SELECT tt.as_admin();
INSERT INTO public.files_onedrive_connection_table ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"role": "current", "state": "ok", "accountEmail": "owner@outlook.test"}');
SELECT tt.fails($q$INSERT INTO public.files_onedrive_connection_table ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"role": "current"}')$q$, 'uq_files_onedrive_connection', 'one OneDrive connection per organization and role');
SELECT tt.eq((SELECT count(*) FROM public.files_google_connection_table), 0::bigint, 'the Google table is not touched');
SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
SELECT tt.fails('SELECT count(*) FROM public.files_onedrive_connection_table', 'permission denied', 'a client (even the administrator) cannot read the OneDrive connection table: the token lives in the function');
SELECT tt.fails($q$DELETE FROM public.files_onedrive_connection_table$q$, 'permission denied', '... nor delete it');
SELECT tt.as_admin();
SET LOCAL ROLE anon;
SELECT tt.fails('SELECT count(*) FROM public.files_onedrive_connection_table', 'permission denied', 'anon cannot read it');
RESET ROLE;

-- ================= 2. the storage of a scope ==================================================================================================================================
SELECT tt.eq(public.files_provider_of_scope('task', 'aaaaaaaa-0000-0000-0000-000000000058'::uuid, :'orga'), 'googleDrive', 'a project without the key is Google Drive (every project made before OneDrive)');
SELECT tt.eq(public.files_provider_of_scope('organization', NULL, :'orga'), 'googleDrive', '... and so is the organization default when missing');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectFilesStorageProvider": "oneDrive"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000058';
SELECT tt.eq(public.files_provider_of_scope('task', 'aaaaaaaa-0000-0000-0000-000000000058'::uuid, :'orga'), 'oneDrive', 'the project setting projectFilesStorageProvider = oneDrive');
SELECT tt.eq(public.files_provider_of_scope('project', 'aaaaaaaa-0000-0000-0000-000000000058'::uuid, :'orga'), 'oneDrive', '... for the project scope too');
SELECT tt.eq(public.files_provider_of_scope('organization', NULL, :'orga'), 'googleDrive', 'but an organization file ignores the project setting');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectFilesStorageProvider": "nonsense"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000058';
SELECT tt.eq(public.files_provider_of_scope('task', 'aaaaaaaa-0000-0000-0000-000000000058'::uuid, :'orga'), 'googleDrive', 'anything but oneDrive is googleDrive');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectFilesStorageProvider": "oneDrive"}' WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000058';
UPDATE public."organizationTable" SET "rowJSON" = jsonb_set("rowJSON", '{defaultProjectSettings}', '{"projectFilesStorageProvider": "oneDrive"}'::jsonb || COALESCE("rowJSON"->'defaultProjectSettings', '{}'::jsonb)) WHERE "rowGUID" = :'orga';
SELECT tt.eq(public.files_provider_of_scope('organization', NULL, :'orga'), 'oneDrive', 'the organization default decides the organization files');
SELECT tt.eq(public.files_provider_of_scope('document', NULL, :'orga'), 'oneDrive', '... and the document files');
SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
SELECT tt.eq(public.files_authorize('add', 'task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058')->>'provider', 'oneDrive', 'files_authorize tells the function the storage of a task file');
SELECT tt.eq(public.files_authorize('add', 'organization')->>'provider', 'oneDrive', '... and of an organization file');
SELECT tt.eq(public.files_authorize('read', 'task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058')->>'allowed', 'true', 'the permissions are the same for both storages');
SELECT tt.as_admin();

-- ================= 3. facts of an organization per storage + the pending upload with a web url ==================================================================================
SET LOCAL ROLE service_role;
SELECT public.files_org_facts(current_setting('tt.orga'))->>'rootFolderId' AS factg1, public.files_org_facts(current_setting('tt.orga'), 'googleDrive')->>'accountEmail' AS factg2,
       (public.files_org_facts(current_setting('tt.orga'), 'oneDrive')->>'rootFolderId') || '|' || (public.files_org_facts(current_setting('tt.orga'), 'oneDrive')->>'accountEmail') AS facto \gset
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '58585858-5858-5858-5858-585858585801', 'od-up-1', jsonb_build_object('provider', 'oneDrive', 'scope', 'task', 'scopeGUID', 'bbbbbbbb-0000-0000-0000-000000000581', 'projectGUID', 'aaaaaaaa-0000-0000-0000-000000000058', 'name', 'plan.pdf', 'mime', 'application/pdf', 'size', 3000, 'folderId', 'OFOLDER', 'relativePath', 'project/p/task/t/files', 'expiresAt', (now() + interval '1 hour')::text));
SELECT public.files_upload_pending_verify('od-up-1', 'OITEM1', 2999, 'OFOLDER', 'project/p/task/t/files', 'https://onedrive.live.com/?id=OITEM1') IS NOT NULL;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '58585858-5858-5858-5858-585858585801', 'g-up-1', jsonb_build_object('scope', 'task', 'scopeGUID', 'bbbbbbbb-0000-0000-0000-000000000581', 'projectGUID', 'aaaaaaaa-0000-0000-0000-000000000058', 'name', 'old.pdf', 'mime', 'application/pdf', 'size', 100, 'folderId', 'GFOLDER', 'relativePath', 'project/p/task/t/files', 'expiresAt', (now() + interval '1 hour')::text));
SELECT public.files_upload_pending_verify('g-up-1', 'GITEM1', 100, 'GFOLDER', 'project/p/task/t/files') IS NOT NULL;
RESET ROLE;
SELECT tt.eq(:'factg1'::text, 'GROOT', 'files_org_facts with one argument is still Google''s');
SELECT tt.eq(:'factg2'::text, 'drive@gmail.test', '... and with googleDrive');
SELECT tt.eq(:'facto'::text, 'OROOT|owner@outlook.test', 'with oneDrive: its root and account');
SELECT tt.eq((SELECT "rowJSON"->>'webUrl' FROM public.files_upload_pending_table WHERE "rowJSON"->>'uploadId' = 'od-up-1'), 'https://onedrive.live.com/?id=OITEM1', 'the verified pending row keeps the web url');
SELECT tt.eq((SELECT "rowJSON"->>'provider' FROM public.files_upload_pending_table WHERE "rowJSON"->>'uploadId' = 'od-up-1'), 'oneDrive', '... and its storage');

-- ================= 4. file rows: a OneDrive row has OneDrive keys only, a Google row is exactly as before =======================================================================
SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
SELECT public.files_add('od-up-1', 'task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058', '{}') AS fo \gset
SELECT tt.eq(:'fo'::jsonb->'rowJSON'->>'fileStorageProvider', 'oneDrive', 'the OneDrive row says its storage');
SELECT tt.eq((:'fo'::jsonb->'rowJSON'->>'oneDriveItemId') || '|' || (:'fo'::jsonb->'rowJSON'->>'oneDriveFolderId') || '|' || (:'fo'::jsonb->'rowJSON'->>'oneDriveRootFolderId'), 'OITEM1|OFOLDER|OROOT', '... item, folder and root of OneDrive');
SELECT tt.eq((:'fo'::jsonb->'rowJSON'->>'oneDriveAccountEmail') || '|' || (:'fo'::jsonb->'rowJSON'->>'oneDriveWebUrl'), 'owner@outlook.test|https://onedrive.live.com/?id=OITEM1', '... the account and the web url');
SELECT tt.eq(:'fo'::jsonb->'rowJSON'->>'mediaPostOrigin', 'https://onedrive.live.com/?id=OITEM1', '... the origin is the web url');
SELECT tt.eq(:'fo'::jsonb->'rowJSON'->>'mediaPostOriginType', 'oneDrive', '... the origin type is oneDrive');
SELECT tt.eq((:'fo'::jsonb->'rowJSON' ? 'googleDriveFileId')::text, 'false', '... and it has NO Google key');
SELECT tt.eq((:'fo'::jsonb->'rowJSON'->>'fileSizeBytes'), '2999', '... the size is the one the function verified');
SELECT public.files_add('g-up-1', 'task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058', '{}') AS fg \gset
SELECT tt.eq((:'fg'::jsonb->'rowJSON'->>'googleDriveFileId') || '|' || (:'fg'::jsonb->'rowJSON'->>'googleDriveFolderId') || '|' || (:'fg'::jsonb->'rowJSON'->>'googleDriveAccountEmail'), 'GITEM1|GFOLDER|drive@gmail.test', 'a Google upload (no provider key in the pending row) is a Google row exactly as before');
SELECT tt.eq((:'fg'::jsonb->'rowJSON'->>'fileStorageProvider') || '|' || (:'fg'::jsonb->'rowJSON'->>'mediaPostOriginType'), 'googleDrive|googleDrive', '... marked googleDrive');
SELECT tt.eq((:'fg'::jsonb->'rowJSON' ? 'oneDriveItemId')::text, 'false', '... with no OneDrive key');
SELECT set_config('tt.fo', :'fo'::jsonb->>'rowGUID', true);
SELECT set_config('tt.fg', :'fg'::jsonb->>'rowGUID', true);

-- ================= 5. storage used counts both, health rows are per storage, move keeps the storage's keys =======================================================================
SELECT tt.eq((public.files_storage_used('organization')->>'files')::int, 2, 'storage used: a Google file and a OneDrive file');
SELECT tt.eq((public.files_storage_used('organization')->>'bytes')::int, 3099, '... 2999 + 100 bytes');
SELECT tt.eq((SELECT jsonb_agg(f->>'fileId') FROM jsonb_array_elements(public.files_health_rows()->'files') f)::text, '["GITEM1"]', 'health rows with no argument = Google''s files only');
SELECT tt.eq((SELECT jsonb_agg(f->>'fileId') FROM jsonb_array_elements(public.files_health_rows('oneDrive')->'files') f)::text, '["OITEM1"]', 'health rows of oneDrive = its files only');
SELECT tt.eq(public.files_health_rows('oneDrive')->>'rootFolderId', 'OROOT', '... and its root');
SELECT tt.as_user('boris@od.test', '58585858-5858-5858-5858-585858585802');
SELECT tt.fails($q$SELECT public.files_health_rows('oneDrive')$q$, 'No permission', 'a plain member cannot run the health rows');
SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
SELECT public.files_move(current_setting('tt.fo'), 'organization', NULL, NULL, 'OFOLDER2', 'organization/files') IS NOT NULL;
SELECT tt.eq((SELECT "rowJSON"->>'oneDriveFolderId' FROM public."mediaPostTable" WHERE "rowGUID" = current_setting('tt.fo')) || '|' || (SELECT "rowJSON"->>'oneDriveRelativePath' FROM public."mediaPostTable" WHERE "rowGUID" = current_setting('tt.fo')), 'OFOLDER2|organization/files', 'move on a OneDrive row sets the OneDrive folder keys');
SELECT tt.eq((SELECT ("rowJSON" ? 'googleDriveFolderId')::text FROM public."mediaPostTable" WHERE "rowGUID" = current_setting('tt.fo')), 'false', '... and no Google key');
SELECT public.files_move(current_setting('tt.fg'), 'organization', NULL, NULL, 'GFOLDER2', 'organization/files') IS NOT NULL;
SELECT tt.eq((SELECT "rowJSON"->>'googleDriveFolderId' FROM public."mediaPostTable" WHERE "rowGUID" = current_setting('tt.fg')), 'GFOLDER2', 'move on a Google row is as before');

-- ================= 6. delete: the queue line knows the storage ==================================================================================================================
SELECT public.files_delete(current_setting('tt.fo')) IS NOT NULL;
SELECT public.files_delete(current_setting('tt.fg')) IS NOT NULL;
SELECT tt.as_admin();
SELECT tt.eq((SELECT "rowJSON"->>'provider' FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'driveItemId' = 'OITEM1'), 'oneDrive', 'the line of the OneDrive file says oneDrive');
SELECT tt.eq((SELECT "rowJSON"->>'provider' FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'driveItemId' = 'GITEM1'), 'googleDrive', '... the Google file googleDrive');
SET LOCAL ROLE service_role;
SELECT (SELECT jsonb_agg(l->>'provider' ORDER BY l->>'driveItemId') FROM jsonb_array_elements(public.files_cleanup_pending(10)) l)::text AS pend \gset
RESET ROLE;
SELECT tt.eq(:'pend'::text, '["googleDrive", "oneDrive"]', 'files_cleanup_pending hands the function the storage of every line');
SELECT public.files_queue(:'orga', 'X1', 'file', 'old call') ;
SELECT tt.eq((SELECT "rowJSON"->>'provider' FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'driveItemId' = 'X1'), 'googleDrive', 'files_queue with five arguments is still Google''s');

-- ================= 7. the delete triggers queue per storage ====================================================================================================================
SELECT tt.as_user('anna@od.test', '58585858-5858-5858-5858-585858585801');
SELECT public.files_add_link('task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058', 'https://youtu.be/q') IS NOT NULL;
SELECT tt.as_admin();
-- one file row of each storage on the task + one folder row of each storage
INSERT INTO public."mediaPostTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('trg-od', :'orga', 'bbbbbbbb-0000-0000-0000-000000000581', '{"fileSourceKind": "task", "fileStorageProvider": "oneDrive", "oneDriveItemId": "TRG-OD", "fileName": "a"}'),
  ('trg-g',  :'orga', 'bbbbbbbb-0000-0000-0000-000000000581', '{"fileSourceKind": "task", "googleDriveFileId": "TRG-G", "fileName": "b"}');
INSERT INTO public.files_folder_table ("rowOwnerGUID", "rowJSON") VALUES
  (:'orga', '{"scopeKey": "task:bbbbbbbb-0000-0000-0000-000000000581", "driveFolderId": "TF-G", "driveFilesFolderId": "TFF-G"}'),
  (:'orga', '{"scopeKey": "oneDrive:task:bbbbbbbb-0000-0000-0000-000000000581", "driveFolderId": "TF-O", "driveFilesFolderId": "TFF-O", "provider": "oneDrive"}');
DELETE FROM public.project_task_table WHERE "rowGUID" = 'bbbbbbbb-0000-0000-0000-000000000581';
SELECT tt.eq((SELECT string_agg(("rowJSON"->>'driveItemId') || ':' || ("rowJSON"->>'provider'), ',' ORDER BY "rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table WHERE "rowJSON"->>'why' = 'task deleted'), 'TF-G:googleDrive,TF-O:oneDrive,TRG-G:googleDrive,TRG-OD:oneDrive', 'deleting a task queues its files and its folders, each with its storage');
SELECT tt.eq((SELECT count(*) FROM public.files_folder_table), 0::bigint, '... and the folder rows of both storages go');
SELECT tt.eq((SELECT count(*) FROM public."mediaPostTable" WHERE "rowJSON" ? 'fileSourceKind'), 0::bigint, '... and the file rows');

-- the organization: the root of EACH storage is queued (allowRoot)
SELECT public.organization_ensure_user('dora@od2.test', '58585858-5858-5858-5858-585858585803', 'Dora', 'O') AS dora \gset
SELECT :'dora'::jsonb->>'organizationGUID' AS orgb \gset
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"organizationGoogleDriveRootFolderId": "BG", "organizationOneDriveRootFolderId": "BO"}' WHERE "rowGUID" = :'orgb';
DELETE FROM public."organizationTable" WHERE "rowGUID" = :'orgb';
SELECT tt.eq((SELECT string_agg(("rowJSON"->>'driveItemId') || ':' || ("rowJSON"->>'provider') || ':' || ("rowJSON"->>'allowRoot'), ',' ORDER BY "rowJSON"->>'driveItemId') FROM public.files_drive_cleanup_table WHERE "rowOwnerGUID" = :'orgb'), 'BG:googleDrive:true,BO:oneDrive:true', 'deleting an organization queues the root of Google AND of OneDrive');

-- ================= 8. the pending verify keeps working with the old five arguments ==========================================================================================
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(:'orga', 'u', 'old-5', '{"scope": "organization", "name": "n"}'::jsonb);
SELECT (public.files_upload_pending_verify('old-5', 'F', 1, 'D', 'P')->>'state') AS v5 \gset
RESET ROLE;
SELECT tt.eq(:'v5'::text, 'verified', 'files_upload_pending_verify with five arguments is still valid (no web url)');
ROLLBACK;
