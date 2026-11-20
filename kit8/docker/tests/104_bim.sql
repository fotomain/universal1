-- PART 55: BIM (documentation/BIM_WBS.html). The bim_ tables are READ by the members of the project (RLS) and written ONLY by the bim_import_* / bim_delete_model RPCs; the key
-- projectIsBIMBased of the project is a plain switch of the user (the import sets it); the chunk files are queued for removal when their rows go; the Storage policies are made by bim_storage_setup().
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('boris@acme.test', '33333333-3333-3333-3333-333333333333', 'Boris', 'B');
SELECT public.organization_ensure_user('clara@out.test', '44444444-4444-4444-4444-444444444444', 'Clara', 'C');
-- an empty project of Anna (the BIM target) and a project with a plain task
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES
  ('aabd1dde-97e6-4359-97e4-0efcb847589b', public.pm_ltree_label('aabd1dde-97e6-4359-97e4-0efcb847589b'), '11111111-1111-1111-1111-111111111111', '{"name":"BIM target","projectStartAt":"2026-11-23T00:00:00.000Z"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', public.pm_ltree_label('bbbbbbbb-0000-4000-8000-000000000002'), '11111111-1111-1111-1111-111111111111', '{"name":"Plain project"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON") VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000a1', public.pm_ltree_label('bbbbbbbb-0000-4000-8000-000000000002') || public.pm_ltree_label('bbbbbbbb-0000-4000-8000-0000000000a1'), 'bbbbbbbb-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', '{"rowKind":"task","taskDescription":"Plain task"}');
