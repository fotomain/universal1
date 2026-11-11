-- PART 44: the RACI items (documentation/PERMISSIONS_WBS.html, section 3): managementRACIGenusTable (4 seeded rows, read only), task_line_table.rowJSON.raciItem of a Time line
-- (default raciResponsibleGUID, only a row of the catalog), the trigger does not touch the other genus, a signed-in user cannot change the catalog
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');

-- ---- the catalog -----------------------------------------------------------------------------------------------------------------------------
SELECT tt.eq((SELECT count(*) FROM public."managementRACIGenusTable"), 4::bigint, 'four RACI items');
SELECT tt.eq((SELECT string_agg("rowGUID", ',' ORDER BY "orderInList") FROM public."managementRACIGenusTable"),
             'raciResponsibleGUID,raciAccountableGUID,raciConsultedGUID,raciInformedGUID', 'Responsible, Accountable, Consulted, Informed in this order');
SELECT tt.eq((SELECT string_agg("rowJSON"->>'title', ',' ORDER BY "orderInList") FROM public."managementRACIGenusTable"), 'Responsible,Accountable,Consulted,Informed', 'the titles');
SELECT tt.eq((SELECT count(*) FROM public."managementRACIGenusTable" WHERE "rowOwnerGUID" = 'managementRACIGenusCatalog' AND "rowParentGUID" = 'empty' AND coalesce("rowJSON"->>'description', '') <> ''),
             4::bigint, 'every item: catalog owner, no folder, a description');

-- ---- a Time line --------------------------------------------------------------------------------------------------------------------------
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON")
VALUES ('aaaaaaaa-0000-0000-0000-000000000047', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000047'), '11111111-1111-1111-1111-111111111111', '{"name": "RACI project"}');
INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowJSON")
VALUES ('bbbbbbbb-0000-0000-0000-000000000047', public.pm_ltree_label('aaaaaaaa-0000-0000-0000-000000000047') || public.pm_ltree_label('bbbbbbbb-0000-0000-0000-000000000047'),
        'aaaaaaaa-0000-0000-0000-000000000047', '11111111-1111-1111-1111-111111111111', '{"taskDescription": "T", "rowKind": "task"}');

INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000047', 'timeGenus', '{"taskResourceKind": "person", "taskResourceItem": "p-x"}');
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'), 'raciResponsibleGUID', 'a new Time line without a RACI item is Responsible');

INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000047', 'timeGenus', '{"taskResourceKind": "person", "raciItem": "raciConsultedGUID"}');
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000002'), 'raciConsultedGUID', 'a chosen RACI item is kept');

INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000047', 'timeGenus', '{"taskResourceKind": "person", "raciItem": null}');
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000003'), 'raciResponsibleGUID', 'a JSON null becomes Responsible');

INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000047', 'timeGenus', '{"taskResourceKind": "person", "raciItem": "  "}');
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000004'), 'raciResponsibleGUID', 'a blank text becomes Responsible');

SELECT tt.fails($$INSERT INTO public.task_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('bbbbbbbb-0000-0000-0000-000000000047', 'timeGenus', '{"raciItem": "boss"}')$$,
                'is not a row of managementRACIGenusTable', 'an unknown RACI item is refused on insert');
SELECT tt.fails($$UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"raciItem": "raciResponsible"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'$$,
                'is not a row of managementRACIGenusTable', 'the code name without GUID is refused on update');

UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || '{"raciItem": "raciAccountableGUID"}' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'), 'raciAccountableGUID', 'the item can be changed');
UPDATE public.task_line_table SET "rowJSON" = "rowJSON" - 'raciItem' WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001';
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000001'), 'raciResponsibleGUID', 'removing the key gives Responsible again (never empty)');

-- ---- another genus is not touched ----------------------------------------------------------------------------------------------------------
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000047', 'materialGenus', '{"taskResourceItem": "prod-x"}');
SELECT tt.eq((SELECT "rowJSON" ? 'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000005'), false, 'a Material line gets no RACI item');

-- ---- the backfill: old Time lines (made without the trigger) become Responsible once, without touching updated_at -------------------------------------
ALTER TABLE public.task_line_table DISABLE TRIGGER trg_task_line_raci;
INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON", "updated_at") VALUES
  ('cccccccc-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000047', 'timeGenus', '{"taskResourceKind": "person"}', '2020-01-01');
ALTER TABLE public.task_line_table ENABLE TRIGGER trg_task_line_raci;
SELECT tt.eq((SELECT "rowJSON" ? 'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000006'), false, 'an old Time line has no RACI item yet');
DO $$
BEGIN
  ALTER TABLE public.task_line_table DISABLE TRIGGER USER;
  UPDATE public.task_line_table SET "rowJSON" = "rowJSON" || jsonb_build_object('raciItem', 'raciResponsibleGUID')
   WHERE "rowParentGUID" = 'timeGenus' AND COALESCE(btrim("rowJSON"->>'raciItem'), '') = '';
  ALTER TABLE public.task_line_table ENABLE TRIGGER USER;
END $$;
SELECT tt.eq((SELECT "rowJSON"->>'raciItem' FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000006'), 'raciResponsibleGUID', 'the backfill makes it Responsible');
SELECT tt.eq((SELECT "updated_at" FROM public.task_line_table WHERE "rowGUID" = 'cccccccc-0000-0000-0000-000000000006'), '2020-01-01'::timestamptz, 'updated_at stays (no "posted and changed" mark)');
SELECT tt.eq((SELECT count(*) FROM public.task_line_table WHERE "rowParentGUID" = 'timeGenus' AND coalesce("rowJSON"->>'raciItem', '') = ''), 0::bigint, 'no Time line is without a RACI item');

-- ---- a signed-in user only READS the catalog ---------------------------------------------------------------------------------------------------
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.eq((SELECT count(*) FROM public."managementRACIGenusTable"), 4::bigint, 'a user reads the four items');
SELECT tt.fails($$INSERT INTO public."managementRACIGenusTable" ("rowGUID", "rowJSON") VALUES ('raciBossGUID', '{"title": "Boss"}')$$, 'permission denied', 'a user cannot add an item');
SELECT tt.fails($$UPDATE public."managementRACIGenusTable" SET "rowJSON" = '{"title": "X"}'$$, 'permission denied', 'a user cannot change an item');
SELECT tt.fails($$DELETE FROM public."managementRACIGenusTable"$$, 'permission denied', 'a user cannot delete an item');

ROLLBACK;
