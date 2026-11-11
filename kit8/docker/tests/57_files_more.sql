-- PART 49, third slice: document types (S5), replace + versions (S4), move (S7), storage used (S8), health rows (S1), delete_row_only.
BEGIN;
SELECT tt.as_admin();
GRANT USAGE ON SCHEMA tt TO service_role;
SELECT public.organization_ensure_user('anna@more.test', '57575757-5757-5757-5757-575757575701', 'Anna', 'M') AS anna \gset
SELECT :'anna'::jsonb->>'organizationGUID' AS orga \gset
SELECT set_config('tt.orga', :'orga', true);
SELECT public.organization_ensure_user('boris@more.test', '57575757-5757-5757-5757-575757575702', 'Boris', 'M');
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
INSERT INTO public."organizationMemberTable" ("rowOwnerGUID", "rowJSON") VALUES (:'orga', '{"userEmailForInvitation": "boris@more.test"}');
SELECT tt.as_admin();
UPDATE public."userTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('userOrganization', :'orga') WHERE "rowOwnerGUID" = 'boris@more.test';
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000057', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000057'), '57575757-5757-5757-5757-575757575701', '{"name": "P57"}'),
  ('aaaaaaaa-0000-0000-0000-000000000058', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000058'), '57575757-5757-5757-5757-575757575701', '{"name": "P58"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-0000-0000-000000000571', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000057') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000571'), 'aaaaaaaa-0000-0000-0000-000000000057', '57575757-5757-5757-5757-575757575701', '{"taskDescription": "T1"}'),
  ('bbbbbbbb-0000-0000-0000-000000000581', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000058') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000581'), 'aaaaaaaa-0000-0000-0000-000000000058', '57575757-5757-5757-5757-575757575701', '{"taskDescription": "T2"}');

-- ================= S5 document types ==========================================================================================================================================
SELECT tt.as_admin();
SELECT tt.as_user('boris@more.test', '57575757-5757-5757-5757-575757575702');
SELECT tt.eq((SELECT count(*) FROM public.files_document_type_catalog), 9::bigint, 'a member reads the 9 seeded document types (start4)');
SELECT tt.fails($q$INSERT INTO public.files_document_type_catalog ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"title": "Mine"}')$q$, 'row-level security', 'a plain member cannot add a type');
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
INSERT INTO public.files_document_type_catalog ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('own-1', :'orga', '{"title": "Permit"}');
SELECT tt.eq((SELECT count(*) FROM public.files_document_type_catalog), 10::bigint, 'the administrator adds a type of the organization');
SELECT tt.fails($q$INSERT INTO public.files_document_type_catalog ("rowOwnerGUID", "rowJSON") VALUES ('empty', '{"title": "Global"}')$q$, 'row-level security', '... but not a seeded one (owner empty)');
SELECT tt.eq(tt.rows_of($q$UPDATE public.files_document_type_catalog SET "rowJSON" = '{"title": "X"}' WHERE "rowGUID" = 'filesTypeContract'$q$), 0::bigint, '... and cannot change a seeded type');
SELECT tt.fails($q$INSERT INTO public.files_document_type_catalog ("rowOwnerGUID", "rowJSON") VALUES (current_setting('tt.orga'), '{"title": "permit"}')$q$, 'duplicate key', 'one title once per organization (case does not matter)');
SELECT tt.eq(public.files_document_type_ok('filesTypeContract', current_setting('tt.orga')), true, 'files_document_type_ok: a seeded type');
SELECT tt.eq(public.files_document_type_ok('nope', current_setting('tt.orga')), false, '... an unknown type');
SELECT tt.eq(public.files_document_type_ok('', current_setting('tt.orga')), true, '... no type is fine');