INSERT INTO public.project_permission_profile_user_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON")
  VALUES ('ppu-bim-1', 'aabd1dde-97e6-4359-97e4-0efcb847589b', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionProjectReadOnly"}');

-- the tasks of the model: stage S1 (task T1, T2), stage S2 (task T3); made by the file import in real life (project_import_tasks)
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.project_import_tasks('aabd1dde-97e6-4359-97e4-0efcb847589b', jsonb_build_array(
  jsonb_build_object('rowGUID','cccccccc-0000-4000-8000-0000000000a1','treePath', public.pm_ltree_label('aabd1dde-97e6-4359-97e4-0efcb847589b')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000a1')::text,'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',1024,'rowJSON','{"rowKind":"stage","taskDescription":"L1","bimStoreyGuid":"ST1"}'::jsonb),
  jsonb_build_object('rowGUID','cccccccc-0000-4000-8000-0000000000a2','treePath', public.pm_ltree_label('aabd1dde-97e6-4359-97e4-0efcb847589b')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000a2')::text,'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',2048,'rowJSON','{"rowKind":"stage","taskDescription":"L2","bimStoreyGuid":"ST2"}'::jsonb),
  jsonb_build_object('rowGUID','cccccccc-0000-4000-8000-0000000000b1','treePath', public.pm_ltree_label('aabd1dde-97e6-4359-97e4-0efcb847589b')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000a1')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000b1')::text,'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',1024,'rowJSON','{"rowKind":"task","taskDescription":"Wall A","durationDays":1,"manualStartAt":"2026-11-23T00:00:00.000Z","bimIfcGuid":"EL_A"}'::jsonb),
  jsonb_build_object('rowGUID','cccccccc-0000-4000-8000-0000000000b2','treePath', public.pm_ltree_label('aabd1dde-97e6-4359-97e4-0efcb847589b')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000a1')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000b2')::text,'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',2048,'rowJSON','{"rowKind":"task","taskDescription":"Doors (2)","durationDays":1,"manualStartAt":"2026-11-24T00:00:00.000Z","bimGroupKey":"g1"}'::jsonb),
  jsonb_build_object('rowGUID','cccccccc-0000-4000-8000-0000000000b3','treePath', public.pm_ltree_label('aabd1dde-97e6-4359-97e4-0efcb847589b')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000a2')::text||'.'||public.pm_ltree_label('cccccccc-0000-4000-8000-0000000000b3')::text,'rowOwnerGUID','11111111-1111-1111-1111-111111111111','orderInList',1024,'rowJSON','{"rowKind":"task","taskDescription":"Wall C","durationDays":1,"manualStartAt":"2026-11-25T00:00:00.000Z","bimIfcGuid":"EL_C"}'::jsonb)
));
-- (the import above ran on a project with tasks that is NOT a BIM project yet: begin must refuse it)
SELECT tt.fails($q$SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'x.ifc')$q$, 'not a BIM project', 'a project with tasks that is not a BIM project is refused');
SELECT tt.as_admin();
-- ... so the test starts from the state after a file import: make the tasks of the model go and bring them back after the begin (the real flow: begin first, import the tasks, then rows + commit)
CREATE TEMP TABLE tmp_t AS SELECT * FROM public.project_task_table WHERE "projectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b';
DELETE FROM public.project_task_table WHERE "projectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b';

-- 1. who may begin ------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('clara@out.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.fails($q$SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'x.ifc')$q$, 'permission', 'a stranger cannot begin an import');
SELECT tt.as_user('boris@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails($q$SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'x.ifc')$q$, 'permission', 'a read only member cannot begin an import');
SELECT tt.fails($q$INSERT INTO public.bim_model_table ("rowProjectGUID", "storagePrefix") VALUES ('aabd1dde-97e6-4359-97e4-0efcb847589b', 'x')$q$, 'permission denied', 'a client cannot write the table');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT public.bim_import_begin('bbbbbbbb-0000-4000-8000-000000000002', 'x.ifc')$q$, 'not a BIM project', 'a plain project with tasks is refused (Q10)');
SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'first.ifc', 'abc', '{"granularity":"auto"}') AS b1 \gset
SELECT (:'b1'::jsonb->>'modelGUID') AS m1, (:'b1'::jsonb->>'storagePrefix') AS pre1 \gset
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'m1'), 'importing', 'the model is importing');
SELECT tt.eq((SELECT "revision" FROM public.bim_model_table WHERE "rowGUID" = :'m1'), 1, 'revision 1');
SELECT tt.eq(:'pre1', 'aabd1dde-97e6-4359-97e4-0efcb847589b/' || :'m1', 'the storage prefix is project/model');
-- a second begin drops the unfinished first one
SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'second.ifc') AS b2 \gset
SELECT (:'b2'::jsonb->>'modelGUID') AS m2, (:'b2'::jsonb->>'storagePrefix') AS pre2 \gset
SELECT tt.eq((SELECT count(*) FROM public.bim_model_table WHERE "rowProjectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 1::bigint, 'the unfinished import was dropped');
SELECT tt.eq((SELECT "revision" FROM public.bim_model_table WHERE "rowGUID" = :'m2'), 1, 'the number is counted again after the unfinished one went: revision 1');

-- 2. the tasks come (the importer), then the rows ---------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
INSERT INTO public.project_task_table SELECT * FROM tmp_t ORDER BY nlevel("treePath");
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(public.bim_import_add_rows(:'m2', 'storeys', jsonb_build_array(
  jsonb_build_object('ifcGuid','ST1','name','L1','elevation',0,'orderInList',1,'stageGUID','cccccccc-0000-4000-8000-0000000000a1'),
  jsonb_build_object('ifcGuid','ST2','name','L2','elevation',3,'orderInList',2,'stageGUID','cccccccc-0000-4000-8000-0000000000a2'))), 2, 'two storeys');
SELECT tt.fails(format($q$SELECT public.bim_import_add_rows(%L, 'chunks', '[{"storeyIfcGuid":"ST1","contentHash":"h1","storagePath":"elsewhere/h1.bimc"}]'::jsonb)$q$, :'m2'), 'outside the model folder', 'a chunk path outside the model folder is refused');
SELECT tt.eq(public.bim_import_add_rows(:'m2', 'chunks', jsonb_build_array(
  jsonb_build_object('storeyIfcGuid','ST1','contentHash','h1','part',0,'byteSize',1000,'vertexCount',24,'elementCount',3,'bboxMin','[0,0,0]'::jsonb,'bboxSize','[5,3,1]'::jsonb,'storagePath', :'pre2' || '/h1.bimc'),
  jsonb_build_object('storeyIfcGuid','ST2','contentHash','h2','part',0,'byteSize',500,'vertexCount',8,'elementCount',1,'bboxMin','[0,3,0]'::jsonb,'bboxSize','[5,3,1]'::jsonb,'storagePath', :'pre2' || '/h2.bimc'))), 2, 'two chunks');
SELECT tt.fails(format($q$SELECT public.bim_import_add_rows(%L, 'elements', '[{"ifcGuid":"EL_X","chunkHash":"h1","taskGUID":"bbbbbbbb-0000-4000-8000-0000000000a1"}]'::jsonb)$q$, :'m2'), 'not in the project', 'an element pointing to a task of ANOTHER project is refused');
SELECT tt.eq(public.bim_import_add_rows(:'m2', 'elements', jsonb_build_array(
  jsonb_build_object('ifcGuid','EL_A','ifcClass','IfcWall','name','Wall A','storeyIfcGuid','ST1','taskGUID','cccccccc-0000-4000-8000-0000000000b1','chunkHash','h1','elementNumber',0,'bbox','[0,0,0,5,3,0.2]'::jsonb),
  jsonb_build_object('ifcGuid','EL_D1','ifcClass','IfcDoor','name','Door 1','typeName','Door 900','storeyIfcGuid','ST1','taskGUID','cccccccc-0000-4000-8000-0000000000b2','chunkHash','h1','elementNumber',1,'bbox','[1,0,0,2,2,0.1]'::jsonb),
  jsonb_build_object('ifcGuid','EL_D2','ifcClass','IfcDoor','name','Door 2','typeName','Door 900','storeyIfcGuid','ST1','taskGUID','cccccccc-0000-4000-8000-0000000000b2','chunkHash','h1','elementNumber',2,'bbox','[3,0,0,4,2,0.1]'::jsonb),
  jsonb_build_object('ifcGuid','EL_C','ifcClass','IfcWall','name','Wall C','storeyIfcGuid','ST2','taskGUID','cccccccc-0000-4000-8000-0000000000b3','chunkHash','h2','elementNumber',0,'bbox','[0,3,0,5,6,0.2]'::jsonb))), 4, 'four elements');
SELECT tt.eq(public.bim_import_add_rows(:'m2', 'properties', jsonb_build_array(jsonb_build_object('ifcGuid','EL_A','rowJSON','{"sets":{"Pset_WallCommon":{"IsExternal":true}}}'::jsonb))), 1, 'one property row');
SELECT tt.fails(format($q$SELECT public.bim_import_commit(%L, '{"elements": 5}')$q$, :'m2'), 'not the rows announced', 'a wrong count refuses the commit');
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'m2'), 'importing', 'a refused commit leaves the model importing');
SELECT tt.eq(public.bim_import_commit(:'m2', '{"storeys":2,"chunks":2,"elements":4,"properties":1}', '{"ifcSchema":"IFC4","unitScale":0.3048,"converterVersion":"bim-converter-1","bbox":[-1,0,-1,1,6,1],"originShift":[1,2,3]}')->'counts'->>'tasks', '3', 'commit: 3 tasks have elements');
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'m2'), 'ready', 'the model is ready');
SELECT tt.eq((SELECT "unitScale" FROM public.bim_model_table WHERE "rowGUID" = :'m2'), 0.3048::numeric, 'the facts of the converter are kept');
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 'true', 'the project is BIM based');
SELECT tt.eq((SELECT "state" FROM public.bim_import_job_table WHERE "rowModelGUID" = :'m2'), 'done', 'the job is done');
SELECT tt.fails(format($q$SELECT public.bim_import_add_rows(%L, 'elements', '[]'::jsonb)$q$, :'m2'), 'not open for you', 'a finished import takes no more rows');

