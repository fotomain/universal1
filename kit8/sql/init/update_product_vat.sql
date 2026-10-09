-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: kit8/sql/init/update_product_vat.sql
-- Makes every product 21 % VAT (1C:ERP: Ставка НДС of ВидыНоменклатуры + Номенклатура).
--   1. valueAddedTaxTable gets the row 'vat_21' when it is missing (create_product_tables.sql seeds it too)
--   2. productTypeTable.rowJSON.productVATDefaultRate = 'vat_21' for EVERY product type
--   3. productTable.rowJSON.productVATRate is removed from EVERY product (= the product uses its type default, so
--      all products are 21 % and follow the type when its default changes later)
-- Run it in the Supabase SQL editor AFTER create_product_tables.sql. Idempotent: running it twice changes nothing more.
-- Replace 'vat_21' by another valueAddedTaxTable rowGUID to make everything another rate.
-- =====================================================================================

-- 1. the 21 % row
INSERT INTO public."valueAddedTaxTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('vat_21', 'valueAddedTaxCatalog', 'empty', 1000, '{"vatTableTitle": "21 %", "vatTablePercent": 21}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- 2. every product type: default rate 21 %
UPDATE public."productTypeTable"
   SET "rowJSON" = jsonb_set("rowJSON", '{productVATDefaultRate}', '"vat_21"'::jsonb, true)
 WHERE "rowJSON"->>'productVATDefaultRate' IS DISTINCT FROM 'vat_21';

-- 3. every product: no own rate = the product type default (21 %)
UPDATE public."productTable"
   SET "rowJSON" = "rowJSON" - 'productVATRate'
 WHERE "rowJSON" ? 'productVATRate';

NOTIFY pgrst, 'reload schema';

-- Check (expect: every row 'vat_21' / no own rates):
--   SELECT "rowJSON"->>'productVATDefaultRate' AS rate, count(*) FROM public."productTypeTable" GROUP BY 1;
--   SELECT count(*) AS products_with_own_rate FROM public."productTable" WHERE "rowJSON" ? 'productVATRate';
