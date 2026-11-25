-- PART 57: PROJECT ESTIMATION (documentation/ESTIMATION/PROJECT_ESTIMATION.html): project_estimation_summary (the sums of the task lines of the estimation project per budget item + the counts of the
-- project it fills), project_delete_task_roots (delete top-level rows with their subtrees), the guard trigger of the key projectEstimationGUID of project_table.
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('outsider@other.test', '33333333-3333-3333-3333-333333333333', 'Out', 'S');

CREATE FUNCTION tt.mk_project(p_guid uuid, p_name text, p_owner uuid, p_extra jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES (p_guid, public.pm_ltree_label(p_guid), p_owner, jsonb_build_object('name', p_name) || p_extra);
  RETURN p_guid;
END $$;

CREATE FUNCTION tt.mk_task(p_project uuid, p_parent uuid, p_kind text, p_name text, p_order numeric DEFAULT 0) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid(); v_path ltree; v_owner uuid;
BEGIN
  SELECT "rowOwnerGUID" INTO v_owner FROM public.project_table WHERE "rowGUID" = p_project;
  v_path := COALESCE((SELECT "treePath" FROM public.project_task_table WHERE "rowGUID" = p_parent), public.pm_ltree_label(p_project)) || public.pm_ltree_label(v);
  INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
  VALUES (v, v_path, p_project, v_owner, p_order, jsonb_build_object('taskDescription', p_name, 'rowKind', p_kind, 'durationDays', 3));
  RETURN v;
END $$;

-- a line with a budget item and its budget sums (NULL sum = a line that has no budget sum)
CREATE FUNCTION tt.mk_eline(p_task uuid, p_genus text, p_item text, p_sum numeric, p_vat numeric) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON")
  VALUES (v, p_task, p_genus, jsonb_strip_nulls(jsonb_build_object('taskManagementGenusLine', p_genus, 'budgetItemTaskLine', p_item, 'sumForBudget', p_sum, 'sumVATForBudget', p_vat)));
  RETURN v;
END $$;

-- two cost items and one revenue item of the seeds (a budget item has a management genus, its folder is costsGenus / revenuesGenus)
SELECT bi."rowGUID" AS cost1 FROM public."budgetItemTable" bi JOIN public."managementGenusTable" g ON g."rowGUID" = bi."rowJSON"->>'managementGenusItem'
  JOIN public."managementGenusTable" gf ON gf."rowGUID" = g."rowParentGUID" WHERE gf."rowGUID" = 'costsGenus' ORDER BY bi."rowGUID" LIMIT 1 \gset
SELECT bi."rowGUID" AS cost2 FROM public."budgetItemTable" bi JOIN public."managementGenusTable" g ON g."rowGUID" = bi."rowJSON"->>'managementGenusItem'
  JOIN public."managementGenusTable" gf ON gf."rowGUID" = g."rowParentGUID" WHERE gf."rowGUID" = 'costsGenus' ORDER BY bi."rowGUID" OFFSET 1 LIMIT 1 \gset
SELECT bi."rowGUID" AS rev1 FROM public."budgetItemTable" bi JOIN public."managementGenusTable" g ON g."rowGUID" = bi."rowJSON"->>'managementGenusItem'
  JOIN public."managementGenusTable" gf ON gf."rowGUID" = g."rowParentGUID" WHERE gf."rowGUID" = 'revenuesGenus' ORDER BY bi."rowGUID" LIMIT 1 \gset
SELECT tt.eq((:'cost1' <> :'cost2' AND :'rev1' <> '')::text, 'true', 'the seeds have two cost items and a revenue item');

-- P1 = the project that is filled (EUR), P2 = its estimation (EUR): stage S { T1 (2 lines cost1 + 1 line cost2), T2 (1 revenue line, 1 line without an item, 1 line without a sum) } + a link T2 after T1
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-0000000000a1', 'Hall 12', '11111111-1111-1111-1111-111111111111', '{"currencyForBudget": "EUR"}') AS p1 \gset
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-0000000000a2', 'Hall 12 - Estimate', '11111111-1111-1111-1111-111111111111', '{"currencyForBudget": "EUR"}') AS p2 \gset
SELECT tt.mk_project('bbbbbbbb-0000-0000-0000-0000000000b1', 'Foreign', '33333333-3333-3333-3333-333333333333') AS pf \gset
SELECT tt.mk_task(:'p2', NULL, 'stage', 'Stage S', 1) AS s \gset
SELECT tt.mk_task(:'p2', :'s', 'task', 'T1', 1) AS t1 \gset
SELECT tt.mk_task(:'p2', :'s', 'task', 'T2', 2) AS t2 \gset
SELECT tt.mk_eline(:'t1', 'materialGenus', :'cost1', 8650.00, 1816.50) AS l1 \gset
SELECT tt.mk_eline(:'t1', 'materialGenus', :'cost1', 1350.00, 283.50) AS l2 \gset
SELECT tt.mk_eline(:'t1', 'expenseGenus', :'cost2', 3100.00, 651.00) AS l3 \gset
SELECT tt.mk_eline(:'t2', 'revenueGenus', :'rev1', 36000.00, 7560.00) AS l4 \gset
SELECT tt.mk_eline(:'t2', 'expenseGenus', NULL, 500.00, 105.00) AS l5 \gset
SELECT tt.mk_eline(:'t2', 'expenseGenus', :'cost2', NULL, NULL) AS l6 \gset
INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID") VALUES (:'t2', :'t1', :'p2', '11111111-1111-1111-1111-111111111111');
-- P1 has one top-level task of its own with one cost line
SELECT tt.mk_task(:'p1', NULL, 'task', 'Own task', 5) AS own \gset
SELECT tt.mk_eline(:'own', 'timeGenus', :'cost1', 2000.00, 0.00) AS lo \gset

-- 1. the summary ------------------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.project_estimation_summary(:'p1', :'p2') AS sm \gset
SELECT tt.eq((:'sm'::jsonb)->'source'->>'name', 'Hall 12 - Estimate', 'the source part names the estimation project');
SELECT tt.eq((:'sm'::jsonb)->'source'->>'currencyForBudget', 'EUR', '... and its budget currency');
SELECT tt.eq(((:'sm'::jsonb)->'source'->>'tasks')::int, 3, 'the source has 3 tasks / stages');
SELECT tt.eq(((:'sm'::jsonb)->'source'->>'links')::int, 1, '... 1 link');
SELECT tt.eq(((:'sm'::jsonb)->'source'->>'lines')::int, 6, '... 6 lines');
SELECT tt.eq(((:'sm'::jsonb)->'source'->>'linesWithoutItem')::int, 1, '... 1 line has no budget item');
SELECT tt.eq(((:'sm'::jsonb)->'source'->>'linesWithoutSum')::int, 1, '... 1 line has no budget sum');
SELECT tt.eq(jsonb_array_length((:'sm'::jsonb)->'source'->'items'), 4, 'four rows: cost1, cost2, revenue, (no budget item)');
SELECT tt.eq((SELECT (i->>'sumForBudget')::numeric FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'cost1'), 10000.00, 'cost1 = 8650 + 1350');
SELECT tt.eq((SELECT (i->>'lines')::int FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'cost1'), 2, '... 2 lines');
SELECT tt.eq((SELECT (i->>'vatForBudget')::numeric FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'cost1'), 2100.00, '... its VAT 1816.50 + 283.50');
SELECT tt.eq((SELECT (i->>'sumForBudget')::numeric FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'cost2'), 3100.00, 'cost2 = 3100 (the line without a sum adds nothing)');
SELECT tt.eq((SELECT (i->>'linesWithoutSum')::int FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'cost2'), 1, '... and is counted');
SELECT tt.eq((SELECT i->>'kind' FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'rev1'), 'revenue', 'the revenue item is a revenue row');
SELECT tt.eq((SELECT i->>'kind' FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' = :'cost1'), 'cost', 'a cost item is a cost row');
SELECT tt.eq((SELECT (i->>'sumForBudget')::numeric FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' IS NULL), 500.00, 'the line with no budget item is one row (budgetItemGUID null)');
SELECT tt.eq((SELECT i->>'kind' FROM jsonb_array_elements((:'sm'::jsonb)->'source'->'items') i WHERE i->>'budgetItemGUID' IS NULL), 'cost', '... a cost row (the genus of the line decides)');
-- the target part
SELECT tt.eq(((:'sm'::jsonb)->'target'->>'tasks')::int, 1, 'the target part counts the tasks of project1');
SELECT tt.eq((SELECT (i->>'sumForBudget')::numeric FROM jsonb_array_elements((:'sm'::jsonb)->'target'->'items') i WHERE i->>'budgetItemGUID' = :'cost1'), 2000.00, '... and its sum per budget item (Project now)');
SELECT tt.eq(((:'sm'::jsonb)->'target'->>'postedTasks')::int, 0, 'nothing is posted');
SELECT tt.eq(((:'sm'::jsonb)->'target'->>'documents')::int, 0, '... and there is no document');
SELECT tt.eq((:'sm'::jsonb)->'target'->>'readonly', 'false', 'project1 is not read-only');
SELECT tt.eq((:'sm'::jsonb)->'target'->>'canCreate', 'true', 'the owner may create tasks in project1');
SELECT tt.eq(jsonb_array_length((:'sm'::jsonb)->'target'->'roots'), 1, 'project1 has one top-level row');
SELECT tt.eq((:'sm'::jsonb)->'target'->'roots'->0->>'rowGUID', :'own', '... its own task');
SELECT tt.eq(((:'sm'::jsonb)->'target'->'roots'->0->>'orderInList')::numeric, 5::numeric, '... with its order');
-- no target = a project that is not saved yet
SELECT tt.eq(public.project_estimation_summary(NULL, :'p2')->'target', 'null'::jsonb, 'no target (a new project): only the source part');
SELECT tt.fails(format($q$SELECT public.project_estimation_summary(%L, %L)$q$, :'p1', :'pf'), 'No permission', 'a project of another user cannot be read as the estimation');
SELECT tt.fails(format($q$SELECT public.project_estimation_summary(%L, %L)$q$, :'p1', gen_random_uuid()), 'No permission', 'a project that does not exist is refused');
SELECT tt.as_user('outsider@other.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails(format($q$SELECT public.project_estimation_summary(NULL, %L)$q$, :'p2'), 'No permission', 'an outsider cannot read the estimation of anna');

-- 2. posted tasks and documents of the target are counted ----------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
INSERT INTO public.task_line_plan_movements ("rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "rowPeriodDatetime", "rowCoefficient", "qtyTaskLine", "sumForBudget")
VALUES (:'p1', :'own', :'lo', '2026-03-02T00:00:00Z', 1, 1, 2000);
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.project_estimation_summary(:'p1', :'p2')->'target'->>'postedTasks')::int, 1, 'one posted task of project1 is counted');
SELECT tt.as_admin();
INSERT INTO public.project_status_movements ("rowMovementKind", "rowTurnoverMoment", "rowTurnoverDay", "rowRegistratorGUID", "rowRegistratorType", "rowProjectGUID", "rowOwnerGUID", "genusGUID")
VALUES ('invoiced', now(), current_date, gen_random_uuid(), 'vendorInvoice', :'p1', :'own', 'materialGenus');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((public.project_estimation_summary(:'p1', :'p2')->'target'->>'documents')::int, 1, 'one posted document row of project1 is counted');

-- 3. the guard of the key -------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', %L) WHERE "rowGUID" = %L$q$, :'p1', :'p1'), 'its own estimation', 'a project cannot be its own estimation');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', 'not-a-guid') WHERE "rowGUID" = %L$q$, :'p1'), 'GUID of a project', 'a value that is no GUID is refused');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', %L) WHERE "rowGUID" = %L$q$, gen_random_uuid(), :'p1'), 'does not exist', 'a project that does not exist is refused');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', %L) WHERE "rowGUID" = %L$q$, :'pf', :'p1'), 'cannot read', 'the project of another user is refused');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', %L) WHERE "rowGUID" = %L$q$, :'p2', :'p1'))::int, 1, 'project2 is accepted as the estimation of project1');
SELECT tt.eq((SELECT "rowJSON"->>'projectEstimationGUID' FROM public.project_table WHERE "rowGUID" = :'p1'), :'p2', '... and stored');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('name', 'Hall 12 (renamed)') WHERE "rowGUID" = %L$q$, :'p1'))::int, 1, 'a later save that does not change the key is not checked again');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', '') WHERE "rowGUID" = %L$q$, :'p1'))::int, 1, 'clearing the key is allowed');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'projectEstimationGUID' WHERE "rowGUID" = %L$q$, :'p1'))::int, 1, '... also by removing it');
-- the key may be set when the project is made
SELECT tt.eq(tt.rows_of(format($q$INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES (%L, %L::ltree, %L, jsonb_build_object('name', 'Hall 13', 'projectEstimationGUID', %L))$q$,
  'aaaaaaaa-0000-0000-0000-0000000000a3', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-0000000000a3'::uuid)::text, '11111111-1111-1111-1111-111111111111', :'p2'))::int, 1, 'a new project may name its estimation at once');
SELECT tt.fails(format($q$INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES (%L, %L::ltree, %L, jsonb_build_object('name', 'Hall 14', 'projectEstimationGUID', %L))$q$,
  'aaaaaaaa-0000-0000-0000-0000000000a4', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-0000000000a4'::uuid)::text, '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-0000000000a4'), 'its own estimation', '... but not itself');

-- 4. project_delete_task_roots --------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-0000000000a5', 'Roots', '11111111-1111-1111-1111-111111111111') AS p5 \gset
SELECT tt.mk_task(:'p5', NULL, 'stage', 'Old stage', 1) AS r1 \gset
SELECT tt.mk_task(:'p5', :'r1', 'task', 'Old child A', 1) AS r1a \gset
SELECT tt.mk_task(:'p5', :'r1', 'task', 'Old child B', 2) AS r1b \gset
SELECT tt.mk_task(:'p5', NULL, 'task', 'Keep me', 2) AS r2 \gset
SELECT tt.mk_eline(:'r1a', 'materialGenus', :'cost1', 10, 0) AS lr1 \gset
SELECT tt.mk_eline(:'r2', 'materialGenus', :'cost1', 20, 0) AS lr2 \gset
INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID") VALUES (:'r1b', :'r1a', :'p5', '11111111-1111-1111-1111-111111111111');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.fails(format($q$SELECT public.project_delete_task_roots(%L, ARRAY[%L]::uuid[])$q$, :'p5', :'r1a'), 'not top-level', 'a row that is not a top-level row is refused');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = :'p5'), 4::bigint, '... and nothing was deleted');
SELECT tt.fails(format($q$SELECT public.project_delete_task_roots(%L, ARRAY[%L]::uuid[])$q$, :'p5', :'own'), 'not top-level', 'a top-level row of ANOTHER project is refused');
SELECT tt.eq(public.project_delete_task_roots(:'p5', ARRAY[:'r1']::uuid[]), 3, 'one root deletes the root + its 2 children');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = :'p5'), 1::bigint, 'only the other root is left');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table WHERE "rowProjectGUID" = :'p5'), 1::bigint, '... with its line (the lines of the deleted rows are gone)');
SELECT tt.eq((SELECT count(*) FROM public.project_task_dependencies_table WHERE "projectGUID" = :'p5'), 0::bigint, '... and the link inside the deleted stage is gone');
SELECT tt.eq(public.project_delete_task_roots(:'p5', ARRAY[]::uuid[]), 0, 'no rows = nothing to do');
SELECT tt.as_user('outsider@other.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.fails(format($q$SELECT public.project_delete_task_roots(%L, ARRAY[%L]::uuid[])$q$, :'p5', :'r2'), 'does not exist or is not yours', 'an outsider cannot delete rows of the project of anna');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
-- the rollback of a failed fill: rows written through project_import_tasks are taken back by their roots
SELECT gen_random_uuid() AS nr \gset
SELECT public.project_import_tasks(:'p5', jsonb_build_array(jsonb_build_object('rowGUID', :'nr', 'treePath', public.pm_ltree_label(:'p5'::uuid)::text || '.' || public.pm_ltree_label(:'nr'::uuid)::text,
  'rowOwnerGUID', '11111111-1111-1111-1111-111111111111', 'orderInList', 9, 'rowJSON', jsonb_build_object('taskDescription', 'Copied', 'rowKind', 'task')))) AS imported \gset
SELECT tt.eq(:'imported'::int, 1, 'project_import_tasks writes the new top-level row');
SELECT tt.eq(public.project_delete_task_roots(:'p5', ARRAY[:'nr']::uuid[]), 1, '... and project_delete_task_roots takes it back');
SELECT tt.eq((SELECT count(*) FROM public.project_task_table WHERE "projectGUID" = :'p5'), 1::bigint, 'the project is as before');

-- speed: 3000 rows under 3 root stages go in one call
SELECT tt.as_admin();
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-0000000000a6', 'Big', '11111111-1111-1111-1111-111111111111') AS p6 \gset
SELECT tt.mk_task(:'p6', NULL, 'stage', 'Big stage', 1) AS big \gset
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
SELECT g.id, (SELECT "treePath" FROM public.project_task_table WHERE "rowGUID" = :'big') || public.pm_ltree_label(g.id), :'p6', '11111111-1111-1111-1111-111111111111', n, '{"taskDescription":"x","rowKind":"task"}'::jsonb
  FROM (SELECT gen_random_uuid() AS id, n FROM generate_series(1, 3000) n) g;
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT clock_timestamp() AS t0 \gset
SELECT public.project_delete_task_roots(:'p6', ARRAY[:'big']::uuid[]) AS bigdeleted \gset
SELECT tt.eq(:'bigdeleted'::int, 3001, 'a root with 3000 rows below it: 3001 rows deleted');
SELECT tt.eq((EXTRACT(EPOCH FROM clock_timestamp() - :'t0'::timestamptz) < 4)::text, 'true', '... in under 4 seconds');

-- 5. a read-only project ---------------------------------------------------------------------------------------------------------------------------------------------------------
SELECT public.project_set_readonly(:'p1', true);
SELECT tt.eq((public.project_estimation_summary(:'p1', :'p2')->'target'->>'readonly'), 'true', 'the summary says project1 is read-only');
SELECT tt.fails(format($q$UPDATE public.project_table SET "rowJSON" = "rowJSON" || jsonb_build_object('projectEstimationGUID', %L) WHERE "rowGUID" = %L$q$, :'p2', :'p1'), 'Read-only project', 'the key of a read-only project cannot change');
SELECT tt.fails(format($q$SELECT public.project_delete_task_roots(%L, ARRAY[%L]::uuid[])$q$, :'p1', :'own'), 'Read-only project', 'the rows of a read-only project cannot be deleted');
SELECT public.project_set_readonly(:'p1', false);

-- 6. the member who may not create tasks ------------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
SELECT public.organization_ensure_user('carl@acme.test', '44444444-4444-4444-4444-444444444444', 'Carl', 'C');
SELECT tt.as_user('carl@acme.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq(count(*)::int, 0, 'carl (no project of his own, no right) reads nothing of anna through RLS') FROM public.project_table WHERE "rowGUID" IN (:'p1', :'p2');
SELECT tt.fails(format($q$SELECT public.project_estimation_summary(NULL, %L)$q$, :'p2'), 'No permission', 'so he cannot read her estimation either');

ROLLBACK;