-- 3. projectIsBIMBased is a switch of the user (always switchable) ---------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM pg_trigger WHERE tgname = 'ab_project_bim'), 0::bigint, 'no guard trigger: the key is the user''s switch');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectIsBIMBased": false, "name": "Renamed"}' WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b';
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' || '|' || ("rowJSON"->>'name') FROM public.project_table WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 'false|Renamed', 'the owner switches it off');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectIsBIMBased": true}' WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b';
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 'true', 'and on again');
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectIsBIMBased": true}' WHERE "rowGUID" = 'bbbbbbbb-0000-4000-8000-000000000002';
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = 'bbbbbbbb-0000-4000-8000-000000000002'), 'true', 'also on a project that has no model (the BIM button shows, the view says "no model")');
-- the switch on a project with tasks and no model lets an import replace its tasks (the app asks first)
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectIsBIMBased": false}' WHERE "rowGUID" = 'bbbbbbbb-0000-4000-8000-000000000002';
SELECT tt.fails($q$SELECT public.bim_import_begin('bbbbbbbb-0000-4000-8000-000000000002', 'x.ifc')$q$, 'not a BIM project', 'switched off + tasks = an import is still refused');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES ('bbbbbbbb-0000-4000-8000-000000000003', public.pm_ltree_label('bbbbbbbb-0000-4000-8000-000000000003'), '11111111-1111-1111-1111-111111111111', '{"name":"Copy"}');
SELECT tt.as_admin();

