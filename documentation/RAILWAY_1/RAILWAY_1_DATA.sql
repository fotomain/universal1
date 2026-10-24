-- ===============================================================================================
-- UNIVERSAL1 - RAILWAY #1 DATA SEED: RAILWAY_1_DATA.sql
-- Project: Railway #1: New York Washington-Contract for Construction Works on the New York – Washington Section of the Northeast Corridor
-- Dates: 2026-01-01 to 2026-12-31
-- Target Schema: Universal1 PM & ERP System (/kit8/sql/start/start1_sql_tables.sql)
--
-- Single Task with Exactly 1 Line per Management Genus:
--   1. revenueGenus  : Deliverable Railroad Segment No. 1 (225 miles @ $1,200,000.00 / mile = $270,000,000.00)
--   2. materialGenus : 136 RE carbon steel rail (80-Foot Stick) (29,700 sticks @ $1,850.00 / stick = $54,945,000.00)
--   3. expenseGenus  : Tamper Equipment: Plasser 09-3X / Dynacat (6,750 hours @ $650.00 / hour = $4,387,500.00)
--   4. timeGenus     : Machine (RMM) Operator: John Rimm (2,080 hours @ $95.00 / hour = $197,600.00)
--
-- Full 5-Document Project Lifecycle (1 document of each type, ALL WITH FULL PROJECT AMOUNTS):
--   1. Purchase Order   : PO-NYWAS-00001 (FULL: 29,700 sticks rail + 6,750 tamper hours + 2,080 operator hours = $59,530,100.00)
--   2. Product Receipt  : PR-NYWAS-00001 (FULL: 29,700 sticks rail + 6,750 tamper hours + 2,080 operator hours = $59,530,100.00)
--   3. Fact Input       : FI-NYWAS-00001 (FULL: 29,700 sticks + 6,750 tamper hrs + 2,080 operator hrs + 225 mi deliverable = $329,530,100.00)
--   4. Vendor Invoice   : VI-SUPP-98421  (FULL: 29,700 sticks rail + 6,750 tamper hours + 2,080 operator hours = $59,530,100.00)
--   5. Customer Invoice : CI-AMTRK-2026-001 (FULL: 225 miles turnkey deliverable = $270,000,000.00)
--
-- Money and payments (PART 38 of start1_sql_tables.sql + start2_sql_code.sql, documentation/PAYMENTS_FACT_WBS.html):
--   3 money accounts of the legal entity (the catalog "Money accounts"), each with its currency, opening date and opening balance:
--     ma-nec-usd-operating  bank  USD  opening 2026-01-01   25,000,000.00   the account the project's money moves on
--     ma-nec-eur-reserve    bank  EUR  opening 2026-01-01    2,000,000.00   a euro reserve account (no payment of this project)
--     ma-nec-petty-cash     cash  USD  opening 2026-01-01       10,000.00   the site cash desk (no payment of this project)
--   2 PAYMENT FACTS, each made with "Create based on -> Payment fact" of its POSTED invoice (create_payment_fact_from_vendor_invoice / _customer_invoice) and posted:
--     receipt  BANK-NEC-2026-1205-001  2026-12-05  INBOUND   CI-AMTRK-2026-001  $270,000,000.00 from Amtrak               (budget item: Receipts from customers)
--     payment  BANK-NEC-2026-1210-001  2026-12-10  OUTBOUND  VI-SUPP-98421       $59,530,100.00 to Eastern Rail & Track   (budget item: Payments to vendors)
--   the rest of ma-nec-usd-operating after both: 25,000,000.00 + 270,000,000.00 - 59,530,100.00 = 235,469,900.00 USD (the invoices, the money accounts and the payment facts all in USD: no exchange rate is needed)
--   the contracts carry the payment keys of W1 PLAN PAYMENTS (paymentBudgetItemOutbound / Inbound, paymentTimelineShiftDays): the payment fact takes the budget item from its contract.
--
-- Activity genus (PART 32 of start1_sql_tables.sql + start2_sql_code.sql, documentation/ACTIVITY_GENUS.html): every budget item of the project carries its KEY (activity.genus),
-- its DIRECTION (inbound | outbound) and its names in IFRS (IAS 7), D365 FO and SAP. Railway #1 is a pure OPERATING-activity project:
--   operatingActivity.revenueGenus  inbound   $270,000,000.00   (IAS 7.14(a))
--   operatingActivity.materialGenus outbound   $54,945,000.00   (IAS 7.14(c))
--   operatingActivity.expenseGenus  outbound    $4,387,500.00   (IAS 7.14(c))   short-term plant hire: operating (a lease > 12 months would be financing, IAS 7.17(e))
--   operatingActivity.timeGenus     outbound      $197,600.00   (IAS 7.14(c))   operators invoiced by a vendor (external labor)
--   net operating cash flow budget  $210,469,900.00; investing and financing: none (the tamper is hired, not bought; no loan lines)
-- The script stops with a message when PART 32 is not installed (run start1 + start2 + start4 first).
--
-- The payment part (money accounts, payment facts) is skipped with a NOTICE while PART 38 is not installed (an older database): run start1 + start2 and this file again.
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

  -- Document Headers (1 document of each type)
  v_po_header           uuid := 'c1000000-0000-4000-8000-000000000001'::uuid;
  v_pr_header           uuid := 'c2000000-0000-4000-8000-000000000002'::uuid;
  v_fact_header         uuid := 'c3000000-0000-4000-8000-000000000003'::uuid;
  v_vi_header           uuid := 'c4000000-0000-4000-8000-000000000004'::uuid;
  v_ci_header           uuid := 'c5000000-0000-4000-8000-000000000005'::uuid;

  -- Purchase Order Lines
  v_po_line_mat         uuid := 'd1000000-0000-4000-8000-000000000001'::uuid;
  v_po_line_exp         uuid := 'd1000000-0000-4000-8000-000000000002'::uuid;
  v_po_line_time        uuid := 'd1000000-0000-4000-8000-000000000003'::uuid;

  -- Product Receipt Lines
  v_pr_line_mat         uuid := 'd2000000-0000-4000-8000-000000000001'::uuid;
  v_pr_line_exp         uuid := 'd2000000-0000-4000-8000-000000000002'::uuid;
  v_pr_line_time        uuid := 'd2000000-0000-4000-8000-000000000003'::uuid;

  -- Fact Input Lines
  v_fact_line_rev       uuid := 'd3000000-0000-4000-8000-000000000001'::uuid;
  v_fact_line_mat       uuid := 'd3000000-0000-4000-8000-000000000002'::uuid;
  v_fact_line_exp       uuid := 'd3000000-0000-4000-8000-000000000003'::uuid;
  v_fact_line_time      uuid := 'd3000000-0000-4000-8000-000000000004'::uuid;

  -- Kanban Stage GUID
  v_kanban_stage_exec   uuid;

  -- Vendor Invoice Lines
  v_vi_line_mat         uuid := 'd4000000-0000-4000-8000-000000000001'::uuid;
  v_vi_line_exp         uuid := 'd4000000-0000-4000-8000-000000000002'::uuid;
  v_vi_line_time        uuid := 'd4000000-0000-4000-8000-000000000003'::uuid;

  -- Customer Invoice Line
  v_ci_line_rev         uuid := 'd5000000-0000-4000-8000-000000000001'::uuid;

  -- Full Project Quantities & Financial Totals
  c_miles_total          numeric := 225.00;
  c_miles_price          numeric := 1200000.00;        -- $1.2M per mile turnkey track construction
  c_miles_sum            numeric := 270000000.00;

  c_rail_sticks_total    numeric := 29700.00;          -- 2 rails * 225 mi * 5280 ft / 80 ft stick
  c_rail_stick_price     numeric := 1850.00;           -- $1,850 per 80-ft 136 RE carbon rail stick (spec: $1,600-$2,200)
  c_rail_sum             numeric := 54945000.00;

  c_tamper_hours_total   numeric := 6750.00;
  c_tamper_hour_rate     numeric := 650.00;            -- $650/hr Plasser 09-3X Dynacat tamper wet machine rate
  c_tamper_sum           numeric := 4387500.00;

  c_operator_hours_total numeric := 2080.00;          -- a normal work week: 40 h x 52 weeks = 261 working days x 7.97 h (capacity of John Rimm = 8 h a day, standard work week)
  c_operator_hour_rate   numeric := 95.00;             -- $95/hr specialized RMM union operator prevailing wage
  c_operator_sum         numeric := 197600.00;

  c_vendor_total_sum     numeric := 59530100.00;       -- Rail Material ($54.945M) + Tamper Hire ($4.3875M) + Operator Labor ($0.1976M)
  c_budget_cost_total    numeric := 59530100.00;       -- Material + Equipment + Time
  c_vat_rate             numeric := 0.000;             -- Municipal infrastructure project exempt
  -- the 0 % row of valueAddedTaxTable (start4), fully recoverable: every document line carries it, so the VAT column of the lines shows "0 %" (documentation/VENDOR_INVOICE_DOC.html)
  c_vat_json             jsonb := '{"vatRateGUID": "vat_0", "vatTablePercent": 0, "vatRecoverablePercent": 100}'::jsonb;

  -- Document line descriptions copied from the task lines (same keys as the app's create_*_from_* RPCs).
  -- REQUIRED: the *_lines_before_write triggers compute sumForBudget / sumForAccounting ONLY from
  -- rowJSON.unitSumForBudget / unitSumForAccounting (+ priceTaskLine); without them the sums are NULL
  -- and Monitor01 shows empty Vendor Invoice / Customer Invoice Amounts. resourceRoleItem +
  -- measureUnitTaskLine put the document movements on the same Monitor01 row as the plan.
  v_pf_row              record;
  v_pf_receipt          uuid;
  v_pf_payment          uuid;
  v_pf_answer           jsonb;
  v_json_rev            jsonb;
  v_json_mat            jsonb;
  v_json_exp            jsonb;
  v_json_time           jsonb;
BEGIN
  -- ---------------------------------------------------------------------------------------------
  -- 0a. PREREQUISITE: the activity genus (PART 32)
  -- ---------------------------------------------------------------------------------------------
  IF to_regclass('public."budgetItemGenericKeyTable"') IS NULL OR to_regprocedure('public.kit8_budget_item_key_direction(text)') IS NULL THEN
    RAISE EXCEPTION 'Railway #1: the activity genus (PART 32) is not installed - run start1_sql_tables.sql, start2_sql_code.sql and start4_sql_insert_missing.sql (kit8/sql/start) first';
  END IF;

  -- ---------------------------------------------------------------------------------------------
  -- 0. RESOLVE CONTEXT: Current App User & Organization
  -- ---------------------------------------------------------------------------------------------
  v_owner := public.app_user_guid();
  -- Match the owner of existing active projects (Project 1, Project 2 = foto888999@gmail.com)
  IF v_owner IS NULL THEN
    SELECT "rowOwnerGUID"::uuid INTO v_owner 
    FROM public.project_table 
    WHERE "rowOwnerGUID" IS NOT NULL 
      AND "rowGUID" != v_project 
    ORDER BY "orderInList" ASC 
    LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    v_owner := '43cdefd5-4a25-4667-973b-337635fe52aa'::uuid; -- Default active user (foto888999@gmail.com)
  END IF;

  SELECT public.organization_of_user(v_owner::text) INTO v_org;
  IF v_org IS NULL OR v_org = '' THEN
    SELECT "rowParentGUID" INTO v_org FROM public.project_table WHERE "rowOwnerGUID" = v_owner AND "rowParentGUID" IS NOT NULL LIMIT 1;
  END IF;
  IF v_org IS NULL OR v_org = '' THEN
    SELECT "rowGUID" INTO v_org FROM public."organizationTable" LIMIT 1;
  END IF;
  IF v_org IS NULL OR v_org = '' THEN
    v_org := '50cba041-0d84-4688-a641-cca6fdeda5a1';
  END IF;

  -- Ensure session auth settings are populated so triggers (e.g. purchase_order_header_before_write) can resolve organization_of_current_user()
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, false);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_owner::text)::text, false);

  RAISE NOTICE 'Universal1 Railway #1: Active Owner GUID = %, Organization = %', v_owner, v_org;

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

  -- Money accounts (PART 38): the folder is the legal entity; the currency, the opening date and the opening balance cannot change once an account has posted payments (the payment facts of an earlier run
  -- are unposted and deleted below, before this is written again)
  IF to_regclass('public."moneyAccountTable"') IS NOT NULL THEN
    INSERT INTO public."moneyAccountTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
      ('ma-nec-usd-operating', 'moneyAccountCatalog', 'le-nec-infra', 1024, jsonb_build_object(
        'moneyAccountTitle', 'NEC Operating Account (USD)', 'moneyAccountKind', 'bank', 'moneyAccountCurrency', 'USD',
        'moneyAccountNumber', 'US64 BOFA 0260 0959 3100 0048 1175', 'moneyAccountBank', 'Bank of America, N.A. - Philadelphia',
        'moneyAccountOpeningDate', '2026-01-01', 'moneyAccountOpeningBalance', 25000000.00, 'isActive', true)),
      ('ma-nec-eur-reserve', 'moneyAccountCatalog', 'le-nec-infra', 2048, jsonb_build_object(
        'moneyAccountTitle', 'NEC Euro Reserve Account (EUR)', 'moneyAccountKind', 'bank', 'moneyAccountCurrency', 'EUR',
        'moneyAccountNumber', 'DE89 3704 0044 0532 0130 00', 'moneyAccountBank', 'Deutsche Bank AG - Frankfurt',
        'moneyAccountOpeningDate', '2026-01-01', 'moneyAccountOpeningBalance', 2000000.00, 'isActive', true)),
      ('ma-nec-petty-cash', 'moneyAccountCatalog', 'le-nec-infra', 3072, jsonb_build_object(
        'moneyAccountTitle', 'NEC Site Petty Cash (USD)', 'moneyAccountKind', 'cash', 'moneyAccountCurrency', 'USD',
        'moneyAccountNumber', 'CASH-NEC-SITE-01', 'moneyAccountBank', 'Site office, Newark NJ',
        'moneyAccountOpeningDate', '2026-01-01', 'moneyAccountOpeningBalance', 10000.00, 'isActive', true))
    ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON", "rowParentGUID" = EXCLUDED."rowParentGUID";
  ELSE
    RAISE NOTICE 'Railway #1: PART 38 (money accounts, payment facts) is not installed - no money account and no payment fact is made (run start1_sql_tables.sql + start2_sql_code.sql, then this file again)';
  END IF;

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
      'legalEntityGUID', 'le-nec-infra',
      'paymentBudgetItemInbound', 'customerReceiptsBudgetItem',
      'paymentTimelineShiftDays', 15
    )),
    ('ct-eastern-rail-01', 'ptn-eastern-rail', 'partner', 2048, jsonb_build_object(
      'contractPartyType', 'partner',
      'contractNumber', 'CT-SUPP-136RE-2026',
      'contractTitle', 'Master Supply Agreement - 136 RE Carbon Steel Rail 80ft Sticks',
      'contractCurrency', 'USD',
      'contractSumBeforeVAT', c_rail_sum,
      'legalEntityGUID', 'le-nec-infra',
      'paymentBudgetItemOutbound', 'vendorPaymentsBudgetItem',
      'paymentTimelineShiftDays', 30
    )),
    ('ct-plasser-tamper-01', 'ptn-plasser-usa', 'partner', 3072, jsonb_build_object(
      'contractPartyType', 'partner',
      'contractNumber', 'CT-LEASE-TAMPER-2026',
      'contractTitle', 'Master Plant & Heavy RMM Tamper Lease Agreement (Plasser 09-3X)',
      'contractCurrency', 'USD',
      'contractSumBeforeVAT', c_tamper_sum,
      'legalEntityGUID', 'le-nec-infra',
      'paymentBudgetItemOutbound', 'vendorPaymentsBudgetItem',
      'paymentTimelineShiftDays', 30
    )),
    ('ct-plasser-operator-01', 'ptn-plasser-usa', 'partner', 4096, jsonb_build_object(
      'contractPartyType', 'partner',
      'contractNumber', 'CT-SRV-OPERATOR-2026',
      'contractTitle', 'Master Agreement - Specialized Heavy Railway Machinery (RMM) Lead Operator Services',
      'contractCurrency', 'USD',
      'contractSumBeforeVAT', c_operator_sum,
      'legalEntityGUID', 'le-nec-infra',
      'paymentBudgetItemOutbound', 'vendorPaymentsBudgetItem',
      'paymentTimelineShiftDays', 30
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- Products (Materials)
  INSERT INTO public."productTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
    ('prd-136re-rail-80ft', 'productCatalog', 'empty', 1024, jsonb_build_object(
      'productTitle', '136 RE carbon steel rail (80-Foot Stick)',
      'productCode', '136RE-80FT',
      'measureUnit', 'unit_pcs',
      'measureUnitDefault', 'unit_pcs',
      'measureUnitForInventory', 'unit_pcs',
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
    ('role-rail-segment', 'revenueResources', 'empty', 1024, jsonb_build_object(
      'title', 'Railroad Segment Construction Turnkey Works',
      'roleTitle', 'Railroad Segment Construction Turnkey Works',
      'measureUnit', 'unit_mile',
      'managementGenus', 'revenueGenus'
    )),
    ('role-steel-rail', 'materialResources', 'empty', 2048, jsonb_build_object(
      'title', '136 RE Carbon Steel Rail Sticks Supply',
      'roleTitle', '136 RE Carbon Steel Rail Sticks Supply',
      'measureUnit', 'unit_pcs',
      'managementGenus', 'materialGenus'
    )),
    ('role-tamper-machine', 'expenseResources', 'empty', 3072, jsonb_build_object(
      'title', 'Tamper: Continuous-Action Production Tamper',
      'roleTitle', 'Tamper: Continuous-Action Production Tamper',
      'measureUnit', 'unit_hour',
      'managementGenus', 'expenseGenus'
    )),
    ('role-rmm-operator', 'humanResources', 'empty', 4096, jsonb_build_object(
      'title', 'Machine Operator: Machine (RMM) Operator',
      'roleTitle', 'Machine Operator: Machine (RMM) Operator',
      'measureUnit', 'unit_hour',
      'managementGenus', 'timeGenus'
    ))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON", "rowOwnerGUID" = EXCLUDED."rowOwnerGUID";

  -- Budget Items: the STANDARD items of the tree of possible budget items (documentation/ACTIVITY_GENUS.html; seeded by start4_sql_insert_missing.sql PART 32). Each one carries its KEY activity.genus,
  -- its DIRECTION and the names in IFRS / D365 FO / SAP, so the project invents none:
  --   revenue  serviceRevenueBudgetItem          Rendering of services (project billing)   operatingActivity.revenueGenus   inbound   IAS 7.14(a)
  --   material rawMaterialsBudgetItem            Raw materials and components               operatingActivity.materialGenus  outbound  IAS 7.14(c)
  --   expense  subcontractedServicesBudgetItem   Subcontracted services (the tamper hire)   operatingActivity.expenseGenus   outbound  IAS 7.14(c)
  --   time     externalLaborBudgetItem           External labor hours (contractors)         operatingActivity.timeGenus      outbound  IAS 7.14(c)  (the operators are invoiced by a vendor)
  -- The settlement of the two invoices uses vendorPaymentsBudgetItem / customerReceiptsBudgetItem (operating payment items): section 10b makes the two payment facts of them.
  IF (SELECT count(*) FROM public."budgetItemTable" WHERE "rowGUID" IN ('serviceRevenueBudgetItem', 'rawMaterialsBudgetItem', 'subcontractedServicesBudgetItem', 'externalLaborBudgetItem')) <> 4 THEN
    RAISE EXCEPTION 'Railway #1: the standard budget items are missing - run start4_sql_insert_missing.sql (PART 32) first';
  END IF;

  -- ---------------------------------------------------------------------------------------------
  -- 2. CREATE PROJECT: Railway #1 (Northeast Corridor) - IDEMPOTENT CLEANUP
  -- ---------------------------------------------------------------------------------------------
  -- Ensure ownership matches v_owner before cleanup so project recalculation triggers pass
  UPDATE public.project_table SET "rowOwnerGUID" = v_owner WHERE "rowGUID" = v_project;

  -- Clean up prior seed runs so script can be safely re-executed unlimited times
  -- the payment facts of an earlier run (PART 38): the posted ones are unposted (their cash ledger rows and rests go), then every one is deleted
  IF to_regclass('public.partner_balance_movements') IS NOT NULL THEN
    DELETE FROM public.partner_balance_movements WHERE "projectGUID" = v_project;          -- PART 39: the rows of the old invoices (the payments take theirs with them at Unpost)
  END IF;
  IF to_regclass('public.project_payment_fact_header') IS NOT NULL THEN
    FOR v_pf_row IN
      SELECT h."rowGUID" AS guid FROM public.project_payment_fact_header h
       WHERE h."rowJSON"->>'paymentFactInvoiceHeader' IN (v_vi_header::text, v_ci_header::text)
          OR EXISTS (SELECT 1 FROM public.project_payment_fact_lines l WHERE l."rowHeaderGUID" = h."rowGUID" AND l."rowProjectGUID" = v_project)
    LOOP
      PERFORM public.unpost_payment_fact(v_pf_row.guid);
      DELETE FROM public.project_payment_fact_header WHERE "rowGUID" = v_pf_row.guid;
    END LOOP;
  END IF;
  DELETE FROM public.project_status_movements WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.task_fact_usage_timeline WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.task_line_plan_movements WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.task_line_plan_timeline WHERE "rowProjectGUID" = v_project;

  DELETE FROM public.customer_invoice_lines WHERE "rowHeaderGUID" = v_ci_header OR "rowProjectGUID" = v_project;
  DELETE FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = v_vi_header OR "rowProjectGUID" = v_project;
  DELETE FROM public.product_receipt_lines WHERE "rowHeaderGUID" = v_pr_header OR "rowProjectGUID" = v_project;
  DELETE FROM public.purchase_order_lines WHERE "rowHeaderGUID" = v_po_header OR "rowProjectGUID" = v_project;

  DELETE FROM public.customer_invoice_header WHERE "rowGUID" = v_ci_header;
  DELETE FROM public.vendor_invoice_header WHERE "rowGUID" = v_vi_header;
  DELETE FROM public.task_fact_header WHERE "rowGUID" = v_fact_header;
  DELETE FROM public.product_receipt_header WHERE "rowGUID" = v_pr_header;
  DELETE FROM public.purchase_order_header WHERE "rowGUID" = v_po_header;

  DELETE FROM public.task_line_table WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.project_task_dependencies_table WHERE "projectGUID" = v_project;
  DELETE FROM public.project_task_kanban_state_table WHERE "rowOwnerGUID" = v_project;
  DELETE FROM public.project_task_table WHERE "projectGUID" = v_project;
  DELETE FROM public.project_user_settings_table WHERE "rowOwnerGUID" = v_project;
  DELETE FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = v_project;
  DELETE FROM public.project_table WHERE "rowGUID" = v_project;

  INSERT INTO public.project_table (
    "rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowDuration", "rowProgress", "orderInList", "rowJSON", "created_at", "updated_at"
  ) VALUES (
    v_project,
    public.pm_ltree_label(v_project),
    v_owner,
    v_org,
    '2026-12-31T23:59:59Z'::timestamptz,
    100.00,
    4096,
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
    100.00,
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
    100.00,
    1024,
    jsonb_build_object(
      'rowKind', 'task',
      'taskDescription', 'Railroad Segment No. 1 Construction (225 miles NY-WAS)',
      'name', 'Railroad Segment No. 1 (225 miles)',
      'startAt', '2026-01-01T00:00:00Z',
      'durationDays', 365,
      'taskStatus', 'completed',
      'progressPercent', 100.00
    ),
    NOW(),
    NOW()
  );

  -- Ensure Kanban stages for Railway #1
  PERFORM public.pm_kanban_ensure_project_stages(v_project);

  -- Set 100% Kanban execution state for Task 1 (final column: Execute at 100%)
  SELECT "rowGUID" INTO v_kanban_stage_exec
  FROM public.project_kanban_stage_table
  WHERE "rowOwnerGUID" = v_project
  ORDER BY "orderInList" DESC
  LIMIT 1;

  IF v_kanban_stage_exec IS NOT NULL THEN
    INSERT INTO public.project_task_kanban_state_table (
      "rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON", "created_at", "updated_at"
    ) VALUES (
      gen_random_uuid(),
      v_project,
      v_task,
      1024,
      jsonb_build_object(
        'stageGUID', v_kanban_stage_exec::text,
        'kanbanStageProgressPercent', 100
      ),
      NOW(),
      NOW()
    );
  END IF;

  -- Project User Settings (allows immediate loading of Gantt, Tree, and Ribbon for user)
  INSERT INTO public.project_user_settings_table (
    "rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON"
  ) VALUES (
    'a4000000-0000-4000-8000-000000000001'::uuid,
    v_project,
    v_owner,
    1024,
    jsonb_build_object(
      'uxuiSettings', jsonb_build_object(
        'projectTreeContextCommandsMode', 'onRightClickMenuMode',
        'projectGanttChartContextCommandsMode', 'onRightClickMenuMode',
        'viewButtonsOrder', jsonb_build_array('showGanttChart', 'showFinancesView', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showReportsView', 'showPlanView'),
        'treeColumnsOrder', jsonb_build_array('wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress', 'kanban', 'kanbanStageProgressPercent'),
        'ganttArrowsForm', 'smoothForm',
        'dragAndDropTaskInTree', true,
        'showTreeHierarchyNumbers', true
      )
    )
  ) ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  -- ---------------------------------------------------------------------------------------------
  -- 4. CREATE TASK LINES: Exactly 1 line for each management genus (FULL PROJECT AMOUNTS)
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
      'distributionForBudgetTaskLine', 'uniformDistribution',
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
      'budgetItemTaskLine', 'serviceRevenueBudgetItem',
      'budgetItemItem', 'serviceRevenueBudgetItem',
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
      'distributionForBudgetTaskLine', 'uniformDistribution',
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
      'budgetItemTaskLine', 'rawMaterialsBudgetItem',
      'budgetItemItem', 'rawMaterialsBudgetItem',
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
      'distributionForBudgetTaskLine', 'uniformDistribution',
      'resourceRoleItem', 'role-tamper-machine',
      'taskResourceItem', 'eq-plasser-093x',
      'measureUnitTaskLine', 'unit_hour',
      'qtyTaskLine', c_tamper_hours_total,
      'priceTaskLine', c_tamper_hour_rate,
      'vatRatioTaskLine', c_vat_rate,
      'sumForContract', c_tamper_sum,
      'sumForBudget', c_tamper_sum,
      'sumForAccounting', c_tamper_sum,
      'taskLinePartnerItem', 'ptn-plasser-usa',
      'taskLinePartnerContract', 'ct-plasser-tamper-01',
      'budgetItemTaskLine', 'subcontractedServicesBudgetItem',
      'budgetItemItem', 'subcontractedServicesBudgetItem',
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
      'distributionForBudgetTaskLine', 'uniformDistribution',
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
      'taskLinePartnerItem', 'ptn-plasser-usa',
      'taskLinePartnerContract', 'ct-plasser-operator-01',
      'taskResourcePartner', 'ptn-plasser-usa',
      'taskResourceContract', 'ct-plasser-operator-01',
      'budgetItemTaskLine', 'externalLaborBudgetItem',
      'budgetItemItem', 'externalLaborBudgetItem',
      'description', 'Specialized Heavy Railway Machinery (RMM) Lead Operator John Rimm'
    )
  );

  -- Document line descriptions (identical to the app: kit8 create_vendor_invoice / create_customer_invoice ...)
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'resourceRoleItem',     NULLIF(l."rowJSON"->>'resourceRoleItem', ''),
           'taskResourceItem',     NULLIF(l."rowJSON"->>'taskResourceItem', ''),
           'taskResourceKind',     NULLIF(l."rowJSON"->>'taskResourceKind', ''),
           'measureUnitTaskLine',  NULLIF(l."rowJSON"->>'measureUnitTaskLine', ''),
           'budgetItemTaskLine',   NULLIF(COALESCE(l."rowJSON"->>'budgetItemTaskLine', l."rowJSON"->>'budgetItemItem'), ''),
           'businessUnitTaskLine', NULLIF(l."rowJSON"->>'businessUnitTaskLine', ''),
           'priceTaskLine',        l."rowJSON"->'priceTaskLine',
           'unitSumForBudget',     to_jsonb(round((l."rowJSON"->>'sumForBudget')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6)),
           'unitSumForAccounting', to_jsonb(round((l."rowJSON"->>'sumForAccounting')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6))))
    INTO v_json_rev FROM public.task_line_table l WHERE l."rowGUID" = v_line_revenue;
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'resourceRoleItem',     NULLIF(l."rowJSON"->>'resourceRoleItem', ''),
           'taskResourceItem',     NULLIF(l."rowJSON"->>'taskResourceItem', ''),
           'taskResourceKind',     NULLIF(l."rowJSON"->>'taskResourceKind', ''),
           'measureUnitTaskLine',  NULLIF(l."rowJSON"->>'measureUnitTaskLine', ''),
           'budgetItemTaskLine',   NULLIF(COALESCE(l."rowJSON"->>'budgetItemTaskLine', l."rowJSON"->>'budgetItemItem'), ''),
           'businessUnitTaskLine', NULLIF(l."rowJSON"->>'businessUnitTaskLine', ''),
           'priceTaskLine',        l."rowJSON"->'priceTaskLine',
           'unitSumForBudget',     to_jsonb(round((l."rowJSON"->>'sumForBudget')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6)),
           'unitSumForAccounting', to_jsonb(round((l."rowJSON"->>'sumForAccounting')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6))))
    INTO v_json_mat FROM public.task_line_table l WHERE l."rowGUID" = v_line_material;
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'resourceRoleItem',     NULLIF(l."rowJSON"->>'resourceRoleItem', ''),
           'taskResourceItem',     NULLIF(l."rowJSON"->>'taskResourceItem', ''),
           'taskResourceKind',     NULLIF(l."rowJSON"->>'taskResourceKind', ''),
           'measureUnitTaskLine',  NULLIF(l."rowJSON"->>'measureUnitTaskLine', ''),
           'budgetItemTaskLine',   NULLIF(COALESCE(l."rowJSON"->>'budgetItemTaskLine', l."rowJSON"->>'budgetItemItem'), ''),
           'businessUnitTaskLine', NULLIF(l."rowJSON"->>'businessUnitTaskLine', ''),
           'priceTaskLine',        l."rowJSON"->'priceTaskLine',
           'unitSumForBudget',     to_jsonb(round((l."rowJSON"->>'sumForBudget')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6)),
           'unitSumForAccounting', to_jsonb(round((l."rowJSON"->>'sumForAccounting')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6))))
    INTO v_json_exp FROM public.task_line_table l WHERE l."rowGUID" = v_line_expense;
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'resourceRoleItem',     NULLIF(l."rowJSON"->>'resourceRoleItem', ''),
           'taskResourceItem',     NULLIF(l."rowJSON"->>'taskResourceItem', ''),
           'taskResourceKind',     NULLIF(l."rowJSON"->>'taskResourceKind', ''),
           'measureUnitTaskLine',  NULLIF(l."rowJSON"->>'measureUnitTaskLine', ''),
           'budgetItemTaskLine',   NULLIF(COALESCE(l."rowJSON"->>'budgetItemTaskLine', l."rowJSON"->>'budgetItemItem'), ''),
           'businessUnitTaskLine', NULLIF(l."rowJSON"->>'businessUnitTaskLine', ''),
           'priceTaskLine',        l."rowJSON"->'priceTaskLine',
           'unitSumForBudget',     to_jsonb(round((l."rowJSON"->>'sumForBudget')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6)),
           'unitSumForAccounting', to_jsonb(round((l."rowJSON"->>'sumForAccounting')::numeric / NULLIF((l."rowJSON"->>'qtyTaskLine')::numeric, 0), 6))))
    INTO v_json_time FROM public.task_line_table l WHERE l."rowGUID" = v_line_time;

  v_json_rev  := v_json_rev  || c_vat_json;
  v_json_mat  := v_json_mat  || c_vat_json;
  v_json_exp  := v_json_exp  || c_vat_json;
  v_json_time := v_json_time || c_vat_json;

  -- ---------------------------------------------------------------------------------------------
  -- 5. TASK LINE PLAN & TIMELINE (Plan Movements across 2026)
  -- ---------------------------------------------------------------------------------------------
  -- The plan is what Post writes for "Uniform (even)": one row per ACTIVE day of the calendar of the project (workingDaysCalendar, 2026), every day the same share;
  -- the rounding rest goes to the last day (Correct033). The Time line of John Rimm (2,080 h = 7.97 h on each of the 261 days) fits his 8 h a day (standard work week),
  -- so the capacity check (capacityModeBlock) finds no conflict. A calendar that is not filled for 2026 falls back to Monday-Friday.
  CREATE TEMP TABLE IF NOT EXISTS railway1_days (d date, rn int, n int) ON COMMIT DROP;
  DELETE FROM railway1_days;
  INSERT INTO railway1_days
  SELECT x.d, row_number() OVER (ORDER BY x.d)::int, (count(*) OVER ())::int
    FROM (SELECT (c."rowJSON"->>'day')::date AS d FROM public."managementCalendarDaysTable" c
           WHERE c."rowOwnerGUID" = 'workingDaysCalendar' AND (c."rowJSON"->>'isActive')::boolean IS TRUE AND c."rowJSON"->>'day' BETWEEN '2026-01-01' AND '2026-12-31'
          UNION
          SELECT g::date FROM generate_series('2026-01-01'::date, '2026-12-31'::date, interval '1 day') g
           WHERE extract(isodow FROM g) < 6
             AND NOT EXISTS (SELECT 1 FROM public."managementCalendarDaysTable" c WHERE c."rowOwnerGUID" = 'workingDaysCalendar' AND c."rowJSON"->>'day' BETWEEN '2026-01-01' AND '2026-12-31')) x;

  INSERT INTO public.task_line_plan_movements (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowPeriodDatetime", "rowCoefficient",
    "qtyTaskLine", "sumForBudget", "sumForContract", "sumForAccounting", "planMovementStatus", "periodDay", "rowJSON"
  )
  SELECT gen_random_uuid(), v_project, v_task, L.line, L.ord * 100000 + t.rn, t.d::timestamp AT TIME ZONE 'UTC',
         CASE WHEN t.rn < t.n THEN round(1.0 / t.n, 10) ELSE 1 - (t.n - 1) * round(1.0 / t.n, 10) END,
         CASE WHEN t.rn < t.n THEN round(L.qty / t.n, 2) ELSE L.qty - (t.n - 1) * round(L.qty / t.n, 2) END,
         CASE WHEN t.rn < t.n THEN round(L.amt / t.n, 2) ELSE L.amt - (t.n - 1) * round(L.amt / t.n, 2) END,
         CASE WHEN t.rn < t.n THEN round(L.amt / t.n, 2) ELSE L.amt - (t.n - 1) * round(L.amt / t.n, 2) END,
         CASE WHEN t.rn < t.n THEN round(L.amt / t.n, 2) ELSE L.amt - (t.n - 1) * round(L.amt / t.n, 2) END,
         true, t.d, L.js
    FROM (VALUES
      (v_line_revenue,  1, c_miles_total,         c_miles_sum,   jsonb_build_object('budgetItemTaskLine', 'serviceRevenueBudgetItem', 'taskManagementGenusLine', 'revenueGenus')),
      (v_line_material, 2, c_rail_sticks_total,   c_rail_sum,    jsonb_build_object('budgetItemTaskLine', 'rawMaterialsBudgetItem', 'taskManagementGenusLine', 'materialGenus')),
      (v_line_expense,  3, c_tamper_hours_total,  c_tamper_sum,  jsonb_build_object('budgetItemTaskLine', 'subcontractedServicesBudgetItem', 'taskManagementGenusLine', 'expenseGenus')),
      (v_line_time,     4, c_operator_hours_total, c_operator_sum, jsonb_build_object('budgetItemTaskLine', 'externalLaborBudgetItem', 'taskManagementGenusLine', 'timeGenus'))
    ) AS L(line, ord, qty, amt, js)
    CROSS JOIN railway1_days t;

  INSERT INTO public.task_line_plan_timeline (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowPeriodDatetime", "taskLineGUID", "qtyForBudget", "sumForContract", "sumForBudget", "sumForAccounting"
  )
  SELECT gen_random_uuid(), m."rowProjectGUID", m."rowOwnerGUID", m."rowPeriodDatetime", m."rowParentGUID",
         m."qtyTaskLine", m."sumForContract", m."sumForBudget", m."sumForAccounting"
    FROM public.task_line_plan_movements m WHERE m."rowOwnerGUID" = v_task;

  -- Mark task lines as posted so Monitor01 does not show stale plan warning (yellow)
  UPDATE public.task_line_table
  SET "rowJSON" = "rowJSON" || '{"taskIsPosted": true, "baseOfDistribution": 1}'::jsonb
  WHERE "rowOwnerGUID" = v_task;

  -- Register plan movements
  PERFORM public.project_status_register_plan(ARRAY[v_task]);

  -- ---------------------------------------------------------------------------------------------
  -- 6. LIFECYCLE DOCUMENT 1: PURCHASE ORDER (FULL PROJECT AMOUNT: $59,530,100.00)
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
      'purchaseOrderDateTime', '2026-11-01T09:00:00Z',
      'purchaseOrderCurrency', 'USD',
      'purchaseOrderFolder', 'le-nec-infra:ptn-eastern-rail',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'PO-NYWAS-00001',
        'documentStatus', 'posted',
        'postedAt', '2026-11-01T09:30:00Z',
        'postedBy', v_owner,
        'title', 'Purchase Order: 100% Full Project Order - Steel Rails, Tamper Plant Hire & Operator Services'
      )
    ),
    '2026-11-01T09:00:00Z'::timestamptz,
    '2026-11-01T09:30:00Z'::timestamptz
  );

  INSERT INTO public.purchase_order_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "genusGUID", "orderInList",
    "qtyOrdered", "priceOrdered", "vatRatioOrdered", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_po_line_mat, v_po_header, v_project, v_task, v_line_material, 'materialGenus', 1024,
     c_rail_sticks_total, c_rail_stick_price, c_vat_rate, c_rail_sum, c_rail_sum, 0.00, c_rail_sum, 0.00,
     v_json_mat || jsonb_build_object('itemTitle', '136 RE Carbon Steel Rail 80ft Sticks (Full Project Amount: 29,700 sticks)')),
    (v_po_line_exp, v_po_header, v_project, v_task, v_line_expense, 'expenseGenus', 2048,
     c_tamper_hours_total, c_tamper_hour_rate, c_vat_rate, c_tamper_sum, c_tamper_sum, 0.00, c_tamper_sum, 0.00,
     v_json_exp || jsonb_build_object('itemTitle', 'Plasser 09-3X Dynacat Tamper Hire (Full Project Amount: 6,750 hours)')),
    (v_po_line_time, v_po_header, v_project, v_task, v_line_time, 'timeGenus', 3072,
     c_operator_hours_total, c_operator_hour_rate, c_vat_rate, c_operator_sum, c_operator_sum, 0.00, c_operator_sum, 0.00,
     v_json_time || jsonb_build_object('itemTitle', 'Specialized Heavy Railway Machinery (RMM) Lead Operator Services (Full Project Amount: 2,080 hours)'));

  PERFORM public.project_status_register_order(v_po_header);

  -- ---------------------------------------------------------------------------------------------
  -- 7. LIFECYCLE DOCUMENT 2: PRODUCT RECEIPT (FULL PROJECT AMOUNT: $59,530,100.00)
  -- ---------------------------------------------------------------------------------------------
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
      'productReceiptDateTime', '2026-11-15T14:00:00Z',
      'productReceiptCurrency', 'USD',
      'productReceiptFolder', 'le-nec-infra:ptn-eastern-rail',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'PR-NYWAS-00001',
        'documentStatus', 'posted',
        'postedAt', '2026-11-15T15:00:00Z',
        'postedBy', v_owner,
        'title', 'Product Receipt: 100% Full Project Delivery - Steel Rails, Tamper Plant & Operator Services'
      )
    ),
    '2026-11-15T14:00:00Z'::timestamptz,
    '2026-11-15T15:00:00Z'::timestamptz
  );

  INSERT INTO public.product_receipt_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "purchaseOrderLineGUID", "genusGUID", "orderInList",
    "qtyReceived", "priceReceived", "vatRatioReceived", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_pr_line_mat, v_pr_header, v_project, v_task, v_line_material, v_po_line_mat, 'materialGenus', 1024,
     c_rail_sticks_total, c_rail_stick_price, c_vat_rate, c_rail_sum, c_rail_sum, 0.00, c_rail_sum, 0.00,
     v_json_mat || jsonb_build_object('deliveryWaybill', 'WB-NEC-FULL-136RE-01', 'itemTitle', '136 RE Carbon Steel Rail 80ft Sticks (Full Delivery: 29,700 sticks)')),
    (v_pr_line_exp, v_pr_header, v_project, v_task, v_line_expense, v_po_line_exp, 'expenseGenus', 2048,
     c_tamper_hours_total, c_tamper_hour_rate, c_vat_rate, c_tamper_sum, c_tamper_sum, 0.00, c_tamper_sum, 0.00,
     v_json_exp || jsonb_build_object('deliveryWaybill', 'WB-NEC-FULL-TAMPER-01', 'itemTitle', 'Plasser 09-3X Dynacat Tamper (Full Operating Hours: 6,750 hours)')),
    (v_pr_line_time, v_pr_header, v_project, v_task, v_line_time, v_po_line_time, 'timeGenus', 3072,
     c_operator_hours_total, c_operator_hour_rate, c_vat_rate, c_operator_sum, c_operator_sum, 0.00, c_operator_sum, 0.00,
     v_json_time || jsonb_build_object('deliveryWaybill', 'TS-NEC-FULL-OPERATOR-01', 'itemTitle', 'Specialized Heavy Railway Machinery (RMM) Lead Operator Services (Full Delivery: 2,080 hours)'));

  PERFORM public.project_status_register_receipt(v_pr_header);

  -- ---------------------------------------------------------------------------------------------
  -- 8. LIFECYCLE DOCUMENT 3: FACT INPUT (FULL PROJECT AMOUNTS: ALL 4 GENERA AT 100%)
  -- ---------------------------------------------------------------------------------------------
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
        'postedAt', '2026-11-30T17:00:00Z',
        'postedBy', v_owner,
        'created_at', '2026-11-30T16:30:00Z',
        'title', 'Fact Input: 100% Full Project Final Progress & Actuals Confirmation'
      )
    ),
    '2026-11-30T16:30:00Z'::timestamptz,
    '2026-11-30T17:00:00Z'::timestamptz
  );

  INSERT INTO public.task_fact_usage_timeline (
    "rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowHeaderGUID", "taskLineGUID", "genusGUID", "orderInList",
    "rowPeriodDatetime", "periodDay", "qtyForBudget", "qtyForContract", "sumForBudget", "sumForContract", "sumForAccounting", "rowJSON"
  ) VALUES
    (v_fact_line_rev, v_project, v_task, v_fact_header, v_line_revenue, 'revenueGenus', 1024,
     '2026-11-30T00:00:00Z'::timestamptz, '2026-11-30'::date, c_miles_total, c_miles_total, c_miles_sum, c_miles_sum, c_miles_sum,
     v_json_rev || jsonb_build_object('milestoneTitle', '100% Full Completion - Railroad Segment No. 1 (225 miles)')),
    (v_fact_line_mat, v_project, v_task, v_fact_header, v_line_material, 'materialGenus', 2048,
     '2026-11-30T00:00:00Z'::timestamptz, '2026-11-30'::date, c_rail_sticks_total, c_rail_sticks_total, c_rail_sum, c_rail_sum, c_rail_sum,
     v_json_mat || jsonb_build_object('materialBatch', '100% Full Consumption - 29,700 sticks 136 RE rail laid into track')),
    (v_fact_line_exp, v_project, v_task, v_fact_header, v_line_expense, 'expenseGenus', 3072,
     '2026-11-30T00:00:00Z'::timestamptz, '2026-11-30'::date, c_tamper_hours_total, c_tamper_hours_total, c_tamper_sum, c_tamper_sum, c_tamper_sum,
     v_json_exp || jsonb_build_object('logReport', '100% Full Operation - 6,750 operating hours Plasser 09-3X Dynacat tamper')),
    (v_fact_line_time, v_project, v_task, v_fact_header, v_line_time, 'timeGenus', 4096,
     '2026-11-30T00:00:00Z'::timestamptz, '2026-11-30'::date, c_operator_hours_total, c_operator_hours_total, c_operator_sum, c_operator_sum, c_operator_sum,
     v_json_time || jsonb_build_object('timesheetRef', '100% Full Execution - John Rimm 2,080 shift hours completed'));

  PERFORM public.project_status_register_fact(v_fact_header);

  -- ---------------------------------------------------------------------------------------------
  -- 9. LIFECYCLE DOCUMENT 4: VENDOR INVOICE (FULL PROJECT AMOUNT: $59,530,100.00)
  -- ---------------------------------------------------------------------------------------------
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
      'vendorInvoiceDateTime', '2026-11-20T10:00:00Z',
      'vendorInvoiceCurrency', 'USD',
      'vendorInvoiceFolder', 'le-nec-infra:ptn-eastern-rail',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'VI-SUPP-98421',
        'documentStatus', 'posted',
        'postedAt', '2026-11-20T11:00:00Z',
        'postedBy', v_owner,
        'title', 'Vendor Invoice: 100% Full Project Billing - Steel Rails, Tamper Plant Hire & Operator Services'
      )
    ),
    '2026-11-20T10:00:00Z'::timestamptz,
    '2026-11-20T11:00:00Z'::timestamptz
  );

  INSERT INTO public.vendor_invoice_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "genusGUID", "orderInList",
    "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_vi_line_mat, v_vi_header, v_project, v_task, v_line_material, 'materialGenus', 1024,
     c_rail_sticks_total, c_rail_stick_price, c_vat_rate, c_rail_sum, c_rail_sum, 0.00, c_rail_sum, 0.00,
     v_json_mat || jsonb_build_object('productReceiptLineGUID', v_pr_line_mat, 'vendorItemCode', '136RE-80-FULL', 'itemTitle', '136 RE Carbon Steel Rail (Full: 29,700 sticks)')),
    (v_vi_line_exp, v_vi_header, v_project, v_task, v_line_expense, 'expenseGenus', 2048,
     c_tamper_hours_total, c_tamper_hour_rate, c_vat_rate, c_tamper_sum, c_tamper_sum, 0.00, c_tamper_sum, 0.00,
     v_json_exp || jsonb_build_object('productReceiptLineGUID', v_pr_line_exp, 'vendorItemCode', 'PLASSER-093X-FULL', 'itemTitle', 'Plasser 09-3X Dynacat Tamper (Full: 6,750 hours)')),
    (v_vi_line_time, v_vi_header, v_project, v_task, v_line_time, 'timeGenus', 3072,
     c_operator_hours_total, c_operator_hour_rate, c_vat_rate, c_operator_sum, c_operator_sum, 0.00, c_operator_sum, 0.00,
     v_json_time || jsonb_build_object('productReceiptLineGUID', v_pr_line_time, 'vendorItemCode', 'RMM-OP-FULL', 'itemTitle', 'Specialized Heavy Railway Machinery (RMM) Lead Operator Services (Full: 2,080 hours)'));

  PERFORM public.project_status_register_invoice(v_vi_header);

  -- ---------------------------------------------------------------------------------------------
  -- 10. LIFECYCLE DOCUMENT 5: CUSTOMER INVOICE (FULL PROJECT AMOUNT: $270,000,000.00)
  -- ---------------------------------------------------------------------------------------------
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
      'customerInvoiceDateTime', '2026-11-30T10:00:00Z',
      'customerInvoiceCurrency', 'USD',
      'customerInvoiceFolder', 'le-nec-infra:ptn-amtrak',
      'documentHeader', jsonb_build_object(
        'documentNumber', 'CI-AMTRK-2026-001',
        'documentStatus', 'posted',
        'postedAt', '2026-11-30T12:00:00Z',
        'postedBy', v_owner,
        'title', 'Customer Invoice: 100% Full Project Billing - 225 Miles Railroad Segment 1'
      )
    ),
    '2026-11-30T10:00:00Z'::timestamptz,
    '2026-11-30T12:00:00Z'::timestamptz
  );

  INSERT INTO public.customer_invoice_lines (
    "rowGUID", "rowHeaderGUID", "rowProjectGUID", "rowOwnerGUID", "taskLineGUID", "genusGUID", "orderInList",
    "qtyInvoiced", "priceInvoiced", "vatRatioInvoiced", "sumForBudget", "sumForContract", "vatForContract", "sumForAccounting", "vatForAccounting", "rowJSON"
  ) VALUES
    (v_ci_line_rev, v_ci_header, v_project, v_task, v_line_revenue, 'revenueGenus', 1024,
     c_miles_total, c_miles_price, c_vat_rate, c_miles_sum, c_miles_sum, 0.00, c_miles_sum, 0.00,
     v_json_rev || jsonb_build_object('milestoneCertification', 'NEC-ENG-FULL-COMPLETION-ACCEPTED', 'itemTitle', 'Railroad Segment No. 1 Turnkey Construction (Full Project: 225 miles)'));

  PERFORM public.project_status_register_customer_invoice(v_ci_header);

  -- ---------------------------------------------------------------------------------------------
  -- 10b. PAYMENT FACTS (PART 38): "Create based on -> Payment fact" of the two POSTED invoices, then the bank number, the date and the money account, then Post
  --      the customer pays $270,000,000.00 on 2026-12-05 (INBOUND, Receipts from customers), the vendor is paid $59,530,100.00 on 2026-12-10 (OUTBOUND, Payments to vendors), both on the operating account
  -- ---------------------------------------------------------------------------------------------
  IF to_regclass('public."moneyAccountTable"') IS NOT NULL AND to_regprocedure('public.create_payment_fact_from_customer_invoice(uuid)') IS NOT NULL THEN
    v_pf_answer := public.create_payment_fact_from_customer_invoice(v_ci_header);
    v_pf_receipt := (v_pf_answer->'documents'->0->>'documentGUID')::uuid;
    IF v_pf_receipt IS NULL THEN RAISE EXCEPTION 'Railway #1: no payment fact was made of the customer invoice: %', v_pf_answer; END IF;
    PERFORM public.payment_fact_set_header(v_pf_receipt, jsonb_build_object('paymentFactNumber', 'BANK-NEC-2026-1205-001', 'paymentFactDate', '2026-12-05', 'moneyAccountFact', 'ma-nec-usd-operating'));
    v_pf_answer := public.post_payment_fact(v_pf_receipt);
    IF v_pf_answer->>'status' <> 'posted' THEN RAISE EXCEPTION 'Railway #1: the customer receipt was not posted: %', v_pf_answer; END IF;

    v_pf_answer := public.create_payment_fact_from_vendor_invoice(v_vi_header);
    v_pf_payment := (v_pf_answer->'documents'->0->>'documentGUID')::uuid;
    IF v_pf_payment IS NULL THEN RAISE EXCEPTION 'Railway #1: no payment fact was made of the vendor invoice: %', v_pf_answer; END IF;
    PERFORM public.payment_fact_set_header(v_pf_payment, jsonb_build_object('paymentFactNumber', 'BANK-NEC-2026-1210-001', 'paymentFactDate', '2026-12-10', 'moneyAccountFact', 'ma-nec-usd-operating'));
    v_pf_answer := public.post_payment_fact(v_pf_payment);
    IF v_pf_answer->>'status' <> 'posted' THEN RAISE EXCEPTION 'Railway #1: the vendor payment was not posted: %', v_pf_answer; END IF;

    -- guard: the cash ledger holds exactly the two payments and the rest of the operating account is the one of the design
    IF (SELECT coalesce(sum(m."sumForContract"), 0) FROM public.cash_account_ledger_movements m WHERE m."rowProjectGUID" = v_project AND m."paymentDirection" = 'inbound') <> c_miles_sum
       OR (SELECT coalesce(sum(-m."sumForContract"), 0) FROM public.cash_account_ledger_movements m WHERE m."rowProjectGUID" = v_project AND m."paymentDirection" = 'outbound') <> c_vendor_total_sum
       OR (SELECT r."rest" FROM public.cash_account_ledger_rests r WHERE r."moneyAccount" = 'ma-nec-usd-operating' AND r."sumKind" = 'account' AND r."currency" = 'USD' ORDER BY r."periodDay" DESC LIMIT 1)
          <> 25000000.00 + c_miles_sum - c_vendor_total_sum THEN
      RAISE EXCEPTION 'Railway #1: the cash ledger is not what the design says (receipt %, payment %, rest %)', c_miles_sum, c_vendor_total_sum, (25000000.00 + c_miles_sum - c_vendor_total_sum);
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------------------------
  -- 10c. PARTNER BALANCE (PART 39, Monitor07): the two invoices above were written as POSTED (no Post call), so their rows are made now (the backfill); the two payments made theirs at Post.
  --      Each contract is paid in full: the balance of the customer contract and of the vendor contract is 0 (Monitor07 shows the invoice in Plus and the payment in Minus).
  -- ---------------------------------------------------------------------------------------------
  IF to_regprocedure('public.partner_balance_register_missing()') IS NOT NULL THEN
    PERFORM public.partner_balance_register_missing();
    IF to_regclass('public."moneyAccountTable"') IS NOT NULL AND v_pf_receipt IS NOT NULL AND v_pf_payment IS NOT NULL THEN
      IF (SELECT count(*) FROM public.partner_balance_movements m WHERE m."projectGUID" = v_project) <> 2 * ((SELECT count(*) FROM public.customer_invoice_lines WHERE "rowHeaderGUID" = v_ci_header) + (SELECT count(*) FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = v_vi_header))
         OR (SELECT coalesce(sum(m."sumForContract"), 0) FROM public.partner_balance_movements m WHERE m."projectGUID" = v_project AND m."balanceRole" = 'customer') <> 0
         OR (SELECT coalesce(sum(m."sumForContract"), 0) FROM public.partner_balance_movements m WHERE m."projectGUID" = v_project AND m."balanceRole" = 'vendor') <> 0 THEN
        RAISE EXCEPTION 'Railway #1: the partner balance is not what the design says (every contract is paid in full: customer 0, vendor 0)';
      END IF;
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------------------------
  -- 11. FINANCIAL ROLLUP & MONITOR01 REPORT SYNC
  -- ---------------------------------------------------------------------------------------------
  PERFORM public.project_cost_rebuild(v_project);

  -- Ensure task lines stay posted after cost rollup so Monitor01 hasStalePlan is false
  UPDATE public.task_line_table
  SET "rowJSON" = "rowJSON" || '{"taskIsPosted": true, "baseOfDistribution": 1}'::jsonb
  WHERE "rowOwnerGUID" = v_task;

  -- Refresh Monitor01 view immediately and queue tasks
  PERFORM public.monitor01_refresh_now(v_project);
  PERFORM public.monitor01_queue_tasks(ARRAY[v_stage, v_task], 'railway1_seed');
  PERFORM public.monitor01_process_batch();

  -- guard: the invoice amounts must not be empty
  IF EXISTS (SELECT 1 FROM public.vendor_invoice_lines WHERE "rowHeaderGUID" = v_vi_header AND "sumForBudget" IS NULL)
     OR EXISTS (SELECT 1 FROM public.customer_invoice_lines WHERE "rowHeaderGUID" = v_ci_header AND "sumForBudget" IS NULL) THEN
    RAISE EXCEPTION 'Railway #1: vendor / customer invoice lines have NULL sumForBudget';
  END IF;

  -- the budget items this script made before it used the standard ones (nothing points at them any more)
  DELETE FROM public."budgetItemTable" WHERE "rowGUID" IN ('bi-nec-turnkey-rev', 'bi-nec-rail-mat', 'bi-nec-tamper-exp', 'bi-nec-operator-lab');

  -- guard (activity genus): the 4 lines point at budget items that have a key and a direction; the budget cash flow by activity and direction is the one of the design
  IF (SELECT count(*) FROM public.task_line_table l JOIN public."budgetItemTable" b ON b."rowGUID" = l."rowJSON"->>'budgetItemTaskLine'
       WHERE l."rowOwnerGUID" = v_task AND coalesce(b."rowJSON"->>'budgetItemGenericKey', '') <> '' AND b."rowJSON"->>'direction' IN ('inbound', 'outbound')) <> 4 THEN
    RAISE EXCEPTION 'Railway #1: the 4 task lines need 4 budget items with a budgetItemGenericKey and a direction';
  END IF;
  IF (SELECT coalesce(sum(CASE WHEN b."rowJSON"->>'direction' = 'inbound' THEN 1 ELSE -1 END * (l."rowJSON"->>'sumForBudget')::numeric), 0)
        FROM public.task_line_table l JOIN public."budgetItemTable" b ON b."rowGUID" = l."rowJSON"->>'budgetItemTaskLine'
       WHERE l."rowOwnerGUID" = v_task AND split_part(b."rowJSON"->>'budgetItemGenericKey', '.', 1) = 'operatingActivity') <> (c_miles_sum - c_budget_cost_total) THEN
    RAISE EXCEPTION 'Railway #1: the net operating cash flow budget is not % (inbound - outbound of the operating budget items)', (c_miles_sum - c_budget_cost_total);
  END IF;

  RAISE NOTICE 'Universal1 Railway #1 Seed Successfully Landed with FULL PROJECT AMOUNTS across all documents!';
  RAISE NOTICE 'Project GUID: %', v_project;
  RAISE NOTICE 'Task GUID: %', v_task;
  RAISE NOTICE 'Net operating cash flow budget (inbound - outbound of the operating budget items): %', (c_miles_sum - c_budget_cost_total);
  RAISE NOTICE 'Payment facts: receipt % (inbound %), payment % (outbound %); rest of ma-nec-usd-operating %', v_pf_receipt, c_miles_sum, v_pf_payment, c_vendor_total_sum, (25000000.00 + c_miles_sum - c_vendor_total_sum);
  RAISE NOTICE 'Full Amounts: PO=%, PR=%, Fact=%, VI=%, CI=%',
    c_vendor_total_sum, c_vendor_total_sum, (c_miles_sum + c_budget_cost_total), c_vendor_total_sum, c_miles_sum;
END $$;

COMMIT;

-- Ensure lines are marked as posted and Monitor01 is refreshed after transaction commits
UPDATE public.task_line_table
SET "rowJSON" = "rowJSON" || '{"taskIsPosted": true, "baseOfDistribution": 1}'::jsonb
WHERE "rowOwnerGUID" = 'a3000000-0000-4000-8000-000000000001'::uuid;

SELECT public.monitor01_refresh_now('a1000000-0000-4000-8000-000000000001'::uuid);
