-- =====================================================================================
-- UNIVERSAL1 - RESOURCE ROLE CATALOG: kit8/sql/init/create_resource_role_tables.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_resource_role_tables.sql.)
--
-- Source: Google Sheet "W1 V3 ER DESCRIPTORS PLAN": resourceRoleTypeTable and resourceRoleTable are the work-resource twins of
-- productTypeTable and productTable and use the SAME descriptor tables as the products:
--   Property  = what a role requires (min. experience, certification)   propertyValueTable   owner = resourceRole
--   Variant   = a bookable level of the role (Senior, English)          variantTable         owner = resourceRoleType (variantMode perType)
--   Rate      = the hourly price per price list / variant / day         rolePriceTable       owner = resourceRole, parent = variant | 'empty'
--                                                                       (the SAME shape as productPriceTable: priceTypeGUID, price, measureUnit, validFrom)
-- Four tables are new: resourceRoleTypeTable, resourceRoleFolderTable (the role tree), resourceRoleTable, rolePriceTable.
-- The descriptor tables (descriptorGenusTable, descriptorValueTable, descriptorDestinationTable, descriptorPlanTable,
-- propertyValueTable, variantTable, variantValueTable, priceTypeTable, measureUnitTable, valueAddedTaxTable) are shared: this script
-- only ADDS the role rows to them (the owner is polymorphic: a product type / product OR a role type / role).
--
-- Every table follows kit8/sql/defTable.md: "rowGUID" (TEXT, unique) · "rowOwnerGUID" · "rowParentGUID"
-- ('empty' = none) · "orderInList" · "rowJSON" (all values) · created_at / updated_at.
-- Screen: Resource roles dashboard (kit8/catalog/resourcerole/dashboard/ResourceRoleDashboard.tsx, route /catalog/resourcerole/dashboard).
--
-- NEEDS kit8/sql/init/create_product_tables.sql FIRST (the shared tables). IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS,
-- seeds ON CONFLICT DO NOTHING. Safe to run twice.
--
-- Seed (the sheet rows, role side; sheet GUIDs kept: projectManager, role1, dv11, dp8, pv7, rp1 ...) + a small folder tree
-- (Management & analysis, Data, Engineering > Frontend / Backend) and VAT 21 % (as the products).
-- Rows: resourceRoleTypeTable 5, resourceRoleFolderTable 5, resourceRoleTable 8, rolePriceTable 32, descriptorGenusTable 4, descriptorValueTable 11, descriptorDestinationTable 10, descriptorPlanTable 18, propertyValueTable 11, variantTable 9, variantValueTable 18, priceTypeTable 2
--
-- Integrity (rules R1-R14 of the sheet): unique indexes below (one price per day) + checks of the fixed lists; the rest
-- (R3-R7, R10-R14) is checked by the dashboard "Checks" panel (kit8/catalog/resourcerole/crud/resourceRoleValidation.ts).
-- No foreign keys: owners are polymorphic and Undo of a delete must be able to re-create a row.
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."descriptorGenusTable"') IS NULL OR to_regclass('public."variantTable"') IS NULL OR to_regclass('public."priceTypeTable"') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/create_product_tables.sql first: the role catalog shares its descriptor, variant, price type and unit tables';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;

-- one helper for every catalog / generic table: RLS on + touch trigger + REPLICA IDENTITY FULL
CREATE OR REPLACE FUNCTION public.kit8_setup_def_table(p_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.%I', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || p_table || '_touch', p_table);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at()',
                 'trg_' || p_table || '_touch', p_table);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING GIN ("rowJSON" jsonb_path_ops)', 'idx_' || p_table || '_rowJSON', p_table);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I ("orderInList")', 'idx_' || p_table || '_order', p_table);
END;
$$;

-- =====================================================================================
-- 1. Tables
-- =====================================================================================

-- resourceRoleTypeTable: groups roles of the same kind. owner = 'resourceRoleTypeCatalog'
CREATE TABLE IF NOT EXISTS public."resourceRoleTypeTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'resourceRoleTypeCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_resourceRoleTypeTable_owner_order" ON public."resourceRoleTypeTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_resourceRoleTypeTable_parent" ON public."resourceRoleTypeTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('resourceRoleTypeTable');