-- 4. reads ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table), 4::bigint, 'a read only member sees the elements');
SELECT tt.eq(public.bim_model_manifest('aabd1dde-97e6-4359-97e4-0efcb847589b')->'model'->>'revision', '1', 'the manifest of a member');
SELECT tt.eq(jsonb_array_length(public.bim_model_manifest('aabd1dde-97e6-4359-97e4-0efcb847589b')->'chunks'), 2, 'the manifest lists the chunks');
SELECT tt.eq(jsonb_array_length(public.bim_model_manifest('aabd1dde-97e6-4359-97e4-0efcb847589b')->'storeys'), 2, 'the manifest lists the storeys');
SELECT public.bim_elements_page(:'m2', NULL, 3) AS pg1 \gset
SELECT tt.eq(jsonb_array_length(:'pg1'::jsonb->'rows'), 3, 'a page of 3 elements');
SELECT tt.eq((:'pg1'::jsonb->>'next') IS NOT NULL, true, 'and a key for the next page');
SELECT public.bim_elements_page(:'m2', (:'pg1'::jsonb->>'next')::uuid, 3) AS pg2 \gset
SELECT tt.eq(jsonb_array_length(:'pg2'::jsonb->'rows'), 1, 'the last page has 1 element');
SELECT tt.eq((:'pg2'::jsonb->>'next') IS NULL, true, 'and no next key');
SELECT tt.eq(public.bim_property_get(:'m2', 'EL_A')->'sets'->'Pset_WallCommon'->>'IsExternal', 'true', 'the properties of one element');
SELECT tt.eq(public.bim_elements_of_task('aabd1dde-97e6-4359-97e4-0efcb847589b', 'cccccccc-0000-4000-8000-0000000000b2'), '["EL_D1", "EL_D2"]'::jsonb, 'the elements of a grouped task');
SELECT tt.eq(jsonb_array_length(public.bim_elements_of_task('aabd1dde-97e6-4359-97e4-0efcb847589b', 'cccccccc-0000-4000-8000-0000000000a1')), 3, 'the elements of a stage = of its tasks');
SELECT tt.eq(public.bim_task_of_element(:'m2', 'EL_C')->>'taskGUID', 'cccccccc-0000-4000-8000-0000000000b3', 'the task of an element');
SELECT tt.eq(public.bim_task_of_element(:'m2', 'EL_C')->>'stageGUID', 'cccccccc-0000-4000-8000-0000000000a2', 'and its stage');
SELECT tt.as_user('clara@out.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table), 0::bigint, 'a stranger sees no element');
SELECT tt.eq((SELECT count(*) FROM public.bim_model_table), 0::bigint, 'a stranger sees no model');
SELECT tt.fails($q$SELECT public.bim_model_manifest('aabd1dde-97e6-4359-97e4-0efcb847589b')$q$, 'No permission', 'a stranger gets no manifest');
SELECT tt.fails(format($q$SELECT public.bim_elements_page(%L)$q$, :'m2'), 'No permission', 'a stranger gets no elements');

-- 5. an element whose task is deleted loses the link only; a template does not take the keys -------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.eq(public.task_template_clean_task('{"taskDescription":"x","bimIfcGuid":"A","bimGroupKey":"g","bimStoreyGuid":"S","bimIfcClass":"IfcWall"}'::jsonb), '{"taskDescription":"x"}'::jsonb, 'a template does not carry the BIM keys');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
DELETE FROM public.project_task_table WHERE "rowGUID" = 'cccccccc-0000-4000-8000-0000000000b3';
SELECT tt.eq((SELECT "taskGUID" IS NULL FROM public.bim_element_table WHERE "ifcGuid" = 'EL_C'), true, 'a deleted task leaves its element without a task');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table), 4::bigint, 'the element stays');

-- 6. read-only project ----------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.project_set_readonly('aabd1dde-97e6-4359-97e4-0efcb847589b', true);
SELECT tt.fails($q$SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'ro.ifc')$q$, 'Read-only project', 'a read-only project takes no import');
SELECT tt.fails($q$SELECT public.bim_delete_model('aabd1dde-97e6-4359-97e4-0efcb847589b')$q$, 'Read-only project', 'and no removal of its BIM data');
SELECT public.project_set_readonly('aabd1dde-97e6-4359-97e4-0efcb847589b', false);

