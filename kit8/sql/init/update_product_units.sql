-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: kit8/sql/init/update_product_units.sql
-- A product has exactly ONE unit for inventory and ONE default unit, both chosen from the ONE units catalog (measureUnitTable):
--   productTable.rowJSON.measureUnitForInventory  the unit the product is counted and stocked in
--   productTable.rowJSON.measureUnitDefault       the unit it is offered, ordered and reported in
-- Migrates a database made by an earlier version of create_product_tables.sql (run this BEFORE running the new create script):
--   1. a database where the unit catalog was renamed to measureUnitForInventoryTable is renamed back to measureUnitTable
--      (rows, GUIDs, policies, indexes kept; rowOwnerGUID 'measureUnitForInventoryCatalog' -> 'measureUnitCatalog')
--   2. measureUnitDefaultTable (a second catalog that existed for a short time, only seed rows) is dropped
--   3. every product: the old rowJSON.unit / rowJSON.unitDefault become measureUnitForInventory / measureUnitDefault;
--      a missing value is filled with the unit of the product type (baseUnit), else 'unit_pcs'; the default unit starts equal to the
--      unit for inventory (change it per product in the dashboard)
-- Idempotent: a second run changes nothing. A NEW database needs only create_product_tables.sql.
-- =====================================================================================
DO $$
DECLARE
  pol record;
BEGIN
  -- 1. rename back
  IF to_regclass('public."measureUnitForInventoryTable"') IS NOT NULL AND to_regclass('public."measureUnitTable"') IS NULL THEN
    ALTER TABLE public."measureUnitForInventoryTable" RENAME TO "measureUnitTable";
    ALTER INDEX IF EXISTS public."measureUnitForInventoryTable_pkey" RENAME TO "measureUnitTable_pkey";
    ALTER INDEX IF EXISTS public."idx_measureUnitForInventoryTable_owner_order" RENAME TO "idx_measureUnitTable_owner_order";
    ALTER INDEX IF EXISTS public."idx_measureUnitForInventoryTable_parent" RENAME TO "idx_measureUnitTable_parent";
    ALTER INDEX IF EXISTS public."idx_measureUnitForInventoryTable_rowJSON" RENAME TO "idx_measureUnitTable_rowJSON";
    ALTER INDEX IF EXISTS public."idx_measureUnitForInventoryTable_order" RENAME TO "idx_measureUnitTable_order";
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public."measureUnitTable"'::regclass AND tgname = 'trg_measureUnitForInventoryTable_touch') THEN
      ALTER TRIGGER "trg_measureUnitForInventoryTable_touch" ON public."measureUnitTable" RENAME TO "trg_measureUnitTable_touch";
    END IF;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'measureUnitTable' AND policyname LIKE 'measureUnitForInventoryTable\_%' LOOP
      EXECUTE format('ALTER POLICY %I ON public."measureUnitTable" RENAME TO %I', pol.policyname, replace(pol.policyname, 'measureUnitForInventoryTable', 'measureUnitTable'));
    END LOOP;
    ALTER TABLE public."measureUnitTable" ALTER COLUMN "rowOwnerGUID" SET DEFAULT 'measureUnitCatalog';
    UPDATE public."measureUnitTable" SET "rowOwnerGUID" = 'measureUnitCatalog' WHERE "rowOwnerGUID" = 'measureUnitForInventoryCatalog';
    RAISE NOTICE 'measureUnitForInventoryTable renamed back to measureUnitTable';
  END IF;

  -- 2. the second catalog is gone
  IF to_regclass('public."measureUnitDefaultTable"') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'measureUnitDefaultTable')
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public."measureUnitDefaultTable";
    END IF;
    DROP TABLE public."measureUnitDefaultTable" CASCADE;
    RAISE NOTICE 'measureUnitDefaultTable dropped';
  END IF;
END $$;

-- 3. products: unit / unitDefault -> measureUnitForInventory / measureUnitDefault (never leaves a product without both)
UPDATE public."productTable" p
   SET "rowJSON" = (p."rowJSON" - 'unit' - 'unitDefault')
     || jsonb_build_object(
          'measureUnitForInventory', coalesce(nullif(p."rowJSON"->>'measureUnitForInventory', ''), nullif(p."rowJSON"->>'unit', ''),
                                              (SELECT nullif(t."rowJSON"->>'baseUnit', '') FROM public."productTypeTable" t WHERE t."rowGUID" = p."rowOwnerGUID"), 'unit_pcs'),
          'measureUnitDefault',      coalesce(nullif(p."rowJSON"->>'measureUnitDefault', ''), nullif(p."rowJSON"->>'unitDefault', ''),
                                              nullif(p."rowJSON"->>'measureUnitForInventory', ''), nullif(p."rowJSON"->>'unit', ''),
                                              (SELECT nullif(t."rowJSON"->>'baseUnit', '') FROM public."productTypeTable" t WHERE t."rowGUID" = p."rowOwnerGUID"), 'unit_pcs'))
 WHERE coalesce(p."rowJSON"->>'measureUnitForInventory', '') = ''
    OR coalesce(p."rowJSON"->>'measureUnitDefault', '') = ''
    OR p."rowJSON" ? 'unit' OR p."rowJSON" ? 'unitDefault';

NOTIFY pgrst, 'reload schema';

-- Check (expect 0 and 0):
--   SELECT count(*) FROM public."productTable" WHERE coalesce("rowJSON"->>'measureUnitForInventory','') = '' OR coalesce("rowJSON"->>'measureUnitDefault','') = '';
--   SELECT count(*) FROM public."productTable" p WHERE NOT EXISTS (SELECT 1 FROM public."measureUnitTable" u WHERE u."rowGUID" = p."rowJSON"->>'measureUnitForInventory');
