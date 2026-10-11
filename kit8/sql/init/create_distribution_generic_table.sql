-- =====================================================================================
-- UNIVERSAL1 - DISTRIBUTION: kit8/sql/init/create_distribution_generic_table.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_distribution_generic_table.sql.)
--
-- distributionGenericTable: HOW a budget is spread over the days of a task line (the minimum period is one day), two levels in one table:
--   GROUPS (level 1, rowParentGUID 'empty')   simpleDistributionGroup · curvesDistributionGroup · customDistributionGroup
--   ITEMS  (level 2, rowParentGUID = group)   simple: frontLoaded, backLoaded, uniform
--                                             curves: normal (peak, spread), logarithmicFront / logarithmicBack (steepness), epidemic (peak, spread)
--                                             custom: manual (the value of every period, typed by the user - the only editable one)
-- Only the items are distributions a task line can have; the groups gather them.
-- task_line_table.rowJSON.distributionForBudgetTaskLine holds the rowGUID of the distribution of a line.
--
-- defTable.md pattern: "rowGUID" (TEXT = the code) · "rowOwnerGUID" ('distributionGenericCatalog') · "rowParentGUID" (group | 'empty') ·
-- "orderInList" · "rowJSON" { title, description, shape, params: [{ key, title, default }], editable } · created_at / updated_at.
-- Screen: Distribution (kit8/catalog/distribution/DistributionTypeCRUD.tsx, route /catalog/distribution/list, read-only by default).
-- IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS, seed ON CONFLICT DO NOTHING. Independent of the other tables.
-- Rows: distributionGenericTable 11 (3 groups + 8 distributions)
-- =====================================================================================

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

CREATE TABLE IF NOT EXISTS public."distributionGenericTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'distributionGenericCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_distributionGenericTable_owner_order" ON public."distributionGenericTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_distributionGenericTable_parent" ON public."distributionGenericTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('distributionGenericTable');

-- security: full CRUD for signed-in users (as partnerTable / personTable)
DO $$
DECLARE
  t text := 'distributionGenericTable';
BEGIN
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
END $$;

-- distributionGenericTable: groups (parent empty) and distributions (parent = group)
INSERT INTO public."distributionGenericTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('simpleDistributionGroup', 'distributionGenericCatalog', 'empty', 1000, '{"title": "Simple", "description": "Group: shapes without parameters."}'::jsonb),
  ('curvesDistributionGroup', 'distributionGenericCatalog', 'empty', 5000, '{"title": "Curves", "description": "Group: smooth curves with parameters (peak position, spread, steepness)."}'::jsonb),
  ('customDistributionGroup', 'distributionGenericCatalog', 'empty', 10000, '{"title": "Custom", "description": "Group: the user types the value of every period."}'::jsonb),
  ('frontLoadedDistribution', 'distributionGenericCatalog', 'simpleDistributionGroup', 2000, '{"title": "Front-loaded (start)", "description": "Spends the budget early: the first days get the biggest share, the last day almost nothing.", "shape": "Heaviest at the start, falling to zero at the end.", "params": [], "editable": false}'::jsonb),
  ('backLoadedDistribution', 'distributionGenericCatalog', 'simpleDistributionGroup', 3000, '{"title": "Back-loaded (end)", "description": "Spends the budget late: the first days get almost nothing, the last days the biggest share.", "shape": "Zero at the start, heaviest at the end.", "params": [], "editable": false}'::jsonb),
  ('uniformDistribution', 'distributionGenericCatalog', 'simpleDistributionGroup', 4000, '{"title": "Uniform (even)", "description": "The same share every day.", "shape": "An equal share in every period.", "params": [], "editable": false}'::jsonb),
  ('normalDistribution', 'distributionGenericCatalog', 'curvesDistributionGroup', 6000, '{"title": "Normal (Gaussian)", "description": "Few at the start and the end, most around the peak. Peak position and spread are a share of the timeline (0..1).", "shape": "A symmetric bell; the peak is in the middle of the timeline by default.", "params": [{"key": "peak", "title": "Peak position", "default": 0.5}, {"key": "spread", "title": "Spread", "default": 0.2}], "editable": false}'::jsonb),
  ('logarithmicFrontDistribution', 'distributionGenericCatalog', 'curvesDistributionGroup', 7000, '{"title": "Logarithmic, front", "description": "Most of the budget in the first days, then less and less. Steepness: the bigger, the faster the start.", "shape": "A fast start that flattens, with a long thin tail.", "params": [{"key": "steepness", "title": "Steepness", "default": 9}], "editable": false}'::jsonb),
  ('logarithmicBackDistribution', 'distributionGenericCatalog', 'curvesDistributionGroup', 8000, '{"title": "Logarithmic, back", "description": "Little at the start, most of the budget in the last days. Steepness: the bigger, the sharper the rise.", "shape": "The mirror of Logarithmic, front: a thin early share and a sharp rise toward the end.", "params": [{"key": "steepness", "title": "Steepness", "default": 9}], "editable": false}'::jsonb),
  ('epidemicDistribution', 'distributionGenericCatalog', 'curvesDistributionGroup', 9000, '{"title": "Epidemic (wave)", "description": "A wave: slow start, steep rise to the peak, long decline. Peak position and spread are a share of the timeline (0..1).", "shape": "A slow start, a steep rise to a peak and a long decline (right-skewed).", "params": [{"key": "peak", "title": "Peak position", "default": 0.35}, {"key": "spread", "title": "Spread", "default": 0.2}], "editable": false}'::jsonb),
  ('manualDistribution', 'distributionGenericCatalog', 'customDistributionGroup', 11000, '{"title": "Manual", "description": "The only editable one: the share of every period is typed by the user.", "shape": "The user enters the value for each period.", "params": [], "editable": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- realtime: the table in the supabase_realtime publication (auto refresh in every browser)
DO $$
DECLARE
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
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'distributionGenericTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."distributionGenericTable";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT "rowGUID", "rowParentGUID", "rowJSON"->>'title' FROM public."distributionGenericTable" ORDER BY "orderInList";