-- 7. a second import replaces the first (revision 2); the files of the old model are queued -------------------------------------------------------------------------
SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'third.ifc') AS b3 \gset
SELECT (:'b3'::jsonb->>'modelGUID') AS m3, (:'b3'::jsonb->>'storagePrefix') AS pre3 \gset
SELECT tt.eq((SELECT count(*) FROM public.bim_model_table WHERE "state" = 'ready'), 1::bigint, 'the old model is still the ready one while the new one imports');
SELECT public.bim_import_add_rows(:'m3', 'storeys', jsonb_build_array(jsonb_build_object('ifcGuid','ST1','name','L1','elevation',0,'orderInList',1,'stageGUID','cccccccc-0000-4000-8000-0000000000a1')));
SELECT public.bim_import_add_rows(:'m3', 'chunks', jsonb_build_array(jsonb_build_object('storeyIfcGuid','ST1','contentHash','h3','byteSize',10,'storagePath', :'pre3' || '/h3.bimc')));
SELECT public.bim_import_add_rows(:'m3', 'elements', jsonb_build_array(jsonb_build_object('ifcGuid','EL_A','ifcClass','IfcWall','storeyIfcGuid','ST1','taskGUID','cccccccc-0000-4000-8000-0000000000b1','chunkHash','h3','elementNumber',0)));
SELECT public.bim_import_commit(:'m3', '{"storeys":1,"chunks":1,"elements":1}');
SELECT tt.eq((SELECT count(*) FROM public.bim_model_table WHERE "rowProjectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 1::bigint, 'only the new model is left');
SELECT tt.eq((SELECT "revision" FROM public.bim_model_table WHERE "state" = 'ready' AND "rowProjectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 2, 'revision 2 is the ready one');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table WHERE "rowProjectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 1::bigint, 'the rows of the old model went (cascade)');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.bim_storage_cleanup_table WHERE "storagePath" IN (:'pre2' || '/h1.bimc', :'pre2' || '/h2.bimc')), 2::bigint, 'the two files of the old model are queued for removal');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq(jsonb_array_length(public.bim_storage_cleanup_pending()), 2, 'the owner sees what waits');
SELECT tt.eq(public.bim_storage_cleanup_confirm(ARRAY[:'pre2' || '/h1.bimc', :'pre2' || '/h2.bimc']), 2, 'and confirms the removal');
SELECT tt.as_user('clara@out.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq(public.bim_storage_cleanup_confirm(ARRAY['aabd1dde-97e6-4359-97e4-0efcb847589b/zzz/none.bimc']), 0, 'a stranger confirms nothing');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 8. a failed import leaves no rows and queues the uploaded files ------------------------------------------------------------------------------------------------------------
SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'bad.ifc') AS b4 \gset
SELECT (:'b4'::jsonb->>'modelGUID') AS m4, (:'b4'::jsonb->>'storagePrefix') AS pre4 \gset
SELECT public.bim_import_add_rows(:'m4', 'storeys', jsonb_build_array(jsonb_build_object('ifcGuid','ST1','name','L1','elevation',0,'orderInList',1)));
SELECT public.bim_import_fail(:'m4', 'the importer broke', ARRAY[:'pre4' || '/up1.bimc', 'elsewhere/up2.bimc']);
SELECT tt.eq((SELECT "state" || ':' || "errorText" FROM public.bim_model_table WHERE "rowGUID" = :'m4'), 'failed:the importer broke', 'the model is failed with the text');
SELECT tt.eq((SELECT count(*) FROM public.bim_storey_table WHERE "rowModelGUID" = :'m4'), 0::bigint, 'its partial rows are gone');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.bim_storage_cleanup_table WHERE "storagePath" = :'pre4' || '/up1.bimc'), 1::bigint, 'the uploaded file is queued');
SELECT tt.eq((SELECT count(*) FROM public.bim_storage_cleanup_table WHERE "storagePath" = 'elsewhere/up2.bimc'), 0::bigint, 'a path outside the model folder is not queued');
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 'true', 'the project stays BIM based through a failed re-import');
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'m3'), 'ready', 'and the ready model is untouched');

