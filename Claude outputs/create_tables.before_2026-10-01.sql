-- =====================================================================================
-- MASTER TABLE INITIALIZATION SCRIPT (create_tables.sql)
--
-- Single master initialization and migration script aligning with branch pm33 and
-- incorporating all table definitions, migrations, and updates:
--
-- 1. Common triggers & extensions (ltree, uuid-ossp, timestamp helpers)
-- 2. Generic application tables (defTable pattern + update_tables.sql):
--    googleDriveCommandTable, raciMemberTable, userTable, userAuthTable,
--    aiSessionTable, dtcTaskFinishedTable, dtcCatalogExecutiveTable, mediaPostTable,
--    mediaPostTableArchive, dtcTaskRegisteredTable, dtcTaskWaitingTable,
--    dtcTaskProgressTable, dtcFreeExecutiveTable (with created_at / updated_at / indexes / triggers)
-- 3. Core catalog & business tables:
--    countryTable, currencyTable, currencyExchangeRateTable, organizationTable,
--    departamentTable, personTable, partnerTable, contractTable (with seeds)
-- 4. PM Gantt tables (aligning with pm33 create_pm_tables.sql):
--    - project_table (with "treePath" LTREE NOT NULL and constraint)
--    - project_task_table (with "treePath" LTREE NOT NULL)
--    - project_task_dependencies_table (with "rowGUID", "rowDependsOnGUID", "rowJSON")
--    - project_task_dependency_closure_table (with "ancestorGUID", "descendantGUID", "depthLevel")
--    - project_user_settings_table
-- 5. PM Kanban tables (create_pm_kanban_tables.sql):
--    kanban_stage_table, project_kanban_stage_table, project_task_kanban_state_table
-- 6. Project Templates tables & views:
--    templates_project_table (with "treePath"), templates_project_task_table,
--    templates_project_task_dependencies_table, templates_project_task_dependency_closure_table,
--    templates_project_kanban_stage_table, templates_project_user_settings_table
-- 7. Functions, RPCs, Views, Triggers:
--    project_task_schedule_view, templates_project_task_schedule_view,
--    pm_apply_schedule, pm_recalc_project_progress, pm_dependency_creates_cycle,
--    pm_task_upstream, pm_task_downstream, pm_kanban_ensure_project_stages,
--    pm_kanban_stage_after_delete, pm_seed_demo, etc.
-- 8. Migrations (from update_pm_tables_*.sql & update_tables.sql):
--    treePath backfill, taskColor migration, uxuiSettings migration, user settings seeding, progress recalculation
-- 9. Realtime publications & Grants:
--    All tables in supabase_realtime with REPLICA IDENTITY FULL,
--    EXECUTE grants for authenticated AND anon roles, NOTIFY pgrst for schema cache reload
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS ltree;

-- Common timestamp triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;

-- PM ltree label converter
CREATE OR REPLACE FUNCTION public.pm_ltree_label(p_guid uuid) RETURNS ltree
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT text2ltree(replace(lower(p_guid::text), '-', '_'));
$$;
GRANT EXECUTE ON FUNCTION public.pm_ltree_label(uuid) TO authenticated, anon;


-- =====================================================================================
-- SECTION 1: GENERIC APP TABLES (defTable pattern + update_tables.sql)
-- =====================================================================================
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'googleDriveCommandTable',
    'raciMemberTable',
    'userTable',
    'userAuthTable',
    'aiSessionTable',
    'dtcTaskFinishedTable',
    'dtcCatalogExecutiveTable',
    'mediaPostTable',
    'mediaPostTableArchive',
    'dtcTaskRegisteredTable',
    'dtcTaskWaitingTable',
    'dtcTaskProgressTable',
    'dtcFreeExecutiveTable'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I (
        "rowGUID" TEXT NOT NULL,
        "rowOwnerGUID" TEXT NOT NULL,
        "rowParentGUID" TEXT NOT NULL,
        "rowJSON" JSONB NOT NULL DEFAULT ''{}''::jsonb,
        "orderInList" NUMERIC NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("rowGUID")
      )',
      table_name
    );

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', table_name);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING GIN ("rowJSON" jsonb_path_ops)', 'idx_' || table_name || '_rowJSON', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I ("orderInList")', 'idx_' || table_name || '_order', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_at)', table_name || '_created_at_idx', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_at)', table_name || '_updated_at_idx', table_name);

    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', table_name);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all select ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all insert ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all update ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all sql_for_delete ' || table_name, table_name);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', 'Allow all select ' || table_name, table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (true)', 'Allow all insert ' || table_name, table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (true) WITH CHECK (true)', 'Allow all update ' || table_name, table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (true)', 'Allow all sql_for_delete ' || table_name, table_name);

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END IF;
  END LOOP;
END $$;


-- =====================================================================================
-- SECTION 2: CORE BUSINESS & CATALOG TABLES
-- =====================================================================================

-- 2.1 countryTable
CREATE TABLE IF NOT EXISTS public."countryTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'countryCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT "countryTable_code_chk" CHECK (("rowJSON"->>'countryCode') ~ '^[A-Z]{2,3}$')
);
CREATE INDEX IF NOT EXISTS "idx_countryTable_rowJSON" ON public."countryTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_countryTable_order" ON public."countryTable" ("orderInList");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_countryTable_code" ON public."countryTable" (upper("rowJSON"->>'countryCode'));
CREATE INDEX IF NOT EXISTS "idx_countryTable_name" ON public."countryTable" ((lower("rowJSON"->>'countryName')));

DROP TRIGGER IF EXISTS "trg_countryTable_touch" ON public."countryTable";
CREATE TRIGGER "trg_countryTable_touch" BEFORE UPDATE ON public."countryTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."countryTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."countryTable" FROM anon, authenticated;
GRANT SELECT ON public."countryTable" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."countryTable" TO authenticated;

DROP POLICY IF EXISTS "countryTable_select" ON public."countryTable";
DROP POLICY IF EXISTS "countryTable_insert" ON public."countryTable";
DROP POLICY IF EXISTS "countryTable_update" ON public."countryTable";
DROP POLICY IF EXISTS "countryTable_delete" ON public."countryTable";
CREATE POLICY "countryTable_select" ON public."countryTable" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "countryTable_insert" ON public."countryTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "countryTable_update" ON public."countryTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "countryTable_delete" ON public."countryTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."countryTable" REPLICA IDENTITY FULL;

-- Seed default countries
INSERT INTO public."countryTable" ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object(
  'countryName', v.name, 'countryCode', v.code2, 'countryCodeAlpha3', v.code3,
  'countryNumericCode', v.num, 'phonePrefix', v.prefix, 'currencyCode', v.curr,
  'flagEmoji', v.flag, 'isActive', true
)
FROM (VALUES
  (1000,  'Latvia',         'LV', 'LVA', '428', '+371', 'EUR', '🇱🇻'),
  (2000,  'Estonia',        'EE', 'EST', '233', '+372', 'EUR', '🇪🇪'),
  (3000,  'Lithuania',      'LT', 'LTU', '440', '+370', 'EUR', '🇱🇹'),
  (4000,  'United States',  'US', 'USA', '840', '+1',   'USD', '🇺🇸'),
  (5000,  'United Kingdom', 'GB', 'GBR', '826', '+44',  'GBP', '🇬🇧'),
  (6000,  'Germany',        'DE', 'DEU', '276', '+49',  'EUR', '🇩🇪'),
  (7000,  'France',         'FR', 'FRA', '250', '+33',  'EUR', '🇫🇷'),
  (8000,  'Spain',          'ES', 'ESP', '724', '+34',  'EUR', '🇪🇸'),
  (9000,  'Italy',          'IT', 'ITA', '380', '+39',  'EUR', '🇮🇹'),
  (10000, 'Poland',         'PL', 'POL', '616', '+48',  'PLN', '🇵🇱'),
  (11000, 'Sweden',         'SE', 'SWE', '752', '+46',  'SEK', '🇸🇪'),
  (12000, 'Norway',         'NO', 'NOR', '578', '+47',  'NOK', '🇳🇴'),
  (13000, 'Finland',        'FI', 'FIN', '246', '+358', 'EUR', '🇫🇮'),
  (14000, 'Denmark',        'DK', 'DNK', '208', '+45',  'DKK', '🇩🇰'),
  (15000, 'Switzerland',    'CH', 'CHE', '756', '+41',  'CHF', '🇨🇭'),
  (16000, 'Canada',         'CA', 'CAN', '124', '+1',   'CAD', '🇨🇦')
) AS v(ord, name, code2, code3, num, prefix, curr, flag)
WHERE NOT EXISTS (
  SELECT 1 FROM public."countryTable" c
   WHERE upper(c."rowJSON"->>'countryCode') = v.code2
);

-- 2.2 currencyTable
CREATE TABLE IF NOT EXISTS public."currencyTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'currencyCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT "currencyTable_code_chk" CHECK (("rowJSON"->>'currencyCode') ~ '^[A-Z]{3}$')
);
CREATE INDEX IF NOT EXISTS "idx_currencyTable_rowJSON" ON public."currencyTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_currencyTable_order" ON public."currencyTable" ("orderInList");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_currencyTable_code" ON public."currencyTable" (upper("rowJSON"->>'currencyCode'));

DROP TRIGGER IF EXISTS "trg_currencyTable_touch" ON public."currencyTable";
CREATE TRIGGER "trg_currencyTable_touch" BEFORE UPDATE ON public."currencyTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."currencyTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."currencyTable" FROM anon, authenticated;
GRANT SELECT ON public."currencyTable" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."currencyTable" TO authenticated;

DROP POLICY IF EXISTS "currencyTable_select" ON public."currencyTable";
DROP POLICY IF EXISTS "currencyTable_insert" ON public."currencyTable";
DROP POLICY IF EXISTS "currencyTable_update" ON public."currencyTable";
DROP POLICY IF EXISTS "currencyTable_delete" ON public."currencyTable";
CREATE POLICY "currencyTable_select" ON public."currencyTable" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "currencyTable_insert" ON public."currencyTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "currencyTable_update" ON public."currencyTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "currencyTable_delete" ON public."currencyTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."currencyTable" REPLICA IDENTITY FULL;

