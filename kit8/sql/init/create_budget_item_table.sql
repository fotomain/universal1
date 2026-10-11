-- =====================================================================================
-- UNIVERSAL1 - BUDGET ITEMS: kit8/sql/init/create_budget_item_table.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_budget_item_table.sql.)
--
-- budgetItemTable: the budget items (articles) a task line is budgeted as, two levels in one table - the shape of managementGenusTable:
--   FOLDERS (level 1, rowParentGUID 'empty')   costsBudgetFolder · revenuesBudgetFolder · paymentsBudgetFolder
--   ITEMS   (level 2, rowParentGUID = folder)  costsBudgetFolder > timeBudgetItem, materialBudgetItem, expenseBudgetItem
--                                              revenuesBudgetFolder > revenueBudgetItem
--                                              paymentsBudgetFolder > inboundPaymentBudgetItem, outboundPaymentBudgetItem
-- budgetItemTable."rowJSON"->>'managementGenusItem' is OBLIGATORY on an item: the rowGUID of a LEVEL 2 row of managementGenusTable
-- (timeGenus, materialGenus, ...). Enforced here by a CHECK (set) and a trigger (it exists and is not a genus folder). Folders have no genus.
-- The default rows are GENERATED from the managementGenusTable rows (INSERT ... SELECT): one folder per genus folder, one item per genus item
-- (...Genus -> ...BudgetFolder / ...BudgetItem), so the catalog is usable at once; the user adds more items under the same genus.
--
-- defTable.md pattern: "rowGUID" (TEXT = the code) · "rowOwnerGUID" ('budgetItemCatalog') · "rowParentGUID" (folder | 'empty') ·
-- "orderInList" · "rowJSON" { title, description, managementGenusItem } · created_at / updated_at.
-- Screen: Budget Items (kit8/catalog/budget/item/PMBudgetItemCRUD.tsx, route /budget/item/list).
-- NEEDS create_management_genus_table.sql (stops with a message when it was not run).
-- IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS, seed ON CONFLICT DO NOTHING.
-- Rows: budgetItemTable 9 (3 folders + 6 items)
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."managementGenusTable"') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/create_management_genus_table.sql first (budgetItemTable points at managementGenusTable)';
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

CREATE TABLE IF NOT EXISTS public."budgetItemTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'budgetItemCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_budgetItemTable_owner_order" ON public."budgetItemTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_budgetItemTable_parent" ON public."budgetItemTable" ("rowParentGUID");
CREATE INDEX IF NOT EXISTS "idx_budgetItemTable_genus" ON public."budgetItemTable" ((("rowJSON"->>'managementGenusItem')));
SELECT public.kit8_setup_def_table('budgetItemTable');

-- obligatory managementGenusItem on an item (a folder = rowParentGUID 'empty' has none)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgetItemTable_genus_chk' AND conrelid = 'public."budgetItemTable"'::regclass) THEN
    ALTER TABLE public."budgetItemTable"
      ADD CONSTRAINT "budgetItemTable_genus_chk"
      CHECK ("rowParentGUID" = 'empty' OR coalesce("rowJSON"->>'managementGenusItem', '') NOT IN ('', 'empty'));
  END IF;
END $$;

-- ... and it must be a LEVEL 2 row of managementGenusTable (a JSON key cannot be a foreign key)
CREATE OR REPLACE FUNCTION public.kit8_budget_item_check_genus() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rowParentGUID" <> 'empty' AND NOT EXISTS (
    SELECT 1 FROM public."managementGenusTable" g
    WHERE g."rowGUID" = NEW."rowJSON"->>'managementGenusItem' AND g."rowParentGUID" <> 'empty'
  ) THEN
    RAISE EXCEPTION 'budgetItemTable %: managementGenusItem "%" is not an item of managementGenusTable', NEW."rowGUID", NEW."rowJSON"->>'managementGenusItem';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_budgetItemTable_genus" ON public."budgetItemTable";
CREATE TRIGGER "trg_budgetItemTable_genus" BEFORE INSERT OR UPDATE ON public."budgetItemTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_budget_item_check_genus();

-- security: full CRUD for signed-in users (as managementGenusTable)
DO $$
DECLARE
  t text := 'budgetItemTable';
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

-- default rows from managementGenusTable: folders first (a genus folder -> a budget folder), then the items (a genus item -> a budget item of that genus)
INSERT INTO public."budgetItemTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT regexp_replace(g."rowGUID", 'Genus$', 'BudgetFolder'), 'budgetItemCatalog', 'empty', g."orderInList",
       jsonb_build_object('title', g."rowJSON"->>'title', 'description', g."rowJSON"->>'description')
FROM public."managementGenusTable" g
WHERE g."rowParentGUID" = 'empty'
ON CONFLICT ("rowGUID") DO NOTHING;

INSERT INTO public."budgetItemTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT regexp_replace(g."rowGUID", 'Genus$', 'BudgetItem'), 'budgetItemCatalog', regexp_replace(g."rowParentGUID", 'Genus$', 'BudgetFolder'), g."orderInList",
       jsonb_build_object('title', g."rowJSON"->>'title', 'description', 'Budget item: ' || coalesce(g."rowJSON"->>'description', g."rowJSON"->>'title'), 'managementGenusItem', g."rowGUID")
FROM public."managementGenusTable" g
WHERE g."rowParentGUID" <> 'empty'
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
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgetItemTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."budgetItemTable";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT "rowGUID", "rowParentGUID", "rowJSON"->>'title', "rowJSON"->>'managementGenusItem' FROM public."budgetItemTable" ORDER BY "orderInList";
--   every item has a genus:  SELECT count(*) FROM public."budgetItemTable" WHERE "rowParentGUID" <> 'empty' AND "rowJSON"->>'managementGenusItem' IS NULL;  -> 0
