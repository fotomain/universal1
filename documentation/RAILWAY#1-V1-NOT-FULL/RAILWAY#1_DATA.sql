-- ===============================================================================================
-- UNIVERSAL1 - RAILWAY #1 DATA SEED: RAILWAY#1_DATA.sql
-- Project: Railway #1: New York Washington-Contract for Construction Works on the New York – Washington Section of the Northeast Corridor
-- Dates: 2026-01-01 to 2026-12-31
-- Target Schema: Universal1 PM & ERP System (/kit8/sql/start/start1_sql_tables.sql)
--
-- Single Task with Exactly 1 Line per Management Genus:
--   1. revenueGenus  : Deliverable Railroad Segment No. 1 (225 miles @ $1,200,000.00 / mile = $270,000,000.00)
--   2. materialGenus : 136 RE carbon steel rail (80-Foot Stick) (29,700 sticks @ $1,850.00 / stick = $54,945,000.00)
--   3. expenseGenus  : Tamper Equipment: Plasser 09-3X / Dynacat (6,750 hours @ $650.00 / hour = $4,387,500.00)
--   4. timeGenus     : Machine (RMM) Operator: John Rimm (6,750 hours @ $95.00 / hour = $641,250.00)
--
-- Full 5-Document Project Lifecycle (with register movements):
--   1. Purchase Order   : PO-NYWAS-00001 (Ordered: 29,700 sticks of rail + 6,750 tamper hours = $59,332,500.00)
--   2. Product Receipt  : PR-NYWAS-00001 (Received: 10,000 sticks of rail + 2,250 tamper hours = $19,962,500.00)
--   3. Fact Input       : FI-NYWAS-00001 (Used/Progress: 10,000 sticks + 2,250 tamper hrs + 2,250 operator hrs + 75 mi deliverable)
--   4. Vendor Invoice   : VI-SUPP-98421  (Invoiced: 10,000 sticks + 2,250 tamper hours = $19,962,500.00)
--   5. Customer Invoice : CI-AMTRK-2026-001 (Sold: 75 miles milestone billing @ $1,200,000.00 = $90,000,000.00)
--
-- Safe, idempotent script. Can be executed multiple times.
-- ===============================================================================================

BEGIN;

DO $$
DECLARE
  v_owner               uuid;
  v_org                 text;
  v_project             uuid := 'a1000000-0000-4000-8000-000000000001'::uuid;
  v_stage               uuid := 'a2000000-0000-4000-8000-000000000001'::uuid;
  v_task                uuid := 'a3000000-0000-4000-8000-000000000001'::uuid;
  
  -- Task Lines (1 line per leaf management genus)
  v_line_revenue        uuid := 'b1000000-0000-4000-8000-000000000001'::uuid;
  v_line_material       uuid := 'b2000000-0000-4000-8000-000000000002'::uuid;
  v_line_expense        uuid := 'b3000000-0000-4000-8000-000000000003'::uuid;
  v_line_time           uuid := 'b4000000-0000-4000-8000-000000000004'::uuid;

  -- Document Headers
  v_po_header           uuid := 'c1000000-0000-4000-8000-000000000001'::uuid;
  v_pr_header           uuid := 'c2000000-0000-4000-8000-000000000002'::uuid;
  v_fact_header         uuid := 'c3000000-0000-4000-8000-000000000003'::uuid;
  v_vi_header           uuid := 'c4000000-0000-4000-8000-000000000004'::uuid;
  v_ci_header           uuid := 'c5000000-0000-4000-8000-000000000005'::uuid;

  -- Purchase Order Lines
  v_po_line_mat         uuid := 'd1000000-0000-4000-8000-000000000001'::uuid;
  v_po_line_exp         uuid := 'd1000000-0000-4000-8000-000000000002'::uuid;

  -- Product Receipt Lines
  v_pr_line_mat         uuid := 'd2000000-0000-4000-8000-000000000001'::uuid;
  v_pr_line_exp         uuid := 'd2000000-0000-4000-8000-000000000002'::uuid;

  -- Fact Input Lines
  v_fact_line_rev       uuid := 'd3000000-0000-4000-8000-000000000001'::uuid;
  v_fact_line_mat       uuid := 'd3000000-0000-4000-8000-000000000002'::uuid;
  v_fact_line_exp       uuid := 'd3000000-0000-4000-8000-000000000003'::uuid;
  v_fact_line_time      uuid := 'd3000000-0000-4000-8000-000000000004'::uuid;

  -- Vendor Invoice Lines
  v_vi_line_mat         uuid := 'd4000000-0000-4000-8000-000000000001'::uuid;
  v_vi_line_exp         uuid := 'd4000000-0000-4000-8000-000000000002'::uuid;

  -- Customer Invoice Line
  v_ci_line_rev         uuid := 'd5000000-0000-4000-8000-000000000001'::uuid;

  -- Quantities & Financial Totals
  c_miles_total         numeric := 225.00;
  c_miles_price         numeric := 1200000.00;        -- $1.2M per mile turnkey track construction
  c_miles_sum           numeric := 270000000.00;

  c_rail_sticks_total   numeric := 29700.00;          -- 2 rails * 225 mi * 5280 ft / 80 ft stick
  c_rail_stick_price    numeric := 1850.00;           -- $1,850 per 80-ft 136 RE carbon rail stick (spec: $1,600-$2,200)
  c_rail_sum            numeric := 54945000.00;

  c_tamper_hours_total  numeric := 6750.00;
  c_tamper_hour_rate    numeric := 650.00;            -- $650/hr Plasser 09-3X Dynacat tamper wet machine rate
  c_tamper_sum          numeric := 4387500.00;

  c_operator_hours_total numeric := 6750.00;
  c_operator_hour_rate   numeric := 95.00;            -- $95/hr specialized RMM union operator prevailing wage
  c_operator_sum         numeric := 641250.00;

  c_budget_cost_total   numeric := 59973750.00;       -- Material + Equipment + Time
  c_vat_rate            numeric := 0.000;             -- Interstate infrastructure tax-exempt municipal transit project