-- Seed default currencies
INSERT INTO public."currencyTable" ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object('currencyCode', v.code, 'currencyName', v.name, 'currencySymbol', v.sym,
                                 'currencyNumericCode', v.num, 'decimalDigits', v.dec, 'isActive', true)
  FROM (VALUES
    (1024,  'EUR', 'Euro',              '€',   '978', 2),
    (2048,  'USD', 'US Dollar',         '$',   '840', 2),
    (3072,  'GBP', 'Pound Sterling',    '£',   '826', 2),
    (4096,  'CHF', 'Swiss Franc',       'CHF', '756', 2),
    (5120,  'JPY', 'Yen',               '¥',   '392', 0),
    (6144,  'CNY', 'Yuan Renminbi',     '¥',   '156', 2),
    (7168,  'SEK', 'Swedish Krona',     'kr',  '752', 2),
    (8192,  'NOK', 'Norwegian Krone',   'kr',  '578', 2),
    (9216,  'DKK', 'Danish Krone',      'kr',  '208', 2),
    (10240, 'PLN', 'Zloty',             'zł',  '985', 2)
  ) AS v(ord, code, name, sym, num, dec)
 WHERE NOT EXISTS (SELECT 1 FROM public."currencyTable" c WHERE upper(c."rowJSON"->>'currencyCode') = v.code);

