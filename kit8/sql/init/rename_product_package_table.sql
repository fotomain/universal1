-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: kit8/sql/init/rename_product_package_table.sql
-- Migration of a database created BEFORE the refactor:  productPackagingTable  ->  productPackageTable
-- (rows, GUIDs, indexes, trigger, policies, the ratio check and the realtime publication are kept).
-- Run it BEFORE the new create_product_tables.sql (which would otherwise create an empty productPackageTable beside the old one).
-- Idempotent; a NEW database needs neither this file nor any rename.
-- =====================================================================================
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public."productPackagingTable"') IS NULL OR to_regclass('public."productPackageTable"') IS NOT NULL THEN
    RAISE NOTICE 'productPackagingTable is not there (or already renamed) - nothing to do';
    RETURN;
  END IF;

  ALTER TABLE public."productPackagingTable" RENAME TO "productPackageTable";
  ALTER INDEX IF EXISTS public."productPackagingTable_pkey" RENAME TO "productPackageTable_pkey";
  ALTER INDEX IF EXISTS public."idx_productPackagingTable_owner_order" RENAME TO "idx_productPackageTable_owner_order";
  ALTER INDEX IF EXISTS public."idx_productPackagingTable_parent" RENAME TO "idx_productPackageTable_parent";
  ALTER INDEX IF EXISTS public."idx_productPackagingTable_rowJSON" RENAME TO "idx_productPackageTable_rowJSON";
  ALTER INDEX IF EXISTS public."idx_productPackagingTable_order" RENAME TO "idx_productPackageTable_order";
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."productPackageTable"'::regclass AND conname = 'productPackagingTable_ratio_chk') THEN
    ALTER TABLE public."productPackageTable" RENAME CONSTRAINT "productPackagingTable_ratio_chk" TO "productPackageTable_ratio_chk";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public."productPackageTable"'::regclass AND tgname = 'trg_productPackagingTable_touch') THEN
    ALTER TRIGGER "trg_productPackagingTable_touch" ON public."productPackageTable" RENAME TO "trg_productPackageTable_touch";
  END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'productPackageTable' AND policyname LIKE 'productPackagingTable\_%' LOOP
    EXECUTE format('ALTER POLICY %I ON public."productPackageTable" RENAME TO %I', pol.policyname, replace(pol.policyname, 'productPackagingTable', 'productPackageTable'));
  END LOOP;
  RAISE NOTICE 'productPackagingTable renamed to productPackageTable';
END $$;

NOTIFY pgrst, 'reload schema';
