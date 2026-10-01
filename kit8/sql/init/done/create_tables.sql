-- =====================================================================================
-- UNIVERSAL1 - MASTER SCHEMA: kit8/sql/init/done/create_tables.sql
-- (Supabase / PostgreSQL 15+. Remove everything again with delete_tables.sql)
--
-- Built from the app code (kit8/pm/crud/*, kit8/redux/SystemMetaData.ts, app/_layout.tsx,
-- kit8/catalog/*) and the init scripts of branch pm33 (kit8/sql/init/done/*.sql), which it
-- replaces: create_tables.sql, update_tables.sql, create_*_table.sql, create_pm_tables.sql,
-- create_pm_kanban_tables.sql and every update_pm_tables_*.sql.
--
-- IDEMPOTENT + NON-DESTRUCTIVE: run it on an empty database (fresh install, e.g. after
-- delete_tables.sql) or on top of an existing one (it only adds what is missing, refreshes
-- functions / triggers / policies / grants and runs the data migrations). Safe to run twice.
--
--   0. extensions + shared helper functions
--   1. generic app tables (defTable.md pattern, TEXT ids, open RLS)
--        googleDriveCommandTable, raciMemberTable, themeStoreTable, mediaPostTable,
--        mediaPostTableArchive, userTable, userAuthTable, aiSessionTable, dtc*Table (7)
--   2. catalogs (defTable.md pattern, TEXT ids) + seeds
--        countryTable, currencyTable, currencyExchangeRateTable, organizationTable,
--        departamentTable, personTable, partnerTable, contractTable
--   3. PM Gantt (UUID ids, ltree tree, DAG + closure, owner RLS)
--        project_table, project_task_table, project_task_dependencies_table,
--        project_task_dependency_closure_table, project_user_settings_table
--        + project_task_schedule_view and the RPCs pm_apply_schedule,
--          pm_dependency_creates_cycle, pm_recalc_project_progress, pm_task_upstream,
--          pm_task_downstream, pm_owns_project, pm_seed_demo
--   4. PM Kanban
--        kanban_stage_table (seeded catalog), project_kanban_stage_table,
--        project_task_kanban_state_table + RPC pm_kanban_ensure_project_stages
--   5. PM project templates (kit8/pm/crud/api/templateApi.ts)
--        templates_project_table, templates_project_task_table,
--        templates_project_task_dependencies_table, templates_project_task_dependency_closure_table,
--        templates_project_kanban_stage_table, templates_project_user_settings_table
--        (same tree / DAG / closure integrity as the real project tables, owner RLS)
--   6. data migrations of older databases (all no-ops on a fresh database)
--   7. realtime publication + PostgREST schema reload
--
-- Conventions
--   * "rowGUID" own id, "rowOwnerGUID" owner, "rowParentGUID" parent, "orderInList" numeric
--     order, "rowJSON" jsonb payload, created_at / updated_at (kit8/sql/defTable.md).
--   * PM: ltree labels = rowGUID with '-' -> '_' (client: scheduling.ts toLtreeLabel()).
--     rowJSON.startAt = start, "rowDuration" = finish (exclusive). Errors raised by triggers
--     start with 'pm_gantt: ' (the client strips it: apiUtils.errorMessage()).
--   * PM rows belong to auth.uid() ("rowOwnerGUID" uuid) - RLS on every PM table.
-- =====================================================================================

-- =====================================================================================
-- 0. Extensions + shared helpers
-- =====================================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS ltree;      -- kept wherever it is already installed
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() on PostgreSQL < 13

-- updated_at helpers (three names, all still referenced by older triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

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

-- uuid -> ltree label ('-' -> '_')
CREATE OR REPLACE FUNCTION public.pm_ltree_label(p_guid uuid) RETURNS ltree
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, extensions AS $$
  SELECT text2ltree(replace(lower(p_guid::text), '-', '_'));
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
-- 1. Generic app tables (kit8/redux/SystemMetaData.ts reusable CRUD + realtime saga)
--    TEXT ids; open RLS for anon + authenticated (as in pm33 create_tables.sql).
--    Defaults on rowGUID / rowParentGUID / orderInList: themeStore createOne sends no
--    rowParentGUID, raciMember / organization rows use 'empty'.
-- =====================================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'googleDriveCommandTable', 'raciMemberTable', 'themeStoreTable',
    'mediaPostTable', 'mediaPostTableArchive',
    'userTable', 'userAuthTable', 'aiSessionTable',
    'dtcTaskFinishedTable', 'dtcCatalogExecutiveTable', 'dtcTaskRegisteredTable',
    'dtcTaskWaitingTable', 'dtcTaskProgressTable', 'dtcFreeExecutiveTable'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I (
         "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
         "rowOwnerGUID"  TEXT        NOT NULL,
         "rowParentGUID" TEXT        NOT NULL DEFAULT ''empty'',
         "rowJSON"       JSONB       NOT NULL DEFAULT ''{}''::jsonb,
         "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
         "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         PRIMARY KEY ("rowGUID")
       )', t);
    -- older databases: columns / defaults added later (update_tables.sql)
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN "rowParentGUID" SET DEFAULT ''empty''', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN "orderInList" SET DEFAULT 0', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN "rowJSON" SET DEFAULT ''{}''::jsonb', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I ("rowOwnerGUID")', 'idx_' || t || '_owner', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_at)', t || '_created_at_idx', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_at)', t || '_updated_at_idx', t);
    PERFORM public.kit8_setup_def_table(t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Allow anon select" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Allow anon insert" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Allow anon update" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Allow anon delete" ON public.%I FOR DELETE TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;

-- one row per owner (pm33 create_tables.sql "additional indexes")
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dtcTaskProgressTable_rowOwnerGUID" ON public."dtcTaskProgressTable" ("rowOwnerGUID");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_userTable_rowOwnerGUID" ON public."userTable" ("rowOwnerGUID");

-- =====================================================================================
-- 2. Catalogs (kit8/catalog/*) - defTable.md pattern, TEXT ids
-- =====================================================================================

-- ---- countryTable: rowOwnerGUID 'countryCatalog'. Read: everybody; write: signed-in --------
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
CREATE UNIQUE INDEX IF NOT EXISTS "idx_countryTable_code" ON public."countryTable" (upper("rowJSON"->>'countryCode'));
CREATE INDEX IF NOT EXISTS "idx_countryTable_name" ON public."countryTable" ((lower("rowJSON"->>'countryName')));
SELECT public.kit8_setup_def_table('countryTable');
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

INSERT INTO public."countryTable" ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object('countryName', v.name, 'countryCode', v.code2, 'countryCodeAlpha3', v.code3,
                                 'countryNumericCode', v.num, 'phonePrefix', v.prefix, 'currencyCode', v.curr,
                                 'flagEmoji', v.flag, 'isActive', true)
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
    (16000, 'Canada',         'CA', 'CAN', '124', '+1',   'CAD', '🇨🇦'),
    (17000, 'Japan',          'JP', 'JPN', '392', '+81',  'JPY', '🇯🇵'),
    (18000, 'Australia',      'AU', 'AUS', '036', '+61',  'AUD', '🇦🇺')
  ) AS v(ord, name, code2, code3, num, prefix, curr, flag)
 WHERE NOT EXISTS (SELECT 1 FROM public."countryTable" c WHERE upper(c."rowJSON"->>'countryCode') = v.code2);

-- ---- currencyTable: rowOwnerGUID 'currencyCatalog'. Read: everybody; write: signed-in -------
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
CREATE UNIQUE INDEX IF NOT EXISTS "idx_currencyTable_code" ON public."currencyTable" (upper("rowJSON"->>'currencyCode'));
SELECT public.kit8_setup_def_table('currencyTable');
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

INSERT INTO public."currencyTable" ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object('currencyCode', v.code, 'currencyName', v.name, 'currencySymbol', v.sym,
                                 'currencyNumericCode', v.num, 'decimalDigits', v.dec, 'isActive', true)
  FROM (VALUES
    (1024,  'EUR', 'Euro',            '€',   '978', 2),
    (2048,  'USD', 'US Dollar',       '$',   '840', 2),
    (3072,  'GBP', 'Pound Sterling',  '£',   '826', 2),
    (4096,  'CHF', 'Swiss Franc',     'CHF', '756', 2),
    (5120,  'JPY', 'Yen',             '¥',   '392', 0),
    (6144,  'CNY', 'Yuan Renminbi',   '¥',   '156', 2),
    (7168,  'SEK', 'Swedish Krona',   'kr',  '752', 2),
    (8192,  'NOK', 'Norwegian Krone', 'kr',  '578', 2),
    (9216,  'DKK', 'Danish Krone',    'kr',  '208', 2),
    (10240, 'PLN', 'Zloty',           'zł',  '985', 2)
  ) AS v(ord, code, name, sym, num, dec)
 WHERE NOT EXISTS (SELECT 1 FROM public."currencyTable" c WHERE upper(c."rowJSON"->>'currencyCode') = v.code);

-- ---- currencyExchangeRateTable: rowOwnerGUID = currency, rowParentGUID = 'YYYY-MM-DD' -------
--      one rate per currency per day; orderInList = -(days since 1970-01-01); no FK on purpose
--      (an undone currency delete re-creates the same rowGUID and gets its rates back)
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
CREATE UNIQUE INDEX IF NOT EXISTS "idx_currencyExchangeRateTable_owner_day" ON public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID");
CREATE INDEX IF NOT EXISTS "idx_currencyExchangeRateTable_owner_order" ON public."currencyExchangeRateTable" ("rowOwnerGUID", "orderInList");
SELECT public.kit8_setup_def_table('currencyExchangeRateTable');
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

-- ---- organizationTable: rowOwnerGUID 'organizationCatalog'. Created on first login ----------
--      (app/_layout.tsx). Read: signed-in; update / delete: only rowJSON.createdByUser
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
CREATE INDEX IF NOT EXISTS "idx_organizationTable_title" ON public."organizationTable" ((lower("rowJSON"->>'organizationTitle')));
CREATE INDEX IF NOT EXISTS "idx_organizationTable_createdByUser" ON public."organizationTable" (("rowJSON"->>'createdByUser'));
SELECT public.kit8_setup_def_table('organizationTable');
REVOKE ALL ON public."organizationTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."organizationTable" TO authenticated;
DROP POLICY IF EXISTS "organizationTable_select" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_insert" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_update" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_delete" ON public."organizationTable";
CREATE POLICY "organizationTable_select" ON public."organizationTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizationTable_insert" ON public."organizationTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "organizationTable_update" ON public."organizationTable" FOR UPDATE TO authenticated
  USING (lower("rowJSON"->>'createdByUser') = lower(auth.jwt()->>'email') OR (auth.jwt()->>'email') IS NULL)
  WITH CHECK (lower("rowJSON"->>'createdByUser') = lower(auth.jwt()->>'email') OR (auth.jwt()->>'email') IS NULL);
CREATE POLICY "organizationTable_delete" ON public."organizationTable" FOR DELETE TO authenticated
  USING (lower("rowJSON"->>'createdByUser') = lower(auth.jwt()->>'email') OR (auth.jwt()->>'email') IS NULL);

-- ---- departamentTable: rowOwnerGUID = organization, rowParentGUID = parent dept or 'empty' ---
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
CREATE INDEX IF NOT EXISTS "idx_departamentTable_name" ON public."departamentTable" ((lower("rowJSON"->>'departmentName')));
SELECT public.kit8_setup_def_table('departamentTable');

-- ---- personTable / partnerTable: shared catalogs, signed-in users only (GDPR) ---------------
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
CREATE INDEX IF NOT EXISTS "idx_personTable_title" ON public."personTable" ((lower("rowJSON"->>'personTitle')));
SELECT public.kit8_setup_def_table('personTable');

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
CREATE INDEX IF NOT EXISTS "idx_partnerTable_title" ON public."partnerTable" ((lower("rowJSON"->>'partnerTitle')));
CREATE UNIQUE INDEX IF NOT EXISTS "idx_partnerTable_vat" ON public."partnerTable" (upper("rowJSON"->'legalData'->>'vatNo'))
  WHERE ("rowJSON"->'legalData'->>'vatNo') IS NOT NULL AND ("rowJSON"->'legalData'->>'vatNo') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "idx_partnerTable_reg" ON public."partnerTable" (("rowJSON"->'legalData'->>'registrationNo'))
  WHERE ("rowJSON"->'legalData'->>'registrationNo') IS NOT NULL AND ("rowJSON"->'legalData'->>'registrationNo') <> '';
SELECT public.kit8_setup_def_table('partnerTable');

-- ---- contractTable: rowOwnerGUID = person / partner rowGUID, rowParentGUID 'person'|'partner'
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
CREATE INDEX IF NOT EXISTS "idx_contractTable_number" ON public."contractTable" ((lower("rowJSON"->>'contractNumber')));
SELECT public.kit8_setup_def_table('contractTable');

-- departament / person / partner / contract: full CRUD for signed-in users only
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departamentTable', 'personTable', 'partnerTable', 'contractTable'] LOOP
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

-- demo rows (fixed ids, skipped when present)
INSERT INTO public."personTable" ("rowGUID", "orderInList", "rowJSON") VALUES
  ('11111111-1111-4111-a111-111111111111', 1024, '{"personFirstName":"John","personLastName":"Doe","personTitle":"John Doe",
    "personEmail":"john.doe@example.com","personPhone":"+1 555 0100","isActive":true,"personIsEmployee":true,
    "employeeData":{"employeeNumber":"EMP-001","position":"Lead Software Engineer","department":"Engineering",
    "personalCode":"010190-12345","bankIban":"LV80HABA0551000000001"}}'::jsonb),
  ('22222222-2222-4222-a222-222222222222', 2048, '{"personFirstName":"Jane","personLastName":"Smith","personTitle":"Jane Smith",
    "personEmail":"jane.smith@example.com","personPhone":"+1 555 0200","isActive":true,"personIsEmployee":true,
    "employeeData":{"employeeNumber":"EMP-002","position":"Operations Director","department":"Management",
    "personalCode":"150588-54321","bankIban":"LV80HABA0551000000002"}}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

INSERT INTO public."partnerTable" ("rowGUID", "orderInList", "rowJSON") VALUES
  ('33333333-3333-4333-a333-333333333333', 1024, '{"partnerTitle":"Baltic Timber Supply","partnerLegalName":"Baltic Timber Supply SIA",
    "partnerKind":"company","isActive":true,"partnerIsSupplier":true,"partnerIsCustomer":false,
    "legalData":{"registrationNo":"40003001234","vatNo":"LV40003001234","legalAddress":"Eksporta iela 10, Riga, LV-1010","country":"LV","bankIban":"LV80HABA0551000000003"},
    "supplierData":{"paymentTermsDays":14,"defaultCurrency":"EUR","notes":"Raw wood supply partner"},
    "customerData":{"paymentTermsDays":30,"creditLimit":0,"defaultCurrency":"EUR","discountPercent":0}}'::jsonb),
  ('44444444-4444-4444-a444-444444444444', 2048, '{"partnerTitle":"Nordic Furniture Group","partnerLegalName":"Nordic Furniture Group AB",
    "partnerKind":"company","isActive":true,"partnerIsSupplier":false,"partnerIsCustomer":true,
    "legalData":{"registrationNo":"5560123456","vatNo":"SE556012345601","legalAddress":"Sveavägen 44, Stockholm, 11134","country":"SE","bankIban":"SE4550000000055601234560"},
    "supplierData":{"paymentTermsDays":14,"defaultCurrency":"EUR","notes":""},
    "customerData":{"paymentTermsDays":45,"creditLimit":50000,"defaultCurrency":"EUR","discountPercent":8}}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('55555555-5555-4555-a555-555555555555', '11111111-1111-4111-a111-111111111111', 'person', -20500,
   '{"contractPartyType":"person","contractNumber":"EMP-2026-001","contractTitle":"Employment Agreement - Lead Engineer",
     "contractType":"Employment","contractStatus":"active","contractSignedDate":"2026-01-15","contractStartDate":"2026-02-01",
     "contractFinishDate":null,"contractPaymentsPeriod":"Month","contractCurrency":"EUR","contractSumBeforeVAT":5500,
     "contractVATRate":0,"contractVAT":0,"contractTotal":5500,"notes":"Full time employment agreement"}'::jsonb),
  ('66666666-6666-4666-a666-666666666666', '33333333-3333-4333-a333-333333333333', 'partner', -20550,
   '{"contractPartyType":"partner","contractNumber":"SUP-2026-088","contractTitle":"Master Wood Supply Agreement 2026",
     "contractType":"Supply","contractStatus":"active","contractSignedDate":"2026-01-10","contractStartDate":"2026-01-15",
     "contractFinishDate":"2026-12-31","contractPaymentsPeriod":"Month","contractCurrency":"EUR","contractSumBeforeVAT":12000,
     "contractVATRate":21,"contractVAT":2520,"contractTotal":14520,"notes":"Monthly timber deliveries"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- =====================================================================================
-- 3. PM Gantt (kit8/pm/crud/api: projectApi, taskApi, dependencyApi, projectUserSettingsApi)
--    TREE = ltree "treePath" (what contains what), DAG = dependencies (FS/SS/FF/SF + lag),
--    CLOSURE = all upstream / downstream pairs, maintained by triggers.
-- =====================================================================================
-- -------------------------------------------------------------------------------------
-- project_table - one row per project (treePath = own label)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- finish (end of duration)
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT project_table_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"))
);
CREATE INDEX IF NOT EXISTS idx_project_table_owner_order ON public.project_table ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_project_table_treePath ON public.project_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_project_table_rowJSON ON public.project_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- project_task_table - stages + tasks + milestones (rowJSON.rowKind)
--   treePath = <project>.<stage>...<own row>
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_task_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "projectGUID"  UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- finish (end of duration), written by the scheduler
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering among siblings
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
CREATE INDEX IF NOT EXISTS idx_project_task_project_order ON public.project_task_table ("projectGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_project_task_owner ON public.project_task_table ("rowOwnerGUID");
CREATE INDEX IF NOT EXISTS idx_project_task_treePath ON public.project_task_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_project_task_rowJSON ON public.project_task_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- project_task_dependencies_table - the DAG: "rowGUID" waits for "rowDependsOnGUID"
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_task_dependencies_table (
  "rowGUID"          UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "rowDependsOnGUID" UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"      UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"     UUID        NOT NULL,
  "linkType"         TEXT        NOT NULL DEFAULT 'FS',
  "lagDays"          NUMERIC     NOT NULL DEFAULT 0,  -- lag (>0) / lead (<0) in working days
  "rowJSON"          JSONB       NOT NULL DEFAULT '{}'::jsonb, -- dependencyColor, notes, ...
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID", "rowDependsOnGUID"),
  CONSTRAINT project_task_dep_self_chk CHECK ("rowGUID" <> "rowDependsOnGUID"),
  CONSTRAINT project_task_dep_type_chk CHECK ("linkType" IN ('FS', 'SS', 'FF', 'SF'))
);
ALTER TABLE public.project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_task_deps_dependsOn ON public.project_task_dependencies_table ("rowDependsOnGUID");
CREATE INDEX IF NOT EXISTS idx_task_deps_project ON public.project_task_dependencies_table ("projectGUID");
CREATE INDEX IF NOT EXISTS idx_task_deps_rowJSON ON public.project_task_dependencies_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- project_task_dependency_closure_table - every (ancestor ~> descendant) pair of the
-- DAG with the SHORTEST path length. Written ONLY by the triggers below (clients: read).
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_task_dependency_closure_table (
  "ancestorGUID"   UUID  NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "descendantGUID" UUID  NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"    UUID  NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "depthLevel"     INT   NOT NULL,
  "rowJSON"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY ("ancestorGUID", "descendantGUID"),
  CONSTRAINT project_task_dep_closure_self_chk CHECK ("ancestorGUID" <> "descendantGUID")
);
ALTER TABLE public.project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_task_dep_closure_descendant ON public.project_task_dependency_closure_table ("descendantGUID");
CREATE INDEX IF NOT EXISTS idx_task_dep_closure_project ON public.project_task_dependency_closure_table ("projectGUID");

-- ownership helper (used by RLS policies and RPCs)
CREATE OR REPLACE FUNCTION public.pm_owns_project(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_table p WHERE p."rowGUID" = p_project AND p."rowOwnerGUID" = auth.uid());
$$;

DROP TRIGGER IF EXISTS trg_project_table_touch ON public.project_table;
CREATE TRIGGER trg_project_table_touch BEFORE UPDATE ON public.project_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS trg_project_task_table_touch ON public.project_task_table;
CREATE TRIGGER trg_project_task_table_touch BEFORE UPDATE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- ---- TREE integrity (ltree) -----------------------------------------------------------
-- parent must exist inside the same project; a row cannot be moved under itself
CREATE OR REPLACE FUNCTION public.pm_task_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
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

  -- rows re-pathed by the after-move trigger (trigger depth > 1) are validated by the outer move
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

-- moving a stage rewrites the paths of its whole subtree (one statement)
CREATE OR REPLACE FUNCTION public.pm_task_after_move() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND NEW."treePath" IS DISTINCT FROM OLD."treePath" THEN
    UPDATE public.project_task_table
       SET "treePath" = NEW."treePath" || subpath("treePath", nlevel(OLD."treePath"))
     WHERE "projectGUID" = NEW."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> NEW."rowGUID";
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_task_after_move ON public.project_task_table;
CREATE TRIGGER trg_project_task_after_move
  AFTER UPDATE OF "treePath" ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_move();

-- deleting a stage deletes its subtree (edges + closure follow through FK cascades)
CREATE OR REPLACE FUNCTION public.pm_task_after_delete_subtree() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  DELETE FROM public.project_task_table
   WHERE "projectGUID" = OLD."projectGUID"
     AND "treePath" <@ OLD."treePath"
     AND "rowGUID" <> OLD."rowGUID";
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_task_after_delete_subtree ON public.project_task_table;
CREATE TRIGGER trg_project_task_after_delete_subtree
  AFTER DELETE ON public.project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_after_delete_subtree();

-- ---- DAG integrity + closure maintenance ----------------------------------------------
-- Tree-aware reachability: does succ already (transitively) come before pred? A link on a
-- stage applies to every row inside it, so a walk may continue through the links of a row's
-- ancestors and descendants ("A in Stage S, S after B, B after A" is a cycle too).
CREATE OR REPLACE FUNCTION public.pm_dependency_creates_cycle(p_pred uuid, p_succ uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH RECURSIVE
  pred AS (SELECT "treePath" AS path FROM public.project_task_table WHERE "rowGUID" = p_pred),
  reach(guid) AS (            -- uuid only: ltree is not hashable for a recursive UNION
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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

  IF v_succ."treePath" @> v_pred."treePath" OR v_succ."treePath" <@ v_pred."treePath" THEN
    RAISE EXCEPTION 'pm_gantt: a row cannot depend on its own stage or sub-rows' USING ERRCODE = 'check_violation';
  END IF;

  -- serialize DAG writes per project so two concurrent inserts cannot close a cycle
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."projectGUID"::text, 0));

  IF public.pm_dependency_creates_cycle(NEW."rowDependsOnGUID", NEW."rowGUID") THEN
    RAISE EXCEPTION 'pm_gantt: dependency % -> % would create a cycle', NEW."rowDependsOnGUID", NEW."rowGUID"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_task_dependency_before_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" <> OLD."rowGUID" OR NEW."rowDependsOnGUID" <> OLD."rowDependsOnGUID"
     OR NEW."projectGUID" <> OLD."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependency endpoints are immutable (delete + insert instead)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- incremental closure insert: (ancestors of pred + pred) x (succ + descendants of succ)
CREATE OR REPLACE FUNCTION public.pm_task_dependency_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  INSERT INTO public.project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  SELECT a.anc, d.dsc, NEW."projectGUID", MIN(a.depth + d.depth + 1), '{}'::jsonb
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
   GROUP BY a.anc, d.dsc
  ON CONFLICT ("ancestorGUID", "descendantGUID") DO UPDATE
    SET "depthLevel" = LEAST(public.project_task_dependency_closure_table."depthLevel", EXCLUDED."depthLevel");
  RETURN NULL;
END;
$$;

-- a DAG can have several paths between two nodes, so a delete is not undone locally:
-- the closure of THAT project is rebuilt (small at PM scale, always correct)
CREATE OR REPLACE FUNCTION public.pm_rebuild_dependency_closure(p_project uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  -- skip when the whole project is being deleted (FK cascade already cleans up)
  IF EXISTS (SELECT 1 FROM public.project_table WHERE "rowGUID" = OLD."projectGUID") THEN
    PERFORM public.pm_rebuild_dependency_closure(OLD."projectGUID");
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_task_dependency_before_insert ON public.project_task_dependencies_table;
DROP TRIGGER IF EXISTS trg_pm_task_dependency_before_update ON public.project_task_dependencies_table;
DROP TRIGGER IF EXISTS trg_pm_task_dependency_after_insert ON public.project_task_dependencies_table;
DROP TRIGGER IF EXISTS trg_pm_task_dependency_after_delete ON public.project_task_dependencies_table;
CREATE TRIGGER trg_pm_task_dependency_before_insert
  BEFORE INSERT ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_before_insert();
CREATE TRIGGER trg_pm_task_dependency_before_update
  BEFORE UPDATE ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_before_update();
CREATE TRIGGER trg_pm_task_dependency_after_insert
  AFTER INSERT ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_after_insert();
CREATE TRIGGER trg_pm_task_dependency_after_delete
  AFTER DELETE ON public.project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_dependency_after_delete();

-- ---- Row Level Security: everything belongs to auth.uid() ------------------------------
--   table                                       SELECT  INSERT  UPDATE  DELETE
--   project_table                           owner   owner   owner   owner
--   project_task_table                      owner   owner   owner   owner
--   project_task_dependencies_table         owner   owner   owner*  owner  (*linkType/lagDays/rowJSON)
--   project_task_dependency_closure_table   owner   -       -       -      (triggers only)
ALTER TABLE public.project_table                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_table                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_dependencies_table       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_dependency_closure_table ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_table                         FROM anon, authenticated;
REVOKE ALL ON public.project_task_table                    FROM anon, authenticated;
REVOKE ALL ON public.project_task_dependencies_table       FROM anon, authenticated;
REVOKE ALL ON public.project_task_dependency_closure_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_table                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_table              TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.project_task_dependencies_table TO authenticated;
GRANT UPDATE ("linkType", "lagDays", "rowJSON") ON public.project_task_dependencies_table TO authenticated;
GRANT SELECT                         ON public.project_task_dependency_closure_table TO authenticated;

DROP POLICY IF EXISTS project_table_select ON public.project_table;
DROP POLICY IF EXISTS project_table_insert ON public.project_table;
DROP POLICY IF EXISTS project_table_update ON public.project_table;
DROP POLICY IF EXISTS project_table_delete ON public.project_table;
CREATE POLICY project_table_select ON public.project_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_insert ON public.project_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_update ON public.project_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_table_delete ON public.project_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

DROP POLICY IF EXISTS project_task_select ON public.project_task_table;
DROP POLICY IF EXISTS project_task_insert ON public.project_task_table;
DROP POLICY IF EXISTS project_task_update ON public.project_task_table;
DROP POLICY IF EXISTS project_task_delete ON public.project_task_table;
CREATE POLICY project_task_select ON public.project_task_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_insert ON public.project_task_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_update ON public.project_task_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid())
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_delete ON public.project_task_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

DROP POLICY IF EXISTS project_task_dep_select ON public.project_task_dependencies_table;
DROP POLICY IF EXISTS project_task_dep_insert ON public.project_task_dependencies_table;
DROP POLICY IF EXISTS project_task_dep_update ON public.project_task_dependencies_table;
DROP POLICY IF EXISTS project_task_dep_delete ON public.project_task_dependencies_table;
CREATE POLICY project_task_dep_select ON public.project_task_dependencies_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_dep_insert ON public.project_task_dependencies_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_project("projectGUID"));
CREATE POLICY project_task_dep_update ON public.project_task_dependencies_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY project_task_dep_delete ON public.project_task_dependencies_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

DROP POLICY IF EXISTS project_task_dep_closure_select ON public.project_task_dependency_closure_table;
CREATE POLICY project_task_dep_closure_select ON public.project_task_dependency_closure_table FOR SELECT TO authenticated
  USING (public.pm_owns_project("projectGUID"));

REVOKE ALL ON FUNCTION public.pm_rebuild_dependency_closure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_dependency_creates_cycle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_owns_project(uuid) TO authenticated;
-- -------------------------------------------------------------------------------------
-- Project / stage progress (stored procedure + trigger)
--   progress(summary or project) = round1( SUM(w*p) / SUM(w) ) over its LEAF rows
--   w = max(rowJSON.durationDays, 1), p = "rowProgress" clamped to 0..100
-- Same formula as the client (scheduling.ts), so the UI never jumps.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_recalc_project_progress(p_project uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_progress numeric;
BEGIN
  -- callers with a JWT may only recalc their own projects (SQL editor / triggers: no JWT)
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_project uuid := COALESCE(NEW."projectGUID", OLD."projectGUID");
BEGIN
  -- rows written by the recalc itself / by the subtree triggers run at depth > 1
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  -- skip when the whole project is being deleted (FK cascade)
  IF NOT EXISTS (SELECT 1 FROM public.project_table WHERE "rowGUID" = v_project) THEN
    RETURN NULL;
  END IF;
  PERFORM public.pm_recalc_project_progress(v_project);
  RETURN NULL;
END;
$$;

-- "zz": runs after the subtree triggers (triggers of one event fire in name order)
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

-- -------------------------------------------------------------------------------------
-- RPC pm_apply_schedule (kit8/pm/crud/api/taskApi.ts applySchedule): client CPM write-back
--   p_rows: [{"rowGUID", "startAt", "finishAt", "rowProgress"?}]
--   SECURITY INVOKER -> RLS applies; the DB progress formula wins afterwards.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_apply_schedule(
  p_project_guid uuid,
  p_rows jsonb,
  p_project_finish timestamptz DEFAULT NULL,
  p_project_progress numeric DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.project_task_table t
     SET "rowJSON"     = jsonb_set(t."rowJSON", '{startAt}', to_jsonb(r."startAt")),
         "rowDuration" = r."finishAt",
         "rowProgress" = COALESCE(r."rowProgress", t."rowProgress")
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb))
         AS r("rowGUID" uuid, "startAt" timestamptz, "finishAt" timestamptz, "rowProgress" numeric)
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

-- the schedule, queryable in SQL
CREATE OR REPLACE VIEW public.project_task_schedule_view
WITH (security_invoker = true) AS
SELECT t."rowGUID",
       t."projectGUID",
       t."treePath",
       nlevel(t."treePath") - 1                                 AS "treeDepth",
       t."rowJSON"->>'name'                                     AS "name",
       t."rowJSON"->>'rowKind'                                  AS "rowKind",
       (t."rowJSON"->>'startAt')::timestamptz                   AS "startAt",
       t."rowDuration"                                          AS "finishAt",
       t."rowDuration" - (t."rowJSON"->>'startAt')::timestamptz AS "duration",
       t."rowProgress",
       t."orderInList"
  FROM public.project_task_table t;

-- "all blockers of X" / "everything X blocks", straight from the closure table
CREATE OR REPLACE FUNCTION public.pm_task_upstream(p_task uuid)
RETURNS TABLE ("rowGUID" uuid, "depthLevel" int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  SELECT c."ancestorGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
   WHERE c."descendantGUID" = p_task ORDER BY c."depthLevel";
$$;

CREATE OR REPLACE FUNCTION public.pm_task_downstream(p_task uuid)
RETURNS TABLE ("rowGUID" uuid, "depthLevel" int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  SELECT c."descendantGUID", c."depthLevel" FROM public.project_task_dependency_closure_table c
   WHERE c."ancestorGUID" = p_task ORDER BY c."depthLevel";
$$;

GRANT SELECT  ON public.project_task_schedule_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_recalc_project_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_apply_schedule(uuid, jsonb, timestamptz, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_task_upstream(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_task_downstream(uuid) TO authenticated;

-- -------------------------------------------------------------------------------------
-- Demo data. Signed-in: select public.pm_seed_demo();  SQL editor: select public.pm_seed_demo('<user uuid>');
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_seed_demo(p_owner uuid DEFAULT auth.uid(), p_start date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_project jsonb;
  v_stage jsonb;
  v_task jsonb;
  v_p uuid; v_s uuid; v_t uuid;
  v_p_order numeric := COALESCE((SELECT MAX("orderInList") FROM public.project_table WHERE "rowOwnerGUID" = p_owner), 0);
  v_s_order numeric; v_t_order numeric;
  v_ids uuid[];
  v_after int;
  v_start timestamptz := (p_start::timestamp AT TIME ZONE 'UTC');
  v_demo jsonb := '[
    {"name":"Project 1","stages":[
      {"name":"Stage 1","tasks":[{"name":"Task 111","days":3},{"name":"Task 112","days":5},{"name":"Task 113","days":2,"after":[1,2]}]},
      {"name":"Stage 2","tasks":[{"name":"Task 121","days":3},{"name":"Task 122","days":5},{"name":"Task 123","days":2,"after":[1,2]}]}]},
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
GRANT EXECUTE ON FUNCTION public.pm_seed_demo(uuid, date) TO authenticated;

-- -------------------------------------------------------------------------------------
-- project_user_settings_table - Gantt / tree settings of ONE user for ONE project
--   rowOwnerGUID = project, rowParentGUID = user (auth.uid()), rowJSON = { uxuiSettings }
--   one row per (project, user): the client upserts on ("rowOwnerGUID","rowParentGUID")
-- -------------------------------------------------------------------------------------
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
CREATE POLICY project_user_settings_select ON public.project_user_settings_table FOR SELECT TO authenticated
  USING ("rowParentGUID" = auth.uid());
CREATE POLICY project_user_settings_insert ON public.project_user_settings_table FOR INSERT TO authenticated
  WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_project("rowOwnerGUID"));
CREATE POLICY project_user_settings_update ON public.project_user_settings_table FOR UPDATE TO authenticated
  USING ("rowParentGUID" = auth.uid()) WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_project("rowOwnerGUID"));
CREATE POLICY project_user_settings_delete ON public.project_user_settings_table FOR DELETE TO authenticated
  USING ("rowParentGUID" = auth.uid());

-- =====================================================================================
-- 4. PM Kanban (kit8/pm/crud/api/kanbanApi.ts)
--   kanban_stage_table               shared catalog, rowOwnerGUID 'kanbanStageCatalog' (TEXT ids)
--   project_kanban_stage_table       columns of ONE project (rowOwnerGUID = project,
--                                    rowParentGUID = catalog rowGUID or 'empty')
--   project_task_kanban_state_table  stage of ONE task (rowOwnerGUID = project, rowParentGUID = task,
--                                    rowJSON = { stageGUID, kanbanStageProgressPercent? }); no row = first stage
-- =====================================================================================
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
CREATE TRIGGER trg_kanban_stage_touch BEFORE UPDATE ON public.kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

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

-- seed: Waiting, Plan, Analyse, Construct, Execute (existing codes are kept)
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
CREATE TRIGGER trg_project_kanban_stage_touch BEFORE UPDATE ON public.project_kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

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
CREATE TRIGGER trg_project_task_kanban_state_touch BEFORE UPDATE ON public.project_task_kanban_state_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- deleting a column sends its tasks back to the first stage (their state rows are removed)
CREATE OR REPLACE FUNCTION public.pm_kanban_stage_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  DELETE FROM public.project_task_kanban_state_table s
   WHERE s."rowOwnerGUID" = OLD."rowOwnerGUID" AND s."rowJSON"->>'stageGUID' = OLD."rowGUID"::text;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_project_kanban_stage_after_delete ON public.project_kanban_stage_table;
CREATE TRIGGER trg_project_kanban_stage_after_delete AFTER DELETE ON public.project_kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_kanban_stage_after_delete();

-- RPC: the project's stages; the first call copies the active catalog stages into the project.
-- One advisory lock per project -> two browsers never create the stages twice. RLS applies.
CREATE OR REPLACE FUNCTION public.pm_kanban_ensure_project_stages(p_project uuid)
RETURNS SETOF public.project_kanban_stage_table
LANGUAGE plpgsql SET search_path = public, extensions AS $$
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
     WHERE k."rowOwnerGUID" = 'kanbanStageCatalog' AND COALESCE((k."rowJSON"->>'isActive')::boolean, true)
     ORDER BY k."orderInList";
  END IF;
  RETURN QUERY SELECT * FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = p_project ORDER BY "orderInList";
END;
$$;
REVOKE ALL ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm_kanban_ensure_project_stages(uuid) TO authenticated;

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
-- 5. PM project templates (kit8/pm/crud/api/templateApi.ts, model/constants.ts templates*)
--    Same layout, integrity and RLS as the project tables: "projectGUID" = the template.
--    No progress roll-up / Kanban task states in templates.
-- =====================================================================================
-- -------------------------------------------------------------------------------------
-- templates_project_table - one row per template (treePath = own label)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates_project_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- finish (end of duration)
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering
  "rowJSON"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT templates_project_table_progress_chk CHECK ("rowProgress" BETWEEN 0 AND 100),
  CONSTRAINT templates_project_table_path_chk CHECK ("treePath" = public.pm_ltree_label("rowGUID"))
);
CREATE INDEX IF NOT EXISTS idx_templates_project_table_owner_order ON public.templates_project_table ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_templates_project_table_treePath ON public.templates_project_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_templates_project_table_rowJSON ON public.templates_project_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- templates_project_task_table - stages + tasks + milestones (rowJSON.rowKind)
--   treePath = <project>.<stage>...<own row>
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates_project_task_table (
  "rowGUID"      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "treePath"     LTREE       NOT NULL,
  "projectGUID"  UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID" UUID        NOT NULL,
  "rowDuration"  TIMESTAMPTZ,                       -- finish (end of duration), written by the scheduler
  "rowProgress"  NUMERIC     NOT NULL DEFAULT 0,
  "orderInList"  NUMERIC     NOT NULL DEFAULT 0,    -- fractional ordering among siblings
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
CREATE INDEX IF NOT EXISTS idx_templates_project_task_project_order ON public.templates_project_task_table ("projectGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_templates_project_task_owner ON public.templates_project_task_table ("rowOwnerGUID");
CREATE INDEX IF NOT EXISTS idx_templates_project_task_treePath ON public.templates_project_task_table USING GIST ("treePath");
CREATE INDEX IF NOT EXISTS idx_templates_project_task_rowJSON ON public.templates_project_task_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- templates_project_task_dependencies_table - the DAG: "rowGUID" waits for "rowDependsOnGUID"
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates_project_task_dependencies_table (
  "rowGUID"          UUID        NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "rowDependsOnGUID" UUID        NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"      UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"     UUID        NOT NULL,
  "linkType"         TEXT        NOT NULL DEFAULT 'FS',
  "lagDays"          NUMERIC     NOT NULL DEFAULT 0,  -- lag (>0) / lead (<0) in working days
  "rowJSON"          JSONB       NOT NULL DEFAULT '{}'::jsonb, -- dependencyColor, notes, ...
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID", "rowDependsOnGUID"),
  CONSTRAINT templates_project_task_dep_self_chk CHECK ("rowGUID" <> "rowDependsOnGUID"),
  CONSTRAINT templates_project_task_dep_type_chk CHECK ("linkType" IN ('FS', 'SS', 'FF', 'SF'))
);
ALTER TABLE public.templates_project_task_dependencies_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_templates_task_deps_dependsOn ON public.templates_project_task_dependencies_table ("rowDependsOnGUID");
CREATE INDEX IF NOT EXISTS idx_templates_task_deps_project ON public.templates_project_task_dependencies_table ("projectGUID");
CREATE INDEX IF NOT EXISTS idx_templates_task_deps_rowJSON ON public.templates_project_task_dependencies_table USING GIN ("rowJSON" jsonb_path_ops);

-- -------------------------------------------------------------------------------------
-- templates_project_task_dependency_closure_table - every (ancestor ~> descendant) pair of the
-- DAG with the SHORTEST path length. Written ONLY by the triggers below (clients: read).
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates_project_task_dependency_closure_table (
  "ancestorGUID"   UUID  NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "descendantGUID" UUID  NOT NULL REFERENCES public.templates_project_task_table("rowGUID") ON DELETE CASCADE,
  "projectGUID"    UUID  NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "depthLevel"     INT   NOT NULL,
  "rowJSON"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY ("ancestorGUID", "descendantGUID"),
  CONSTRAINT templates_project_task_dep_closure_self_chk CHECK ("ancestorGUID" <> "descendantGUID")
);
ALTER TABLE public.templates_project_task_dependency_closure_table ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_templates_task_dep_closure_descendant ON public.templates_project_task_dependency_closure_table ("descendantGUID");
CREATE INDEX IF NOT EXISTS idx_templates_task_dep_closure_project ON public.templates_project_task_dependency_closure_table ("projectGUID");

-- ownership helper (used by RLS policies and RPCs)
CREATE OR REPLACE FUNCTION public.pm_owns_template(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM public.templates_project_table p WHERE p."rowGUID" = p_project AND p."rowOwnerGUID" = auth.uid());
$$;

DROP TRIGGER IF EXISTS trg_templates_project_table_touch ON public.templates_project_table;
CREATE TRIGGER trg_templates_project_table_touch BEFORE UPDATE ON public.templates_project_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS trg_templates_project_task_table_touch ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_project_task_table_touch BEFORE UPDATE ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- ---- TREE integrity (ltree) -----------------------------------------------------------
-- parent must exist inside the same project; a row cannot be moved under itself
CREATE OR REPLACE FUNCTION public.pm_template_task_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
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

  -- rows re-pathed by the after-move trigger (trigger depth > 1) are validated by the outer move
  IF nlevel(NEW."treePath") > 2 AND pg_trigger_depth() = 1 THEN
    v_parent := subpath(NEW."treePath", 0, nlevel(NEW."treePath") - 1);
    IF NOT EXISTS (
      SELECT 1 FROM public.templates_project_task_table p
       WHERE p."treePath" = v_parent AND p."projectGUID" = NEW."projectGUID"
    ) THEN
      RAISE EXCEPTION 'pm_gantt: parent % does not exist in project %', v_parent, NEW."projectGUID"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_templates_project_task_before_write ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_project_task_before_write
  BEFORE INSERT OR UPDATE OF "treePath", "projectGUID" ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_before_write();

-- moving a stage rewrites the paths of its whole subtree (one statement)
CREATE OR REPLACE FUNCTION public.pm_template_task_after_move() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND NEW."treePath" IS DISTINCT FROM OLD."treePath" THEN
    UPDATE public.templates_project_task_table
       SET "treePath" = NEW."treePath" || subpath("treePath", nlevel(OLD."treePath"))
     WHERE "projectGUID" = NEW."projectGUID"
       AND "treePath" <@ OLD."treePath"
       AND "rowGUID" <> NEW."rowGUID";
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_templates_project_task_after_move ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_project_task_after_move
  AFTER UPDATE OF "treePath" ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_after_move();

-- deleting a stage deletes its subtree (edges + closure follow through FK cascades)
CREATE OR REPLACE FUNCTION public.pm_template_task_after_delete_subtree() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  DELETE FROM public.templates_project_task_table
   WHERE "projectGUID" = OLD."projectGUID"
     AND "treePath" <@ OLD."treePath"
     AND "rowGUID" <> OLD."rowGUID";
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_templates_project_task_after_delete_subtree ON public.templates_project_task_table;
CREATE TRIGGER trg_templates_project_task_after_delete_subtree
  AFTER DELETE ON public.templates_project_task_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_after_delete_subtree();

-- ---- DAG integrity + closure maintenance ----------------------------------------------
-- Tree-aware reachability: does succ already (transitively) come before pred? A link on a
-- stage applies to every row inside it, so a walk may continue through the links of a row's
-- ancestors and descendants ("A in Stage S, S after B, B after A" is a cycle too).
CREATE OR REPLACE FUNCTION public.pm_template_dependency_creates_cycle(p_pred uuid, p_succ uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH RECURSIVE
  pred AS (SELECT "treePath" AS path FROM public.templates_project_task_table WHERE "rowGUID" = p_pred),
  reach(guid) AS (            -- uuid only: ltree is not hashable for a recursive UNION
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_succ public.templates_project_task_table%ROWTYPE;
  v_pred public.templates_project_task_table%ROWTYPE;
BEGIN
  SELECT * INTO v_succ FROM public.templates_project_task_table WHERE "rowGUID" = NEW."rowGUID";
  SELECT * INTO v_pred FROM public.templates_project_task_table WHERE "rowGUID" = NEW."rowDependsOnGUID";
  IF v_succ."rowGUID" IS NULL OR v_pred."rowGUID" IS NULL THEN
    RAISE EXCEPTION 'pm_gantt: dependency references a missing task' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_succ."projectGUID" <> v_pred."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependencies must stay inside one project' USING ERRCODE = 'check_violation';
  END IF;
  NEW."projectGUID" := v_succ."projectGUID";

  IF v_succ."treePath" @> v_pred."treePath" OR v_succ."treePath" <@ v_pred."treePath" THEN
    RAISE EXCEPTION 'pm_gantt: a row cannot depend on its own stage or sub-rows' USING ERRCODE = 'check_violation';
  END IF;

  -- serialize DAG writes per project so two concurrent inserts cannot close a cycle
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."projectGUID"::text, 0));

  IF public.pm_template_dependency_creates_cycle(NEW."rowDependsOnGUID", NEW."rowGUID") THEN
    RAISE EXCEPTION 'pm_gantt: dependency % -> % would create a cycle', NEW."rowDependsOnGUID", NEW."rowGUID"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_template_task_dependency_before_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowGUID" <> OLD."rowGUID" OR NEW."rowDependsOnGUID" <> OLD."rowDependsOnGUID"
     OR NEW."projectGUID" <> OLD."projectGUID" THEN
    RAISE EXCEPTION 'pm_gantt: dependency endpoints are immutable (delete + insert instead)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- incremental closure insert: (ancestors of pred + pred) x (succ + descendants of succ)
CREATE OR REPLACE FUNCTION public.pm_template_task_dependency_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  INSERT INTO public.templates_project_task_dependency_closure_table ("ancestorGUID", "descendantGUID", "projectGUID", "depthLevel", "rowJSON")
  SELECT a.anc, d.dsc, NEW."projectGUID", MIN(a.depth + d.depth + 1), '{}'::jsonb
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
   GROUP BY a.anc, d.dsc
  ON CONFLICT ("ancestorGUID", "descendantGUID") DO UPDATE
    SET "depthLevel" = LEAST(public.templates_project_task_dependency_closure_table."depthLevel", EXCLUDED."depthLevel");
  RETURN NULL;
END;
$$;

-- a DAG can have several paths between two nodes, so a delete is not undone locally:
-- the closure of THAT project is rebuilt (small at PM scale, always correct)
CREATE OR REPLACE FUNCTION public.pm_template_rebuild_dependency_closure(p_project uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  -- skip when the whole project is being deleted (FK cascade already cleans up)
  IF EXISTS (SELECT 1 FROM public.templates_project_table WHERE "rowGUID" = OLD."projectGUID") THEN
    PERFORM public.pm_template_rebuild_dependency_closure(OLD."projectGUID");
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_template_task_dependency_before_insert ON public.templates_project_task_dependencies_table;
DROP TRIGGER IF EXISTS trg_pm_template_task_dependency_before_update ON public.templates_project_task_dependencies_table;
DROP TRIGGER IF EXISTS trg_pm_template_task_dependency_after_insert ON public.templates_project_task_dependencies_table;
DROP TRIGGER IF EXISTS trg_pm_template_task_dependency_after_delete ON public.templates_project_task_dependencies_table;
CREATE TRIGGER trg_pm_template_task_dependency_before_insert
  BEFORE INSERT ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_before_insert();
CREATE TRIGGER trg_pm_template_task_dependency_before_update
  BEFORE UPDATE ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_before_update();
CREATE TRIGGER trg_pm_template_task_dependency_after_insert
  AFTER INSERT ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_after_insert();
CREATE TRIGGER trg_pm_template_task_dependency_after_delete
  AFTER DELETE ON public.templates_project_task_dependencies_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_template_task_dependency_after_delete();

-- ---- Row Level Security: everything belongs to auth.uid() ------------------------------
--   table                                       SELECT  INSERT  UPDATE  DELETE
--   templates_project_table                           owner   owner   owner   owner
--   templates_project_task_table                      owner   owner   owner   owner
--   templates_project_task_dependencies_table         owner   owner   owner*  owner  (*linkType/lagDays/rowJSON)
--   templates_project_task_dependency_closure_table   owner   -       -       -      (triggers only)
ALTER TABLE public.templates_project_table                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_project_task_table                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_project_task_dependencies_table       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_project_task_dependency_closure_table ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.templates_project_table                         FROM anon, authenticated;
REVOKE ALL ON public.templates_project_task_table                    FROM anon, authenticated;
REVOKE ALL ON public.templates_project_task_dependencies_table       FROM anon, authenticated;
REVOKE ALL ON public.templates_project_task_dependency_closure_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_table                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_task_table              TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.templates_project_task_dependencies_table TO authenticated;
GRANT UPDATE ("linkType", "lagDays", "rowJSON") ON public.templates_project_task_dependencies_table TO authenticated;
GRANT SELECT                         ON public.templates_project_task_dependency_closure_table TO authenticated;

DROP POLICY IF EXISTS templates_project_table_select ON public.templates_project_table;
DROP POLICY IF EXISTS templates_project_table_insert ON public.templates_project_table;
DROP POLICY IF EXISTS templates_project_table_update ON public.templates_project_table;
DROP POLICY IF EXISTS templates_project_table_delete ON public.templates_project_table;
CREATE POLICY templates_project_table_select ON public.templates_project_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_table_insert ON public.templates_project_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_table_update ON public.templates_project_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_table_delete ON public.templates_project_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

DROP POLICY IF EXISTS templates_project_task_select ON public.templates_project_task_table;
DROP POLICY IF EXISTS templates_project_task_insert ON public.templates_project_task_table;
DROP POLICY IF EXISTS templates_project_task_update ON public.templates_project_task_table;
DROP POLICY IF EXISTS templates_project_task_delete ON public.templates_project_task_table;
CREATE POLICY templates_project_task_select ON public.templates_project_task_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_task_insert ON public.templates_project_task_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_template("projectGUID"));
CREATE POLICY templates_project_task_update ON public.templates_project_task_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid())
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_template("projectGUID"));
CREATE POLICY templates_project_task_delete ON public.templates_project_task_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

DROP POLICY IF EXISTS templates_project_task_dep_select ON public.templates_project_task_dependencies_table;
DROP POLICY IF EXISTS templates_project_task_dep_insert ON public.templates_project_task_dependencies_table;
DROP POLICY IF EXISTS templates_project_task_dep_update ON public.templates_project_task_dependencies_table;
DROP POLICY IF EXISTS templates_project_task_dep_delete ON public.templates_project_task_dependencies_table;
CREATE POLICY templates_project_task_dep_select ON public.templates_project_task_dependencies_table FOR SELECT TO authenticated
  USING ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_task_dep_insert ON public.templates_project_task_dependencies_table FOR INSERT TO authenticated
  WITH CHECK ("rowOwnerGUID" = auth.uid() AND public.pm_owns_template("projectGUID"));
CREATE POLICY templates_project_task_dep_update ON public.templates_project_task_dependencies_table FOR UPDATE TO authenticated
  USING ("rowOwnerGUID" = auth.uid()) WITH CHECK ("rowOwnerGUID" = auth.uid());
CREATE POLICY templates_project_task_dep_delete ON public.templates_project_task_dependencies_table FOR DELETE TO authenticated
  USING ("rowOwnerGUID" = auth.uid());

DROP POLICY IF EXISTS templates_project_task_dep_closure_select ON public.templates_project_task_dependency_closure_table;
CREATE POLICY templates_project_task_dep_closure_select ON public.templates_project_task_dependency_closure_table FOR SELECT TO authenticated
  USING (public.pm_owns_template("projectGUID"));

REVOKE ALL ON FUNCTION public.pm_template_rebuild_dependency_closure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_template_dependency_creates_cycle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_owns_template(uuid) TO authenticated;
-- -------------------------------------------------------------------------------------
-- templates_project_kanban_stage_table - Kanban columns of a template (copied to / from
-- project_kanban_stage_table). Task Kanban states are NOT part of a template.
-- -------------------------------------------------------------------------------------
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
CREATE INDEX IF NOT EXISTS idx_templates_project_kanban_stage_project ON public.templates_project_kanban_stage_table ("rowOwnerGUID", "orderInList");
DROP TRIGGER IF EXISTS trg_templates_project_kanban_stage_touch ON public.templates_project_kanban_stage_table;
CREATE TRIGGER trg_templates_project_kanban_stage_touch BEFORE UPDATE ON public.templates_project_kanban_stage_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.templates_project_kanban_stage_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.templates_project_kanban_stage_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_kanban_stage_table TO authenticated;
DROP POLICY IF EXISTS templates_project_kanban_stage_all ON public.templates_project_kanban_stage_table;
CREATE POLICY templates_project_kanban_stage_all ON public.templates_project_kanban_stage_table FOR ALL TO authenticated
  USING (public.pm_owns_template("rowOwnerGUID")) WITH CHECK (public.pm_owns_template("rowOwnerGUID"));

-- -------------------------------------------------------------------------------------
-- templates_project_user_settings_table - per user Gantt settings of a template
--   rowOwnerGUID = template, rowParentGUID = user; upsert on ("rowOwnerGUID","rowParentGUID")
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates_project_user_settings_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL REFERENCES public.templates_project_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID" UUID        NOT NULL,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT templates_project_user_settings_unique UNIQUE ("rowOwnerGUID", "rowParentGUID")
);
CREATE INDEX IF NOT EXISTS idx_templates_project_user_settings_user ON public.templates_project_user_settings_table ("rowParentGUID");
DROP TRIGGER IF EXISTS trg_templates_project_user_settings_touch ON public.templates_project_user_settings_table;
CREATE TRIGGER trg_templates_project_user_settings_touch BEFORE UPDATE ON public.templates_project_user_settings_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

ALTER TABLE public.templates_project_user_settings_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.templates_project_user_settings_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_project_user_settings_table TO authenticated;
DROP POLICY IF EXISTS templates_project_user_settings_select ON public.templates_project_user_settings_table;
DROP POLICY IF EXISTS templates_project_user_settings_insert ON public.templates_project_user_settings_table;
DROP POLICY IF EXISTS templates_project_user_settings_update ON public.templates_project_user_settings_table;
DROP POLICY IF EXISTS templates_project_user_settings_delete ON public.templates_project_user_settings_table;
CREATE POLICY templates_project_user_settings_select ON public.templates_project_user_settings_table FOR SELECT TO authenticated
  USING ("rowParentGUID" = auth.uid());
CREATE POLICY templates_project_user_settings_insert ON public.templates_project_user_settings_table FOR INSERT TO authenticated
  WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_template("rowOwnerGUID"));
CREATE POLICY templates_project_user_settings_update ON public.templates_project_user_settings_table FOR UPDATE TO authenticated
  USING ("rowParentGUID" = auth.uid()) WITH CHECK ("rowParentGUID" = auth.uid() AND public.pm_owns_template("rowOwnerGUID"));
CREATE POLICY templates_project_user_settings_delete ON public.templates_project_user_settings_table FOR DELETE TO authenticated
  USING ("rowParentGUID" = auth.uid());

-- =====================================================================================
-- 6. Data migrations of older databases (no-ops on a fresh database)
-- =====================================================================================
-- task colors used to be rowJSON.color -> rowJSON.taskColor   (update_pm_tables_rowJSON.sql)
UPDATE public.project_task_table
   SET "rowJSON" = ("rowJSON" - 'color') || jsonb_build_object('taskColor', "rowJSON"->'color')
 WHERE "rowJSON" ? 'color' AND NOT ("rowJSON" ? 'taskColor');

-- old top-level view keys -> rowJSON.uxuiSettings               (update_pm_tables_projectProgress.sql)
UPDATE public.project_table
   SET "rowJSON" = ("rowJSON" - 'showCriticalPath' - 'ganttArrowsForm' - 'showTaskProgressOnGantt')
       || jsonb_build_object('uxuiSettings',
            COALESCE("rowJSON"->'uxuiSettings', '{}'::jsonb)
            || jsonb_strip_nulls(jsonb_build_object(
                 'showCriticalPath', "rowJSON"->'showCriticalPath',
                 'ganttArrowsForm', "rowJSON"->'ganttArrowsForm',
                 'showTaskProgressOnGantt', "rowJSON"->'showTaskProgressOnGantt')))
 WHERE "rowJSON" ?| ARRAY['showCriticalPath', 'ganttArrowsForm', 'showTaskProgressOnGantt'];

-- project_table.rowJSON.uxuiSettings -> settings row of the owner (update_pm_tables_userSettings.sql)
INSERT INTO public.project_user_settings_table ("rowOwnerGUID", "rowParentGUID", "rowJSON")
SELECT p."rowGUID", p."rowOwnerGUID", jsonb_build_object('uxuiSettings', p."rowJSON"->'uxuiSettings')
  FROM public.project_table p
 WHERE jsonb_typeof(p."rowJSON"->'uxuiSettings') = 'object'
ON CONFLICT ("rowOwnerGUID", "rowParentGUID") DO NOTHING;

-- closures + progress of every existing project / template (cheap; keeps them consistent)
SELECT public.pm_rebuild_dependency_closure("rowGUID") FROM public.project_table;
SELECT public.pm_template_rebuild_dependency_closure("rowGUID") FROM public.templates_project_table;
SELECT public.pm_recalc_project_progress("rowGUID") FROM public.project_table;

-- =====================================================================================
-- 7. Realtime: REPLICA IDENTITY FULL + supabase_realtime publication (auto refresh in every
--    browser). Closure / template tables are not published (the client refetches them).
-- =====================================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- generic (redux-saga realtime)
    'googleDriveCommandTable', 'raciMemberTable', 'themeStoreTable', 'mediaPostTable', 'mediaPostTableArchive',
    'userTable', 'userAuthTable', 'aiSessionTable',
    'dtcTaskFinishedTable', 'dtcCatalogExecutiveTable', 'dtcTaskRegisteredTable',
    'dtcTaskWaitingTable', 'dtcTaskProgressTable', 'dtcFreeExecutiveTable',
    -- catalogs
    'countryTable', 'currencyTable', 'currencyExchangeRateTable', 'organizationTable',
    'departamentTable', 'personTable', 'partnerTable', 'contractTable',
    -- PM (React Query invalidation: kit8/pm/crud/realtime, kit8/pm/crud/kanban)
    'project_table', 'project_task_table', 'project_task_dependencies_table', 'project_user_settings_table',
    'kanban_stage_table', 'project_kanban_stage_table', 'project_task_kanban_state_table'
  ];
  v_all boolean;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;

  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
    RETURN;
  END IF;
  IF v_all THEN
    RETURN;  -- FOR ALL TABLES publication already covers everything
  END IF;
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- PostgREST: pick up the new tables / functions immediately
NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