-- 2.3 currencyExchangeRateTable
CREATE TABLE IF NOT EXISTS public."currencyExchangeRateTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT "currencyExchangeRateTable_day_chk"
    CHECK ("rowParentGUID" ~ '^\d{4}-\d{2}-\d{2}$' AND ("rowParentGUID")::date IS NOT NULL
           AND "rowJSON"->>'startingDate' = "rowParentGUID"),
  CONSTRAINT "currencyExchangeRateTable_ratio_chk"
    CHECK (jsonb_typeof("rowJSON"->'currencyRatio') = 'number' AND ("rowJSON"->>'currencyRatio')::numeric > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_currencyExchangeRateTable_owner_day"
  ON public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID");
CREATE INDEX IF NOT EXISTS "idx_currencyExchangeRateTable_owner_order"
  ON public."currencyExchangeRateTable" ("rowOwnerGUID", "orderInList");

DROP TRIGGER IF EXISTS "trg_currencyExchangeRateTable_touch" ON public."currencyExchangeRateTable";
CREATE TRIGGER "trg_currencyExchangeRateTable_touch" BEFORE UPDATE ON public."currencyExchangeRateTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."currencyExchangeRateTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."currencyExchangeRateTable" FROM anon, authenticated;
GRANT SELECT ON public."currencyExchangeRateTable" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."currencyExchangeRateTable" TO authenticated;

DROP POLICY IF EXISTS "currencyExchangeRateTable_select" ON public."currencyExchangeRateTable";
DROP POLICY IF EXISTS "currencyExchangeRateTable_insert" ON public."currencyExchangeRateTable";
DROP POLICY IF EXISTS "currencyExchangeRateTable_update" ON public."currencyExchangeRateTable";
DROP POLICY IF EXISTS "currencyExchangeRateTable_delete" ON public."currencyExchangeRateTable";
CREATE POLICY "currencyExchangeRateTable_select" ON public."currencyExchangeRateTable" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "currencyExchangeRateTable_insert" ON public."currencyExchangeRateTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "currencyExchangeRateTable_update" ON public."currencyExchangeRateTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "currencyExchangeRateTable_delete" ON public."currencyExchangeRateTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."currencyExchangeRateTable" REPLICA IDENTITY FULL;

-- 2.4 organizationTable
CREATE TABLE IF NOT EXISTS public."organizationTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'organizationCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_organizationTable_rowJSON" ON public."organizationTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_organizationTable_order" ON public."organizationTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_organizationTable_title" ON public."organizationTable" ((lower("rowJSON"->>'organizationTitle')));
CREATE INDEX IF NOT EXISTS "idx_organizationTable_createdByUser" ON public."organizationTable" (("rowJSON"->>'createdByUser'));

DROP TRIGGER IF EXISTS "trg_organizationTable_touch" ON public."organizationTable";
CREATE TRIGGER "trg_organizationTable_touch" BEFORE UPDATE ON public."organizationTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."organizationTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."organizationTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."organizationTable" TO authenticated;

DROP POLICY IF EXISTS "organizationTable_select" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_insert" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_update" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_delete" ON public."organizationTable";
CREATE POLICY "organizationTable_select" ON public."organizationTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizationTable_insert" ON public."organizationTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "organizationTable_update" ON public."organizationTable" FOR UPDATE TO authenticated
  USING (("rowJSON"->>'createdByUser') = (auth.jwt()->>'email') OR (auth.jwt()->>'email') IS NULL)
  WITH CHECK (("rowJSON"->>'createdByUser') = (auth.jwt()->>'email') OR (auth.jwt()->>'email') IS NULL);
CREATE POLICY "organizationTable_delete" ON public."organizationTable" FOR DELETE TO authenticated
  USING (("rowJSON"->>'createdByUser') = (auth.jwt()->>'email') OR (auth.jwt()->>'email') IS NULL);
ALTER TABLE public."organizationTable" REPLICA IDENTITY FULL;

-- 2.5 departamentTable
CREATE TABLE IF NOT EXISTS public."departamentTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_departamentTable_rowOwner" ON public."departamentTable" ("rowOwnerGUID");
CREATE INDEX IF NOT EXISTS "idx_departamentTable_rowParent" ON public."departamentTable" ("rowParentGUID");
CREATE INDEX IF NOT EXISTS "idx_departamentTable_order" ON public."departamentTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_departamentTable_rowJSON" ON public."departamentTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_departamentTable_name" ON public."departamentTable" ((lower("rowJSON"->>'departmentName')));

DROP TRIGGER IF EXISTS "trg_departamentTable_touch" ON public."departamentTable";
CREATE TRIGGER "trg_departamentTable_touch" BEFORE UPDATE ON public."departamentTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."departamentTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."departamentTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."departamentTable" TO authenticated;

DROP POLICY IF EXISTS "departamentTable_select" ON public."departamentTable";
DROP POLICY IF EXISTS "departamentTable_insert" ON public."departamentTable";
DROP POLICY IF EXISTS "departamentTable_update" ON public."departamentTable";
DROP POLICY IF EXISTS "departamentTable_delete" ON public."departamentTable";
CREATE POLICY "departamentTable_select" ON public."departamentTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "departamentTable_insert" ON public."departamentTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "departamentTable_update" ON public."departamentTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "departamentTable_delete" ON public."departamentTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."departamentTable" REPLICA IDENTITY FULL;

-- 2.6 personTable
CREATE TABLE IF NOT EXISTS public."personTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'personCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_personTable_rowJSON" ON public."personTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_personTable_order" ON public."personTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_personTable_title" ON public."personTable" ((lower("rowJSON"->>'personTitle')));

DROP TRIGGER IF EXISTS "trg_personTable_touch" ON public."personTable";
CREATE TRIGGER "trg_personTable_touch" BEFORE UPDATE ON public."personTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."personTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."personTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."personTable" TO authenticated;

DROP POLICY IF EXISTS "personTable_select" ON public."personTable";
DROP POLICY IF EXISTS "personTable_insert" ON public."personTable";
DROP POLICY IF EXISTS "personTable_update" ON public."personTable";
DROP POLICY IF EXISTS "personTable_delete" ON public."personTable";
CREATE POLICY "personTable_select" ON public."personTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "personTable_insert" ON public."personTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "personTable_update" ON public."personTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "personTable_delete" ON public."personTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."personTable" REPLICA IDENTITY FULL;

-- Seed demo persons
INSERT INTO public."personTable" ("rowGUID", "orderInList", "rowJSON")
VALUES
  ('11111111-1111-4111-a111-111111111111', 1024, '{
    "personFirstName": "John",
    "personLastName": "Doe",
    "personTitle": "John Doe",
    "personEmail": "john.doe@example.com",
    "personPhone": "+1 555 0100",
    "isActive": true,
    "personIsEmployee": true,
    "employeeData": {
      "employeeNumber": "EMP-001",
      "position": "Lead Software Engineer",
      "department": "Engineering",
      "personalCode": "010190-12345",
      "bankIban": "LV80HABA0551000000001"
    }
  }'::jsonb),
  ('22222222-2222-4222-a222-222222222222', 2048, '{
    "personFirstName": "Jane",
    "personLastName": "Smith",
    "personTitle": "Jane Smith",
    "personEmail": "jane.smith@example.com",
    "personPhone": "+1 555 0200",
    "isActive": true,
    "personIsEmployee": true,
    "employeeData": {
      "employeeNumber": "EMP-002",
      "position": "Product Manager",
      "department": "Product",
      "personalCode": "020292-23456",
      "bankIban": "LV80HABA0551000000002"
    }
  }'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- 2.7 partnerTable
CREATE TABLE IF NOT EXISTS public."partnerTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'partnerCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_partnerTable_rowJSON" ON public."partnerTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_partnerTable_order" ON public."partnerTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_partnerTable_title" ON public."partnerTable" ((lower("rowJSON"->>'partnerTitle')));
CREATE UNIQUE INDEX IF NOT EXISTS "idx_partnerTable_vat" ON public."partnerTable" (upper("rowJSON"->'legalData'->>'vatNo'))
  WHERE ("rowJSON"->'legalData'->>'vatNo') IS NOT NULL AND ("rowJSON"->'legalData'->>'vatNo') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "idx_partnerTable_reg" ON public."partnerTable" (("rowJSON"->'legalData'->>'registrationNo'))
  WHERE ("rowJSON"->'legalData'->>'registrationNo') IS NOT NULL AND ("rowJSON"->'legalData'->>'registrationNo') <> '';

DROP TRIGGER IF EXISTS "trg_partnerTable_touch" ON public."partnerTable";
CREATE TRIGGER "trg_partnerTable_touch" BEFORE UPDATE ON public."partnerTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."partnerTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."partnerTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."partnerTable" TO authenticated;

DROP POLICY IF EXISTS "partnerTable_select" ON public."partnerTable";
DROP POLICY IF EXISTS "partnerTable_insert" ON public."partnerTable";
DROP POLICY IF EXISTS "partnerTable_update" ON public."partnerTable";
DROP POLICY IF EXISTS "partnerTable_delete" ON public."partnerTable";
CREATE POLICY "partnerTable_select" ON public."partnerTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "partnerTable_insert" ON public."partnerTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "partnerTable_update" ON public."partnerTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "partnerTable_delete" ON public."partnerTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."partnerTable" REPLICA IDENTITY FULL;

-- Seed demo partner
INSERT INTO public."partnerTable" ("rowGUID", "orderInList", "rowJSON")
VALUES
  ('33333333-3333-4333-a333-333333333333', 1024, '{
    "partnerTitle": "Baltic Timber Supply",
    "partnerLegalName": "Baltic Timber Supply SIA",
    "partnerKind": "company",
    "isActive": true,
    "partnerIsSupplier": true,
    "partnerIsCustomer": false,
    "legalData": {
      "registrationNo": "40003001234",
      "vatNo": "LV40003001234",
      "legalAddress": "Eksporta iela 10, Riga, LV-1010",
      "country": "LV",
      "bankIban": "LV80HABA0551000000003"
    },
    "supplierData": {
      "paymentTermsDays": 14,
      "defaultCurrency": "EUR",
      "notes": "Raw wood supply partner"
    },
    "customerData": null
  }'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- 2.8 contractTable
CREATE TABLE IF NOT EXISTS public."contractTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT "contractTable_party_chk"
    CHECK ("rowParentGUID" IN ('person', 'partner') AND "rowJSON"->>'contractPartyType' = "rowParentGUID"),
  CONSTRAINT "contractTable_sum_chk"
    CHECK (jsonb_typeof("rowJSON"->'contractSumBeforeVAT') = 'number' AND ("rowJSON"->>'contractSumBeforeVAT')::numeric >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_contractTable_owner_order" ON public."contractTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_contractTable_rowJSON" ON public."contractTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_contractTable_number" ON public."contractTable" ((lower("rowJSON"->>'contractNumber')));

DROP TRIGGER IF EXISTS "trg_contractTable_touch" ON public."contractTable";
CREATE TRIGGER "trg_contractTable_touch" BEFORE UPDATE ON public."contractTable" FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

ALTER TABLE public."contractTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."contractTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contractTable" TO authenticated;

DROP POLICY IF EXISTS "contractTable_select" ON public."contractTable";
DROP POLICY IF EXISTS "contractTable_insert" ON public."contractTable";
DROP POLICY IF EXISTS "contractTable_update" ON public."contractTable";
DROP POLICY IF EXISTS "contractTable_delete" ON public."contractTable";
CREATE POLICY "contractTable_select" ON public."contractTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "contractTable_insert" ON public."contractTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contractTable_update" ON public."contractTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contractTable_delete" ON public."contractTable" FOR DELETE TO authenticated USING (true);
ALTER TABLE public."contractTable" REPLICA IDENTITY FULL;

-- Seed demo contracts
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES
  ('55555555-5555-4555-a555-555555555555', '11111111-1111-4111-a111-111111111111', 'person', -20500, '{
    "contractPartyType": "person",
    "contractNumber": "EMP-2026-001",
    "contractTitle": "Employment Agreement - Lead Engineer",
    "contractType": "Employment",
    "contractStatus": "active",
    "contractSignedDate": "2026-01-15",
    "contractStartDate": "2026-02-01",
    "contractFinishDate": null,
    "contractPaymentsPeriod": "Month",
    "contractCurrency": "EUR",
    "contractSumBeforeVAT": 5500,
    "contractVATRate": 0,
    "contractVAT": 0,
    "contractTotal": 5500,
    "notes": "Full time employment agreement"
  }'::jsonb),
  ('66666666-6666-4666-a666-666666666666', '33333333-3333-4333-a333-333333333333', 'partner', -20480, '{
    "contractPartyType": "partner",
    "contractNumber": "SUP-2026-042",
    "contractTitle": "Timber Supply Master Agreement",
    "contractType": "Supply",
    "contractStatus": "active",
    "contractSignedDate": "2026-01-20",
    "contractStartDate": "2026-02-01",
    "contractFinishDate": "2026-12-31",
    "contractPaymentsPeriod": "14 days",
    "contractCurrency": "EUR",
    "contractSumBeforeVAT": 120000,
    "contractVATRate": 21,
    "contractVAT": 25200,
    "contractTotal": 145200,
    "notes": "Annual raw timber framework supply"
  }'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;


-- =====================================================================================
-- SECTION 3: PM GANTT TABLES (pm33 create_pm_tables.sql pattern)
-- =====================================================================================

-- 3.1 project_table (with treePath LTREE NOT NULL and constraint)
CREATE TABLE IF NOT EXISTS public.project_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- project finish (end of duration)
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_table_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"))
);

-- In case project_table was created without treePath previously:
ALTER TABLE public.project_table ADD COLUMN IF NOT EXISTS "treePath" LTREE;
UPDATE public.project_table SET "treePath" = public.pm_ltree_label("rowGUID") WHERE "treePath" IS NULL;
ALTER TABLE public.project_table ALTER COLUMN "treePath" SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_table_path_chk') THEN
    ALTER TABLE public.project_table ADD CONSTRAINT project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_table_owner_order ON public.project_table ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_project_table_treePath ON public.project_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_project_table_rowJSON ON public.project_table USING GIN ("rowJSON" jsonb_path_ops);

-- Automatically set treePath on project_table if omitted on INSERT
CREATE OR REPLACE FUNCTION public.pm_project_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" IS NULL THEN
    NEW."rowGUID" := gen_random_uuid();
  END IF;
  IF NEW."treePath" IS NULL THEN
    NEW."treePath" := public.pm_ltree_label(NEW."rowGUID");
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_before_write ON public.project_table;
CREATE TRIGGER trg_project_before_write
  BEFORE INSERT OR UPDATE OF "rowGUID", "treePath" ON public.project_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_project_before_write();

DROP TRIGGER IF EXISTS trg_project_touch ON public.project_table;
CREATE TRIGGER trg_project_touch BEFORE UPDATE ON public.project_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.project_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_table TO authenticated;

DROP POLICY IF EXISTS project_table_select ON public.project_table;
DROP POLICY IF EXISTS project_table_insert ON public.project_table;
DROP POLICY IF EXISTS project_table_update ON public.project_table;
DROP POLICY IF EXISTS project_table_delete ON public.project_table;
CREATE POLICY project_table_select ON public.project_table FOR SELECT TO authenticated USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_insert ON public.project_table FOR INSERT TO authenticated WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_update ON public.project_table FOR UPDATE TO authenticated USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_delete ON public.project_table FOR DELETE TO authenticated USING ("rowOwnerGUID" = auth.uid());

CREATE OR REPLACE FUNCTION public.pm_owns_project(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_table p WHERE p."rowGUID" = p_project AND p."rowOwnerGUID" = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.pm_owns_project(uuid) TO authenticated, anon;

-- 3.2 project_task_table (stages and tasks, ltree tree)
CREATE TABLE IF NOT EXISTS public.project_task_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "projectGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_task_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT project_task_path_depth_chk CHECK (nlevel("treePath") >= 2),
  CONSTRAINT project_task_path_root_chk CHECK (subpath("treePath", 0, 1) = public.pm_ltree_label("projectGUID")),
  CONSTRAINT project_task_path_self_chk CHECK (subpath("treePath", nlevel("treePath") - 1, 1) = public.pm_ltree_label("rowGUID")),
  CONSTRAINT project_task_path_unique UNIQUE ("treePath")
);
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "treePath" LTREE;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "projectGUID" UUID;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "rowOwnerGUID" UUID;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "rowDuration" TIMESTAMPTZ;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "rowProgress" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "orderInList" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.project_task_table ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_project_task_project_order ON public.project_task_table ("projectGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_project_task_owner ON public.project_task_table ("rowOwnerGUID");
CREATE INDEX IF NOT EXISTS idx_project_task_treePath ON public.project_task_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_project_task_rowJSON ON public.project_task_table USING GIN ("rowJSON" jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_project_task_touch ON public.project_task_table;
CREATE TRIGGER trg_project_task_touch BEFORE UPDATE ON public.project_task_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.project_task_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_table TO authenticated;

DROP POLICY IF EXISTS project_task_select ON public.project_task_table;
DROP POLICY IF EXISTS project_task_insert ON public.project_task_table;
DROP POLICY IF EXISTS project_task_update ON public.project_task_table;
DROP POLICY IF EXISTS project_task_delete ON public.project_task_table;
CREATE POLICY project_task_select ON public.project_task_table FOR SELECT TO authenticated USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_insert ON public.project_task_table FOR INSERT TO authenticated WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_update ON public.project_task_table FOR UPDATE TO authenticated USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_delete ON public.project_task_table FOR DELETE TO authenticated USING ("rowOwnerGUID" = auth.uid());

-- 3.3 project_task_dependencies_table (rowGUID waits for rowDependsOnGUID, matching pm33 schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'project_task_dependencies_table'
  ) THEN
    -- If rowDependsOnGUID is missing, attempt rename or drop legacy table with wrong schema
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'project_task_dependencies_table' AND column_name = 'rowDependsOnGUID'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'project_task_dependencies_table' AND column_name = 'dependsOnGUID'
      ) THEN
        ALTER TABLE public.project_task_dependencies_table RENAME COLUMN "dependsOnGUID" TO "rowDependsOnGUID";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'project_task_dependencies_table' AND column_name = 'successorGUID'
      ) THEN
        ALTER TABLE public.project_task_dependencies_table RENAME COLUMN "successorGUID" TO "rowDependsOnGUID";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'project_task_dependencies_table' AND column_name = 'predecessorGUID'
      ) THEN
        ALTER TABLE public.project_task_dependencies_table RENAME COLUMN "predecessorGUID" TO "rowDependsOnGUID";
      ELSE
        -- The existing table has an incompatible schema (e.g. legacy defTable). Drop it to recreate cleanly.
        DROP TABLE public.project_task_dependencies_table CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_task_dependencies_table (
  "rowGUID"          UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "rowDependsOnGUID" UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"      UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"     UUID        NOT NULL,
  "linkType"         TEXT        NOT NULL DEFAULT 'FS',
  "lagDays"          NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID", "rowDependsOnGUID"),
  CONSTRAINT project_task_dep_self_chk CHECK ("rowGUID" <> "rowDependsOnGUID"),
  CONSTRAINT project_task_dep_type_chk CHECK ("linkType" IN ('FS', 'SS', 'FF', 'SF'))
);
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowDependsOnGUID" UUID;
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "projectGUID" UUID;
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowOwnerGUID" UUID;
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "linkType" TEXT NOT NULL DEFAULT 'FS';
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "lagDays" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill projectGUID & rowOwnerGUID from project_task_table if missing
UPDATE public.project_task_dependencies_table d
   SET "projectGUID" = t."projectGUID",
       "rowOwnerGUID" = t."rowOwnerGUID"
  FROM public.project_task_table t
 WHERE d."rowGUID" = t."rowGUID"
   AND (d."projectGUID" IS NULL OR d."rowOwnerGUID" IS NULL);

CREATE INDEX IF NOT EXISTS idx_task_deps_dependsOn ON public.project_task_dependencies_table ("rowDependsOnGUID");
CREATE INDEX IF NOT EXISTS idx_task_deps_project ON public.project_task_dependencies_table ("projectGUID");
CREATE INDEX IF NOT EXISTS idx_task_deps_rowJSON ON public.project_task_dependencies_table USING GIN ("rowJSON" jsonb_path_ops);

ALTER TABLE public.project_task_dependencies_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.project_task_dependencies_table TO authenticated;
GRANT UPDATE ("linkType", "lagDays", "rowJSON") ON public.project_task_dependencies_table TO authenticated;

