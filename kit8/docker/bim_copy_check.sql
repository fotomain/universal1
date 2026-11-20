-- BIM copy (bim_copy_begin: project copy "Copy with BIM"): BIM example 2 (the Duplex Apartment) through the REAL flow, then the copy of its model into a fresh database: begin -> the tasks of the project file (project_import_tasks) -> storeys / chunks / elements / properties -> commit,
-- then the reads and delete_bim_data.sql. Called by test_bim_copy.sh (the files are copied to /tmp/bim_cp inside the container).
\set ON_ERROR_STOP on
\set pf `cat /tmp/bim_cp/project.json`
\set bundle `cat /tmp/bim_cp/bundle.json`
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
SELECT (:'pf'::jsonb->'project'->>'rowGUID')::uuid, public.pm_ltree_label((:'pf'::jsonb->'project'->>'rowGUID')::uuid), '11111111-1111-1111-1111-111111111111', (:'pf'::jsonb->'project'->'rowJSON');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT :'pf'::jsonb->'project'->>'rowGUID' AS proj \gset
SELECT public.bim_import_begin(:'proj', 'Duplex_A_20110907.ifc', (:'bundle'::jsonb->'model'->>'sourceSha256')) AS b \gset
SELECT (:'b'::jsonb->>'modelGUID') AS m, (:'b'::jsonb->>'storagePrefix') AS pre \gset

-- the tasks of the file (stages first: by depth)
SELECT tt.eq(public.project_import_tasks(:'proj', (
  SELECT jsonb_agg(jsonb_build_object('rowGUID', t->>'rowGUID', 'treePath', t->>'treePath', 'rowOwnerGUID', '11111111-1111-1111-1111-111111111111', 'rowProgress', 0, 'orderInList', (t->>'orderInList')::numeric, 'rowJSON', t->'rowJSON'))
    FROM jsonb_array_elements(:'pf'::jsonb->'tasks') t)), 219, '4 stages + 215 tasks are imported');

SELECT public.bim_import_add_rows(:'m', 'storeys', (SELECT jsonb_agg(jsonb_build_object('ifcGuid', s->>'ifcGuid', 'name', s->>'name', 'elevation', s->'elevation', 'orderInList', s->'orderInList', 'stageGUID', s->>'stageGUID')) FROM jsonb_array_elements(:'bundle'::jsonb->'storeys') s)) AS n_s \gset
SELECT public.bim_import_add_rows(:'m', 'chunks', (SELECT jsonb_agg(jsonb_build_object('storeyIfcGuid', c->>'storeyIfcGuid', 'contentHash', c->>'hash', 'part', c->'part', 'byteSize', c->'byteSize', 'formatVersion', c->'formatVersion', 'vertexCount', c->'vertexCount',
         'elementCount', c->'elementCount', 'bboxMin', c->'bboxMin', 'bboxSize', c->'bboxSize', 'storagePath', :'pre' || '/' || (c->>'hash') || '.bimc')) FROM jsonb_array_elements(:'bundle'::jsonb->'chunks') c)) AS n_c \gset
SELECT public.bim_import_add_rows(:'m', 'elements', (SELECT jsonb_agg(jsonb_build_object('ifcGuid', e->>'ifcGuid', 'ifcClass', e->>'ifcClass', 'name', e->>'name', 'typeName', e->>'typeName', 'storeyIfcGuid', e->>'storeyIfcGuid', 'taskGUID', e->>'taskGUID',
         'chunkHash', e->>'chunkHash', 'elementNumber', e->'elementNumber', 'bbox', e->'bbox')) FROM jsonb_array_elements(:'bundle'::jsonb->'elements') e)) AS n_e \gset
SELECT public.bim_import_add_rows(:'m', 'properties', (SELECT jsonb_agg(jsonb_build_object('ifcGuid', p->>'ifcGuid', 'rowJSON', p->'rowJSON')) FROM jsonb_array_elements(:'bundle'::jsonb->'properties') p)) AS n_p \gset
SELECT tt.eq(:n_s::int, 4, '4 storeys'); SELECT tt.eq(:n_c::int, 4, '4 chunks'); SELECT tt.eq(:n_e::int, 215, '215 elements'); SELECT tt.eq(:n_p::int, 215, '215 property rows');
SELECT public.bim_import_commit(:'m', jsonb_build_object('storeys', 4, 'chunks', 4, 'elements', 215, 'properties', 215), :'bundle'::jsonb->'model') AS done \gset
SELECT tt.eq((:'done'::jsonb->'counts'->>'tasks')::int, 215, '215 tasks have an element');
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = :'proj'), 'true', 'the project is BIM based');

