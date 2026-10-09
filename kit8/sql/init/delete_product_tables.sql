-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: kit8/sql/init/delete_product_tables.sql
-- Drops every table create_product_tables.sql creates (data included!). Shared helpers
-- (kit8_setup_def_table, kit8_touch_updated_at) are kept: other tables use them.
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['valueAddedTaxTable', 'measureUnitForInventoryTable', 'descriptorGenusTable', 'descriptorValueTable', 'descriptorModeTable', 'descriptorDestinationTable', 'descriptorPlanTable', 'productTypeTable', 'productFolderTable', 'productTable', 'propertyValueTable', 'variantTable', 'variantValueTable', 'productPackagingTable', 'productSeriesTable', 'productBarcodeTable', 'priceTypeTable', 'productPriceTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