-- ================= a file with a document type; replace + versions ===========================================================================================================
SELECT tt.as_admin();
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '57575757-5757-5757-5757-575757575701', 'u1', jsonb_build_object('scope', 'task', 'scopeGUID', 'bbbbbbbb-0000-0000-0000-000000000571', 'projectGUID', 'aaaaaaaa-0000-0000-0000-000000000057', 'name', 'a.txt', 'mime', 'text/plain', 'size', 100, 'expiresAt', (now() + interval '1 hour')));
SELECT public.files_upload_pending_verify('u1', 'F1', 100, 'FOLDER', 'p') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
SELECT tt.fails($q$SELECT public.files_add('u1', 'task', 'bbbbbbbb-0000-0000-0000-000000000571', 'aaaaaaaa-0000-0000-0000-000000000057', '{"documentTypeGUID": "nope"}')$q$, 'no such document type', 'a file cannot get an unknown type');
SELECT public.files_add('u1', 'task', 'bbbbbbbb-0000-0000-0000-000000000571', 'aaaaaaaa-0000-0000-0000-000000000057', '{"documentTypeGUID": "filesTypeContract"}') AS f \gset
SELECT set_config('tt.f', :'f'::jsonb->>'rowGUID', true);
SELECT tt.eq(:'f'::jsonb->'rowJSON'->>'fileDocumentTypeGUID', 'filesTypeContract', 'the file has its type');
SELECT tt.eq(public.files_update(current_setting('tt.f'), '{"fileDocumentTypeGUID": "own-1"}')->'rowJSON'->>'fileDocumentTypeGUID', 'own-1', 'the type can be changed');
SELECT tt.fails(format($q$SELECT public.files_update(%L, '{"fileDocumentTypeGUID": "nope"}')$q$, current_setting('tt.f')), 'no such document type', '... not to an unknown one');
SELECT tt.eq(public.files_storage_used('organization')->>'bytes', '100', 'storage used: 100 bytes, one file');
-- the new version
SELECT tt.as_admin();
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_add(current_setting('tt.orga'), '57575757-5757-5757-5757-575757575701', 'u2', jsonb_build_object('replaceOf', current_setting('tt.f'), 'scope', 'task', 'scopeGUID', 'bbbbbbbb-0000-0000-0000-000000000571', 'projectGUID', 'aaaaaaaa-0000-0000-0000-000000000057', 'name', 'a2.txt', 'mime', 'text/plain', 'size', 300, 'oldRevisionId', 'REV1', 'expiresAt', (now() + interval '1 hour')));
RESET ROLE;
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
SELECT tt.fails(format($q$SELECT public.files_replace('u2', %L)$q$, current_setting('tt.f')), 'not finished', 'replace needs the verified new version');
SELECT tt.as_admin();
SET LOCAL ROLE service_role;
SELECT public.files_upload_pending_verify('u2', 'F1', 300, 'FOLDER', 'p') IS NOT NULL;
RESET ROLE;
SELECT tt.as_user('boris@more.test', '57575757-5757-5757-5757-575757575702');
SELECT tt.fails(format($q$SELECT public.files_replace('u2', %L)$q$, current_setting('tt.f')), 'No permission', 'a plain member cannot replace');
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
SELECT public.files_replace('u2', current_setting('tt.f')) AS r \gset
SELECT tt.eq((:'r'::jsonb->'rowJSON'->>'fileVersionNumber') || '|' || (:'r'::jsonb->'rowJSON'->>'fileSizeBytes') || '|' || (:'r'::jsonb->'rowJSON'->>'fileName'), '2|300|a2.txt', 'replace: version 2, the new size and name');
SELECT tt.eq(:'r'::jsonb->'rowJSON'->>'googleDriveFileId', 'F1', '... the Drive id does not change');
SELECT tt.eq(public.files_versions_list(current_setting('tt.f'))->0->'rowJSON'->>'driveRevisionId', 'REV1', 'the old version is in the history with its Drive revision');
SELECT tt.eq((public.files_versions_list(current_setting('tt.f'))->0->'rowJSON'->>'fileSizeBytes'), '100', '... with its old size');
SELECT tt.eq(public.files_storage_used('organization')->>'totalBytes', '400', 'storage used counts the old version too (300 + 100)');
SELECT tt.eq(public.files_storage_used('project', 'aaaaaaaa-0000-0000-0000-000000000057')->>'bytes', '300', '... per project');
SELECT tt.as_user('boris@more.test', '57575757-5757-5757-5757-575757575702');
SELECT tt.eq(jsonb_array_length(public.files_versions_list(current_setting('tt.f'))), 1, 'a member reads the history');

-- ================= S7 move ==================================================================================================================================================
SELECT tt.fails(format($q$SELECT public.files_move(%L, 'project', 'aaaaaaaa-0000-0000-0000-000000000058', NULL, 'F2', 'x')$q$, current_setting('tt.f')), 'No permission', 'a plain member cannot move');
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
SELECT public.files_move(current_setting('tt.f'), 'task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058', 'F2', 'project/58/task/T2/files') AS mv \gset
SELECT tt.eq((:'mv'::jsonb->>'rowParentGUID') || '|' || (:'mv'::jsonb->'rowJSON'->>'fileSourceProjectGUID') || '|' || (:'mv'::jsonb->'rowJSON'->>'googleDriveFolderId'), 'bbbbbbbb-0000-0000-0000-000000000581|aaaaaaaa-0000-0000-0000-000000000058|F2', 'moved to the task of another project: parent, project, Drive folder');
SELECT tt.eq(jsonb_array_length(public.files_list('task', 'bbbbbbbb-0000-0000-0000-000000000571', 'aaaaaaaa-0000-0000-0000-000000000057')), 0, 'the old task has no file now');
SELECT tt.eq(jsonb_array_length(public.files_list('task', 'bbbbbbbb-0000-0000-0000-000000000581', 'aaaaaaaa-0000-0000-0000-000000000058')), 1, '... the new task has it');
SELECT tt.eq((public.files_move(current_setting('tt.f'), 'organization', NULL, NULL, 'F3', 'organization/files')->>'rowParentGUID'), current_setting('tt.orga'), 'moved to the organization itself: the parent is the organization');
SELECT tt.fails(format($q$SELECT public.files_move(%L, 'task', 'bbbbbbbb-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000058', 'x', 'x')$q$, current_setting('tt.f')), 'No permission', 'a task that is not in the project is refused');

-- ================= S1 health rows + delete_row_only ==========================================================================================================================
SELECT public.files_health_rows() AS h \gset
SELECT tt.eq(jsonb_array_length(:'h'::jsonb->'files'), 1, 'health rows: the file with a Drive id');
SELECT tt.eq(:'h'::jsonb->'files'->0->>'fileId', 'F1', '... and its id');
SELECT tt.as_user('boris@more.test', '57575757-5757-5757-5757-575757575702');
SELECT tt.fails('SELECT public.files_health_rows()', 'No permission', 'a plain member gets no health rows');
SELECT tt.fails(format($q$SELECT public.files_delete_row_only(%L)$q$, current_setting('tt.f')), 'No permission', '... and cannot delete a row only');
SELECT tt.as_user('anna@more.test', '57575757-5757-5757-5757-575757575701');
SELECT public.files_delete_row_only(current_setting('tt.f'));
SELECT tt.eq(jsonb_array_length(public.files_list('organization')), 0, 'the row of a lost Drive file is deleted');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.files_drive_cleanup_table), 0::bigint, '... and nothing is queued (the file is already gone)');
ROLLBACK;