DROP POLICY IF EXISTS project_task_dep_select ON public.project_task_dependencies_table;
DROP POLICY IF EXISTS project_task_dep_insert ON public.project_task_dependencies_table;
DROP POLICY IF EXISTS project_task_dep_update ON public.project_task_dependencies_table;
DROP POLICY IF EXISTS project_task_dep_delete ON public.project_task_dependencies_table;
CREATE POLICY project_task_dep_select ON public.project_task_dependencies_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid() OR public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_dep_insert ON public.project_task_dependencies_table FOR INSERT TO authenticated
  WITH CHECK (("rowOwnerGUID" = auth.uid() OR "rowOwnerGUID" IS NULL) AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_dep_update ON public.project_task_dependencies_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid() OR public.pm_owns_project("projectGUID"))
  WITH CHECK ("rowOwnerGUID" = auth.uid() OR public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_dep_delete ON public.project_task_dependencies_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid() OR public.pm_owns_project("projectGUID"));

-- 3.4 project_task_dependency_closure_table (ancestorGUID, descendantGUID, depthLevel, rowJSON)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'project_task_dependency_closure_table'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'project_task_dependency_closure_table' AND column_name = 'ancestorGUID'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'project_task_dependency_closure_table' AND column_name = 'descendantGUID'
    ) THEN
      DROP TABLE public.project_task_dependency_closure_table CASCADE;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_task_dependency_closure_table (
  "ancestorGUID"   UUID  NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "descendantGUID" UUID  NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"    UUID  NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "depthLevel"     INT   NOT NULL,
  "rowJSON"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY ("ancestorGUID", "descendantGUID"),
  CONSTRAINT project_task_dep_closure_self_chk CHECK ("ancestorGUID" <> "descendantGUID")
);
ALTER TABLE public.project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "ancestorGUID" UUID;
ALTER TABLE public.project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "descendantGUID" UUID;
ALTER TABLE public.project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "projectGUID" UUID;
ALTER TABLE public.project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "depthLevel" INT;
ALTER TABLE public.project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_task_dep_closure_descendant ON public.project_task_dependency_closure_table ("descendantGUID");
CREATE INDEX IF NOT EXISTS idx_task_dep_closure_project ON public.project_task_dependency_closure_table ("projectGUID");

ALTER TABLE public.project_task_dependency_closure_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.project_task_dependency_closure_table TO authenticated;

DROP POLICY IF EXISTS project_task_dep_closure_select ON public.project_task_dependency_closure_table;
CREATE POLICY project_task_dep_closure_select ON public.project_task_dependency_closure_table FOR SELECT TO authenticated
  USING (public.pm_owns_project("projectGUID"));

-- 3.5 project_user_settings_table (per-user visualisation settings, update_pm_tables_userSettings.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_user_settings_table') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_user_settings_table' AND column_name = 'rowOwnerGUID')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_user_settings_table' AND column_name = 'rowParentGUID') THEN
      DROP TABLE public.project_user_settings_table CASCADE;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_user_settings_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" UUID        NOT NULL,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_user_settings_unique UNIQUE ("rowOwnerGUID", "rowParentGUID")
);
CREATE INDEX IF NOT EXISTS idx_project_user_settings_user ON public.project_user_settings_table ("rowParentGUID");

DROP TRIGGER IF EXISTS trg_project_user_settings_touch ON public.project_user_settings_table;
CREATE TRIGGER trg_project_user_settings_touch BEFORE UPDATE ON public.project_user_settings_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.project_user_settings_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_user_settings_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_user_settings_table TO authenticated;

DROP POLICY IF EXISTS project_user_settings_select ON public.project_user_settings_table;
DROP POLICY IF EXISTS project_user_settings_insert ON public.project_user_settings_table;
DROP POLICY IF EXISTS project_user_settings_update ON public.project_user_settings_table;
DROP POLICY IF EXISTS project_user_settings_delete ON public.project_user_settings_table;
CREATE POLICY project_user_settings_select ON public.project_user_settings_table FOR SELECT TO authenticated USING ("rowParentGUID" = auth.uid());
CREATE POLICY project_user_settings_insert ON public.project_user_settings_table FOR INSERT TO authenticated WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_project("rowOwnerGUID"));
CREATE POLICY project_user_settings_update ON public.project_user_settings_table FOR UPDATE TO authenticated USING ("rowParentGUID" = auth.uid()) WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_project("rowOwnerGUID"));
CREATE POLICY project_user_settings_delete ON public.project_user_settings_table FOR DELETE TO authenticated USING ("rowParentGUID" = auth.uid());


-- =====================================================================================
-- SECTION 4: PM KANBAN TABLES (create_pm_kanban_tables.sql)
-- =====================================================================================

-- 4.1 kanban_stage_table
CREATE TABLE IF NOT EXISTS public.kanban_stage_table (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'kanbanStageCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_kanban_stage_owner ON public.kanban_stage_table ("rowOwnerGUID", "orderInList");
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_stage_code ON public.kanban_stage_table ("rowOwnerGUID", lower("rowJSON"->>'stageCode'));

DROP TRIGGER IF EXISTS trg_kanban_stage_touch ON public.kanban_stage_table;
CREATE TRIGGER trg_kanban_stage_touch BEFORE UPDATE ON public.kanban_stage_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.kanban_stage_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kanban_stage_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_stage_table TO authenticated;

DROP POLICY IF EXISTS kanban_stage_select ON public.kanban_stage_table;
DROP POLICY IF EXISTS kanban_stage_insert ON public.kanban_stage_table;
DROP POLICY IF EXISTS kanban_stage_update ON public.kanban_stage_table;
DROP POLICY IF EXISTS kanban_stage_delete ON public.kanban_stage_table;
CREATE POLICY kanban_stage_select ON public.kanban_stage_table FOR SELECT TO authenticated USING (true);
CREATE POLICY kanban_stage_insert ON public.kanban_stage_table FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY kanban_stage_update ON public.kanban_stage_table FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY kanban_stage_delete ON public.kanban_stage_table FOR DELETE TO authenticated USING (true);

-- Seed default kanban stages
INSERT INTO public.kanban_stage_table ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object('stageCode', v.code, 'stageName', v.name, 'stageColor', v.color, 'isActive', true)
  FROM (VALUES
    (1024, 'waiting',   'Waiting',   '#94A3B8'),
    (2048, 'plan',      'Plan',      '#6366F1'),
    (3072, 'analyse',   'Analyse',   '#0EA5E9'),
    (4096, 'construct', 'Construct', '#F59E0B'),
    (5120, 'execute',   'Execute',   '#22C55E')
  ) AS v(ord, code, name, color)
 WHERE NOT EXISTS (SELECT 1 FROM public.kanban_stage_table k
                    WHERE k."rowOwnerGUID" = 'kanbanStageCatalog' AND lower(k."rowJSON"->>'stageCode') = v.code);

-- 4.2 project_kanban_stage_table
CREATE TABLE IF NOT EXISTS public.project_kanban_stage_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_project_kanban_stage_project ON public.project_kanban_stage_table ("rowOwnerGUID", "orderInList");

DROP TRIGGER IF EXISTS trg_project_kanban_stage_touch ON public.project_kanban_stage_table;
CREATE TRIGGER trg_project_kanban_stage_touch BEFORE UPDATE ON public.project_kanban_stage_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- 4.3 project_task_kanban_state_table
CREATE TABLE IF NOT EXISTS public.project_task_kanban_state_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_task_kanban_state_unique UNIQUE ("rowOwnerGUID", "rowParentGUID")
);
CREATE INDEX IF NOT EXISTS idx_project_task_kanban_state_task ON public.project_task_kanban_state_table ("rowParentGUID");

DROP TRIGGER IF EXISTS trg_project_task_kanban_state_touch ON public.project_task_kanban_state_table;
CREATE TRIGGER trg_project_task_kanban_state_touch BEFORE UPDATE ON public.project_task_kanban_state_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

CREATE OR REPLACE FUNCTION public.pm_kanban_stage_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.project_task_kanban_state_table s
   WHERE s."rowOwnerGUID" = OLD."rowOwnerGUID" AND s."rowJSON"->>'stageGUID' = OLD."rowGUID"::text;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_kanban_stage_after_delete ON public.project_kanban_stage_table;
CREATE TRIGGER trg_project_kanban_stage_after_delete AFTER DELETE ON public.project_kanban_stage_table FOR EACH ROW EXECUTE FUNCTION public.pm_kanban_stage_after_delete();

CREATE OR REPLACE FUNCTION public.pm_kanban_ensure_project_stages(p_project uuid)
RETURNS SETOF public.project_kanban_stage_table
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.pm_owns_project(p_project) THEN
    RAISE EXCEPTION 'pm_gantt: project not found';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('pm_kanban_stages:' || p_project::text));
  IF NOT EXISTS (SELECT 1 FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = p_project) THEN
    INSERT INTO public.project_kanban_stage_table ("rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    SELECT p_project, k."rowGUID", k."orderInList",
           jsonb_build_object('stageCode', k."rowJSON"->>'stageCode', 'stageName', k."rowJSON"->>'stageName',
                              'stageColor', k."rowJSON"->>'stageColor')
      FROM public.kanban_stage_table k
     WHERE k."rowOwnerGUID" = 'kanbanStageCatalog' AND coalesce((k."rowJSON"->>'isActive')::boolean, true)
     ORDER BY k."orderInList";
  END IF;
  RETURN QUERY SELECT * FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = p_project ORDER BY "orderInList";
END;
$$;
REVOKE ALL ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) TO authenticated, anon;

ALTER TABLE public.project_kanban_stage_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_kanban_state_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_kanban_stage_table, public.project_task_kanban_state_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_kanban_stage_table, public.project_task_kanban_state_table TO authenticated;

DROP POLICY IF EXISTS project_kanban_stage_all ON public.project_kanban_stage_table;
CREATE POLICY project_kanban_stage_all ON public.project_kanban_stage_table FOR ALL TO authenticated
  USING (public.pm_owns_project("rowOwnerGUID")) WITH CHECK (public.pm_owns_project("rowOwnerGUID"));

DROP POLICY IF EXISTS project_task_kanban_state_all ON public.project_task_kanban_state_table;
CREATE POLICY project_task_kanban_state_all ON public.project_task_kanban_state_table FOR ALL TO authenticated
  USING (public.pm_owns_project("rowOwnerGUID"))
  WITH CHECK (
    public.pm_owns_project("rowOwnerGUID")
    AND EXISTS (SELECT 1 FROM public.project_task_table t
                 WHERE t."rowGUID" = project_task_kanban_state_table."rowParentGUID"
                   AND t."projectGUID" = project_task_kanban_state_table."rowOwnerGUID")
  );


