-- =====================================================================================
-- UNIVERSAL1 - EQUIPMENT IN THE TASKS: equipment_sql_roles_and_more.sql
-- Paste into the Supabase SQL editor and Run. IDEMPOTENT: every row has a fixed id, a second run changes nothing it already made.
-- Run AFTER start1_sql_structure.sql (PART 17: equipment tables, the role type "Equipment Resources", task_line_table.rowJSON.taskResourceKind).
--
-- What it does, in this order:
--   1. MORE ROLES AND EQUIPMENT: 3 more roles of "Equipment Resources" (Road roller, Concrete mixer truck, Generator 50 kVA) with their minimum engine power and hourly
--      rates, and 3 more machines (Bomag BW 213, Mercedes Arocs mixer, Atlas Copco QAS 40) with engine power, year and variants (class x hire mode).
--   2. ONE PROJECT (the name is set below): switches the equipment inputs on in its settings
--      (projectExpenseBudgetNeeded, projectTimeCostsNeeded, projectTimeOfPersonNeeded, projectTimeOfEquipmentNeeded = true) - the Finances view then offers the
--      menu "Resource: Person | Equipment" on the Time tab.
--   3. TIME LINES OF EQUIPMENT on the first tasks of that project (v_lines of them, one per task, cycling through the 7 machines): taskResourceKind 'equipment', the role,
--      the machine, the variant, hours, the hourly rate of the role (the price list and the rate the app would pick), the sums and the budget item - ready to Post.
--
-- The lines are NOT posted: open the Finances view of the project, check them, press Post.
-- Nothing is deleted. To take the demo lines away again:
--   DELETE FROM public.task_line_table WHERE "rowJSON"->>'demoEquipmentLine' = 'true';
-- =====================================================================================

DO $$
DECLARE
  -- ---- SET THESE ----------------------------------------------------------------------
  v_project_name text    := 'Demo';   -- the project (its name; an exact name wins, else the first name that CONTAINS this text, case-insensitive)
  v_lines        integer := 4;        -- how many tasks get a line of equipment (the first tasks of the project, in tree order)
  -- --------------------------------------------------------------------------------------
BEGIN
  IF to_regclass('public."equipmentTable"') IS NULL OR to_regclass('public.task_line_table') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public."resourceRoleTypeTable" WHERE "rowGUID" = 'equipmentResources') THEN
    RAISE EXCEPTION 'Run start1_sql_structure.sql first (PART 17: the equipment tables and the role type "Equipment Resources")';
  END IF;
  IF v_lines < 0 OR v_lines > 7 THEN RAISE EXCEPTION 'v_lines must be 0 .. 7'; END IF;
  -- the values are read by the statements below through a setting of this session
  PERFORM set_config('equipment_demo.project_name', v_project_name, false);
  PERFORM set_config('equipment_demo.lines', v_lines::text, false);
END $$;

