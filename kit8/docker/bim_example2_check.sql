-- BIM example 2 (kit8/pm/bim/examples/example2, the Duplex Apartment) through the REAL flow into a fresh database: begin -> the tasks of the project file (project_import_tasks) -> storeys / chunks / elements / properties -> commit,
-- then the reads and delete_bim_data.sql. Called by test_bim_example2.sh (the files are copied to /tmp/bim_ex2 inside the container).
\set ON_ERROR_STOP on
\set pf `cat /tmp/bim_ex2/project.json`
\set bundle `cat /tmp/bim_ex2/bundle.json`
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

-- delete_bim_data.sql for this project, as in the SQL editor
SELECT tt.as_admin();
COMMIT;