-- =====================================================================================
-- SECTION 5: PROJECT TEMPLATES TABLES & FUNCTIONS
-- =====================================================================================

-- 5.1 templates_project_table (with treePath LTREE NOT NULL and constraint)
CREATE TABLE IF NOT EXISTS public.templates_project_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT templates_project_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT templates_project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"))
);

ALTER TABLE public.templates_project_table ADD COLUMN IF NOT EXISTS "treePath" LTREE;
UPDATE public.templates_project_table SET "treePath" = public.pm_ltree_label("rowGUID") WHERE "treePath" IS NULL;
ALTER TABLE public.templates_project_table ALTER COLUMN "treePath" SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_project_table_path_chk') THEN
    ALTER TABLE public.templates_project_table ADD CONSTRAINT templates_project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_templates_project_owner_order ON public.templates_project_table ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_templates_project_treePath ON public.templates_project_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_templates_project_rowJSON ON public.templates_project_table USING GIN ("rowJSON" jsonb_path_ops);

CREATE OR REPLACE FUNCTION public.pm_template_project_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" IS NULL THEN
    NEW."rowGUID" := gen_random_uuid();
  END IF;
  IF NEW."treePath" IS NULL THEN
    NEW."treePath" := public.pm_ltree_label(NEW."rowGUID");
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_templates_project_before_write ON public.templates_project_table;
CREATE TRIGGER trg_templates_project_before_write
  BEFORE INSERT OR UPDATE OF "rowGUID", "treePath" ON public.templates_project_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_project_before_write();

DROP TRIGGER IF EXISTS trg_templates_project_touch ON public.templates_project_table;
CREATE TRIGGER trg_templates_project_touch BEFORE UPDATE ON public.templates_project_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.templates_project_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_table TO authenticated;

DROP POLICY IF EXISTS templates_project_select ON public.templates_project_table;
DROP POLICY IF EXISTS templates_project_insert ON public.templates_project_table;
DROP POLICY IF EXISTS templates_project_update ON public.templates_project_table;
DROP POLICY IF EXISTS templates_project_delete ON public.templates_project_table;
CREATE POLICY templates_project_select ON public.templates_project_table FOR SELECT TO authenticated USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_insert ON public.templates_project_table FOR INSERT TO authenticated WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_update ON public.templates_project_table FOR UPDATE TO authenticated USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_delete ON public.templates_project_table FOR DELETE TO authenticated USING ("rowOwnerGUID" = auth.uid());

CREATE OR REPLACE FUNCTION public.pm_template_owns_project(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.templates_project_table p
     WHERE p."rowGUID" = p_project AND p."rowOwnerGUID" = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.pm_template_owns_project(uuid) TO authenticated, anon;

-- 5.2 templates_project_task_table
CREATE TABLE IF NOT EXISTS public.templates_project_task_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "projectGUID"  UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT templates_project_task_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT templates_project_task_path_depth_chk CHECK (nlevel("treePath") >= 2),
  CONSTRAINT templates_project_task_path_root_chk CHECK (subpath("treePath", 0, 1) = public.pm_ltree_label("projectGUID")),
  CONSTRAINT templates_project_task_path_self_chk CHECK (subpath("treePath", nlevel("treePath") - 1, 1) = public.pm_ltree_label("rowGUID")),
  CONSTRAINT templates_project_task_path_unique UNIQUE ("treePath")
);
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "treePath" LTREE;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "projectGUID" UUID;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "rowOwnerGUID" UUID;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "rowDuration" TIMESTAMPTZ;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "rowProgress" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "orderInList" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.templates_project_task_table ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_templates_task_project_order ON public.templates_project_task_table ("projectGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_templates_task_owner ON public.templates_project_task_table ("rowOwnerGUID");
CREATE INDEX IF NOT EXISTS idx_templates_task_treePath ON public.templates_project_task_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_templates_task_rowJSON ON public.templates_project_task_table USING GIN ("rowJSON" jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_templates_project_task_touch ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_project_task_touch BEFORE UPDATE ON public.templates_project_task_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.templates_project_task_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_task_table TO authenticated;

DROP POLICY IF EXISTS templates_project_task_select ON public.templates_project_task_table;
DROP POLICY IF EXISTS templates_project_task_insert ON public.templates_project_task_table;
DROP POLICY IF EXISTS templates_project_task_update ON public.templates_project_task_table;
DROP POLICY IF EXISTS templates_project_task_delete ON public.templates_project_task_table;
CREATE POLICY templates_project_task_select ON public.templates_project_task_table FOR SELECT TO authenticated USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_task_insert ON public.templates_project_task_table FOR INSERT TO authenticated WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_template_owns_project("projectGUID"));
CREATE POLICY templates_project_task_update ON public.templates_project_task_table FOR UPDATE TO authenticated USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_template_owns_project("projectGUID"));
CREATE POLICY templates_project_task_delete ON public.templates_project_task_table FOR DELETE TO authenticated USING ("rowOwnerGUID" = auth.uid());

-- 5.3 templates_project_task_dependencies_table (rowGUID waits for rowDependsOnGUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'templates_project_task_dependencies_table'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'templates_project_task_dependencies_table' AND column_name = 'rowDependsOnGUID'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'templates_project_task_dependencies_table' AND column_name = 'dependsOnGUID'
      ) THEN
        ALTER TABLE public.templates_project_task_dependencies_table RENAME COLUMN "dependsOnGUID" TO "rowDependsOnGUID";
      ELSE
        DROP TABLE public.templates_project_task_dependencies_table CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.templates_project_task_dependencies_table (
  "rowGUID"          UUID        NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "rowDependsOnGUID" UUID        NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"      UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"     UUID        NOT NULL,
  "linkType"         TEXT        NOT NULL DEFAULT 'FS',
  "lagDays"          NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID", "rowDependsOnGUID"),
  CONSTRAINT templates_dep_not_self CHECK ("rowGUID" <> "rowDependsOnGUID"),
  CONSTRAINT templates_dep_link_type_chk CHECK ("linkType" IN ('FS', 'SS', 'FF', 'SF'))
);
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowDependsOnGUID" UUID;
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "projectGUID" UUID;
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowOwnerGUID" UUID;
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "linkType" TEXT NOT NULL DEFAULT 'FS';
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "lagDays" NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_templates_deps_dependsOn ON public.templates_project_task_dependencies_table ("rowDependsOnGUID");
CREATE INDEX IF NOT EXISTS idx_templates_deps_proj ON public.templates_project_task_dependencies_table ("projectGUID");
CREATE INDEX IF NOT EXISTS idx_templates_deps_rowJSON ON public.templates_project_task_dependencies_table USING GIN ("rowJSON" jsonb_path_ops);

ALTER TABLE public.templates_project_task_dependencies_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.templates_project_task_dependencies_table TO authenticated;
GRANT UPDATE ("linkType", "lagDays", "rowJSON") ON public.templates_project_task_dependencies_table TO authenticated;

DROP POLICY IF EXISTS templates_deps_select ON public.templates_project_task_dependencies_table;
DROP POLICY IF EXISTS templates_deps_insert ON public.templates_project_task_dependencies_table;
DROP POLICY IF EXISTS templates_deps_update ON public.templates_project_task_dependencies_table;
DROP POLICY IF EXISTS templates_deps_delete ON public.templates_project_task_dependencies_table;
CREATE POLICY templates_deps_select ON public.templates_project_task_dependencies_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid() OR public.pm_template_owns_project("projectGUID"));
CREATE POLICY templates_deps_insert ON public.templates_project_task_dependencies_table FOR INSERT TO authenticated
  WITH CHECK (("rowOwnerGUID" = auth.uid() OR "rowOwnerGUID" IS NULL) AND public.pm_template_owns_project("projectGUID"));
CREATE POLICY templates_deps_update ON public.templates_project_task_dependencies_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid() OR public.pm_template_owns_project("projectGUID"))
  WITH CHECK ("rowOwnerGUID" = auth.uid() OR public.pm_template_owns_project("projectGUID"));
CREATE POLICY templates_deps_delete ON public.templates_project_task_dependencies_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid() OR public.pm_template_owns_project("projectGUID"));

-- 5.4 templates_project_task_dependency_closure_table (ancestorGUID, descendantGUID, depthLevel, rowJSON)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'templates_project_task_dependency_closure_table'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'templates_project_task_dependency_closure_table' AND column_name = 'ancestorGUID'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'templates_project_task_dependency_closure_table' AND column_name = 'descendantGUID'
    ) THEN
      DROP TABLE public.templates_project_task_dependency_closure_table CASCADE;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.templates_project_task_dependency_closure_table (
  "ancestorGUID"   UUID  NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "descendantGUID" UUID  NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"    UUID  NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "depthLevel"     INT   NOT NULL,
  "rowJSON"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY ("ancestorGUID", "descendantGUID"),
  CONSTRAINT templates_dep_closure_self_chk CHECK ("ancestorGUID" <> "descendantGUID")
);
ALTER TABLE public.templates_project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "ancestorGUID" UUID;
ALTER TABLE public.templates_project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "descendantGUID" UUID;
ALTER TABLE public.templates_project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "projectGUID" UUID;
ALTER TABLE public.templates_project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "depthLevel" INT;
ALTER TABLE public.templates_project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_templates_closure_descendant ON public.templates_project_task_dependency_closure_table ("descendantGUID");
CREATE INDEX IF NOT EXISTS idx_templates_closure_proj ON public.templates_project_task_dependency_closure_table ("projectGUID");

ALTER TABLE public.templates_project_task_dependency_closure_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.templates_project_task_dependency_closure_table TO authenticated;

DROP POLICY IF EXISTS templates_closure_select ON public.templates_project_task_dependency_closure_table;
CREATE POLICY templates_closure_select ON public.templates_project_task_dependency_closure_table FOR SELECT TO authenticated
  USING (public.pm_template_owns_project("projectGUID"));

-- 5.5 templates_project_kanban_stage_table
CREATE TABLE IF NOT EXISTS public.templates_project_kanban_stage_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS idx_templates_kanban_stage_project ON public.templates_project_kanban_stage_table ("rowOwnerGUID", "orderInList");

DROP TRIGGER IF EXISTS trg_templates_kanban_stage_touch ON public.templates_project_kanban_stage_table;
CREATE TRIGGER trg_templates_kanban_stage_touch BEFORE UPDATE ON public.templates_project_kanban_stage_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.templates_project_kanban_stage_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_kanban_stage_table TO authenticated;

DROP POLICY IF EXISTS templates_kanban_stage_all ON public.templates_project_kanban_stage_table;
CREATE POLICY templates_kanban_stage_all ON public.templates_project_kanban_stage_table FOR ALL TO authenticated
  USING (public.pm_template_owns_project("rowOwnerGUID")) WITH CHECK (public.pm_template_owns_project("rowOwnerGUID"));

