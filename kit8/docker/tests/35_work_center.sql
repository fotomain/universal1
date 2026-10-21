-- PART 35: workCenterTable (kind, base, business unit = folder, supplier partner), Copy Variant settings, the calendar (capacity of a work center), the kind 'workCenter' on a Time line, Post busy check
BEGIN;
SELECT tt.as_admin();

SELECT "rowGUID" AS bu1 FROM public."businessUnitTable" ORDER BY "rowGUID" LIMIT 1 \gset
SELECT "rowGUID" AS bu2 FROM public."businessUnitTable" WHERE "rowGUID" <> :'bu1' ORDER BY "rowGUID" LIMIT 1 \gset

INSERT INTO public."personTable" ("rowGUID","rowJSON") VALUES ('p-anna', '{"personFirstName":"Anna","personLastName":"K"}'), ('p-boris', '{"personFirstName":"Boris","personLastName":"M"}');
INSERT INTO public."equipmentTable" ("rowGUID","rowJSON") VALUES ('e-crane', '{"equipmentTitle":"Tower crane"}'), ('e-exc', '{"equipmentManufacturer":"Caterpillar","equipmentModel":"320"}');
INSERT INTO public."partnerTable" ("rowGUID","rowJSON") VALUES ('pa-sup', '{"partnerTitle":"Acme Logistics","partnerIsSupplier":true}'), ('pa-cus', '{"partnerTitle":"Customer only","partnerIsSupplier":false}');