-- the expected check of example 2
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table WHERE "taskGUID" IS NULL), 0::bigint, 'every element has a task');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table t WHERE t."projectGUID" = :'proj' AND t."rowJSON"->>'rowKind' = 'task' AND NOT EXISTS (SELECT 1 FROM public.bim_element_table e WHERE e."taskGUID" = t."rowGUID")), 0::bigint, 'every task has an element');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table WHERE "ifcClass" = 'IfcWallStandardCase'), 56::bigint, '56 walls');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table WHERE "ifcClass" IN ('IfcDoor','IfcWindow')), 38::bigint, '14 doors + 24 windows');
SELECT tt.eq((SELECT "unitScale" FROM public.bim_model_table WHERE "rowGUID" = :'m'), 1.0::numeric, 'the unit scale 1 (metres) is kept');
SELECT tt.eq((SELECT string_agg(name || ':' || n, ',' ORDER BY "orderInList") FROM (SELECT s."name", s."orderInList", (SELECT count(*) FROM public.bim_element_table e WHERE e."rowStoreyGUID" = s."rowGUID") n FROM public.bim_storey_table s) q),
  'T/FDN:14,Level 1:101,Level 2:93,Roof:7', 'elements per storey: 14 / 101 / 93 / 7');
SELECT tt.eq((SELECT round((max((bbox->>4)::numeric) - min((bbox->>1)::numeric)), 2) FROM public.bim_element_table), 8.18::numeric, 'the model is 8.18 m high');
SELECT tt.eq(jsonb_array_length(public.bim_elements_of_task(:'proj', (SELECT "rowGUID" FROM public.project_task_table WHERE "projectGUID" = :'proj' AND "rowJSON"->>'bimStoreyGuid' = (SELECT "ifcGuid" FROM public.bim_storey_table WHERE "name" = 'Level 1')))), 101, 'the stage Level 1 lights its 101 elements');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table l JOIN public.project_task_table t ON t."rowGUID" = l."rowOwnerGUID"::uuid WHERE t."projectGUID" = :'proj'), 0::bigint, 'no task line: minimum data');
SELECT tt.eq((SELECT count(*) FROM public.project_task_dependencies_table WHERE "projectGUID" = :'proj'), 0::bigint, 'no link between tasks');



-- ======= the copy: a second project with the tasks copied (new ids), then bim_copy_begin -> commit =======
SELECT tt.as_admin();
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES
  ('dddddddd-0000-4000-8000-000000000001', public.pm_ltree_label('dddddddd-0000-4000-8000-000000000001'), '11111111-1111-1111-1111-111111111111', '{"name":"Copy target"}'),
  ('dddddddd-0000-4000-8000-000000000003', public.pm_ltree_label('dddddddd-0000-4000-8000-000000000003'), '11111111-1111-1111-1111-111111111111', '{"name":"Copy target 3"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', public.pm_ltree_label('bbbbbbbb-0000-4000-8000-000000000002'), '11111111-1111-1111-1111-111111111111', '{"name":"Plain project"}');
CREATE TEMP TABLE tmp_map AS SELECT "rowGUID" AS old_guid, gen_random_uuid() AS new_guid FROM public.project_task_table WHERE "projectGUID" = :'proj';
GRANT SELECT ON tmp_map TO PUBLIC;
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
SELECT m.new_guid, public.pm_ltree_label('dddddddd-0000-4000-8000-000000000001') || public.pm_ltree_label(m.new_guid), 'dddddddd-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', t."rowJSON"
  FROM public.project_task_table t JOIN tmp_map m ON m.old_guid = t."rowGUID";
