-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: kit8/sql/init/update_prices.sql
-- A price is the price of ONE unit of measure: productPriceTable.rowJSON.measureUnit = a rowGUID of measureUnitTable
-- (price = price of 1 pcs / 1 kg / 1 portion ...). This script gives every CURRENT price its unit: price for 1 unit_pcs.
--   1. measureUnitTable gets the row 'unit_pcs' when it is missing (create_product_tables.sql seeds it too)
--   2. every price without a unit (a price made before the unit existed) gets measureUnit = 'unit_pcs' - the amount is not changed,
--      it now means "the price of 1 unit_pcs"; prices that already have a unit are left alone
--   3. the unique index "one price per day" now includes the unit (a pcs price and a kg price may start on the same day)
--      + the check productPriceTable_unit_chk (NOT VALID: only new / changed prices are checked)
-- Run it in the Supabase SQL editor; idempotent. Then run create_prices_for_all_products_and_variants.sql to fill the gaps.
-- To label the prices with another unit, replace 'unit_pcs' below by another measureUnitTable rowGUID.
-- =====================================================================================

-- 1. the unit
INSERT INTO public."measureUnitTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('unit_pcs', 'measureUnitCatalog', 'empty', 1000, '{"title": "pcs", "code": "796"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- 2. every current price: price for 1 unit_pcs
UPDATE public."productPriceTable"
   SET "rowJSON" = jsonb_set("rowJSON", '{measureUnit}', '"unit_pcs"'::jsonb, true)
 WHERE coalesce("rowJSON"->>'measureUnit', '') = '';

-- 3. one price per product + variant + price list + UNIT + day
DROP INDEX IF EXISTS public."idx_productPriceTable_price_day";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_productPriceTable_price_day" ON public."productPriceTable"
  ("rowOwnerGUID", "rowParentGUID", ("rowJSON"->>'priceTypeGUID'), (coalesce("rowJSON"->>'measureUnit', '')), ("rowJSON"->>'validFrom'))
  WHERE NOT coalesce("rowJSON"->>'priceTypeGUID', '') = '' AND NOT coalesce("rowJSON"->>'validFrom', '') = '';
ALTER TABLE public."productPriceTable" DROP CONSTRAINT IF EXISTS "productPriceTable_unit_chk";
ALTER TABLE public."productPriceTable" ADD CONSTRAINT "productPriceTable_unit_chk" CHECK (coalesce("rowJSON"->>'measureUnit', '') <> '') NOT VALID;

NOTIFY pgrst, 'reload schema';

-- Check (expect 0 and 0):
--   SELECT count(*) FROM public."productPriceTable" WHERE coalesce("rowJSON"->>'measureUnit', '') = '';
--   SELECT count(*) FROM public."productPriceTable" p WHERE NOT EXISTS (SELECT 1 FROM public."measureUnitTable" u WHERE u."rowGUID" = p."rowJSON"->>'measureUnit');