BEGIN
  -- ---------------------------------------------------------------------------------------------
  -- 0. RESOLVE CONTEXT: Current App User & Organization
  -- ---------------------------------------------------------------------------------------------
  v_owner := public.app_user_guid();
  IF v_owner IS NULL THEN
    SELECT "rowGUID"::uuid INTO v_owner FROM public."userTable" WHERE "rowGUID" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    SELECT "rowOwnerGUID"::uuid INTO v_owner FROM public.project_table WHERE "rowOwnerGUID" IS NOT NULL LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    v_owner := '43cdefd5-4a25-4667-973b-337635fe52aa'::uuid; -- Project 1 default owner GUID
  END IF;

  SELECT public.organization_of_user(v_owner::text) INTO v_org;
  IF v_org IS NULL OR v_org = '' THEN
    SELECT "rowGUID" INTO v_org FROM public."organizationTable" LIMIT 1;
  END IF;
  IF v_org IS NULL OR v_org = '' THEN
    v_org := 'org_universal1_main';
  END IF;

  RAISE NOTICE 'Universal1 Railway #1 Seed: Active Owner GUID = %, Organization = %', v_owner, v_org;

  -- ---------------------------------------------------------------------------------------------
  -- 1. CATALOGS & PREREQUISITES
  -- ---------------------------------------------------------------------------------------------
  
  -- Measure Units
  INSERT INTO public."measureUnitTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('unit_mile', 'measureUnitCatalog', 'empty', 5500, '{"title": "mi", "name": "Statute Mile", "code": "011", "symbol": "mi"}'::jsonb),
    ('unit_pcs',  'measureUnitCatalog', 'empty', 1000, '{"title": "pcs", "name": "Piece / Stick", "code": "796", "symbol": "pcs"}'::jsonb),
    ('unit_hour', 'measureUnitCatalog', 'empty', 2000, '{"title": "hour", "name": "Operating Hour", "code": "356", "symbol": "h"}'::jsonb)
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Legal Entity (The Prime Construction Contracting Entity)
  INSERT INTO public."legalEntityTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('le-nec-infra', 'legalEntityCatalog', 'empty', 1024, jsonb_build_object(
      'title', 'Northeast Corridor Rail Infrastructure LLC',
      'legalName', 'Northeast Corridor Rail Infrastructure LLC',
      'registrationNo', 'US-DEL-2025-99881',
      'vatNo', 'US-EIN-12-9876543',
      'legalAddress', '30th Street Station, Concourse West, Suite 400, Philadelphia, PA 19104',
      'isActive', true
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Partners (Customer & Vendors)
  INSERT INTO public."partnerTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('ptn-amtrak', 'partnerCatalog', 'empty', 1024, jsonb_build_object(
      'partnerTitle', 'National Railroad Passenger Corporation (Amtrak)',
      'partnerKind', 'company',
      'partnerIsCustomer', true,
      'partnerIsSupplier', false,
      'isActive', true
    )),
    ('ptn-eastern-rail', 'partnerCatalog', 'empty', 2048, jsonb_build_object(
      'partnerTitle', 'Eastern Rail & Track Supply Corp.',
      'partnerKind', 'company',
      'partnerIsCustomer', false,
      'partnerIsSupplier', true,
      'isActive', true
    )),
    ('ptn-plasser-usa', 'partnerCatalog', 'empty', 3072, jsonb_build_object(
      'partnerTitle', 'Plasser American Corporation',
      'partnerKind', 'company',
      'partnerIsCustomer', false,
      'partnerIsSupplier', true,
      'isActive', true
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Contracts
  INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('ct-amtrak-nec-01', 'ptn-amtrak', 'partner', 1024, jsonb_build_object(
      'contractPartyType', 'partner',
      'contractNumber', 'CT-AMTRK-NEC-2026',
      'contractTitle', 'Contract for Construction Works on the NY-WAS Section of the Northeast Corridor',
      'contractCurrency', 'USD',
      'contractSumBeforeVAT', c_miles_sum,
      'legalEntityGUID', 'le-nec-infra'
    )),
    ('ct-eastern-rail-01', 'ptn-eastern-rail', 'partner', 2048, jsonb_build_object(
      'contractPartyType', 'partner',
      'contractNumber', 'CT-SUPP-136RE-2026',
      'contractTitle', 'Master Supply Agreement - 136 RE Carbon Steel Rail 80ft Sticks',
      'contractCurrency', 'USD',
      'contractSumBeforeVAT', c_rail_sum,
      'legalEntityGUID', 'le-nec-infra'
    )),
    ('ct-plasser-tamper-01', 'ptn-plasser-usa', 'partner', 3072, jsonb_build_object(
      'contractPartyType', 'partner',
      'contractNumber', 'CT-LEASE-TAMPER-2026',
      'contractTitle', 'Master Plant & Heavy RMM Tamper Lease Agreement (Plasser 09-3X)',
      'contractCurrency', 'USD',
      'contractSumBeforeVAT', c_tamper_sum,
      'legalEntityGUID', 'le-nec-infra'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Products (Materials)
  INSERT INTO public."productTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('prd-136re-rail-80ft', 'productCatalog', 'empty', 1024, jsonb_build_object(
      'productTitle', '136 RE carbon steel rail (80-Foot Stick)',
      'productCode', '136RE-80FT',
      'measureUnit', 'unit_pcs',
      'mainVendorGUID', 'ptn-eastern-rail',
      'mainVendorContractGUID', 'ct-eastern-rail-01',
      'priceDefault', c_rail_stick_price,
      'currency', 'USD',
      'description', 'AREMA Standard 136 lb/yd high-strength carbon steel continuous welded rail stick (80 ft length, 3,627 lbs per stick)'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Equipment Types & Equipment (Machines)
  INSERT INTO public."equipmentTypeTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('eqt-track-machinery', 'equipmentTypeCatalog', 'empty', 1024, jsonb_build_object(
      'title', 'Railroad Track Maintenance & Tamping Machinery'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  INSERT INTO public."equipmentTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('eq-plasser-093x', 'equipmentCatalog', 'empty', 1024, jsonb_build_object(
      'equipmentTitle', 'Plasser 09-3X / Dynacat',
      'equipmentCode', 'EQ-TAMPER-093X',
      'equipmentType', 'eqt-track-machinery',
      'equipmentOwnership', 'rented',
      'mainVendorGUID', 'ptn-plasser-usa',
      'mainVendorContractGUID', 'ct-plasser-tamper-01',
      'measureUnit', 'unit_hour',
      'standardRate', c_tamper_hour_rate,
      'currency', 'USD',
      'description', 'Plasser American 09-3X Dynacat continuous action 3-tie production tamping and dynamic track stabilizer machine'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Person (Human Resource)
  INSERT INTO public."personTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('per-john-rimm', 'personCatalog', 'empty', 1024, jsonb_build_object(
      'personFirstName', 'John',
      'personLastName', 'Rimm',
      'personTitle', 'John Rimm',
      'personCode', 'EMP-RIMM-001',
      'personType', 'Employee',
      'positionTitle', 'Machine (RMM) Operator',
      'standardHourlyRate', c_operator_hour_rate,
      'currency', 'USD',
      'isActive', true
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Resource Roles
  INSERT INTO public."resourceRoleTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('role-rail-segment', 'resourceRoleCatalog', 'empty', 1024, jsonb_build_object(
      'roleTitle', 'Railroad Segment Construction Turnkey Works',
      'measureUnit', 'unit_mile',
      'managementGenus', 'revenueGenus'
    )),
    ('role-steel-rail', 'resourceRoleCatalog', 'empty', 2048, jsonb_build_object(
      'roleTitle', '136 RE Carbon Steel Rail Sticks Supply',
      'measureUnit', 'unit_pcs',
      'managementGenus', 'materialGenus'
    )),
    ('role-tamper-machine', 'resourceRoleCatalog', 'empty', 3072, jsonb_build_object(
      'roleTitle', 'Tamper: Continuous-Action Production Tamper',
      'measureUnit', 'unit_hour',
      'managementGenus', 'expenseGenus'
    )),
    ('role-rmm-operator', 'resourceRoleCatalog', 'empty', 4096, jsonb_build_object(
      'roleTitle', 'Machine Operator: Machine (RMM) Operator',
      'measureUnit', 'unit_hour',
      'managementGenus', 'timeGenus'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Budget Items
  INSERT INTO public."budgetItemTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('bi-nec-turnkey-rev', 'budgetItemCatalog', 'revenuesGenus', 1024, jsonb_build_object(
      'title', 'High-Speed Track Turnkey Construction Revenue',
      'managementGenusItem', 'revenueGenus'
    )),
    ('bi-nec-rail-mat', 'budgetItemCatalog', 'costsGenus', 2048, jsonb_build_object(
      'title', 'Track Steel Rails & Permanent Way Material',
      'managementGenusItem', 'materialGenus'
    )),
    ('bi-nec-tamper-exp', 'budgetItemCatalog', 'costsGenus', 3072, jsonb_build_object(
      'title', 'Specialized Heavy Railway Machinery Hire & Tamping',
      'managementGenusItem', 'expenseGenus'
    )),
    ('bi-nec-operator-lab', 'budgetItemCatalog', 'costsGenus', 4096, jsonb_build_object(
      'title', 'Specialized Railway Equipment Operators Labor',
      'managementGenusItem', 'timeGenus'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- ---------------------------------------------------------------------------------------------
  -- 2. CREATE PROJECT: Railway #1 (Northeast Corridor)
  -- ---------------------------------------------------------------------------------------------
  DELETE FROM public.project_table WHERE "rowGUID" = v_project;

  INSERT INTO public.project_table (
    "rowGUID", "treePath", "rowOwnerGUID", "rowDuration", "rowProgress", "orderInList", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_project,
    public.pm_ltree_label(v_project),
    v_owner,
    '2026-12-31T23:59:59Z'::timestamptz,
    33.33,
    1024,
    jsonb_build_object(
      'name', 'Railway #1: New York Washington-Contract for Construction Works on the New York – Washington Section of the Northeast Corridor',
      'projectCode', 'RAILWAY-NEC-001',
      'rowKind', 'project',
      'projectStartAt', '2026-01-01T00:00:00.000Z',
      'projectStartDate', '2026-01-01',
      'projectFinishDate', '2026-12-31',
      'durationDays', 365,
      'skipWeekends', false,
      'currencyForBudget', 'USD',
      'currencyForContract', 'USD',
      'currencyForAccounting', 'USD',
      'mainCustomerGUID', 'ptn-amtrak',
      'mainCustomerContractGUID', 'ct-amtrak-nec-01',
      'mainSupplierGUID', 'ptn-eastern-rail',
      'mainSupplierContractGUID', 'ct-eastern-rail-01',
      'legalEntityGUID', 'le-nec-infra',
      'budgetScenarioForPlan', 'planScenarioProject1',
      'budgetScenarioForFact', 'factScenarioProject1',
      'calendarForTaskPlan', 'workingDaysCalendar',
      'planDateInputFormat', 'YYYY-MM-DD',
      'projectExpenseCostsNeeded', true,
      'projectMaterialCostsNeeded', true,
      'projectTimeCostsNeeded', true,
      'projectExpenseBudgetNeeded', true,
      'projectRevenueBudgetNeeded', true,
      'projectTimeOfEquipmentNeeded', true,
      'projectTimeOfPersonNeeded', true,
      'customerInvoiceFunctionalityEnabled', true,
      'multiProjectVendorInvoceNeeded', false,
      'factStrongInputByTaskLine', false,
      'uxuiSettings', jsonb_build_object(
        'projectTreeContextCommandsMode', 'onRightClickMenuMode',
        'projectGanttChartContextCommandsMode', 'onRightClickMenuMode'
      )
    ),
    NOW(),
    NOW()
  );

  -- ---------------------------------------------------------------------------------------------
  -- 3. CREATE WBS: Stage 1 & Task 1 (Segment No. 1)
  -- ---------------------------------------------------------------------------------------------
  INSERT INTO public.project_task_table (
    "rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowDuration", "rowProgress", "orderInList", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_stage,
    public.pm_ltree_label(v_project) || public.pm_ltree_label(v_stage),
    v_project,
    v_owner,
    '2026-12-31T23:59:59Z'::timestamptz,
    33.33,
    1024,
    jsonb_build_object(
      'rowKind', 'stage',
      'taskDescription', 'Stage 1: Track Superstructure Construction & Rail Laying (NY-WAS)',
      'name', 'Stage 1: Track Construction',
      'startAt', '2026-01-01T00:00:00Z',
      'durationDays', 365
    ),
    NOW(),
    NOW()
  );

  INSERT INTO public.project_task_table (
    "rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowDuration", "rowProgress", "orderInList", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_task,
    public.pm_ltree_label(v_project) || public.pm_ltree_label(v_stage) || public.pm_ltree_label(v_task),
    v_project,
    v_owner,
    '2026-12-31T23:59:59Z'::timestamptz,
    33.33,
    1024,
    jsonb_build_object(
      'rowKind', 'task',
      'taskDescription', 'Railroad Segment No. 1 Construction (225 miles NY-WAS)',
      'name', 'Railroad Segment No. 1 (225 miles)',
      'startAt', '2026-01-01T00:00:00Z',
      'durationDays', 365,
      'taskStatus', 'in_progress',
      'progressPercent', 33.33
    ),
    NOW(),
    NOW()
  );

  -- ---------------------------------------------------------------------------------------------
  -- 4. CREATE TASK LINES: Exactly 1 line for each management genus
  -- ---------------------------------------------------------------------------------------------
  
  -- Line 1: revenueGenus (Deliverable: Railroad Segment No. 1, 225 miles)
  INSERT INTO public.task_line_table (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON"
  ) VALUES (
    v_line_revenue,
    v_project,
    v_task,
    'revenueGenus',
    1024,
    jsonb_build_object(
      'taskManagementGenusLine', 'revenueGenus',
      'resourceRoleItem', 'role-rail-segment',
      'measureUnitTaskLine', 'unit_mile',
      'qtyTaskLine', c_miles_total,
      'priceTaskLine', c_miles_price,
      'vatRatioTaskLine', c_vat_rate,
      'sumForContract', c_miles_sum,
      'sumForBudget', c_miles_sum,
      'sumForAccounting', c_miles_sum,
      'taskLinePartnerItem', 'ptn-amtrak',
      'taskLinePartnerContract', 'ct-amtrak-nec-01',
      'budgetItemItem', 'bi-nec-turnkey-rev',
      'description', 'Turnkey Track Superstructure Construction - Railroad Segment No. 1 (225 miles)'
    )
  );

  -- Line 2: materialGenus (Material: 136 RE carbon steel rail, 80-Foot Sticks)
  INSERT INTO public.task_line_table (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON"
  ) VALUES (
    v_line_material,
    v_project,
    v_task,
    'materialGenus',
    2048,
    jsonb_build_object(
      'taskManagementGenusLine', 'materialGenus',
      'resourceRoleItem', 'role-steel-rail',
      'taskResourceItem', 'prd-136re-rail-80ft',
      'measureUnitTaskLine', 'unit_pcs',
      'qtyTaskLine', c_rail_sticks_total,
      'priceTaskLine', c_rail_stick_price,
      'vatRatioTaskLine', c_vat_rate,
      'sumForContract', c_rail_sum,
      'sumForBudget', c_rail_sum,
      'sumForAccounting', c_rail_sum,
      'taskLinePartnerItem', 'ptn-eastern-rail',
      'taskLinePartnerContract', 'ct-eastern-rail-01',
      'budgetItemItem', 'bi-nec-rail-mat',
      'description', '136 RE Carbon Steel Rail 80-Foot Sticks (29,700 sticks for 225 miles track alignment)'
    )
  );

  -- Line 3: expenseGenus (Equipment: Plasser 09-3X Dynacat Tamper Machine Rental & Service)
  INSERT INTO public.task_line_table (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON"
  ) VALUES (
    v_line_expense,
    v_project,
    v_task,
    'expenseGenus',
    3072,
    jsonb_build_object(
      'taskManagementGenusLine', 'expenseGenus',
      'resourceRoleItem', 'role-tamper-machine',
      'taskResourceItem', 'eq-plasser-093x',
      'taskResourceKind', 'equipment',
      'measureUnitTaskLine', 'unit_hour',
      'qtyTaskLine', c_tamper_hours_total,
      'priceTaskLine', c_tamper_hour_rate,
      'vatRatioTaskLine', c_vat_rate,
      'sumForContract', c_tamper_sum,
      'sumForBudget', c_tamper_sum,
      'sumForAccounting', c_tamper_sum,
      'taskLinePartnerItem', 'ptn-plasser-usa',
      'taskLinePartnerContract', 'ct-plasser-tamper-01',
      'budgetItemItem', 'bi-nec-tamper-exp',
      'description', 'Continuous-Action Production Tamper Machinery Deployment (Plasser 09-3X / Dynacat)'
    )
  );

  -- Line 4: timeGenus (Human Resource: Machine Operator John Rimm)
  INSERT INTO public.task_line_table (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON"
  ) VALUES (
    v_line_time,
    v_project,
    v_task,
    'timeGenus',
    4096,
    jsonb_build_object(
      'taskManagementGenusLine', 'timeGenus',
      'resourceRoleItem', 'role-rmm-operator',
      'taskResourceItem', 'per-john-rimm',
      'taskResourceKind', 'person',
      'measureUnitTaskLine', 'unit_hour',
      'qtyTaskLine', c_operator_hours_total,
      'priceTaskLine', c_operator_hour_rate,
      'vatRatioTaskLine', c_vat_rate,
      'sumForContract', c_operator_sum,
      'sumForBudget', c_operator_sum,
      'sumForAccounting', c_operator_sum,
      'budgetItemItem', 'bi-nec-operator-lab',
      'description', 'Specialized Heavy Railway Machinery (RMM) Lead Operator John Rimm'
    )
  );

  -- ---------------------------------------------------------------------------------------------
  -- 5. TASK LINE PLAN & TIMELINE (Plan Movements across 2026)
  -- ---------------------------------------------------------------------------------------------
  -- Material Plan Movement (uniform / spread over project lifecycle)
  INSERT INTO public.task_line_plan_movements (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowPeriodDatetime", "rowCoefficient",
    "qtyTaskLine", "sumForBudget", "sumForContract", "sumForAccounting", "planMovementStatus", "periodDay", "rowJSON"
  ) VALUES
    (gen_random_uuid(), v_project, v_task, v_line_material, 1024, '2026-02-01T00:00:00Z'::timestamptz, 1.0, c_rail_sticks_total, c_rail_sum, c_rail_sum, c_rail_sum, true, '2026-02-01', '{}'::jsonb),
    (gen_random_uuid(), v_project, v_task, v_line_expense,  2048, '2026-03-01T00:00:00Z'::timestamptz, 1.0, c_tamper_hours_total, c_tamper_sum, c_tamper_sum, c_tamper_sum, true, '2026-03-01', '{}'::jsonb),
    (gen_random_uuid(), v_project, v_task, v_line_time,     3072, '2026-03-01T00:00:00Z'::timestamptz, 1.0, c_operator_hours_total, c_operator_sum, c_operator_sum, c_operator_sum, true, '2026-03-01', '{}'::jsonb);

  INSERT INTO public.task_line_plan_timeline (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowPeriodDatetime", "taskLineGUID", "qtyForBudget", "sumForContract", "sumForBudget", "sumForAccounting"
  ) VALUES
    (gen_random_uuid(), v_project, v_task, '2026-02-01T00:00:00Z'::timestamptz, v_line_material, c_rail_sticks_total, c_rail_sum, c_rail_sum, c_rail_sum),
    (gen_random_uuid(), v_project, v_task, '2026-03-01T00:00:00Z'::timestamptz, v_line_expense,  c_tamper_hours_total, c_tamper_sum, c_tamper_sum, c_tamper_sum),
    (gen_random_uuid(), v_project, v_task, '2026-03-01T00:00:00Z'::timestamptz, v_line_time,     c_operator_hours_total, c_operator_sum, c_operator_sum, c_operator_sum);

  -- Register plan movements
  PERFORM public.project_status_register_plan(ARRAY[v_task]);

  -- ---------------------------------------------------------------------------------------------
  -- 6. LIFECYCLE DOCUMENT 1: PURCHASE ORDER (PO-NYWAS-00001)
  -- ---------------------------------------------------------------------------------------------
  INSERT INTO public.purchase_order_header (
    "rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_po_header,
    'le-nec-infra',
    v_org,
    jsonb_build_object(
      'purchaseOrderPartner', 'ptn-eastern-rail',
      'purchaseOrderContract', 'ct-eastern-rail-01',
      'purchaseOrderNumber', 'PO-NYWAS-00001',
      'purchaseOrderDateTime', '2026-01-05T09:00:00Z',
      'purchaseOrderCurrency', 'USD',
      'purchaseOrderFolder', 'le-nec-infra:ptn-eastern-rail',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'PO-NYWAS-00001',
        'documentStatus', 'posted',
        'postedAt', '2026-01-05T09:30:00Z',
        'postedBy', v_owner,
        'title', 'Purchase Order for 136 RE Steel Rails & Plant Hire'
      )
    ),
    '2026-01-05T09:00:00Z'::timestamptz,
    '2026-01-05T09:30:00Z'::timestamptz
  );

  INSERT INTO public.purchase_order_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "genusGUID", "orderInList",
    "qtyOrdered", "priceOrdered", "vatRatioOrdered", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_po_line_mat, v_po_header, v_project, v_task, v_line_material, 'materialGenus', 1024,
     c_rail_sticks_total, c_rail_stick_price, c_vat_rate, c_rail_sum, c_rail_sum, 0.00, c_rail_sum, 0.00,
     jsonb_build_object('itemTitle', '136 RE Carbon Steel Rail 80ft Sticks')),
    (v_po_line_exp, v_po_header, v_project, v_task, v_line_expense, 'expenseGenus', 2048,
     c_tamper_hours_total, c_tamper_hour_rate, c_vat_rate, c_tamper_sum, c_tamper_sum, 0.00, c_tamper_sum, 0.00,
     jsonb_build_object('itemTitle', 'Plasser 09-3X Dynacat Tamper Hire'));

  PERFORM public.project_status_register_order(v_po_header);

  -- ---------------------------------------------------------------------------------------------
  -- 7. LIFECYCLE DOCUMENT 2: PRODUCT RECEIPT (PR-NYWAS-00001)
  -- ---------------------------------------------------------------------------------------------
  -- Initial milestone shipment received: 10,000 sticks of rail + 2,250 tamper machine hours
  INSERT INTO public.product_receipt_header (
    "rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_pr_header,
    'le-nec-infra',
    v_org,
    jsonb_build_object(
      'productReceiptPartner', 'ptn-eastern-rail',
      'productReceiptContract', 'ct-eastern-rail-01',
      'productReceiptPurchaseOrder', v_po_header,
      'productReceiptNumber', 'PR-NYWAS-00001',
      'productReceiptDateTime', '2026-02-15T14:00:00Z',
      'productReceiptCurrency', 'USD',
      'productReceiptFolder', 'le-nec-infra:ptn-eastern-rail',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'PR-NYWAS-00001',
        'documentStatus', 'posted',
        'postedAt', '2026-02-15T15:00:00Z',
        'postedBy', v_owner,
        'title', 'Delivery Receipt - Initial Rail Batches & Tamper Mobilization'
      )
    ),
    '2026-02-15T14:00:00Z'::timestamptz,
    '2026-02-15T15:00:00Z'::timestamptz
  );

  INSERT INTO public.product_receipt_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "purchaseOrderLineGUID", "genusGUID", "orderInList",
    "qtyReceived", "priceReceived", "vatRatioReceived", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_pr_line_mat, v_pr_header, v_project, v_task, v_line_material, v_po_line_mat, 'materialGenus', 1024,
     10000.00, c_rail_stick_price, c_vat_rate, 18500000.00, 18500000.00, 0.00, 18500000.00, 0.00,
     jsonb_build_object('deliveryWaybill', 'WB-NEC-2026-02-001')),
    (v_pr_line_exp, v_pr_header, v_project, v_task, v_line_expense, v_po_line_exp, 'expenseGenus', 2048,
     2250.00, c_tamper_hour_rate, c_vat_rate, 1462500.00, 1462500.00, 0.00, 1462500.00, 0.00,
     jsonb_build_object('deliveryWaybill', 'WB-NEC-TAMPER-MOB-01'));

  PERFORM public.project_status_register_receipt(v_pr_header);

  -- ---------------------------------------------------------------------------------------------
  -- 8. LIFECYCLE DOCUMENT 3: FACT INPUT (FI-NYWAS-00001)
  -- ---------------------------------------------------------------------------------------------
  -- Actual work executed: 75 track miles laid, 10,000 rail sticks installed, 2,250 tamper hrs, 2,250 operator hrs
  INSERT INTO public.task_fact_header (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_fact_header,
    v_project,
    v_task,
    jsonb_build_object(
      'documentHeader', jsonb_build_object(
        'documentNumber', 'FI-NYWAS-00001',
        'documentStatus', 'posted',
        'projectTaskGUID', v_task,
        'activeUser', v_owner,
        'strongInput', 'true',
        'postedAt', '2026-04-30T17:00:00Z',
        'postedBy', v_owner,
        'created_at', '2026-04-30T16:30:00Z',
        'title', 'Monthly Physical Progress & Actuals Fact Confirmation - Q1 2026'
      )
    ),
    '2026-04-30T16:30:00Z'::timestamptz,
    '2026-04-30T17:00:00Z'::timestamptz
  );

  INSERT INTO public.task_fact_usage_timeline (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowHeaderGUID", "taskLineGUID", "genusGUID", "orderInList",
    "rowPeriodDatetime", "periodDay", "qtyForBudget", "qtyForContract", "sumForBudget", "sumForContract", "sumForAccounting", "rowJSON"
  ) VALUES
    (v_fact_line_rev, v_project, v_task, v_fact_header, v_line_revenue, 'revenueGenus', 1024,
     '2026-04-30T00:00:00Z'::timestamptz, '2026-04-30'::date, 75.00, 75.00, 90000000.00, 90000000.00, 90000000.00,
     jsonb_build_object('milestoneTitle', '75 Track-Miles Constructed & Inspected')),
    (v_fact_line_mat, v_project, v_task, v_fact_header, v_line_material, 'materialGenus', 2048,
     '2026-04-30T00:00:00Z'::timestamptz, '2026-04-30'::date, 10000.00, 10000.00, 18500000.00, 18500000.00, 18500000.00,
     jsonb_build_object('materialBatch', '10,000 sticks 136 RE rail consumed into trackbed')),
    (v_fact_line_exp, v_project, v_task, v_fact_header, v_line_expense, 'expenseGenus', 3072,
     '2026-04-30T00:00:00Z'::timestamptz, '2026-04-30'::date, 2250.00, 2250.00, 1462500.00, 1462500.00, 1462500.00,
     jsonb_build_object('logReport', '2,250 operating hours Plasser 09-3X Dynacat tamping')),
    (v_fact_line_time, v_project, v_task, v_fact_header, v_line_time, 'timeGenus', 4096,
     '2026-04-30T00:00:00Z'::timestamptz, '2026-04-30'::date, 2250.00, 2250.00, 213750.00, 213750.00, 213750.00,
     jsonb_build_object('timesheetRef', 'John Rimm Timesheets Jan-Apr 2026'));

  PERFORM public.project_status_register_fact(v_fact_header);

  -- ---------------------------------------------------------------------------------------------
  -- 9. LIFECYCLE DOCUMENT 4: VENDOR INVOICE (VI-SUPP-98421)
  -- ---------------------------------------------------------------------------------------------
  -- Vendor invoice matching the received materials & tamper machine usage
  INSERT INTO public.vendor_invoice_header (
    "rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_vi_header,
    'le-nec-infra',
    v_org,
    jsonb_build_object(
      'vendorInvoicePartner', 'ptn-eastern-rail',
      'vendorInvoiceContract', 'ct-eastern-rail-01',
      'vendorInvoiceNumber', 'VI-SUPP-98421',
      'vendorInvoiceDateTime', '2026-03-01T10:00:00Z',
      'vendorInvoiceCurrency', 'USD',
      'vendorInvoiceFolder', 'le-nec-infra:ptn-eastern-rail',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'VI-SUPP-98421',
        'documentStatus', 'posted',
        'postedAt', '2026-03-02T11:00:00Z',
        'postedBy', v_owner,
        'title', 'Eastern Rail Supply & Machine Services - Progress Invoice #1'
      )
    ),
    '2026-03-01T10:00:00Z'::timestamptz,
    '2026-03-02T11:00:00Z'::timestamptz
  );

  INSERT INTO public.vendor_invoice_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "genusGUID", "orderInList",
    "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_vi_line_mat, v_vi_header, v_project, v_task, v_line_material, 'materialGenus', 1024,
     10000.00, c_rail_stick_price, c_vat_rate, 18500000.00, 18500000.00, 0.00, 18500000.00, 0.00,
     jsonb_build_object('productReceiptLineGUID', v_pr_line_mat, 'vendorItemCode', '136RE-80')),
    (v_vi_line_exp, v_vi_header, v_project, v_task, v_line_expense, 'expenseGenus', 2048,
     2250.00, c_tamper_hour_rate, c_vat_rate, 1462500.00, 1462500.00, 0.00, 1462500.00, 0.00,
     jsonb_build_object('productReceiptLineGUID', v_pr_line_exp, 'vendorItemCode', 'PLASSER-093X'));

  PERFORM public.project_status_register_invoice(v_vi_header);

  -- ---------------------------------------------------------------------------------------------
  -- 10. LIFECYCLE DOCUMENT 5: CUSTOMER INVOICE (CI-AMTRK-2026-001)
  -- ---------------------------------------------------------------------------------------------
  -- Billing to Customer (Amtrak) for completed milestone: 75 track miles @ $1.2M = $90,000,000
  INSERT INTO public.customer_invoice_header (
    "rowGUID", "rowOwnerGUID", "rowOrganizationGUID", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_ci_header,
    'le-nec-infra',
    v_org,
    jsonb_build_object(
      'customerInvoicePartner', 'ptn-amtrak',
      'customerInvoiceContract', 'ct-amtrak-nec-01',
      'customerInvoiceNumber', 'CI-AMTRK-2026-001',
      'customerInvoiceDateTime', '2026-05-01T10:00:00Z',
      'customerInvoiceCurrency', 'USD',
      'customerInvoiceFolder', 'le-nec-infra:ptn-amtrak',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'CI-AMTRK-2026-001',
        'documentStatus', 'posted',
        'postedAt', '2026-05-01T12:00:00Z',
        'postedBy', v_owner,
        'title', 'Milestone Certificate #1 - Completion of 75 Track-Miles Railroad Segment 1'
      )
    ),
    '2026-05-01T10:00:00Z'::timestamptz,
    '2026-05-01T12:00:00Z'::timestamptz
  );

  INSERT INTO public.customer_invoice_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "genusGUID", "orderInList",
    "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_ci_line_rev, v_ci_header, v_project, v_task, v_line_revenue, 'revenueGenus', 1024,
     75.00, c_miles_price, c_vat_rate, 90000000.00, 90000000.00, 0.00, 90000000.00, 0.00,
     jsonb_build_object('milestoneCertification', 'NEC-ENG-MILESTONE-01-ACCEPTED'));

  PERFORM public.project_status_register_customer_invoice(v_ci_header);

  -- ---------------------------------------------------------------------------------------------
  -- 11. FINANCIAL ROLLUP & MONITOR01 REPORT SYNC
  -- ---------------------------------------------------------------------------------------------
  -- Rebuild project cost rollups
  PERFORM public.project_cost_rebuild(v_project);

  -- Refresh Monitor01 view
  PERFORM public.monitor01_process_batch();

  RAISE NOTICE 'Universal1 Railway #1 Seed Successfully Landed!';
  RAISE NOTICE 'Project GUID: %', v_project;
  RAISE NOTICE 'Task GUID: %', v_task;
  RAISE NOTICE 'Lines (4 genera): Revenue=%, Material=%, Expense=%, Time=%', v_line_revenue, v_line_material, v_line_expense, v_line_time;
  RAISE NOTICE 'Documents: PO=%, PR=%, Fact=%, VI=%, CI=%', v_po_header, v_pr_header, v_fact_header, v_vi_header, v_ci_header;
END $$;

COMMIT;
