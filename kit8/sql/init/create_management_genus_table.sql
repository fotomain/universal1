-- =====================================================================================
-- UNIVERSAL1 - MANAGEMENT GENUS: kit8/sql/init/create_management_genus_table.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_management_genus_table.sql.)
--
-- managementGenusTable: the management classes of resources and money, two levels in one table:
--   FOLDERS (level 1, rowParentGUID 'empty')   costsGenus · revenuesGenus · paymentsGenus
--   ITEMS   (level 2, rowParentGUID = folder)  costsGenus > timeGenus, materialGenus, expenseGenus
--                                              revenuesGenus > revenueGenus
--                                              paymentsGenus > inboundPaymentGenus, outboundPaymentGenus
-- Only the items are genus a role type can have; the folders group them.
-- resourceRoleTypeTable.rowJSON.managementGenus holds the rowGUID of the genus of a role type (Human Resources -> timeGenus).
--
-- defTable.md pattern: "rowGUID" (TEXT = the code) · "rowOwnerGUID" ('managementGenusCatalog') · "rowParentGUID" (parent genus | 'empty') ·
-- "orderInList" · "rowJSON" { title, description } · created_at / updated_at.
-- Screen: Management genus (kit8/catalog/management/genus/ManagementGenusDashboard.tsx, route /catalog/management/genus/list, read-only by default).
-- IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS, seed ON CONFLICT DO NOTHING. Independent of the product / role tables.
-- Rows: managementGenusTable 9 (3 folders + 6 items)
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

CREATE TABLE IF NOT EXISTS public."managementGenusTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'managementGenusCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_managementGenusTable_owner_order" ON public."managementGenusTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_managementGenusTable_parent" ON public."managementGenusTable" ("rowParentGUID");
SELECT public.kit8_setup_def_table('managementGenusTable');

-- security: full CRUD for signed-in users (as partnerTable / personTable)
DO $$
DECLARE
  t text := 'managementGenusTable';
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

-- managementGenusTable: folders (parent empty) and items (parent = folder)
INSERT INTO public."managementGenusTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('costsGenus', 'managementGenusCatalog', 'empty', 1000, '{"title": "Costs", "description": "Folder: what the work costs the company - time, material and expense."}'::jsonb),
  ('timeGenus', 'managementGenusCatalog', 'costsGenus', 2000, '{"title": "Time", "description": "Working time of people (human resources), booked and costed by the hour."}'::jsonb),
  ('materialGenus', 'managementGenusCatalog', 'costsGenus', 3000, '{"title": "Material", "description": "Materials and supplies consumed by the work."}'::jsonb),
  ('expenseGenus', 'managementGenusCatalog', 'costsGenus', 4000, '{"title": "Expense", "description": "Other expenses of the work: logistics, transport, advertisement, services."}'::jsonb),
  ('revenuesGenus', 'managementGenusCatalog', 'empty', 5000, '{"title": "Revenues", "description": "Folder: what the customers are invoiced."}'::jsonb),
  ('revenueGenus', 'managementGenusCatalog', 'revenuesGenus', 6000, '{"title": "Revenue", "description": "What the customers are invoiced for the work done."}'::jsonb),
  ('paymentsGenus', 'managementGenusCatalog', 'empty', 7000, '{"title": "Payments", "description": "Folder: money that moves - received from customers, paid to suppliers."}'::jsonb),
  ('inboundPaymentGenus', 'managementGenusCatalog', 'paymentsGenus', 8000, '{"title": "Inbound payment", "description": "Money received (customer payments)."}'::jsonb),
  ('outboundPaymentGenus', 'managementGenusCatalog', 'paymentsGenus', 9000, '{"title": "Outbound payment", "description": "Money paid out (suppliers, salaries, taxes)."}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- an earlier version of this script had revenueGenus on the top level: it is an item of the folder revenuesGenus
UPDATE public."managementGenusTable" SET "rowParentGUID" = 'revenuesGenus' WHERE "rowGUID" = 'revenueGenus' AND "rowParentGUID" = 'empty';

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
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'managementGenusTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."managementGenusTable";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT "rowGUID", "rowParentGUID", "rowJSON"->>'title' FROM public."managementGenusTable" ORDER BY "orderInList";