-- rowJSON: title, description, baseUnit (measureUnitTable, unit_hour), roleVATDefaultRate (valueAddedTaxTable), propertySet / variantSet (descriptorDestinationTable),
--          variantMode (none | perType | perProduct | sharedWithType), variantSharedTypeGUID, uniqueVariants, variantTitleTemplate, isActive

-- resourceRoleFolderTable: the role tree (Engineering > Frontend). owner = 'resourceRoleFolderCatalog', parent = parent folder | 'empty'
CREATE TABLE IF NOT EXISTS public."resourceRoleFolderTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'resourceRoleFolderCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_resourceRoleFolderTable_owner_order" ON public."resourceRoleFolderTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_resourceRoleFolderTable_parent" ON public."resourceRoleFolderTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('resourceRoleFolderTable');

-- resourceRoleTable: a concrete bookable role. owner = resourceRoleType, parent = resourceRoleFolder | 'empty'
CREATE TABLE IF NOT EXISTS public."resourceRoleTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'empty',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_resourceRoleTable_owner_order" ON public."resourceRoleTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_resourceRoleTable_parent" ON public."resourceRoleTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('resourceRoleTable');

-- rowJSON: title, description, roleVATRate (null = the role type default), isActive. NO rate fields: rates live only in rolePriceTable (rule R14)

-- rolePriceTable: hourly rates. owner = resourceRole, parent = variant of the role's type | 'empty' (= all variants)
CREATE TABLE IF NOT EXISTS public."rolePriceTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'empty',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_rolePriceTable_owner_order" ON public."rolePriceTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_rolePriceTable_parent" ON public."rolePriceTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('rolePriceTable');

-- rowJSON: priceTypeGUID, price, measureUnit (measureUnitTable, unit_hour: the rate of ONE unit), validFrom - the same as productPriceTable

-- =====================================================================================
-- 2. Integrity: fixed lists + unique keys (rows the app creates start with empty values: allowed)
-- =====================================================================================
ALTER TABLE public."resourceRoleTypeTable" DROP CONSTRAINT IF EXISTS "resourceRoleTypeTable_variant_mode_chk";
ALTER TABLE public."resourceRoleTypeTable" ADD CONSTRAINT "resourceRoleTypeTable_variant_mode_chk" CHECK (coalesce("rowJSON"->>'variantMode', '') = '' OR "rowJSON"->>'variantMode' IN ('none', 'perType', 'perProduct', 'sharedWithType'));
-- a rate is the price of ONE unit of measure (a rowGUID of measureUnitTable; existence is checked by the dashboard Checks panel)
ALTER TABLE public."rolePriceTable" DROP CONSTRAINT IF EXISTS "rolePriceTable_unit_chk";
ALTER TABLE public."rolePriceTable" ADD CONSTRAINT "rolePriceTable_unit_chk" CHECK (coalesce("rowJSON"->>'measureUnit', '') <> '') NOT VALID;
ALTER TABLE public."rolePriceTable" DROP CONSTRAINT IF EXISTS "rolePriceTable_price_chk";
ALTER TABLE public."rolePriceTable" ADD CONSTRAINT "rolePriceTable_price_chk" CHECK (jsonb_typeof("rowJSON"->'price') IS DISTINCT FROM 'number' OR ("rowJSON"->>'price')::numeric >= 0);
-- one rate per role + variant + price list + unit + day
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rolePriceTable_price_day" ON public."rolePriceTable" ("rowOwnerGUID", "rowParentGUID", ("rowJSON"->>'priceTypeGUID'), (coalesce("rowJSON"->>'measureUnit', '')), ("rowJSON"->>'validFrom')) WHERE NOT coalesce("rowJSON"->>'priceTypeGUID', '') = '' AND NOT coalesce("rowJSON"->>'validFrom', '') = '';
CREATE INDEX IF NOT EXISTS "idx_resourceRoleTable_title" ON public."resourceRoleTable" ((lower("rowJSON"->>'title')));

-- =====================================================================================
-- 3. Security: full CRUD for signed-in users (as partnerTable / personTable)
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', t || '_delete', t);
  END LOOP;