-- 5.6 templates_project_user_settings_table
CREATE TABLE IF NOT EXISTS public.templates_project_user_settings_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" UUID        NOT NULL,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT templates_user_settings_unique UNIQUE ("rowOwnerGUID", "rowParentGUID")
);
CREATE INDEX IF NOT EXISTS idx_templates_user_settings_user ON public.templates_project_user_settings_table ("rowParentGUID");

DROP TRIGGER IF EXISTS trg_templates_user_settings_touch ON public.templates_project_user_settings_table;
CREATE TRIGGER trg_templates_user_settings_touch BEFORE UPDATE ON public.templates_project_user_settings_table FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.templates_project_user_settings_table ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_user_settings_table TO authenticated;

DROP POLICY IF EXISTS templates_user_settings_select ON public.templates_project_user_settings_table;
DROP POLICY IF EXISTS templates_user_settings_insert ON public.templates_project_user_settings_table;
DROP POLICY IF EXISTS templates_user_settings_update ON public.templates_project_user_settings_table;
DROP POLICY IF EXISTS templates_user_settings_delete ON public.templates_project_user_settings_table;
CREATE POLICY templates_user_settings_select ON public.templates_project_user_settings_table FOR SELECT TO authenticated USING ("rowParentGUID" = auth.uid());
CREATE POLICY templates_user_settings_insert ON public.templates_project_user_settings_table FOR INSERT TO authenticated WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_template_owns_project("rowOwnerGUID"));
CREATE POLICY templates_user_settings_update ON public.templates_project_user_settings_table FOR UPDATE TO authenticated USING ("rowParentGUID" = auth.uid()) WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_template_owns_project("rowOwnerGUID"));
CREATE POLICY templates_user_settings_delete ON public.templates_project_user_settings_table FOR DELETE TO authenticated USING ("rowParentGUID" = auth.uid());


-- =====================================================================================
-- SECTION 6: STORED FUNCTIONS, TRIGGERS, RPCS & VIEWS
-- =====================================================================================

-- 6.1 Schedule Views (with security_invoker = true, matching pm33)
CREATE OR REPLACE VIEW public.project_task_schedule_view
WITH (security_invoker = true) AS
SELECT t."rowGUID",
       t."projectGUID",
       t."treePath",
       nlevel(t."treePath") - 1                        AS "treeDepth",
       t."rowJSON"->>'name'                            AS "name",
       t."rowJSON"->>'rowKind'                         AS "rowKind",
       (t."rowJSON"->>'startAt')::timestamptz          AS "startAt",
       t."rowDuration"                                 AS "finishAt",
       t."rowDuration" - (t."rowJSON"->>'startAt')::timestamptz AS "duration",
       t."rowProgress",
       t."orderInList"
  FROM public.project_task_table t;

CREATE OR REPLACE VIEW public.templates_project_task_schedule_view
WITH (security_invoker = true) AS
SELECT t."rowGUID",
       t."projectGUID",
       t."treePath",
       nlevel(t."treePath") - 1                        AS "treeDepth",
       t."rowJSON"->>'name'                            AS "name",
       t."rowJSON"->>'rowKind'                         AS "rowKind",
       (t."rowJSON"->>'startAt')::timestamptz          AS "startAt",
       t."rowDuration"                                 AS "finishAt",
       t."rowDuration" - (t."rowJSON"->>'startAt')::timestamptz AS "duration",
       t."rowProgress",
       t."orderInList"
  FROM public.templates_project_task_table t;

-- 6.2 PM Task & DAG triggers / functions (matching pm33 create_pm_tables.sql)
CREATE OR REPLACE FUNCTION public.pm_task_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_parent ltree;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."projectGUID" <> OLD."projectGUID" THEN
      RAISE EXCEPTION 'pm_gantt: a row cannot be moved to another project' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."treePath" = OLD."treePath" THEN
      RETURN NEW;
    END IF;
    IF NEW."treePath" <@ OLD."treePath" THEN
      RAISE EXCEPTION 'pm_gantt: a row cannot be moved inside its own subtree' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF nlevel(NEW."treePath") > 2 AND pg_trigger_depth() = 1 THEN
    v_parent := subpath(NEW."treePath", 0, nlevel(NEW."treePath") - 1);
    IF NOT EXISTS (
      SELECT 1 FROM public.project_task_table p
      WHERE p."treePath" = v_parent AND p."projectGUID" = NEW."projectGUID"
    ) THEN
      RAISE EXCEPTION 'pm_gantt: parent % does not exist in project %', v_parent, NEW."projectGUID"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_before_write ON public.project_task_table;
CREATE TRIGGER trg_project_task_before_write
  BEFORE INSERT OR UPDATE OF "treePath", "projectGUID" ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_before_write();

CREATE OR REPLACE FUNCTION public.pm_task_after_move() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND NEW."treePath" IS DISTINCT FROM OLD."treePath" THEN
    UPDATE public.project_task_table
       SET "treePath" = NEW."treePath" || subpath("treePath", nlevel(OLD."treePath"))
     WHERE "projectGUID" = NEW."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> NEW."rowGUID";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_after_move ON public.project_task_table;
CREATE TRIGGER trg_project_task_after_move
  AFTER UPDATE OF "treePath" ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_move();

CREATE OR REPLACE FUNCTION public.pm_task_after_delete_subtree() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    DELETE FROM public.project_task_table
     WHERE "projectGUID" = OLD."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> OLD."rowGUID";
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_after_delete_subtree ON public.project_task_table;
CREATE TRIGGER trg_project_task_after_delete_subtree
  AFTER DELETE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_delete_subtree();

-- Tree-aware cycle detection (from pm33 create_pm_tables.sql)
CREATE OR REPLACE FUNCTION public.pm_dependency_creates_cycle(p_pred uuid, p_succ uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  pred AS (SELECT "treePath" AS path, "projectGUID" AS project FROM public.project_task_table WHERE "rowGUID" = p_pred),
  reach(guid) AS (
    SELECT p_succ
    UNION
    SELECT e."rowGUID"
      FROM reach r
      JOIN public.project_task_table rt ON rt."rowGUID" = r.guid
      JOIN public.project_task_table rel
        ON rel."projectGUID" = rt."projectGUID"
       AND (rel."treePath" @> rt."treePath" OR rel."treePath" <@ rt."treePath")
      JOIN public.project_task_dependencies_table e ON e."rowDependsOnGUID" = rel."rowGUID"
  )
  SELECT p_pred = p_succ
      OR EXISTS (
        SELECT 1 FROM reach r
          JOIN public.project_task_table rt ON rt."rowGUID" = r.guid
          CROSS JOIN pred
         WHERE rt."treePath" @> pred.path OR rt."treePath" <@ pred.path
      );
$$;

CREATE OR REPLACE FUNCTION public.pm_task_dependency_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_succ public.project_task_table%ROWTYPE;
  v_pred public.project_task_table%ROWTYPE;
BEGIN
  SELECT * INTO v_succ FROM public.project_task_table WHERE "rowGUID" = NEW."rowGUID";
  SELECT * INTO v_pred FROM public.project_task_table WHERE "rowGUID" = NEW."rowDependsOnGUID";
  IF v_succ."rowGUID" IS NULL OR v_pred."rowGUID" IS NULL THEN
    RAISE EXCEPTION 'pm_gantt: dependency references a missing task' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_succ."projectGUID" <> v_pred."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependencies must stay inside one project' USING ERRCODE = 'check_violation';
  END IF;
  NEW."projectGUID" := v_succ."projectGUID";
  IF NEW."rowOwnerGUID" IS NULL THEN
    NEW."rowOwnerGUID" := v_succ."rowOwnerGUID";
  END IF;

  IF v_succ."treePath" @> v_pred."treePath" OR v_succ."treePath" <@ v_pred."treePath" THEN
    RAISE EXCEPTION 'pm_gantt: a row cannot depend on its own stage or sub-rows' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."projectGUID"::text, 0));

  IF public.pm_dependency_creates_cycle(NEW."rowDependsOnGUID", NEW."rowGUID") THEN
    RAISE EXCEPTION 'pm_gantt: dependency % -> % would create a cycle', NEW."rowDependsOnGUID", NEW."rowGUID"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_task_dependency_before_insert ON public.project_task_dependencies_table;
CREATE TRIGGER trg_pm_task_dependency_before_insert
  BEFORE INSERT ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_before_insert();

CREATE OR REPLACE FUNCTION public.pm_task_dependency_before_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" <> OLD."rowGUID" OR NEW."rowDependsOnGUID" <> OLD."rowDependsOnGUID"
     OR NEW."projectGUID" <> OLD."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependency endpoints are immutable (sql_for_delete + insert instead)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_task_dependency_before_update ON public.project_task_dependencies_table;
CREATE TRIGGER trg_pm_task_dependency_before_update
  BEFORE UPDATE ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_before_update();

CREATE OR REPLACE FUNCTION public.pm_task_dependency_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  SELECT a.anc, d.dsc, NEW."projectGUID", a.depth + d.depth + 1, '{}'::jsonb
    FROM (
      SELECT NEW."rowDependsOnGUID" AS anc, 0 AS depth
      UNION ALL
      SELECT c."ancestorGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
       WHERE c."descendantGUID" = NEW."rowDependsOnGUID"
    ) a
   CROSS JOIN (
      SELECT NEW."rowGUID" AS dsc, 0 AS depth
      UNION ALL
      SELECT c."descendantGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
       WHERE c."ancestorGUID" = NEW."rowGUID"
    ) d
   WHERE a.anc <> d.dsc
  ON CONFLICT ("ancestorGUID", "descendantGUID") DO UPDATE
    SET "depthLevel" = LEAST(public.project_task_dependency_closure_table."depthLevel", EXCLUDED."depthLevel");
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_task_dependency_after_insert ON public.project_task_dependencies_table;
CREATE TRIGGER trg_pm_task_dependency_after_insert
  AFTER INSERT ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_after_insert();

CREATE OR REPLACE FUNCTION public.pm_rebuild_dependency_closure(p_project uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.project_task_dependency_closure_table WHERE "projectGUID" = p_project;
  INSERT INTO public.project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  WITH RECURSIVE walk(anc, dsc, depth) AS (
    SELECT e."rowDependsOnGUID", e."rowGUID", 1
      FROM public.project_task_dependencies_table e WHERE e."projectGUID" = p_project
    UNION
    SELECT w.anc, e."rowGUID", w.depth + 1
      FROM walk w
      JOIN public.project_task_dependencies_table e
        ON e."rowDependsOnGUID" = w.dsc AND e."projectGUID" = p_project
     WHERE w.depth < 10000
  )
  SELECT anc, dsc, p_project, MIN(depth), '{}'::jsonb FROM walk WHERE anc <> dsc GROUP BY anc, dsc;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_task_dependency_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_table WHERE "rowGUID" = OLD."projectGUID") THEN
    PERFORM public.pm_rebuild_dependency_closure(OLD."projectGUID");
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_task_dependency_after_delete ON public.project_task_dependencies_table;
CREATE TRIGGER trg_pm_task_dependency_after_delete
  AFTER DELETE ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_after_delete();