-- 1. the kind, the base, the title ------------------------------------------------------------------------------------------------------------------
INSERT INTO public."workCenterTable" ("rowGUID","rowParentGUID","rowJSON") VALUES ('wc-anna', :'bu1', '{"workCenterKind":"person","workCenterBase":"p-anna"}');
SELECT tt.eq((SELECT "rowJSON"->>'workCenterTitle' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna'), 'Anna K', 'person: the title is the name of the base');
SELECT tt.eq((SELECT "rowJSON"->>'businessUnit' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna'), :'bu1', 'rowJSON.businessUnit follows the folder');
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna'), 'workCenterCatalog', 'the owner is the catalog');
SELECT tt.eq((SELECT "rowJSON"->>'isActive' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna'), 'true', 'a new work center is active');
INSERT INTO public."workCenterTable" ("rowGUID","rowParentGUID","rowJSON") VALUES ('wc-exc', :'bu1', '{"workCenterKind":"equipment","workCenterBase":"e-exc"}');
SELECT tt.eq((SELECT "rowJSON"->>'workCenterTitle' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-exc'), 'Caterpillar 320', 'equipment: manufacturer + model');
INSERT INTO public."workCenterTable" ("rowGUID","rowParentGUID","rowJSON") VALUES ('wc-sup', :'bu2', '{"workCenterKind":"partner","workCenterBase":"pa-sup","workCenterTitle":"Logistics line"}');
SELECT tt.eq((SELECT "rowJSON"->>'workCenterTitle' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-sup'), 'Logistics line', 'a typed title stays');

SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterBase":"p-boris"}')$q$, 'workCenterKind is required', 'no kind is refused');
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterKind":"room","workCenterBase":"p-boris"}')$q$, 'workCenterKind is required', 'an unknown kind is refused');
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterKind":"person"}')$q$, 'workCenterBase is required', 'no base is refused');
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterKind":"person","workCenterBase":"e-crane"}')$q$, 'is not a person catalog item', 'an equipment is no base of a Person work center');
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterKind":"equipment","workCenterBase":"p-boris"}')$q$, 'is not a equipment catalog item', 'a person is no base of an Equipment work center');
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterKind":"person","workCenterBase":"nobody"}')$q$, 'is not a person catalog item', 'an unknown base is refused');

-- one catalog item is the base of ONE work center
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu2' || $q$', '{"workCenterKind":"person","workCenterBase":"p-anna"}')$q$, 'already the base', 'a catalog item is the base of one work center only');

-- a Partner work center needs partnerIsSupplier (checked on save only)
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('$q$ || :'bu1' || $q$', '{"workCenterKind":"partner","workCenterBase":"pa-cus"}')$q$, 'partnerIsSupplier', 'a partner that is not a supplier is refused');
UPDATE public."partnerTable" SET "rowJSON" = "rowJSON" || '{"partnerIsSupplier": false}' WHERE "rowGUID" = 'pa-sup';
UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"workCenterTitle":"Logistics (flag removed)"}' WHERE "rowGUID" = 'wc-sup';
SELECT tt.eq((SELECT "rowJSON"->>'workCenterTitle' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-sup'), 'Logistics (flag removed)', 'a partner that loses the flag later: the work center is untouched and still editable');

-- 2. the folder = the business unit -------------------------------------------------------------------------------------------------------------------
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowJSON") VALUES ('{"workCenterKind":"person","workCenterBase":"p-boris"}')$q$, 'businessUnit is required', 'no folder and no business unit is refused');
SELECT tt.fails($q$INSERT INTO public."workCenterTable" ("rowParentGUID","rowJSON") VALUES ('nope', '{"workCenterKind":"person","workCenterBase":"p-boris"}')$q$, 'is not a business unit', 'an unknown business unit is refused');
INSERT INTO public."workCenterTable" ("rowGUID","rowJSON") VALUES ('wc-boris', ('{"workCenterKind":"person","workCenterBase":"p-boris","businessUnit":"' || :'bu2' || '"}')::jsonb);
SELECT tt.eq((SELECT "rowParentGUID" FROM public."workCenterTable" WHERE "rowGUID" = 'wc-boris'), :'bu2', 'only rowJSON.businessUnit given: the folder is made from it');
UPDATE public."workCenterTable" SET "rowParentGUID" = :'bu1' WHERE "rowGUID" = 'wc-boris';
SELECT tt.eq((SELECT "rowJSON"->>'businessUnit' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-boris'), :'bu1', 'moved to another folder: the business unit follows');
UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || jsonb_build_object('businessUnit', :'bu2') WHERE "rowGUID" = 'wc-boris';
SELECT tt.eq((SELECT "rowParentGUID" FROM public."workCenterTable" WHERE "rowGUID" = 'wc-boris'), :'bu2', 'business unit changed: the work center moves to that folder');

-- 3. Copy Variant settings ------------------------------------------------------------------------------------------------------------------------
INSERT INTO public."variantTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON","orderInList") VALUES
  ('bv-1', 'p-anna', 'empty', '{"descriptorKey":"dp10=dv13|dp11=dv15","isActive":true,"title":"Senior, English"}', 1),
  ('bv-2', 'p-anna', 'empty', '{"descriptorKey":"dp10=dv14","isActive":true,"title":"Middle"}', 2);
INSERT INTO public."variantValueTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON","orderInList") VALUES
  ('bvv-1', 'bv-1', 'dp10', '{"descriptorValueGUID":"dv13"}', 1), ('bvv-2', 'bv-1', 'dp11', '{"descriptorValueGUID":"dv15"}', 2);
SELECT tt.fails($q$UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"workCenterBaseVariant":"dp99=dv1"}' WHERE "rowGUID" = 'wc-anna'$q$, 'is not a variant of the base', 'the base variant must be a variant of the base');
SELECT tt.fails($q$SELECT public.work_center_copy_variant_settings('wc-anna')$q$, 'choose the base variant', 'no base variant chosen: nothing to copy');
UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"workCenterBaseVariant":"dp10=dv13|dp11=dv15"}' WHERE "rowGUID" = 'wc-anna';
SELECT tt.fails($q$UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"workCenterVariant":"dp10=dv13|dp11=dv15"}' WHERE "rowGUID" = 'wc-anna'$q$, 'use Copy Variant settings', 'the work center variant is made by the copy, not typed');
SELECT public.work_center_copy_variant_settings('wc-anna') AS nv \gset
SELECT tt.eq((SELECT "rowOwnerGUID" FROM public."variantTable" WHERE "rowGUID" = :'nv'), 'wc-anna', 'the new variant is owned by the work center');
SELECT tt.eq((SELECT "rowJSON"->>'descriptorKey' FROM public."variantTable" WHERE "rowGUID" = :'nv'), 'dp10=dv13|dp11=dv15', '... with the key of the base variant');
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public."variantTable" WHERE "rowGUID" = :'nv'), 'Senior, English', '... and its data');
SELECT tt.eq((SELECT count(*) FROM public."variantValueTable" WHERE "rowOwnerGUID" = :'nv'), 2::bigint, 'the descriptor values are copied');
SELECT tt.eq((SELECT "rowJSON"->>'workCenterVariant' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna'), 'dp10=dv13|dp11=dv15', 'workCenterVariant points at the copy');
SELECT tt.eq((SELECT count(*) FROM public."variantTable" WHERE "rowOwnerGUID" = 'p-anna'), 2::bigint, 'the base variants are untouched');
-- a one-time copy: a later change of the base variant does not reach it
UPDATE public."variantTable" SET "rowJSON" = "rowJSON" || '{"title":"Senior, English (renamed)"}' WHERE "rowGUID" = 'bv-1';
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public."variantTable" WHERE "rowGUID" = :'nv'), 'Senior, English', 'a later change of the base variant does not reach the copy');
-- it exists: refused unless the user confirmed
SELECT tt.fails($q$SELECT public.work_center_copy_variant_settings('wc-anna')$q$, 'confirm to overwrite', 'a second copy without confirmation is refused');
UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"workCenterBaseVariant":"dp10=dv14"}' WHERE "rowGUID" = 'wc-anna';
SELECT public.work_center_copy_variant_settings('wc-anna', true) AS nv2 \gset
SELECT tt.eq((SELECT count(*) FROM public."variantTable" WHERE "rowOwnerGUID" = 'wc-anna'), 1::bigint, 'overwrite: the work center still has ONE variant of its own');
SELECT tt.eq((SELECT "rowJSON"->>'descriptorKey' FROM public."variantTable" WHERE "rowOwnerGUID" = 'wc-anna'), 'dp10=dv14', '... the new copy');
SELECT tt.eq((SELECT count(*) FROM public."variantValueTable" WHERE "rowOwnerGUID" = :'nv'), 0::bigint, '... the values of the old one are gone');
SELECT tt.eq((SELECT "rowJSON"->>'workCenterVariant' FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna'), 'dp10=dv14', '... and the pointer follows');
-- a partner has no variants
SELECT tt.fails($q$SELECT public.work_center_copy_variant_settings('wc-sup')$q$, 'choose the base variant', 'a partner has no base variant to copy');
SELECT tt.fails($q$SELECT public.work_center_copy_variant_settings('nope')$q$, 'does not exist', 'an unknown work center');

-- 4. the calendar = the capacity of a work center -----------------------------------------------------------------------------------------------------
INSERT INTO public."managementCalendarTable" ("rowGUID","rowOwnerGUID","rowParentGUID","rowJSON") VALUES
  ('wcCalendar', 'managementCalendarCatalog', 'equipmentCalendarFolder', '{"title":"Work center 6 h","kind":"resource","hoursPerDay":6}');
SELECT public.fill_management_calendar('wcCalendar', 2026, 'fiveDays');
SELECT tt.fails($q$UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar":"workingDaysCalendar"}' WHERE "rowGUID" = 'wc-exc'$q$, 'not a resource calendar', 'a project calendar is no work center calendar');
SELECT tt.eq(public.organization_resource_capacity('workCenter','wc-exc','2026-10-14'), 8::numeric, 'no calendar: the Standard work week (8 h)');
SELECT tt.eq((SELECT source FROM public.organization_resource_capacity_info('workCenter','wc-exc','2026-10-14')), 'standard', '... told as standard');
UPDATE public."workCenterTable" SET "rowJSON" = "rowJSON" || '{"resourceCalendar":"wcCalendar"}' WHERE "rowGUID" = 'wc-exc';
SELECT tt.eq(public.organization_resource_capacity('workCenter','wc-exc','2026-10-14'), 6::numeric, 'its own calendar: 6 h');
SELECT tt.eq((SELECT source FROM public.organization_resource_capacity_info('workCenter','wc-exc','2026-10-14')), 'resource', '... told as resource');
SELECT tt.eq(public.organization_resource_capacity('workCenter','wc-exc','2026-10-17'), 0::numeric, 'Saturday 0 h');
SELECT tt.fails($q$DELETE FROM public."managementCalendarTable" WHERE "rowGUID" = 'wcCalendar'$q$, 'is the resourceCalendar', 'a calendar of a work center is not deleted');
SELECT tt.eq((SELECT count(*) FROM public.organization_resource_calendars('workCenter', 'wc-exc') c WHERE c = 'wcCalendar'), 1::bigint, 'organization_resource_calendars lists the calendar of the work center');
SELECT tt.eq(public.organization_resource_title('workCenter', 'wc-exc'), 'Caterpillar 320', 'the title of a work center for a message');

-- 5. a Time line books a work center: the kind is allowed, the Post busy check uses its calendar ------------------------------------------------------
SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K') AS anna \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111'); SELECT public.pm_seed_demo();
SELECT tt.as_admin();
SELECT t."rowGUID" AS ta1 FROM public.project_task_table t WHERE t."rowOwnerGUID" = '11111111-1111-1111-1111-111111111111' AND t."rowJSON"->>'taskDescription' = 'Task 111' \gset
SELECT tt.line(:'ta1', 'workCenter', 'wc-exc') AS lw \gset
SELECT tt.eq((SELECT "rowJSON"->>'taskResourceKind' FROM public.task_line_table WHERE "rowGUID" = :'lw'), 'workCenter', 'a Time line may book a work center');
SELECT tt.fails($q$INSERT INTO public.task_line_table ("rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('$q$ || :'ta1' || $q$', 'materialGenus', '{"taskResourceKind":"workCenter"}')$q$, 'task_line_resource_kind_chk', 'only a Time line may book a work center');
SELECT tt.fails($q$INSERT INTO public.task_line_table ("rowOwnerGUID","rowParentGUID","rowJSON") VALUES ('$q$ || :'ta1' || $q$', 'timeGenus', '{"taskResourceKind":"room"}')$q$, 'task_line_resource_kind_chk', 'an unknown kind of a Time line is refused');
UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{"resourceCapacityStrongMode": "capacityModeBlock"}' WHERE "rowGUID" = :'anna'::jsonb->>'organizationGUID';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 6}}]', :'lw')::jsonb) AS r1 \gset
SELECT tt.eq(:'r1'::jsonb->'busy', '[]'::jsonb, 'exactly the 6 h of the work center calendar is not busy');
SELECT tt.eq((SELECT count(*) FROM public.task_line_plan_movements WHERE "rowParentGUID" = :'lw'), 1::bigint, '... and the day is posted');
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 7}}]', :'lw')::jsonb) AS r2 \gset
SELECT tt.eq((:'r2'::jsonb->'busy'->0->>'capacityHours')::numeric, 6::numeric, '7 h is over the 6 h of ITS calendar (the Standard week would have allowed 8)');
SELECT tt.eq((:'r2'::jsonb->'busy'->0->>'overHours')::numeric, 1::numeric, '... by 1 h');
SELECT tt.eq((:'r2'::jsonb->'busy'->0->>'resourceKind'), 'workCenter', '... the conflict names the kind');

-- the calendar lock: a change that would put the work center under its posted hours is refused
SELECT tt.post(:'ta1', format('[{"line": "%s", "days": {"2026-10-14": 6}}]', :'lw')::jsonb) AS r3 \gset
SELECT tt.as_admin();
SELECT tt.fails($q$UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 4}' WHERE "rowGUID" = 'wcCalendar:2026-10-14'$q$, 'h booked', 'the hours of a posted day cannot go under the booked 6 h');
-- raising is always allowed
UPDATE public."managementCalendarDaysTable" SET "rowJSON" = "rowJSON" || '{"hours": 8}' WHERE "rowGUID" = 'wcCalendar:2026-10-14';
SELECT tt.eq((SELECT ("rowJSON"->>'hours')::numeric FROM public."managementCalendarDaysTable" WHERE "rowGUID" = 'wcCalendar:2026-10-14'), 8::numeric, 'raising the hours of a posted day is allowed');

-- the vendor of a work center line (vendor invoice candidates; the ROI rule "does the cost have a vendor"): a Partner work center IS the supplier, an Equipment work center has the main vendor of its equipment,
-- a Person work center none
SELECT tt.as_admin();
INSERT INTO public."partnerTable" ("rowGUID","rowJSON") VALUES ('pa-sup2', '{"partnerTitle":"Second supplier","partnerIsSupplier":true}');
UPDATE public."equipmentTable" SET "rowJSON" = "rowJSON" || '{"mainVendorGUID":"pa-sup2"}' WHERE "rowGUID" = 'e-exc';
INSERT INTO public."workCenterTable" ("rowGUID","rowParentGUID","rowJSON") VALUES ('wc-sup2', :'bu1', '{"workCenterKind":"partner","workCenterBase":"pa-sup2"}');
SELECT tt.line(:'ta1', 'workCenter', 'wc-sup2') AS lp \gset
SELECT tt.line(:'ta1', 'workCenter', 'wc-boris') AS lb \gset
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT public.vendor_invoice_candidates(:'ta1', ARRAY[:'lw'::uuid]) AS c_eq \gset
SELECT tt.eq((:'c_eq'::jsonb)->'rows'->0->>'partnerGUID', 'pa-sup2', 'an Equipment work center: the main vendor of its equipment is the vendor of the line');
SELECT public.vendor_invoice_candidates(:'ta1', ARRAY[:'lp'::uuid]) AS c_pa \gset
SELECT tt.eq((:'c_pa'::jsonb)->'rows'->0->>'partnerGUID', 'pa-sup2', 'a Partner work center IS the supplier: its partner is the vendor of the line');
SELECT public.vendor_invoice_candidates(:'ta1', ARRAY[:'lb'::uuid]) AS c_pe \gset
SELECT tt.eq(jsonb_array_length((:'c_pe'::jsonb)->'rows'), 0, 'a Person work center has no vendor ...');
SELECT tt.eq(((:'c_pe'::jsonb)->>'skipped')::int, 1, '... the line is counted as a line without a vendor');
SELECT tt.as_admin();
SELECT tt.eq(public.pm_line_has_vendor('timeGenus', '{"taskResourceKind":"workCenter","taskResourceItem":"wc-sup2"}'::jsonb), true, 'ROI: the cost of a Partner work center has a vendor');
SELECT tt.eq(public.pm_line_has_vendor('timeGenus', '{"taskResourceKind":"workCenter","taskResourceItem":"wc-exc"}'::jsonb), true, 'ROI: an Equipment work center has the main vendor of its equipment');
SELECT tt.eq(public.pm_line_has_vendor('timeGenus', '{"taskResourceKind":"workCenter","taskResourceItem":"wc-boris"}'::jsonb), false, 'ROI: a Person work center is own cost');
SELECT tt.eq(public.pm_line_has_vendor('timeGenus', '{"taskResourceKind":"person","taskResourceItem":"p-boris"}'::jsonb), false, 'ROI: a person is own cost, as before');

-- a work center that a Time line books is not deleted; an unused one is, with its variants
SELECT tt.fails($q$DELETE FROM public."workCenterTable" WHERE "rowGUID" = 'wc-exc'$q$, 'is booked by a Time line', 'a booked work center is not deleted');
DELETE FROM public."workCenterTable" WHERE "rowGUID" = 'wc-anna';
SELECT tt.eq((SELECT count(*) FROM public."variantTable" WHERE "rowOwnerGUID" = 'wc-anna'), 0::bigint, 'an unused work center is deleted with its own variants');
SELECT tt.eq((SELECT count(*) FROM public."variantTable" WHERE "rowOwnerGUID" = 'p-anna'), 2::bigint, '... the variants of the base stay');
SELECT tt.eq((SELECT count(*) FROM public."personTable" WHERE "rowGUID" = 'p-anna'), 1::bigint, '... and the base');

ROLLBACK;
