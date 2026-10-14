-- the list of fact documents (task_fact_document_list): totals of each document, the fast filters, who sees what
BEGIN;
SELECT tt.as_admin();
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS ta1, t."projectGUID" AS pa1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'name' = 'Task 111' \gset
SELECT t."rowGUID" AS ta2, t."projectGUID" AS pa2 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'name' = 'Task 211' \gset
SELECT t."rowGUID" AS tm1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'name' = 'Task 111' \gset
SELECT r."rowGUID" AS role1 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" LIMIT 1 \gset
SELECT r."rowGUID" AS role2 FROM public."resourceRoleTable" r ORDER BY r."rowGUID" OFFSET 1 LIMIT 1 \gset
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-0000000000a1', :'ta1', 'timeGenus',     1, jsonb_build_object('resourceRoleItem', :'role1', 'taskResourceItem', 'p-boris', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 8, 'priceTaskLine', 10, 'sumForBudget', 96, 'sumForAccounting', 120, 'businessUnitTaskLine', 'bu_team1costs')),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', :'ta1', 'materialGenus', 2, jsonb_build_object('resourceRoleItem', :'role2', 'measureUnitTaskLine', 'unit_pcs', 'qtyTaskLine', 100, 'priceTaskLine', 2)),
  ('aaaaaaaa-0000-0000-0000-0000000000a3', :'ta2', 'timeGenus',     1, jsonb_build_object('resourceRoleItem', :'role2', 'taskResourceItem', 'p-clara', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 4, 'priceTaskLine', 20)),
  ('aaaaaaaa-0000-0000-0000-0000000000a4', :'tm1', 'timeGenus',     1, jsonb_build_object('resourceRoleItem', :'role1', 'measureUnitTaskLine', 'unit_hour', 'qtyTaskLine', 1, 'priceTaskLine', 5));

-- anna: document 1 (task 1, 2 lines, posted on 2026-10-12), document 2 (task 2 of another project, 1 line, draft on 2026-11-20); marko: one document
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_fact_document_create(:'ta1') AS d1 \gset
UPDATE public.task_fact_usage_timeline SET "rowPeriodDatetime" = '2026-10-12' WHERE "rowHeaderGUID" = :'d1';
SELECT public.post_task_fact_document(:'d1');
SELECT public.task_fact_document_create(:'ta2') AS d2 \gset
UPDATE public.task_fact_usage_timeline SET "rowPeriodDatetime" = '2026-11-20', "qtyForContract" = 3 WHERE "rowHeaderGUID" = :'d2';
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.task_fact_document_create(:'tm1') AS dm \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