-- 9. storage: the helpers and bim_storage_setup() on a stub of the Storage schema ---------------------------------------------------------------------------------------------
SELECT tt.eq(public.bim_storage_project('aabd1dde-97e6-4359-97e4-0efcb847589b/x/y.bimc'), 'aabd1dde-97e6-4359-97e4-0efcb847589b'::uuid, 'the project of a path');
SELECT tt.eq(public.bim_storage_project('not-a-guid/x.bimc') IS NULL, true, 'a path with no project');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.bim_import_begin('aabd1dde-97e6-4359-97e4-0efcb847589b', 'up.ifc') AS b5 \gset
SELECT (:'b5'::jsonb->>'storagePrefix') AS pre5 \gset
SELECT tt.eq(public.bim_storage_upload_ok(:'pre5' || '/' || repeat('a', 64) || '.bimc'), true, 'the owner of an open import may upload into its folder');
SELECT tt.eq(public.bim_storage_upload_ok(:'pre3' || '/' || repeat('a', 64) || '.bimc'), false, 'not into the folder of a finished model');
SELECT tt.eq(public.bim_storage_upload_ok(:'pre5' || '/notahash.bimc'), false, 'the name must be a sha256');
SELECT tt.as_user('boris@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.bim_storage_upload_ok(:'pre5' || '/' || repeat('a', 64) || '.bimc'), false, 'another user may not');
SELECT tt.as_admin();
SELECT tt.eq(public.bim_storage_setup(), 'skipped', 'without a Storage schema the setup says skipped');
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false, file_size_limit bigint);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
SELECT tt.eq(public.bim_storage_setup(), 'ok', 'with a Storage schema the bucket and the policies are made');
SELECT tt.eq((SELECT count(*) FROM storage.buckets WHERE id = 'bim' AND NOT public), 1::bigint, 'a private bucket bim');
SELECT tt.eq((SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'bim_objects_%'), 3::bigint, 'three policies');
SELECT tt.eq(public.bim_storage_setup(), 'ok', 'a second run changes nothing');
SELECT tt.eq((SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'bim_objects_%'), 3::bigint, 'still three policies');

-- 10. remove all BIM data of the project; the tasks stay -----------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('boris@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails($q$SELECT public.bim_delete_model('aabd1dde-97e6-4359-97e4-0efcb847589b')$q$, 'permission', 'a read only member cannot remove the BIM data');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.bim_delete_model('aabd1dde-97e6-4359-97e4-0efcb847589b') AS del \gset
SELECT tt.eq(jsonb_array_length(:'del'::jsonb->'paths'), 1, 'one file path comes back (the ready model had one chunk)');
SELECT tt.eq((SELECT count(*) FROM public.bim_model_table WHERE "rowProjectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 0::bigint, 'no model is left');
SELECT tt.eq((SELECT "rowJSON" ? 'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), false, 'the project is no longer BIM based');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = 'aabd1dde-97e6-4359-97e4-0efcb847589b'), 4::bigint, 'the tasks stay (3 of the 5 are left after the test deleted one; the stages and tasks are not touched by the removal)');

-- 11. a deleted project takes its rows with it and queues the files --------------------------------------------------------------------------------------------------------------
SELECT public.bim_import_begin('bbbbbbbb-0000-4000-8000-000000000003', 'copy.ifc') AS b6 \gset
SELECT (:'b6'::jsonb->>'modelGUID') AS m6, (:'b6'::jsonb->>'storagePrefix') AS pre6 \gset
SELECT public.bim_import_add_rows(:'m6', 'storeys', jsonb_build_array(jsonb_build_object('ifcGuid','S9','name','L9','elevation',0,'orderInList',1)));
SELECT public.bim_import_add_rows(:'m6', 'chunks', jsonb_build_array(jsonb_build_object('storeyIfcGuid','S9','contentHash','h9','byteSize',1,'storagePath', :'pre6' || '/h9.bimc')));
SELECT public.bim_import_add_rows(:'m6', 'elements', jsonb_build_array(jsonb_build_object('ifcGuid','E9','ifcClass','IfcWall','storeyIfcGuid','S9','chunkHash','h9','elementNumber',0)));
SELECT public.bim_import_commit(:'m6', '{"elements":1}');
DELETE FROM public.project_table WHERE "rowGUID" = 'bbbbbbbb-0000-4000-8000-000000000003';
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table WHERE "rowModelGUID" = :'m6'), 0::bigint, 'the project delete took the elements');
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM public.bim_storage_cleanup_table WHERE "storagePath" = :'pre6' || '/h9.bimc'), 1::bigint, 'and queued its file');
ROLLBACK;