-- ---- 1. more roles of "Equipment Resources" ---------------------------------------------------------------------------------
INSERT INTO public."resourceRoleTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('eqr_roller',    'equipmentResources', 'fld_res_eq', 40000, '{"title": "Road roller", "description": "Vibratory roller for compacting soil and asphalt.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('eqr_mixer',     'equipmentResources', 'fld_res_eq', 41000, '{"title": "Concrete mixer truck", "description": "Truck mixer: delivery and pouring of ready-mixed concrete.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('eqr_generator', 'equipmentResources', 'fld_res_eq', 42000, '{"title": "Generator 50 kVA", "description": "Mobile diesel generator for power on site.", "roleVATRate": null, "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

-- what the roles require: a minimum engine power (the plan line of the set of the role type)
INSERT INTO public."propertyValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pp_eqr_roller_pow',    'eqr_roller',    'dp_eqr_p1', 714000, '{"value": 90}'::jsonb),
  ('pp_eqr_mixer_pow',     'eqr_mixer',     'dp_eqr_p1', 715000, '{"value": 200}'::jsonb),
  ('pp_eqr_generator_pow', 'eqr_generator', 'dp_eqr_p1', 716000, '{"value": 35}'::jsonb)
ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

-- the hourly rates: Bill + Cost of every role, and a higher Bill rate of the variant With operator (the variants of the role type exist: PART 17)
INSERT INTO public."rolePriceTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('rp_eqr_roller_bill',       'eqr_roller',    'empty',           102000, '{"priceTypeGUID": "pt_bill", "price": 70,  "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_roller_cost',       'eqr_roller',    'empty',           103000, '{"priceTypeGUID": "pt_cost", "price": 45,  "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_roller_bill_op',    'eqr_roller',    'rv_eqr_med_op',   104000, '{"priceTypeGUID": "pt_bill", "price": 92,  "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_mixer_bill',        'eqr_mixer',     'empty',           105000, '{"priceTypeGUID": "pt_bill", "price": 120, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_mixer_cost',        'eqr_mixer',     'empty',           106000, '{"priceTypeGUID": "pt_cost", "price": 80,  "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_mixer_bill_op',     'eqr_mixer',     'rv_eqr_heavy_op', 107000, '{"priceTypeGUID": "pt_bill", "price": 150, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_generator_bill',    'eqr_generator', 'empty',           108000, '{"priceTypeGUID": "pt_bill", "price": 18,  "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_eqr_generator_cost',    'eqr_generator', 'empty',           109000, '{"priceTypeGUID": "pt_cost", "price": 11,  "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb)
ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

-- ---- 1b. more machines (all of the type Heavy machinery: its descriptor sets dp_eqh_*) ----------------------------------------
INSERT INTO public."equipmentTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT v.guid, 'equipmentCatalog', 'empty', v.ord,
       jsonb_build_object('equipmentTitle', v.title, 'equipmentCode', v.code, 'equipmentType', 'equipmentTypeHeavy', 'equipmentOwnership', v.owned,
                          'equipmentManufacturer', v.maker, 'equipmentModel', v.model, 'equipmentSerialNumber', v.serial, 'isActive', true)
  FROM (VALUES
    ('eq_bomag213', 7000, 'Road roller Bomag BW 213',        'EQ-007', 'own',    'Bomag',       'BW 213 D-5',  'BOM213D5'),
    ('eq_arocs',    8000, 'Concrete mixer Mercedes Arocs',   'EQ-008', 'leased', 'Mercedes-Benz','Arocs 3240', 'MBAROCS8'),
    ('eq_qas40',    9000, 'Generator Atlas Copco QAS 40',    'EQ-009', 'rented', 'Atlas Copco', 'QAS 40',      'AC40GEN9')
  ) AS v(guid, ord, title, code, owned, maker, model, serial)
ON CONFLICT ("rowGUID") DO UPDATE SET "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

INSERT INTO public."propertyValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'pp_eq_' || v.kind || '_' || v.guid, v.guid, 'dp_eqh_' || CASE v.kind WHEN 'pow' THEN 'p1' ELSE 'p2' END, 300100 + v.ord, jsonb_build_object('value', v.val)
  FROM (VALUES
    ('eq_bomag213', 'pow', 1, 105), ('eq_bomag213', 'year', 2, 2021),
    ('eq_arocs',    'pow', 3, 260), ('eq_arocs',    'year', 4, 2020),
    ('eq_qas40',    'pow', 5, 40),  ('eq_qas40',    'year', 6, 2022)
  ) AS v(guid, kind, ord, val)
ON CONFLICT ("rowGUID") DO UPDATE SET "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

-- what each machine can be BOOKED AS (class x hire mode); the key lists the plan lines of the variant set of the type, sorted by plan line
INSERT INTO public."variantTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'evar_' || v.guid || '_' || v.k, v.guid, 'empty', 310100 + v.ord,
       jsonb_build_object('title', v.cls_title || ', ' || v.hire_title, 'descriptorKey', 'dp_eqh_v1=' || v.cls || '|dp_eqh_v2=' || v.hire, 'isActive', true)
  FROM (VALUES
    ('eq_bomag213', 'a', 1, 'dv_eqc_medium', 'Medium', 'dv_hm_op',  'With operator'),
    ('eq_bomag213', 'b', 2, 'dv_eqc_medium', 'Medium', 'dv_hm_dry', 'Dry hire'),
    ('eq_arocs',    'a', 3, 'dv_eqc_heavy',  'Heavy',  'dv_hm_op',  'With operator'),
    ('eq_qas40',    'a', 4, 'dv_eqc_light',  'Light',  'dv_hm_dry', 'Dry hire')
  ) AS v(guid, k, ord, cls, cls_title, hire, hire_title)
ON CONFLICT ("rowGUID") DO UPDATE SET "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

INSERT INTO public."variantValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'evv_' || v.guid || '_' || v.k || '_' || parts.part, 'evar_' || v.guid || '_' || v.k, CASE parts.part WHEN 'c' THEN 'dp_eqh_v1' ELSE 'dp_eqh_v2' END,
       320100 + v.ord * 10 + CASE parts.part WHEN 'c' THEN 1 ELSE 2 END,
       jsonb_build_object('descriptorValueGUID', CASE parts.part WHEN 'c' THEN v.cls ELSE v.hire END)
  FROM (VALUES
    ('eq_bomag213', 'a', 1, 'dv_eqc_medium', 'dv_hm_op'), ('eq_bomag213', 'b', 2, 'dv_eqc_medium', 'dv_hm_dry'),
    ('eq_arocs',    'a', 3, 'dv_eqc_heavy',  'dv_hm_op'), ('eq_qas40',    'a', 4, 'dv_eqc_light',  'dv_hm_dry')
  ) AS v(guid, k, ord, cls, hire)
  CROSS JOIN (VALUES ('c'), ('h')) AS parts(part)
ON CONFLICT ("rowGUID") DO UPDATE SET "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON", "updated_at" = now();

-- ---- 2. + 3. the project: switch the equipment inputs on, add Time lines of equipment to its first tasks ------------------------
DO $$
DECLARE
  v_name    text    := current_setting('equipment_demo.project_name');
  v_lines   integer := current_setting('equipment_demo.lines')::integer;
  v_project uuid;
  v_title   text;
  v_made    integer := 0;
  v_cnt     integer;
  v_names   text;
  v_pick    jsonb;
  v_rate    numeric;
  v_qty     numeric;
  v_sum     numeric;
  v_vat     numeric := 21;
  r         record;
  -- the 7 machines: role, the variant of the role (its key + the row of the rate), the machine, the variant of the machine, hours
  v_picks   jsonb := '[
    {"role": "eqr_excavator", "rvar": "rv_eqr_heavy_op",  "rkey": "dp_eqr_v1=dv_eqc_heavy|dp_eqr_v2=dv_hm_op",   "eq": "eq_cat320",   "ekey": "dp_eqh_v1=dv_eqc_heavy|dp_eqh_v2=dv_hm_op",   "hours": 16},
    {"role": "eqr_crane",     "rvar": "rv_eqr_heavy_op",  "rkey": "dp_eqr_v1=dv_eqc_heavy|dp_eqr_v2=dv_hm_op",   "eq": "eq_ltm1050",  "ekey": "dp_eqh_v1=dv_eqc_heavy|dp_eqh_v2=dv_hm_op",   "hours": 8},
    {"role": "eqr_loader",    "rvar": "rv_eqr_heavy_dry", "rkey": "dp_eqr_v1=dv_eqc_heavy|dp_eqr_v2=dv_hm_dry",  "eq": "eq_cat926",   "ekey": "dp_eqh_v1=dv_eqc_heavy|dp_eqh_v2=dv_hm_dry",  "hours": 24},
    {"role": "eqr_van",       "rvar": "rv_eqr_light_op",  "rkey": "dp_eqr_v1=dv_eqc_light|dp_eqr_v2=dv_hm_op",   "eq": "eq_crafter",  "ekey": "dp_eqv_v1=dv_eqc_light|dp_eqv_v2=dv_hm_op",   "hours": 12},
    {"role": "eqr_roller",    "rvar": "rv_eqr_med_op",    "rkey": "dp_eqr_v1=dv_eqc_medium|dp_eqr_v2=dv_hm_op",  "eq": "eq_bomag213", "ekey": "dp_eqh_v1=dv_eqc_medium|dp_eqh_v2=dv_hm_op",  "hours": 20},
    {"role": "eqr_mixer",     "rvar": "rv_eqr_heavy_op",  "rkey": "dp_eqr_v1=dv_eqc_heavy|dp_eqr_v2=dv_hm_op",   "eq": "eq_arocs",    "ekey": "dp_eqh_v1=dv_eqc_heavy|dp_eqh_v2=dv_hm_op",   "hours": 6},
    {"role": "eqr_generator", "rvar": "rv_eqr_light_dry", "rkey": "dp_eqr_v1=dv_eqc_light|dp_eqr_v2=dv_hm_dry",  "eq": "eq_qas40",    "ekey": "dp_eqh_v1=dv_eqc_light|dp_eqh_v2=dv_hm_dry",  "hours": 40}
  ]'::jsonb;
BEGIN
  -- the project: an exact name, else the first name that contains the text
  SELECT p."rowGUID", p."rowJSON"->>'name' INTO v_project, v_title
    FROM public.project_table p
   WHERE lower(p."rowJSON"->>'name') LIKE '%' || lower(v_name) || '%'
   ORDER BY (lower(p."rowJSON"->>'name') = lower(v_name)) DESC, p."created_at"
   LIMIT 1;
  IF v_project IS NULL THEN
    SELECT string_agg('"' || COALESCE("rowJSON"->>'name', '?') || '"', ', ' ORDER BY "created_at") INTO v_names FROM public.project_table;
    RAISE EXCEPTION 'No project named like "%". Set v_project_name at the top of the script to one of: %', v_name, COALESCE(v_names, '(there is no project yet)');
  END IF;

  -- the equipment inputs of the project (kit8/pm/model/taskInputScope.ts): the master "Expense budget needed" + Time of person AND of equipment
  UPDATE public.project_table
     SET "rowJSON" = "rowJSON" || jsonb_build_object(
           'projectExpenseBudgetNeeded', true, 'projectTimeCostsNeeded', true, 'projectTimeOfPersonNeeded', true, 'projectTimeOfEquipmentNeeded', true)
   WHERE "rowGUID" = v_project;
  RAISE NOTICE 'Project "%" (%): the equipment inputs are on', v_title, v_project;

  -- the first tasks (not stages) in tree order: one Time line of equipment each, cycling through the 7 machines
  FOR r IN
    SELECT t."rowGUID" AS task, row_number() OVER (ORDER BY t."treePath", t."orderInList") AS n
      FROM public.project_task_table t
     WHERE t."projectGUID" = v_project AND COALESCE(t."rowJSON"->>'rowKind', 'task') IN ('task', 'milestone')
     ORDER BY t."treePath", t."orderInList"
     LIMIT v_lines
  LOOP
    v_pick := v_picks -> (((r.n - 1) % 7)::integer);
    v_qty  := (v_pick->>'hours')::numeric;
    -- the rate: the first price list (by its order) that is meant for roles and has a rate of this role valid today; in it the row of the variant of the role
    -- beats the "all variants" row, then the latest validFrom wins
    SELECT (rp."rowJSON"->>'price')::numeric INTO v_rate
      FROM public."rolePriceTable" rp
      JOIN public."priceTypeTable" pt ON pt."rowGUID" = rp."rowJSON"->>'priceTypeGUID'
     WHERE rp."rowOwnerGUID" = v_pick->>'role'
       AND (NOT (pt."rowJSON" ? 'appliesTo') OR pt."rowJSON"->'appliesTo' ? 'resourceRoleType')
       AND rp."rowParentGUID" IN ('empty', v_pick->>'rvar') AND (rp."rowJSON"->>'validFrom')::date <= CURRENT_DATE
     ORDER BY pt."orderInList", (rp."rowParentGUID" = v_pick->>'rvar') DESC, (rp."rowJSON"->>'validFrom') DESC
     LIMIT 1;
    v_sum := round(v_qty * COALESCE(v_rate, 0), 2);
    INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (
      md5('equipment-demo-line-' || r.task::text)::uuid, r.task, 'timeGenus', r.n * 100,
      jsonb_build_object(
        'taskManagementGenusLine', 'timeGenus', 'taskResourceKind', 'equipment',
        'resourceRoleItem', v_pick->>'role', 'resourceRoleAttributeSetKey', v_pick->>'rkey',
        'taskResourceItem', v_pick->>'eq', 'taskResourceAttributesKey', v_pick->>'ekey',
        'qtyTaskLine', v_qty, 'measureUnitTaskLine', 'unit_hour', 'vatRatioTaskLine', v_vat,
        'priceTaskLine', v_rate, 'priceAutoTaskLine', v_rate, 'priceSourceTaskLine', CASE WHEN v_rate IS NULL THEN NULL ELSE 'role' END,
        'sumForContract', v_sum, 'sumVATForContract', round(v_sum * v_vat / 100, 2),
        'budgetItemTaskLine', 'timeBudgetItem', 'distributionForBudgetTaskLine', 'uniformDistribution',
        'taskIsPosted', false, 'demoEquipmentLine', true))
    ON CONFLICT ("rowGUID") DO NOTHING;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_made := v_made + v_cnt;
  END LOOP;
  RAISE NOTICE 'Time lines of equipment: % new (the others of the first % tasks were there already). Open the Finances view of the project, check them, press Post.', v_made, v_lines;
  IF NOT FOUND AND v_lines > 0 THEN RAISE NOTICE 'The project has no task yet: add tasks, then run this script again.'; END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT t."rowJSON"->>'name' AS task, r."rowJSON"->>'title' AS role, e."rowJSON"->>'equipmentTitle' AS equipment, l."rowJSON"->>'qtyTaskLine' AS hours,
--          l."rowJSON"->>'priceTaskLine' AS price, l."rowJSON"->>'sumForContract' AS sum
--     FROM public.task_line_table l
--     JOIN public.project_task_table t ON t."rowGUID" = l."rowOwnerGUID"
--     JOIN public."resourceRoleTable" r ON r."rowGUID" = l."rowJSON"->>'resourceRoleItem'
--     JOIN public."equipmentTable" e ON e."rowGUID" = l."rowJSON"->>'taskResourceItem'
--    WHERE l."rowJSON"->>'taskResourceKind' = 'equipment' ORDER BY t."treePath";