SELECT public.task_fact_document_list() AS l0 \gset
SELECT tt.eq((:'l0'::jsonb->>'totalCount')::int, 2, 'anna sees her 2 documents - not the one of marko');
SELECT tt.eq(:'l0'::jsonb->'rows'->0->>'documentGUID', :'d2', 'newest first');
SELECT tt.eq(:'l0'::jsonb->'rows'->1->>'documentNumber' LIKE 'FI-%', true, 'every row has its document number');
SELECT tt.eq((SELECT r->>'lineCount' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), '2', 'lineCount');
SELECT tt.eq((SELECT (r->>'sumForContract')::numeric FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), 280::numeric, 'document total sumForContract (8 x 10 + 100 x 2)');
SELECT tt.eq((SELECT (r->>'sumForBudget')::numeric FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), 96::numeric, 'document total sumForBudget');
SELECT tt.eq((SELECT (r->>'sumForAccounting')::numeric FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), 120::numeric, 'document total sumForAccounting');
SELECT tt.eq((:'l0'::jsonb->'totals'->>'sumForContract')::numeric, 340::numeric, 'the footer total of all the listed documents (280 + 3 x 20)');
SELECT tt.eq((SELECT r->>'authorName' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), 'Anna K', 'the author is named');
SELECT tt.eq((SELECT r->>'projectGUID' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d2'), :'pa2', 'the project and ...');
SELECT tt.eq((SELECT r->>'taskName' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d2'), 'Task 211', '... the task are named');
SELECT tt.eq((SELECT r->>'firstDay' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), '2026-10-12', 'firstDay');
SELECT tt.eq((SELECT r->>'strongInput' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), 'false', 'strongInput');
SELECT tt.eq((SELECT r->>'documentStatus' FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), 'posted', 'documentStatus');
SELECT tt.eq((SELECT r->>'unpostedAt' IS NULL FROM jsonb_array_elements(:'l0'::jsonb->'rows') r WHERE r->>'documentGUID' = :'d1'), true, 'unpostedAt is empty until an Unpost');
SELECT tt.eq((SELECT count(*) FROM jsonb_array_elements(public.task_fact_document_list(jsonb_build_object('taskGUID', :'ta1'))->'rows')), 1::bigint, 'taskGUID: the documents of ONE task (the form opens with it)');

-- the fast filters
SELECT tt.eq((public.task_fact_document_list('{"fromDay":"2026-11-01"}')->>'totalCount')::int, 1, 'factTimelinePeriod from: only the document with a line from 2026-11-01');
SELECT tt.eq((public.task_fact_document_list('{"fromDay":"2026-10-01","toDay":"2026-10-31"}')->'rows'->0->>'documentGUID'), :'d1', 'factTimelinePeriod from - to');
SELECT tt.eq((public.task_fact_document_list('{"fromDay":"2027-01-01"}')->>'totalCount')::int, 0, 'a period without lines: nothing');
SELECT tt.eq((public.task_fact_document_list(jsonb_build_object('projectGUID', :'pa1'))->'rows'->0->>'documentGUID'), :'d1', 'factProjectFilter');
SELECT tt.eq((public.task_fact_document_list(jsonb_build_object('businessUnitGUID', 'bu_team1costs'))->>'totalCount')::int, 1, 'factBusinessUnitFilter (the unit of the line)');
SELECT tt.eq((public.task_fact_document_list(jsonb_build_object('roleGUID', :'role2'))->>'totalCount')::int, 2, 'factRoleFilter: the role is on a line of both documents');
SELECT tt.eq((public.task_fact_document_list(jsonb_build_object('roleGUID', :'role1'))->>'totalCount')::int, 1, '... and role 1 on one');
SELECT tt.eq((public.task_fact_document_list('{"resourceGUID":"p-clara"}')->'rows'->0->>'documentGUID'), :'d2', 'factResourceFilter');
SELECT tt.eq((public.task_fact_document_list('{"author":"ann"}')->>'totalCount')::int, 2, 'authorFilter: a part of the name');
SELECT tt.eq((public.task_fact_document_list('{"author":"nobody"}')->>'totalCount')::int, 0, '... no author like that');
SELECT tt.eq((public.task_fact_document_list('{"status":"posted"}')->>'totalCount')::int, 1, 'status');
SELECT tt.eq((public.task_fact_document_list(jsonb_build_object('roleGUID', :'role1', 'fromDay', '2026-11-01'))->>'totalCount')::int, 0, 'the line keys are ONE condition on ONE line: role 1 is on the October line, not on a line from November');
SELECT tt.eq((public.task_fact_document_list('{}', 1, 1)->'rows'->0->>'documentGUID'), :'d1', 'paging: limit 1 offset 1');
SELECT tt.eq((public.task_fact_document_list('{}', 1, 1)->>'totalCount')::int, 2, '... the count is of all');

-- marko sees only his
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((public.task_fact_document_list()->>'totalCount')::int, 1, 'marko sees his one document');
SELECT tt.eq(public.task_fact_document_list()->'rows'->0->>'documentGUID', :'dm', '... his');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails($q$SELECT public.task_fact_document_list('{"fromDay":"not a date"}')$q$, 'invalid input syntax', 'a bad date is refused');
ROLLBACK;