-- 6.3 Scheduler write-back & Progress calculation (CRITICAL RPC)
CREATE OR REPLACE FUNCTION public.pm_apply_schedule(
  p_project_guid uuid,
  p_rows jsonb,
  p_project_finish timestamptz DEFAULT NULL,
  p_project_progress numeric DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.project_task_table t
     SET "rowJSON"     = jsonb_set(t."rowJSON", '{startAt}', to_jsonb(r."startAt")),
         "rowDuration" = r."finishAt",
         "rowProgress" = COALESCE(r."rowProgress", t."rowProgress")
    FROM jsonb_to_recordset(p_rows) AS r("rowGUID" uuid, "startAt" timestamptz, "finishAt" timestamptz, "rowProgress" numeric)
   WHERE t."rowGUID" = r."rowGUID" AND t."projectGUID" = p_project_guid;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF p_project_finish IS NOT NULL OR p_project_progress IS NOT NULL THEN
    UPDATE public.project_table
       SET "rowDuration" = COALESCE(p_project_finish, "rowDuration"),
           "rowProgress" = COALESCE(p_project_progress, "rowProgress")
     WHERE "rowGUID" = p_project_guid;
  END IF;
  PERFORM public.pm_recalc_project_progress(p_project_guid);
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_recalc_project_progress(p_project uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_progress numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.pm_owns_project(p_project) THEN
    RAISE EXCEPTION 'pm_gantt: project % is not yours', p_project USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH rows AS (
    SELECT "rowGUID", "treePath", "rowProgress", "rowJSON"
      FROM public.project_task_table WHERE "projectGUID" = p_project
  ), leaves AS (
    SELECT r."rowGUID", r."treePath",
           GREATEST(CASE WHEN r."rowJSON"->>'durationDays' ~ '^-?[0-9]+(\.[0-9]+)?$'
                         THEN (r."rowJSON"->>'durationDays')::numeric ELSE 0 END, 1) AS w,
           LEAST(GREATEST(COALESCE(r."rowProgress", 0), 0), 100) AS p
      FROM rows r
     WHERE COALESCE(r."rowJSON"->>'rowKind', 'task') <> 'stage'
       AND NOT EXISTS (SELECT 1 FROM rows c WHERE c."treePath" <@ r."treePath" AND c."rowGUID" <> r."rowGUID")
  ), summaries AS (
    SELECT s."rowGUID", ROUND(SUM(l.w * l.p) / SUM(l.w), 1) AS prog
      FROM rows s
      JOIN leaves l ON l."treePath" <@ s."treePath" AND l."rowGUID" <> s."rowGUID"
     GROUP BY s."rowGUID"
  )
  UPDATE public.project_task_table t
     SET "rowProgress" = s.prog
    FROM summaries s
   WHERE t."rowGUID" = s."rowGUID" AND t."rowProgress" IS DISTINCT FROM s.prog;

  WITH rows AS (
    SELECT "rowGUID", "treePath", "rowProgress", "rowJSON"
      FROM public.project_task_table WHERE "projectGUID" = p_project
  ), leaves AS (
    SELECT GREATEST(CASE WHEN r."rowJSON"->>'durationDays' ~ '^-?[0-9]+(\.[0-9]+)?$'
                         THEN (r."rowJSON"->>'durationDays')::numeric ELSE 0 END, 1) AS w,
           LEAST(GREATEST(COALESCE(r."rowProgress", 0), 0), 100) AS p
      FROM rows r
     WHERE COALESCE(r."rowJSON"->>'rowKind', 'task') <> 'stage'
       AND NOT EXISTS (SELECT 1 FROM rows c WHERE c."treePath" <@ r."treePath" AND c."rowGUID" <> r."rowGUID")
  )
  SELECT COALESCE(ROUND(SUM(w * p) / NULLIF(SUM(w), 0), 1), 0) INTO v_progress FROM leaves;

  UPDATE public.project_table
     SET "rowProgress" = v_progress
   WHERE "rowGUID" = p_project AND "rowProgress" IS DISTINCT FROM v_progress;
  RETURN v_progress;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_task_after_progress_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project uuid := COALESCE(NEW."projectGUID", OLD."projectGUID");
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_table WHERE "rowGUID" = v_project) THEN
    RETURN NULL;
  END IF;
  PERFORM public.pm_recalc_project_progress(v_project);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_zz_progress_ins_del ON public.project_task_table;
DROP TRIGGER IF EXISTS trg_project_task_zz_progress_upd ON public.project_task_table;
CREATE TRIGGER trg_project_task_zz_progress_ins_del
  AFTER INSERT OR DELETE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_progress_change();
CREATE TRIGGER trg_project_task_zz_progress_upd
  AFTER UPDATE OF "rowProgress", "rowJSON", "treePath" ON public.project_task_table
  FOR EACH ROW
  WHEN (OLD."rowProgress" IS DISTINCT FROM NEW."rowProgress"
        OR (OLD."rowJSON"->>'durationDays') IS DISTINCT FROM (NEW."rowJSON"->>'durationDays')
        OR (OLD."rowJSON"->>'rowKind') IS DISTINCT FROM (NEW."rowJSON"->>'rowKind')
        OR OLD."treePath" IS DISTINCT FROM NEW."treePath")
  EXECUTE FUNCTION public.pm_task_after_progress_change();

CREATE OR REPLACE FUNCTION public.pm_task_upstream(p_task uuid)
RETURNS TABLE ("rowGUID" uuid, "depthLevel" int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c."ancestorGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
   WHERE c."descendantGUID" = p_task ORDER BY c."depthLevel";
$$;

CREATE OR REPLACE FUNCTION public.pm_task_downstream(p_task uuid)
RETURNS TABLE ("rowGUID" uuid, "depthLevel" int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c."descendantGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
   WHERE c."ancestorGUID" = p_task ORDER BY c."depthLevel";
$$;

-- 6.4 Template task & DAG triggers / functions
CREATE OR REPLACE FUNCTION public.pm_template_task_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_parent ltree;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."projectGUID" <> OLD."projectGUID" THEN
      RAISE EXCEPTION 'pm_template: a row cannot be moved to another template' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."treePath" = OLD."treePath" THEN
      RETURN NEW;
    END IF;
    IF NEW."treePath" <@ OLD."treePath" THEN
      RAISE EXCEPTION 'pm_template: a row cannot be moved inside its own subtree' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF nlevel(NEW."treePath") > 2 AND pg_trigger_depth() = 1 THEN
    v_parent := subpath(NEW."treePath", 0, nlevel(NEW."treePath") - 1);
    IF NOT EXISTS (
      SELECT 1 FROM public.templates_project_task_table p
      WHERE p."treePath" = v_parent AND p."projectGUID" = NEW."projectGUID"
    ) THEN
      RAISE EXCEPTION 'pm_template: parent % does not exist in template %', v_parent, NEW."projectGUID"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_before_write ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_task_before_write
  BEFORE INSERT OR UPDATE OF "treePath", "projectGUID" ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_before_write();

CREATE OR REPLACE FUNCTION public.pm_template_task_after_move() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND NEW."treePath" IS DISTINCT FROM OLD."treePath" THEN
    UPDATE public.templates_project_task_table
       SET "treePath" = NEW."treePath" || subpath("treePath", nlevel(OLD."treePath"))
     WHERE "projectGUID" = NEW."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> NEW."rowGUID";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_after_move ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_task_after_move
  AFTER UPDATE OF "treePath" ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_after_move();

CREATE OR REPLACE FUNCTION public.pm_template_task_after_delete_subtree() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    DELETE FROM public.templates_project_task_table
     WHERE "projectGUID" = OLD."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> OLD."rowGUID";
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_after_delete_subtree ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_task_after_delete_subtree
  AFTER DELETE ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_after_delete_subtree();

CREATE OR REPLACE FUNCTION public.pm_template_dependency_creates_cycle(p_pred uuid, p_succ uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  pred AS (SELECT "treePath" AS path, "projectGUID" AS project FROM public.templates_project_task_table WHERE "rowGUID" = p_pred),
  reach(guid) AS (
    SELECT p_succ
    UNION
    SELECT e."rowGUID"
      FROM reach r
      JOIN public.templates_project_task_table rt ON rt."rowGUID" = r.guid
      JOIN public.templates_project_task_table rel
        ON rel."projectGUID" = rt."projectGUID"
       AND (rel."treePath" @> rt."treePath" OR rel."treePath" <@ rt."treePath")
      JOIN public.templates_project_task_dependencies_table e ON e."rowDependsOnGUID" = rel."rowGUID"
  )
  SELECT p_pred = p_succ
      OR EXISTS (
        SELECT 1 FROM reach r
          JOIN public.templates_project_task_table rt ON rt."rowGUID" = r.guid
          CROSS JOIN pred
         WHERE rt."treePath" @> pred.path OR rt."treePath" <@ pred.path
      );
$$;

CREATE OR REPLACE FUNCTION public.pm_template_task_dependency_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_succ public.templates_project_task_table%ROWTYPE;
  v_pred public.templates_project_task_table%ROWTYPE;
BEGIN
  SELECT * INTO v_succ FROM public.templates_project_task_table WHERE "rowGUID" = NEW."rowGUID";
  SELECT * INTO v_pred FROM public.templates_project_task_table WHERE "rowGUID" = NEW."rowDependsOnGUID";
  IF v_succ."rowGUID" IS NULL OR v_pred."rowGUID" IS NULL THEN
    RAISE EXCEPTION 'pm_template: dependency references a missing task' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_succ."projectGUID" <> v_pred."projectGUID" THEN
    RAISE EXCEPTION 'pm_template: dependencies must stay inside one template' USING ERRCODE = 'check_violation';
  END IF;
  NEW."projectGUID" := v_succ."projectGUID";
  IF NEW."rowOwnerGUID" IS NULL THEN
    NEW."rowOwnerGUID" := v_succ."rowOwnerGUID";
  END IF;

  IF v_succ."treePath" @> v_pred."treePath" OR v_succ."treePath" <@ v_pred."treePath" THEN
    RAISE EXCEPTION 'pm_template: a row cannot depend on its own stage or sub-rows' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."projectGUID"::text, 0));

  IF public.pm_template_dependency_creates_cycle(NEW."rowDependsOnGUID", NEW."rowGUID") THEN
    RAISE EXCEPTION 'pm_template: dependency % -> % would create a cycle', NEW."rowDependsOnGUID", NEW."rowGUID"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_dependency_before_insert ON public.templates_project_task_dependencies_table;
CREATE TRIGGER trg_templates_task_dependency_before_insert
  BEFORE INSERT ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_before_insert();

CREATE OR REPLACE FUNCTION public.pm_template_task_dependency_before_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" <> OLD."rowGUID" OR NEW."rowDependsOnGUID" <> OLD."rowDependsOnGUID"
     OR NEW."projectGUID" <> OLD."projectGUID" THEN
    RAISE EXCEPTION 'pm_template: dependency endpoints are immutable (sql_for_delete + insert instead)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_dependency_before_update ON public.templates_project_task_dependencies_table;
CREATE TRIGGER trg_templates_task_dependency_before_update
  BEFORE UPDATE ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_before_update();

CREATE OR REPLACE FUNCTION public.pm_template_task_dependency_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.templates_project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  SELECT a.anc, d.dsc, NEW."projectGUID", a.depth + d.depth + 1, '{}'::jsonb
    FROM (
      SELECT NEW."rowDependsOnGUID" AS anc, 0 AS depth
      UNION ALL
      SELECT c."ancestorGUID", c."depthLevel" FROM public.templates_project_task_dependency_closure_table c
       WHERE c."descendantGUID" = NEW."rowDependsOnGUID"
    ) a
   CROSS JOIN (
      SELECT NEW."rowGUID" AS dsc, 0 AS depth
      UNION ALL
      SELECT c."descendantGUID", c."depthLevel" FROM public.templates_project_task_dependency_closure_table c
       WHERE c."ancestorGUID" = NEW."rowGUID"
    ) d
   WHERE a.anc <> d.dsc
  ON CONFLICT ("ancestorGUID", "descendantGUID") DO UPDATE
    SET "depthLevel" = LEAST(public.templates_project_task_dependency_closure_table."depthLevel", EXCLUDED."depthLevel");
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_dependency_after_insert ON public.templates_project_task_dependencies_table;
CREATE TRIGGER trg_templates_task_dependency_after_insert
  AFTER INSERT ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_after_insert();

CREATE OR REPLACE FUNCTION public.pm_template_rebuild_dependency_closure(p_project uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.templates_project_task_dependency_closure_table WHERE "projectGUID" = p_project;
  INSERT INTO public.templates_project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  WITH RECURSIVE walk(anc, dsc, depth) AS (
    SELECT e."rowDependsOnGUID", e."rowGUID", 1
      FROM public.templates_project_task_dependencies_table e WHERE e."projectGUID" = p_project
    UNION
    SELECT w.anc, e."rowGUID", w.depth + 1
      FROM walk w
      JOIN public.templates_project_task_dependencies_table e
        ON e."rowDependsOnGUID" = w.dsc AND e."projectGUID" = p_project
     WHERE w.depth < 10000
  )
  SELECT anc, dsc, p_project, MIN(depth), '{}'::jsonb FROM walk WHERE anc <> dsc GROUP BY anc, dsc;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_template_task_dependency_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.templates_project_table WHERE "rowGUID" = OLD."projectGUID") THEN
    PERFORM public.pm_template_rebuild_dependency_closure(OLD."projectGUID");
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_task_dependency_after_delete ON public.templates_project_task_dependencies_table;
CREATE TRIGGER trg_templates_task_dependency_after_delete
  AFTER DELETE ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_after_delete();

-- 6.5 Demo Seeding function (pm33 TRD use case)
CREATE OR REPLACE FUNCTION public.pm_seed_demo(p_owner uuid DEFAULT auth.uid(), p_start date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_project jsonb;
  v_stage jsonb;
  v_task jsonb;
  v_p uuid; v_s uuid; v_t uuid;
  v_p_order numeric := 0;
  v_s_order numeric;
  v_t_order numeric;
  v_after int;
  v_ids uuid[];
  v_start timestamptz := p_start::timestamptz;
  v_demo jsonb := '[
    {"name":"Project 1","stages":[
      {"name":"Stage 11","tasks":[{"name":"Task 111","days":6},{"name":"Task 112","days":7},{"name":"Task 113","days":3,"after":[1,2]}]},
      {"name":"Stage 12","tasks":[{"name":"Task 121","days":6},{"name":"Task 122","days":7},{"name":"Task 123","days":3,"after":[1,2]}]}]},
    {"name":"Project 2","stages":[
      {"name":"Stage 21","tasks":[{"name":"Task 211","days":6},{"name":"Task 212","days":7},{"name":"Task 213","days":3,"after":[1,2]}]},
      {"name":"Stage 22","tasks":[{"name":"Task 221","days":6},{"name":"Task 222","days":7},{"name":"Task 223","days":3,"after":[1,2]}]}]}
  ]'::jsonb;
BEGIN
  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'pm_seed_demo: pass an owner uuid or call it as a signed-in user';
  END IF;
  FOR v_project IN SELECT * FROM jsonb_array_elements(v_demo) LOOP
    v_p := gen_random_uuid();
    v_p_order := v_p_order + 1024;
    INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "orderInList", "rowJSON")
    VALUES (v_p, public.pm_ltree_label(v_p), p_owner, v_p_order,
            jsonb_build_object('rowKind', 'project', 'name', v_project->>'name', 'durationDays', 0,
                               'projectStartAt', v_start, 'skipWeekends', false));
    v_s_order := 0;
    FOR v_stage IN SELECT * FROM jsonb_array_elements(v_project->'stages') LOOP
      v_s := gen_random_uuid();
      v_s_order := v_s_order + 1024;
      INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
      VALUES (v_s, public.pm_ltree_label(v_p) || public.pm_ltree_label(v_s), v_p, p_owner, v_s_order,
              jsonb_build_object('rowKind', 'stage', 'name', v_stage->>'name', 'durationDays', 0));
      v_t_order := 0;
      v_ids := ARRAY[]::uuid[];
      FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks') LOOP
        v_t := gen_random_uuid();
        v_t_order := v_t_order + 1024;
        v_ids := v_ids || v_t;
        INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "orderInList", "rowJSON")
        VALUES (v_t, public.pm_ltree_label(v_p) || public.pm_ltree_label(v_s) || public.pm_ltree_label(v_t), v_p, p_owner, v_t_order,
                jsonb_build_object('rowKind', 'task', 'name', v_task->>'name', 'durationDays', (v_task->>'days')::int));
        FOR v_after IN SELECT jsonb_array_elements_text(COALESCE(v_task->'after', '[]'::jsonb))::int LOOP
          INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID", "linkType", "lagDays", "rowJSON")
          VALUES (v_t, v_ids[v_after], v_p, p_owner, 'FS', 0, '{}'::jsonb);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;