END $$;

-- =====================================================================================
-- 4. Seed (ON CONFLICT DO NOTHING: a row the user changed or deleted-and-recreated is left alone)
--    First the rows the role side adds to the SHARED tables, then the four role tables.
-- =====================================================================================

-- measureUnitTable: unit_hour (already in create_product_tables.sql)
INSERT INTO public."measureUnitTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('unit_hour', 'measureUnitCatalog', 'empty', 4000, '{"title": "hour", "code": "356"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- descriptorGenusTable: 4 role descriptors (targetKinds resourceRoleType)
INSERT INTO public."descriptorGenusTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('seniority', 'descriptorGenusCatalog', 'empty', 24000, '{"title": "Seniority", "valueType": "ref", "allowedDescriptionModes": ["variant"], "targetKinds": ["resourceRoleType"], "isActive": true}'::jsonb),
  ('workLanguage', 'descriptorGenusCatalog', 'empty', 25000, '{"title": "Working language", "valueType": "ref", "allowedDescriptionModes": ["property", "variant"], "targetKinds": ["resourceRoleType"], "isActive": true}'::jsonb),
  ('certification', 'descriptorGenusCatalog', 'empty', 26000, '{"title": "Certification", "valueType": "ref", "allowedDescriptionModes": ["property"], "targetKinds": ["resourceRoleType"], "isActive": true}'::jsonb),
  ('minExperienceYears', 'descriptorGenusCatalog', 'empty', 27000, '{"title": "Min. experience, years", "valueType": "number", "allowedDescriptionModes": ["property"], "targetKinds": ["resourceRoleType"], "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- descriptorValueTable: Junior ... Lead, English / Latvian / Russian, PMP ... CBAP
INSERT INTO public."descriptorValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('dv11', 'seniority', 'empty', 100000, '{"code": "junior", "title": "Junior", "sort": 10}'::jsonb),
  ('dv12', 'seniority', 'empty', 101000, '{"code": "middle", "title": "Middle", "sort": 20}'::jsonb),
  ('dv13', 'seniority', 'empty', 102000, '{"code": "senior", "title": "Senior", "sort": 30}'::jsonb),
  ('dv14', 'seniority', 'empty', 103000, '{"code": "lead", "title": "Lead", "sort": 40}'::jsonb),
  ('dv15', 'workLanguage', 'empty', 104000, '{"code": "en", "title": "English", "sort": 10}'::jsonb),
  ('dv16', 'workLanguage', 'empty', 105000, '{"code": "lv", "title": "Latvian", "sort": 20}'::jsonb),
  ('dv17', 'workLanguage', 'empty', 106000, '{"code": "ru", "title": "Russian", "sort": 30}'::jsonb),
  ('dv18', 'certification', 'empty', 107000, '{"code": "pmp", "title": "PMP", "sort": 10}'::jsonb),
  ('dv19', 'certification', 'empty', 108000, '{"code": "prince2", "title": "PRINCE2", "sort": 20}'::jsonb),
  ('dv20', 'certification', 'empty', 109000, '{"code": "pl300", "title": "Microsoft PL-300 (Power BI)", "sort": 30}'::jsonb),
  ('dv21', 'certification', 'empty', 110000, '{"code": "cbap", "title": "IIBA CBAP", "sort": 40}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- priceTypeTable: Bill rate and Cost rate (per hour). pt_customerA of create_product_tables.sql already serves goods AND hours
INSERT INTO public."priceTypeTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pt_bill', 'priceTypeCatalog', 'empty', 5000, '{"title": "Bill rate", "currency": "EUR", "vatIncluded": false, "appliesTo": ["resourceRoleType"]}'::jsonb),
  ('pt_cost', 'priceTypeCatalog', 'empty', 6000, '{"title": "Cost rate", "currency": "EUR", "vatIncluded": false, "appliesTo": ["resourceRoleType"]}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- descriptorDestinationTable: one Property set and one Variant set per role type
INSERT INTO public."descriptorDestinationTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('ds_pm_prop', 'projectManager', 'property', 100000, '{"title": "Project manager – properties"}'::jsonb),
  ('ds_pm_var', 'projectManager', 'variant', 101000, '{"title": "Project manager – variants"}'::jsonb),
  ('ds_ba_prop', 'businessAnalyst', 'property', 102000, '{"title": "Business analyst – properties"}'::jsonb),
  ('ds_ba_var', 'businessAnalyst', 'variant', 103000, '{"title": "Business analyst – variants"}'::jsonb),
  ('ds_da_prop', 'dataAnalyst', 'property', 104000, '{"title": "Data analyst – properties"}'::jsonb),
  ('ds_da_var', 'dataAnalyst', 'variant', 105000, '{"title": "Data analyst – variants"}'::jsonb),
  ('ds_fe_prop', 'frontendDeveloper', 'property', 106000, '{"title": "Frontend developer – properties"}'::jsonb),
  ('ds_fe_var', 'frontendDeveloper', 'variant', 107000, '{"title": "Frontend developer – variants"}'::jsonb),
  ('ds_be_prop', 'backendDeveloper', 'property', 108000, '{"title": "Backend developer – properties"}'::jsonb),
  ('ds_be_var', 'backendDeveloper', 'variant', 109000, '{"title": "Backend developer – variants"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- descriptorPlanTable: the descriptors of those sets
INSERT INTO public."descriptorPlanTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('dp8', 'ds_pm_prop', 'minExperienceYears', 100000, '{"required": true, "sort": 10, "showInCard": true}'::jsonb),
  ('dp9', 'ds_pm_prop', 'certification', 101000, '{"required": false, "sort": 20, "showInCard": true}'::jsonb),
  ('dp10', 'ds_pm_var', 'seniority', 102000, '{"required": true, "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp11', 'ds_pm_var', 'workLanguage', 103000, '{"required": true, "sort": 20, "inVariantTitle": true}'::jsonb),
  ('dp12', 'ds_ba_prop', 'minExperienceYears', 104000, '{"required": true, "sort": 10, "showInCard": true}'::jsonb),
  ('dp13', 'ds_ba_prop', 'certification', 105000, '{"required": false, "sort": 20, "showInCard": true}'::jsonb),
  ('dp14', 'ds_ba_var', 'seniority', 106000, '{"required": true, "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp15', 'ds_ba_var', 'workLanguage', 107000, '{"required": true, "sort": 20, "inVariantTitle": true}'::jsonb),
  ('dp16', 'ds_da_prop', 'minExperienceYears', 108000, '{"required": true, "sort": 10, "showInCard": true}'::jsonb),
  ('dp17', 'ds_da_prop', 'certification', 109000, '{"required": false, "sort": 20, "showInCard": true}'::jsonb),
  ('dp18', 'ds_da_var', 'seniority', 110000, '{"required": true, "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp19', 'ds_da_var', 'workLanguage', 111000, '{"required": true, "sort": 20, "inVariantTitle": true}'::jsonb),
  ('dp20', 'ds_fe_prop', 'minExperienceYears', 112000, '{"required": true, "sort": 10, "showInCard": true}'::jsonb),
  ('dp21', 'ds_fe_var', 'seniority', 113000, '{"required": true, "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp22', 'ds_fe_var', 'workLanguage', 114000, '{"required": true, "sort": 20, "inVariantTitle": true}'::jsonb),
  ('dp23', 'ds_be_prop', 'minExperienceYears', 115000, '{"required": true, "sort": 10, "showInCard": true}'::jsonb),
  ('dp24', 'ds_be_var', 'seniority', 116000, '{"required": true, "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp25', 'ds_be_var', 'workLanguage', 117000, '{"required": true, "sort": 20, "inVariantTitle": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- resourceRoleTypeTable: 5 rows
INSERT INTO public."resourceRoleTypeTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('projectManager', 'resourceRoleTypeCatalog', 'empty', 1000, '{"title": "Project manager", "description": "Plans scope, schedule and budget; leads the team and reports to the customer", "baseUnit": "unit_hour", "roleVATDefaultRate": "vat_21", "propertySet": "ds_pm_prop", "variantSet": "ds_pm_var", "variantMode": "perType", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb),
  ('businessAnalyst', 'resourceRoleTypeCatalog', 'empty', 2000, '{"title": "Business analyst", "description": "Collects and documents requirements; writes specifications and acceptance criteria", "baseUnit": "unit_hour", "roleVATDefaultRate": "vat_21", "propertySet": "ds_ba_prop", "variantSet": "ds_ba_var", "variantMode": "perType", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb),
  ('dataAnalyst', 'resourceRoleTypeCatalog', 'empty', 3000, '{"title": "Data analyst", "description": "Prepares data, builds reports and dashboards, explains results to the business", "baseUnit": "unit_hour", "roleVATDefaultRate": "vat_21", "propertySet": "ds_da_prop", "variantSet": "ds_da_var", "variantMode": "perType", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb),
  ('frontendDeveloper', 'resourceRoleTypeCatalog', 'empty', 4000, '{"title": "Frontend developer", "description": "Builds the user interface (web and mobile screens)", "baseUnit": "unit_hour", "roleVATDefaultRate": "vat_21", "propertySet": "ds_fe_prop", "variantSet": "ds_fe_var", "variantMode": "perType", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb),
  ('backendDeveloper', 'resourceRoleTypeCatalog', 'empty', 5000, '{"title": "Backend developer", "description": "Builds server logic, database and integrations (API)", "baseUnit": "unit_hour", "roleVATDefaultRate": "vat_21", "propertySet": "ds_be_prop", "variantSet": "ds_be_var", "variantMode": "perType", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- resourceRoleFolderTable: 5 rows
INSERT INTO public."resourceRoleFolderTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('fld_role_mgmt', 'resourceRoleFolderCatalog', 'empty', 1000, '{"title": "Management & analysis"}'::jsonb),
  ('fld_role_data', 'resourceRoleFolderCatalog', 'empty', 2000, '{"title": "Data"}'::jsonb),
  ('fld_role_eng', 'resourceRoleFolderCatalog', 'empty', 3000, '{"title": "Engineering"}'::jsonb),
  ('fld_role_fe', 'resourceRoleFolderCatalog', 'fld_role_eng', 4000, '{"title": "Frontend"}'::jsonb),
  ('fld_role_be', 'resourceRoleFolderCatalog', 'fld_role_eng', 5000, '{"title": "Backend"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- resourceRoleTable: 8 rows
INSERT INTO public."resourceRoleTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('role1', 'projectManager', 'fld_role_mgmt', 1000, '{"title": "IT project manager", "description": "Runs software / IT projects end-to-end: scope, plan, budget, risks, customer reporting", "isActive": true}'::jsonb),
  ('role2', 'businessAnalyst', 'fld_role_mgmt', 2000, '{"title": "ERP business analyst", "description": "Maps business processes to ERP (1C, SAP…), writes specifications and test cases", "isActive": true}'::jsonb),
  ('role3', 'dataAnalyst', 'fld_role_data', 3000, '{"title": "BI data analyst (Power BI)", "description": "Builds Power BI models, dashboards and KPI reports", "isActive": true}'::jsonb),
  ('role4', 'dataAnalyst', 'fld_role_data', 4000, '{"title": "SQL data analyst", "description": "Writes SQL queries, prepares data sets and ad-hoc analyses", "isActive": true}'::jsonb),
  ('role5', 'frontendDeveloper', 'fld_role_fe', 5000, '{"title": "React Native developer", "description": "Builds mobile and web screens with React Native / Expo", "isActive": true}'::jsonb),
  ('role6', 'frontendDeveloper', 'fld_role_fe', 6000, '{"title": "React web developer", "description": "Builds web front-ends with React", "isActive": true}'::jsonb),
  ('role7', 'backendDeveloper', 'fld_role_be', 7000, '{"title": "Node.js backend developer", "description": "Builds APIs and integrations on Node.js / PostgreSQL", "isActive": true}'::jsonb),
  ('role8', 'backendDeveloper', 'fld_role_be', 8000, '{"title": "Python backend developer", "description": "Builds services, data pipelines and integrations in Python", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- propertyValueTable: the requirements of the roles (owner = resourceRole)
INSERT INTO public."propertyValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pp7', 'role1', 'dp8', 500000, '{"value": 5}'::jsonb),
  ('pp8', 'role1', 'dp9', 501000, '{"descriptorValueGUID": "dv18"}'::jsonb),
  ('pp9', 'role2', 'dp12', 502000, '{"value": 3}'::jsonb),
  ('pp10', 'role2', 'dp13', 503000, '{"descriptorValueGUID": "dv21"}'::jsonb),
  ('pp11', 'role3', 'dp16', 504000, '{"value": 2}'::jsonb),
  ('pp12', 'role3', 'dp17', 505000, '{"descriptorValueGUID": "dv20"}'::jsonb),
  ('pp13', 'role4', 'dp16', 506000, '{"value": 2}'::jsonb),
  ('pp14', 'role5', 'dp20', 507000, '{"value": 2}'::jsonb),
  ('pp15', 'role6', 'dp20', 508000, '{"value": 2}'::jsonb),
  ('pp16', 'role7', 'dp23', 509000, '{"value": 3}'::jsonb),
  ('pp17', 'role8', 'dp23', 510000, '{"value": 3}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- variantTable: the bookable levels per role type (owner = resourceRoleType, variantMode perType)
INSERT INTO public."variantTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pv7', 'projectManager', 'empty', 500000, '{"title": "Senior, English", "descriptorKey": "dp10=dv13|dp11=dv15", "isActive": true}'::jsonb),
  ('pv8', 'projectManager', 'empty', 501000, '{"title": "Middle, Latvian", "descriptorKey": "dp10=dv12|dp11=dv16", "isActive": true}'::jsonb),
  ('pv9', 'businessAnalyst', 'empty', 502000, '{"title": "Middle, English", "descriptorKey": "dp14=dv12|dp15=dv15", "isActive": true}'::jsonb),
  ('pv10', 'dataAnalyst', 'empty', 503000, '{"title": "Junior, English", "descriptorKey": "dp18=dv11|dp19=dv15", "isActive": true}'::jsonb),
  ('pv11', 'dataAnalyst', 'empty', 504000, '{"title": "Senior, English", "descriptorKey": "dp18=dv13|dp19=dv15", "isActive": true}'::jsonb),
  ('pv12', 'frontendDeveloper', 'empty', 505000, '{"title": "Middle, English", "descriptorKey": "dp21=dv12|dp22=dv15", "isActive": true}'::jsonb),
  ('pv13', 'frontendDeveloper', 'empty', 506000, '{"title": "Senior, English", "descriptorKey": "dp21=dv13|dp22=dv15", "isActive": true}'::jsonb),
  ('pv14', 'backendDeveloper', 'empty', 507000, '{"title": "Senior, English", "descriptorKey": "dp24=dv13|dp25=dv15", "isActive": true}'::jsonb),
  ('pv15', 'backendDeveloper', 'empty', 508000, '{"title": "Senior, Russian", "descriptorKey": "dp24=dv13|dp25=dv17", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- variantValueTable: the descriptor values of each variant
INSERT INTO public."variantValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pvd12', 'pv7', 'dp10', 500000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd13', 'pv7', 'dp11', 501000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd14', 'pv8', 'dp10', 502000, '{"descriptorValueGUID": "dv12"}'::jsonb),
  ('pvd15', 'pv8', 'dp11', 503000, '{"descriptorValueGUID": "dv16"}'::jsonb),
  ('pvd16', 'pv9', 'dp14', 504000, '{"descriptorValueGUID": "dv12"}'::jsonb),
  ('pvd17', 'pv9', 'dp15', 505000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd18', 'pv10', 'dp18', 506000, '{"descriptorValueGUID": "dv11"}'::jsonb),
  ('pvd19', 'pv10', 'dp19', 507000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd20', 'pv11', 'dp18', 508000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd21', 'pv11', 'dp19', 509000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd22', 'pv12', 'dp21', 510000, '{"descriptorValueGUID": "dv12"}'::jsonb),
  ('pvd23', 'pv12', 'dp22', 511000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd24', 'pv13', 'dp21', 512000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd25', 'pv13', 'dp22', 513000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd26', 'pv14', 'dp24', 514000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd27', 'pv14', 'dp25', 515000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd28', 'pv15', 'dp24', 516000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd29', 'pv15', 'dp25', 517000, '{"descriptorValueGUID": "dv17"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- rolePriceTable: 32 rows
INSERT INTO public."rolePriceTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('rp1', 'role1', 'empty', 1000, '{"priceTypeGUID": "pt_bill", "price": 60, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp2', 'role1', 'empty', 2000, '{"priceTypeGUID": "pt_cost", "price": 36, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp3', 'role1', 'pv7', 3000, '{"priceTypeGUID": "pt_bill", "price": 75, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp4', 'role1', 'pv8', 4000, '{"priceTypeGUID": "pt_bill", "price": 55, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp5', 'role2', 'empty', 5000, '{"priceTypeGUID": "pt_bill", "price": 50, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp6', 'role2', 'empty', 6000, '{"priceTypeGUID": "pt_cost", "price": 30, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp7', 'role2', 'pv9', 7000, '{"priceTypeGUID": "pt_bill", "price": 50, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp8', 'role3', 'empty', 8000, '{"priceTypeGUID": "pt_bill", "price": 45, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp9', 'role3', 'empty', 9000, '{"priceTypeGUID": "pt_cost", "price": 27, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp10', 'role3', 'pv10', 10000, '{"priceTypeGUID": "pt_bill", "price": 30, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp11', 'role3', 'pv11', 11000, '{"priceTypeGUID": "pt_bill", "price": 60, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp12', 'role4', 'empty', 12000, '{"priceTypeGUID": "pt_bill", "price": 45, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp13', 'role4', 'empty', 13000, '{"priceTypeGUID": "pt_cost", "price": 27, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp14', 'role4', 'pv10', 14000, '{"priceTypeGUID": "pt_bill", "price": 30, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp15', 'role4', 'pv11', 15000, '{"priceTypeGUID": "pt_bill", "price": 60, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp16', 'role5', 'empty', 16000, '{"priceTypeGUID": "pt_bill", "price": 50, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp17', 'role5', 'empty', 17000, '{"priceTypeGUID": "pt_cost", "price": 30, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp18', 'role5', 'pv12', 18000, '{"priceTypeGUID": "pt_bill", "price": 50, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp19', 'role5', 'pv13', 19000, '{"priceTypeGUID": "pt_bill", "price": 65, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp20', 'role6', 'empty', 20000, '{"priceTypeGUID": "pt_bill", "price": 50, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp21', 'role6', 'empty', 21000, '{"priceTypeGUID": "pt_cost", "price": 30, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp22', 'role6', 'pv12', 22000, '{"priceTypeGUID": "pt_bill", "price": 50, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp23', 'role6', 'pv13', 23000, '{"priceTypeGUID": "pt_bill", "price": 65, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp24', 'role7', 'empty', 24000, '{"priceTypeGUID": "pt_bill", "price": 55, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp25', 'role7', 'empty', 25000, '{"priceTypeGUID": "pt_cost", "price": 33, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp26', 'role7', 'pv14', 26000, '{"priceTypeGUID": "pt_bill", "price": 70, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp27', 'role7', 'pv15', 27000, '{"priceTypeGUID": "pt_bill", "price": 70, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp28', 'role8', 'empty', 28000, '{"priceTypeGUID": "pt_bill", "price": 55, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp29', 'role8', 'empty', 29000, '{"priceTypeGUID": "pt_cost", "price": 33, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp30', 'role8', 'pv14', 30000, '{"priceTypeGUID": "pt_bill", "price": 70, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp31', 'role8', 'pv15', 31000, '{"priceTypeGUID": "pt_bill", "price": 70, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp32', 'role3', 'empty', 32000, '{"priceTypeGUID": "pt_customerA", "price": 42, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;


-- =====================================================================================
-- 5. Realtime: the role tables in the supabase_realtime publication (auto refresh in every browser)
-- =====================================================================================
DO $$
DECLARE
  t text;
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
    RETURN;
  END IF;
  IF v_all THEN
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT 'resourceRoleTable', count(*) FROM public."resourceRoleTable" UNION ALL SELECT 'rolePriceTable', count(*) FROM public."rolePriceTable";