SELECT (SELECT jsonb_object_agg(old_guid::text, new_guid::text) FROM tmp_map) AS mapjson \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.bim_copy_begin(%L, %L, '{}')$q$, :'proj', :'proj'), 'same project', 'a project is not copied onto itself');
SELECT tt.fails(format($q$SELECT public.bim_copy_begin(%L, 'dddddddd-0000-4000-8000-000000000001', '{"x":"y"}')$q$, :'proj'), 'invalid input syntax', 'a bad task map is refused');
SELECT tt.eq((SELECT public.bim_copy_begin('bbbbbbbb-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000003', '{}') IS NULL)::text, 'true', 'a source without a BIM model answers NULL and writes nothing');
SELECT public.bim_copy_begin(:'proj', 'dddddddd-0000-4000-8000-000000000001', :'mapjson'::jsonb) AS cb \gset
SELECT (:'cb'::jsonb->>'modelGUID') AS cm, (:'cb'::jsonb->>'storagePrefix') AS cpre \gset
SELECT tt.eq((:'cb'::jsonb->'counts'->>'elements')::int, 215, 'the copy holds 215 elements');
SELECT tt.eq((:'cb'::jsonb->'counts'->>'storeys')::int, 4, '4 storeys');
SELECT tt.eq((:'cb'::jsonb->'counts'->>'chunks')::int, 4, '4 chunks');
SELECT tt.eq((:'cb'::jsonb->'counts'->>'properties')::int, 215, '215 property rows');
SELECT tt.eq(jsonb_array_length(:'cb'::jsonb->'files'), 4, 'four files to copy');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(:'cb'::jsonb->'files') f WHERE (f->>'to') LIKE :'cpre' || '/%' AND (f->>'from') LIKE :'proj' || '/%'), 4::bigint, 'every file goes from the source folder into the copy folder');
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'cm'), 'importing', 'the copy is importing until it is committed');
SELECT tt.eq((SELECT public.bim_storage_upload_ok((:'cb'::jsonb->'files'->0->>'to')))::text, 'true', 'the upload policy lets the caller write the file of the copy');
SELECT tt.fails(format($q$SELECT public.bim_copy_begin(%L, 'dddddddd-0000-4000-8000-000000000003', %L)$q$, :'proj', :'mapjson'), 'not a task of the target', 'a task of another project in the map is refused');
SELECT public.bim_import_commit(:'cm', (:'cb'::jsonb->'counts')) AS cdone \gset
SELECT tt.eq((:'cdone'::jsonb->'counts'->>'tasks')::int, 215, 'committed: 215 tasks have an element');
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'cm'), 'ready', 'the copy is ready');
SELECT tt.eq((SELECT "rowJSON"->>'projectIsBIMBased' FROM public.project_table WHERE "rowGUID" = 'dddddddd-0000-4000-8000-000000000001'), 'true', 'the copy is BIM based');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table e WHERE e."rowModelGUID" = :'cm' AND NOT EXISTS (SELECT 1 FROM public.project_task_table t WHERE t."rowGUID" = e."taskGUID" AND t."projectGUID" = 'dddddddd-0000-4000-8000-000000000001')), 0::bigint, 'every element of the copy points at a task OF THE COPY');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table e WHERE e."rowModelGUID" = :'cm' AND e."taskGUID" IN (SELECT old_guid FROM tmp_map)), 0::bigint, 'no element of the copy points at a task of the source');
SELECT tt.eq((SELECT count(*) FROM public.bim_storey_table s WHERE s."rowModelGUID" = :'cm' AND NOT EXISTS (SELECT 1 FROM public.project_task_table t WHERE t."rowGUID" = s."stageGUID" AND t."projectGUID" = 'dddddddd-0000-4000-8000-000000000001')), 0::bigint, 'every storey of the copy has the stage of the copy');
SELECT tt.eq((SELECT string_agg(name || ':' || n, ',' ORDER BY "orderInList") FROM (SELECT s."name", s."orderInList", (SELECT count(*) FROM public.bim_element_table e WHERE e."rowStoreyGUID" = s."rowGUID") n FROM public.bim_storey_table s WHERE s."rowModelGUID" = :'cm') q),
  'T/FDN:14,Level 1:101,Level 2:93,Roof:7', 'elements per storey of the copy: 14 / 101 / 93 / 7');
SELECT tt.eq((SELECT count(*) FROM public.bim_chunk_table c WHERE c."rowModelGUID" = :'cm' AND c."rowStoreyGUID" IS NOT NULL AND c."storagePath" LIKE :'cpre' || '/%'), 4::bigint, 'the chunks of the copy are tied to its storeys and its folder');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table e WHERE e."rowModelGUID" = :'cm' AND NOT EXISTS (SELECT 1 FROM public.bim_chunk_table c WHERE c."rowModelGUID" = :'cm' AND c."contentHash" = e."chunkHash")), 0::bigint, 'every element finds its chunk');
SELECT tt.eq((SELECT count(*) FROM public.bim_element_table WHERE "rowModelGUID" = :'m'), 215::bigint, 'the source model is untouched (215 elements)');
SELECT tt.eq((SELECT "state" FROM public.bim_model_table WHERE "rowGUID" = :'m'), 'ready', 'the source model is still ready');
SELECT tt.eq((SELECT public.bim_storage_upload_ok((:'cb'::jsonb->'files'->0->>'to')))::text, 'false', 'after the commit the folder is closed for uploads');
SELECT tt.fails(format($q$SELECT public.bim_copy_begin(%L, 'dddddddd-0000-4000-8000-000000000001', %L)$q$, :'proj', :'mapjson'), 'already has a BIM model', 'a target that has a BIM model is refused');
SELECT tt.as_user('clara@out.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.fails(format($q$SELECT public.bim_copy_begin(%L, 'dddddddd-0000-4000-8000-000000000003', '{}')$q$, :'proj'), 'permission', 'a user who may not read the source cannot copy it');
SELECT tt.as_user('boris@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails(format($q$SELECT public.bim_copy_begin(%L, 'dddddddd-0000-4000-8000-000000000003', '{}')$q$, :'proj'), 'permission', 'a user who is no member of the source cannot copy it either');
SELECT tt.as_admin();
COMMIT;
