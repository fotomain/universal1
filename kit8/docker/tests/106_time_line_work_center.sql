-- PART 35 (2026-11-23): a Time line ALWAYS books a work center. task_line_table.rowJSON.taskResourceItem of a Time line is a workCenterTable row; the trigger aa_task_line_work_center makes a line that names a
-- person / equipment a work center line (the work center is made when it does not exist: work_center_ensure); the CHECK task_line_time_work_center_chk keeps it so; Material lines keep a product.
BEGIN;
SELECT tt.as_admin();

SELECT "rowGUID" AS bu1 FROM public."businessUnitTable" ORDER BY "rowGUID" LIMIT 1 \gset
INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-anna', '{"personFirstName":"Anna","personLastName":"K"}'), ('p-boris', '{"personFirstName":"Boris","personLastName":"M","resourceCalendar":"sixDayWeekCalendar"}');
INSERT INTO public."equipmentTable" ("rowGUID","rowJSON") VALUES ('e-crane', '{"equipmentTitle":"Tower crane","resourceCalendar":"sixDayWeekCalendar"}');
INSERT INTO public."contractTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES
  ('c-boris-7d', 'p-boris', 'person', '{"contractPartyType":"person","contractSumBeforeVAT":1,"contractStartDate":"2026-10-01","contractFinishDate":null,"contractNumber":"7","resourceCalendar":"sevenDayWeekCalendar"}');

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS t1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset

-- 1. a line that names a person / an equipment becomes a work center line ----------------------------------------------------------------------------
SELECT tt.line(:'t1', 'person', 'p-anna') AS l1 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskResourceKind' FROM public.task_line_table WHERE "rowGUID" = :'l1'), 'workCenter', 'a person line: the kind is workCenter');
SELECT tt.eq((SELECT w."rowJSON"->>'workCenterBase' FROM public."workCenterTable" w WHERE w."rowGUID" = (SELECT "rowJSON"->>'taskResourceItem' FROM public.task_line_table WHERE "rowGUID" = :'l1')), 'p-anna', 'the item is the work center of the person');
SELECT tt.eq((SELECT "rowJSON"->>'taskWorkCenterKind' FROM public.task_line_table WHERE "rowGUID" = :'l1'), 'person', 'the menu Resource says Person');
SELECT tt.line(:'t1', 'person', 'p-anna') AS l2 \gset
SELECT tt.eq((SELECT count(*) FROM public."workCenterTable" WHERE "rowJSON"->>'workCenterBase' = 'p-anna'), 1::bigint, 'the second line of the person reuses the work center');
SELECT tt.line(:'t1', 'equipment', 'e-crane') AS l3 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskWorkCenterKind' FROM public.task_line_table WHERE "rowGUID" = :'l3'), 'equipment', 'an equipment line: the menu says Equipment');
SELECT tt.eq((SELECT w."rowJSON"->>'workCenterKind' FROM public."workCenterTable" w WHERE w."rowGUID" = (SELECT "rowJSON"->>'taskResourceItem' FROM public.task_line_table WHERE "rowGUID" = :'l3')), 'equipment', 'the work center of the equipment');
SELECT tt.eq((SELECT w."rowJSON"->>'resourceCalendar' FROM public."workCenterTable" w WHERE w."rowJSON"->>'workCenterBase' = 'e-crane'), 'sixDayWeekCalendar', 'the work center takes the calendar of its base');

-- 2. an empty Time line is a work center line of the kind Person ---------------------------------------------------------------------------------------
SELECT tt.line(:'t1', NULL, NULL) AS l4 \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskResourceKind' || ':' || ("rowJSON"->>'taskWorkCenterKind') FROM public.task_line_table WHERE "rowGUID" = :'l4'), 'workCenter:person', 'an empty Time line: workCenter, menu Person');
-- the menu chosen by the user stays
INSERT INTO public.task_line_table ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('dddddddd-0000-0000-0000-000000000106', :'t1', 'timeGenus', '{"taskResourceKind":"workCenter","taskWorkCenterKind":"equipment"}');
SELECT tt.eq((SELECT "rowJSON"->>'taskWorkCenterKind' FROM public.task_line_table WHERE "rowGUID" = 'dddddddd-0000-0000-0000-000000000106'), 'equipment', 'the menu of an empty work center line stays');

-- 3. what is refused -----------------------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$INSERT INTO public.task_line_table ("rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('$q$ || :'t1' || $q$', 'timeGenus', '{"taskResourceKind":"workCenter","taskResourceItem":"p-anna"}')$q$, 'must be a work center', 'a person GUID on a work center line is refused');
SELECT tt.fails($q$INSERT INTO public.task_line_table ("rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('$q$ || :'t1' || $q$', 'timeGenus', '{"taskResourceKind":"person","taskResourceItem":"p-nobody"}')$q$, 'is not a person', 'a person that is not in the catalog: refused');
SELECT tt.fails($q$INSERT INTO public.task_line_table ("rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('$q$ || :'t1' || $q$', 'timeGenus', '{"taskResourceKind":"room"}')$q$, 'task_line_resource_kind_chk', 'an unknown kind is refused');
SELECT tt.fails($q$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"taskResourceKind":"person"}' WHERE "rowGUID" = '$q$ || :'l1' || $q$'$q$, 'is not a person', 'a work center line cannot be turned back into a person line (its item is a work center GUID, no person)');

-- 4. the other genus keeps its product ---------------------------------------------------------------------------------------------------------------
INSERT INTO public.task_line_table ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('dddddddd-0000-0000-0000-000000000107', :'t1', 'materialGenus', '{"taskResourceItem":"some-product"}');
SELECT tt.eq((SELECT "rowJSON"->>'taskResourceItem' FROM public.task_line_table WHERE "rowGUID" = 'dddddddd-0000-0000-0000-000000000107'), 'some-product', 'a Material line keeps its product');
SELECT tt.eq((SELECT "rowJSON"->>'taskResourceKind' FROM public.task_line_table WHERE "rowGUID" = 'dddddddd-0000-0000-0000-000000000107') IS NULL, true, '... and has no work center kind');

-- 5. a posted line that is converted needs Post again --------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT ("rowJSON"->>'taskIsPosted')::boolean FROM public.task_line_table WHERE "rowGUID" = :'l1') IS NOT TRUE, true, 'a new work center line is not posted');

-- 6. the capacity of a PERSON work center: the contract of its person wins over its own calendar --------------------------------------------------------------
SELECT tt.line(:'t1', 'person', 'p-boris') AS l5 \gset
SELECT w."rowGUID" AS wcb FROM public."workCenterTable" w WHERE w."rowJSON"->>'workCenterBase' = 'p-boris' \gset
SELECT tt.eq(public.organization_resource_capacity('workCenter', :'wcb', '2026-10-18'), 8::numeric, 'Sunday: the 7-day calendar of the contract of the person');
SELECT tt.eq((SELECT i.source FROM public.organization_resource_capacity_info('workCenter', :'wcb', '2026-10-18') i), 'contract', '... and it says where it came from');
SELECT tt.eq((SELECT i.source FROM public.organization_resource_capacity_info('workCenter', :'wcb', '2026-09-20') i), 'resource', 'before the contract: the calendar of the work center');

-- 7. the work center that a line books is not deleted ---------------------------------------------------------------------------------------------------
SELECT tt.fails($q$DELETE FROM public."workCenterTable" WHERE "rowJSON"->>'workCenterBase' = 'p-anna'$q$, 'is booked by a Time line', 'a booked work center is not deleted');

ROLLBACK;
