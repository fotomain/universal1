-- PART 24: the fact input document (documentation/FACT_INPUT.html): task_fact_header, task_fact_usage_timeline, post / unpost, the strong and the free input
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');
SELECT public.organization_ensure_user('marko@acme.test', '22222222-2222-2222-2222-222222222222', 'Marko', 'T');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS ta FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT t."projectGUID" AS pa FROM public.project_task_table t WHERE t."rowGUID" = :'ta' \gset
SELECT t."rowGUID" AS tm FROM public.project_task_table t WHERE t."rowOwnerGUID" = '22222222-2222-2222-2222-222222222222' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset

-- three lines of the task: Time (8 h, price 10), Material (100 pcs, price 2), Revenue (1, price 500)
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', :'ta', 'timeGenus',     1, '{"resourceRoleItem":"role-analyst","taskResourceItem":"p-boris","measureUnitTaskLine":"unit_hour","qtyTaskLine":8,"priceTaskLine":10,"sumForBudget":96,"sumForAccounting":120,"businessUnitTaskLine":"bu_team1costs","taskResourceContract":"c-1"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', :'ta', 'materialGenus', 2, '{"resourceRoleItem":"role-pipe","measureUnitTaskLine":"unit_pcs","qtyTaskLine":100,"priceTaskLine":2}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', :'ta', 'revenueGenus',  3, '{"measureUnitTaskLine":"unit_pcs","qtyTaskLine":1,"priceTaskLine":500}');

-- 1. the free mode (the default): ALL the lines go to the document, disconnected from the task line GUIDs ------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.task_fact_document_create(:'ta') AS d1 \gset
SELECT tt.eq((SELECT count(*) FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1'), 3::bigint, 'free: all 3 lines of the task are in the document');
SELECT tt.eq((SELECT count(*) FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "taskLineGUID" IS NULL), 3::bigint, 'free: the lines are disconnected from the task line GUIDs');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentStatus' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), 'draft', 'the document is a draft');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'projectTaskGUID' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), :'ta', 'documentHeader.projectTaskGUID = the task');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'activeUser' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), '11111111-1111-1111-1111-111111111111', 'documentHeader.activeUser = the user');
SELECT tt.eq((SELECT ("rowJSON"->'documentHeader'->>'created_at') IS NOT NULL FROM public.task_fact_header WHERE "rowGUID" = :'d1'), true, 'documentHeader.created_at is set');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentNumber' LIKE 'FI-%' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), true, 'the document has a number');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'strongInput' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), 'false', 'the mode is copied into the header (free)');
SELECT tt.eq((SELECT "genusGUID" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' ORDER BY "orderInList" LIMIT 1), 'timeGenus', 'the lines are ordered Time first');
SELECT tt.eq((SELECT "qtyForContract" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "genusGUID" = 'timeGenus'), 8::numeric, 'the quantity starts as the quantity of the task line');
SELECT tt.eq((SELECT "sumForContract" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "genusGUID" = 'timeGenus'), 80::numeric, 'sumForContract = qty x price');
SELECT tt.eq((SELECT "sumForBudget" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "genusGUID" = 'timeGenus'), 96::numeric, 'sumForBudget follows the budget sum of the line');
SELECT tt.eq((SELECT "sumForAccounting" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "genusGUID" = 'timeGenus'), 120::numeric, 'sumForAccounting follows the accounting sum of the line');
SELECT tt.eq((SELECT "rowJSON"->>'businessUnitTaskLine' FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "genusGUID" = 'timeGenus'), 'bu_team1costs', 'the business unit of the line is copied (the list filters by it)');
SELECT tt.eq((SELECT "sumForAccounting" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "genusGUID" = 'materialGenus') IS NULL, true, 'a line without an accounting sum has none (never guessed)');
SELECT f."rowGUID" AS f1 FROM public.task_fact_usage_timeline f WHERE f."rowHeaderGUID" = :'d1' AND f."genusGUID" = 'timeGenus' \gset

-- users change the date and the quantity; the budget quantity and the sums are the database's
UPDATE public.task_fact_usage_timeline SET "qtyForContract" = 6, "qtyForBudget" = 999, "sumForContract" = 12345, "rowPeriodDatetime" = '2026-10-12 00:00:00+00' WHERE "rowGUID" = :'f1';
SELECT tt.eq((SELECT "qtyForContract" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), 6::numeric, 'the user changes qtyForContract');
SELECT tt.eq((SELECT "qtyForBudget" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), 8::numeric, 'qtyForBudget cannot be changed by hand');
SELECT tt.eq((SELECT "sumForContract" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), 60::numeric, 'the sum is recomputed (6 x 10), a typed sum is ignored');
SELECT tt.eq((SELECT "sumForBudget" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), 72::numeric, 'the budget sum follows the quantity (6 x 12)');
SELECT tt.eq((SELECT "sumForAccounting" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), 90::numeric, 'the accounting sum follows the quantity (6 x 15)');
SELECT tt.eq((SELECT "periodDay" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), '2026-10-12'::date, 'rowPeriodDatetime is editable; periodDay follows');
SELECT tt.fails($q$UPDATE public.task_fact_usage_timeline SET "qtyForContract" = -1 WHERE "rowGUID" = '$q$ || :'f1' || $q$'$q$, 'task_fact_usage_timeline_qty_chk', 'a negative quantity is refused');
-- free: lines can be added; a second fact of the same line and day is allowed (no unique constraint)
INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract", "rowPeriodDatetime", "rowJSON") VALUES (:'d1', 'timeGenus', 2, '2026-10-12', '{"resourceRoleItem":"role-analyst","measureUnitTaskLine":"unit_hour","priceTaskLine":10}');
INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract", "rowPeriodDatetime", "rowJSON") VALUES (:'d1', 'timeGenus', 3, '2026-10-12', '{"resourceRoleItem":"role-analyst","measureUnitTaskLine":"unit_hour","priceTaskLine":10}');
SELECT tt.eq((SELECT count(*) FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1'), 5::bigint, 'free: lines can be added, several facts of a day');
SELECT tt.eq((SELECT "rowProjectGUID" FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' LIMIT 1), :'pa'::uuid, 'the project of a line comes from the header');

-- 2. nobody else ------------------------------------------------------------------------------------------------------------------------------------
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq((SELECT count(*) FROM public.task_fact_header), 0::bigint, 'marko does not see the document of anna');
SELECT tt.eq((SELECT count(*) FROM public.task_fact_usage_timeline), 0::bigint, 'marko does not see the lines of anna');
SELECT tt.fails(format('SELECT public.task_fact_document_create(%L)', :'ta'), 'not your project', 'marko cannot create a document on the task of anna');
SELECT tt.fails(format('SELECT public.post_task_fact_document(%L)', :'d1'), 'not your project', 'marko cannot post the document of anna');
SELECT tt.fails($q$INSERT INTO public.task_fact_header ("rowOwnerGUID") VALUES (gen_random_uuid())$q$, 'permission denied', 'the header is not written directly');

-- 3. Post: problems are an answer, nothing is written ---------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract", "rowPeriodDatetime") VALUES (:'d1', 'timeGenus', 1, now() + interval '30 days');
SELECT public.post_task_fact_document(:'d1') AS r0 \gset
SELECT tt.eq(:'r0'::jsonb->>'status', 'refused', 'a date in the future refuses the Post');
SELECT tt.eq(:'r0'::jsonb->'problems'->0->>'problem', 'dateInTheFuture', '... with the problem named');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'documentStatus' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), 'draft', '... and the document stays a draft');
DELETE FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d1' AND "rowPeriodDatetime" > now() + interval '10 days';
SELECT public.post_task_fact_document(:'d1') AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->>'status', 'posted', 'a good document is posted');
SELECT tt.eq((:'r1'::jsonb->>'lines')::int, 5, '... with its 5 lines');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'postedBy' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), '11111111-1111-1111-1111-111111111111', 'postedBy is the user');
SELECT tt.eq(public.post_task_fact_document(:'d1')->'problems'->0->>'problem', 'documentIsPosted', 'a posted document cannot be posted again');

-- 4. posted = read only ------------------------------------------------------------------------------------------------------------------------------
WITH u AS (UPDATE public.task_fact_usage_timeline SET "qtyForContract" = 1 WHERE "rowGUID" = :'f1' RETURNING 1) SELECT tt.eq((SELECT count(*) FROM u), 0::bigint, 'posted: a line cannot be updated');
WITH d AS (DELETE FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1' RETURNING 1) SELECT tt.eq((SELECT count(*) FROM d), 0::bigint, 'posted: a line cannot be deleted');
SELECT tt.fails($q$INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract") VALUES ('$q$ || :'d1' || $q$', 'timeGenus', 1)$q$, 'row-level security', 'posted: a line cannot be added');
WITH d AS (DELETE FROM public.task_fact_header WHERE "rowGUID" = :'d1' RETURNING 1) SELECT tt.eq((SELECT count(*) FROM d), 0::bigint, 'posted: the document cannot be deleted');

-- 5. Unpost -> a draft again --------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq(public.unpost_task_fact_document(:'d1')->>'status', 'draft', 'Unpost returns the document to a draft');
SELECT tt.eq((SELECT ("rowJSON"->'documentHeader'->>'unpostedAt') IS NOT NULL FROM public.task_fact_header WHERE "rowGUID" = :'d1'), true, 'unpostedAt is kept');
UPDATE public.task_fact_usage_timeline SET "qtyForContract" = 7 WHERE "rowGUID" = :'f1';
SELECT tt.eq((SELECT "qtyForContract" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'f1'), 7::numeric, 'the draft can be corrected');
SELECT tt.eq(public.unpost_task_fact_document(:'d1')->'problems'->0->>'problem', 'documentIsNotPosted', 'a draft cannot be unposted');
-- an empty document cannot be posted
SELECT tt.as_user('marko@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.task_fact_document_create(:'tm') AS dm2 \gset
SELECT tt.eq(public.post_task_fact_document(:'dm2')->'problems'->0->>'problem', 'documentHasNoLines', 'a document of a task without lines cannot be posted');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');

-- 6. the strong mode (NEW documents only) ---------------------------------------------------------------------------------------------------------------
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"factStrongInputByTaskLine": true}' WHERE "rowGUID" = :'pa';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT "rowJSON"->'documentHeader'->>'strongInput' FROM public.task_fact_header WHERE "rowGUID" = :'d1'), 'false', 'the setting does not change an existing document');
SELECT public.task_fact_document_create(:'ta') AS d2 \gset
SELECT tt.eq((SELECT count(*) FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d2' AND "taskLineGUID" IS NOT NULL), 3::bigint, 'strong: the lines keep the GUIDs of the task lines');
SELECT tt.fails($q$INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract") VALUES ('$q$ || :'d2' || $q$', 'timeGenus', 1)$q$, 'strong fact input', 'strong: users cannot add a free line');
SELECT tt.fails($q$INSERT INTO public.task_fact_usage_timeline ("rowHeaderGUID", "genusGUID", "qtyForContract", "taskLineGUID") VALUES ('$q$ || :'d2' || $q$', 'timeGenus', 1, 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'row-level security', 'strong: users cannot add a line even with a task line');
SELECT f."rowGUID" AS g1 FROM public.task_fact_usage_timeline f WHERE f."rowHeaderGUID" = :'d2' AND f."genusGUID" = 'timeGenus' \gset
SELECT f."rowGUID" AS g2 FROM public.task_fact_usage_timeline f WHERE f."rowHeaderGUID" = :'d2' AND f."genusGUID" = 'materialGenus' \gset
UPDATE public.task_fact_usage_timeline SET "qtyForContract" = 5, "rowPeriodDatetime" = '2026-10-13' WHERE "rowGUID" = :'g1';
SELECT tt.eq((SELECT "qtyForContract" FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'g1'), 5::numeric, 'strong: the user updates the quantity');
SELECT tt.fails(format('UPDATE public.task_fact_usage_timeline SET "genusGUID" = %L WHERE "rowGUID" = %L', 'materialGenus', :'g1'), 'only the date and the quantity', 'strong: the genus of a line cannot change');
SELECT tt.fails(format($q$UPDATE public.task_fact_usage_timeline SET "rowJSON" = '{}' WHERE "rowGUID" = %L$q$, :'g1'), 'only the date and the quantity', 'strong: the description of a line cannot change');
-- delete is allowed: the user drops the revenue line
DELETE FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d2' AND "genusGUID" = 'revenueGenus';
SELECT tt.eq((SELECT count(*) FROM public.task_fact_usage_timeline WHERE "rowHeaderGUID" = :'d2'), 2::bigint, 'strong: lines can be deleted');
-- the task line of a strong fact line is deleted later -> Post names the line
SELECT tt.as_admin();
DELETE FROM public.task_line_table WHERE "rowGUID" = 'aaaaaaaa-0000-0000-0000-000000000002';
SELECT tt.eq((SELECT "taskLineGUID" IS NULL FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'g2'), true, 'a deleted task line sets taskLineGUID to NULL (the fact line stays)');
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.post_task_fact_document(:'d2') AS r2 \gset
SELECT tt.eq(:'r2'::jsonb->>'status', 'refused', 'strong: a line whose task line is gone refuses the Post');
SELECT tt.eq(:'r2'::jsonb->'problems'->0->>'problem', 'taskLineMissing', '... taskLineMissing');
SELECT tt.eq(:'r2'::jsonb->'problems'->0->>'lineGUID', :'g2', '... and names the line');
DELETE FROM public.task_fact_usage_timeline WHERE "rowGUID" = :'g2';
SELECT tt.eq(public.post_task_fact_document(:'d2')->>'status', 'posted', 'strong: after the line is deleted the document is posted');

ROLLBACK;