-- =====================================================================================
-- SECTION 7: DATA MIGRATIONS (from update_pm_tables_*.sql & update_tables.sql)
-- =====================================================================================

-- 7.1 Migrate task colors from rowJSON.color to rowJSON.taskColor (update_pm_tables_rowJSON.sql)
UPDATE public.project_task_table
   SET "rowJSON" = ("rowJSON" - 'color') || jsonb_build_object('taskColor', "rowJSON"->'color')
 WHERE "rowJSON" ? 'color' AND NOT ("rowJSON" ? 'taskColor');

-- 7.2 Move old top-level view keys into rowJSON.uxuiSettings (update_pm_tables_projectProgress.sql)
UPDATE public.project_table
   SET "rowJSON" = ("rowJSON" - 'showCriticalPath' - 'ganttArrowsForm' - 'showTaskProgressOnGantt')
       || jsonb_build_object('uxuiSettings',
            COALESCE("rowJSON"->'uxuiSettings', '{}'::jsonb)
            || jsonb_strip_nulls(jsonb_build_object(
                 'showCriticalPath', "rowJSON"->'showCriticalPath',
                 'ganttArrowsForm', "rowJSON"->'ganttArrowsForm',
                 'showTaskProgressOnGantt', "rowJSON"->'showTaskProgressOnGantt')))
 WHERE "rowJSON" ?| ARRAY['showCriticalPath', 'ganttArrowsForm', 'showTaskProgressOnGantt'];

-- 7.3 Copy per-project settings to project_user_settings_table (update_pm_tables_userSettings.sql)
INSERT INTO public.project_user_settings_table ("rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT p."rowGUID", p."rowOwnerGUID", jsonb_build_object('uxuiSettings', p."rowJSON"->'uxuiSettings')
  FROM public.project_table p
 WHERE jsonb_typeof(p."rowJSON"->'uxuiSettings') = 'object'
ON CONFLICT ("rowOwnerGUID", "rowParentGUID") DO NOTHING;

-- 7.4 Recalculate progress for existing projects
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT "rowGUID" FROM public.project_table LOOP
    PERFORM public.pm_recalc_project_progress(p."rowGUID");
  END LOOP;
END $$;


-- =====================================================================================
-- SECTION 8: REALTIME PUBLICATIONS, PERMISSIONS & GRANTS
-- =====================================================================================

-- 8.1 Realtime Publication (update_pm_tables_realtime.sql & all tables)
DO $$
DECLARE
  t TEXT;
  tables_to_publish TEXT[] := ARRAY[
    'project_table',
    'project_task_table',
    'project_task_dependencies_table',
    'project_user_settings_table',
    'kanban_stage_table',
    'project_kanban_stage_table',
    'project_task_kanban_state_table',
    'countryTable',
    'currencyTable',
    'currencyExchangeRateTable',
    'organizationTable',
    'departamentTable',
    'personTable',
    'partnerTable',
    'contractTable',
    'templates_project_table',
    'templates_project_task_table',
    'templates_project_task_dependencies_table',
    'templates_project_kanban_stage_table',
    'templates_project_user_settings_table'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_publish
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY tables_to_publish
    LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
         AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- 8.2 Function Grants
REVOKE ALL ON FUNCTION public.pm_rebuild_dependency_closure(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pm_template_rebuild_dependency_closure(uuid) FROM PUBLIC, anon, authenticated;

-- Grant execute to authenticated AND anon (ensures functions are visible in schema cache and accessible)
GRANT EXECUTE ON FUNCTION public.pm_apply_schedule(uuid, jsonb, timestamptz, numeric) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_recalc_project_progress(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_dependency_creates_cycle(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_task_upstream(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_task_downstream(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_seed_demo(uuid, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_owns_project(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_template_owns_project(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_ltree_label(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pm_template_dependency_creates_cycle(uuid, uuid) TO authenticated, anon;

GRANT SELECT ON public.project_task_schedule_view TO authenticated, anon;
GRANT SELECT ON public.templates_project_task_schedule_view TO authenticated, anon;

-- 8.3 Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
