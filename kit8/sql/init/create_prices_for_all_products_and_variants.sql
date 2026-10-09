-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: kit8/sql/init/create_prices_for_all_products_and_variants.sql
-- Creates the MISSING prices so that every product AND every variant of it has a price in EVERY product price list
-- (priceTypeTable.appliesTo contains 'product'), for 1 unit_pcs:
--   product level  rowOwnerGUID = product, rowParentGUID = 'empty'  (the price of the product / of all its variants)
--   variant level  rowOwnerGUID = product, rowParentGUID = variant   (the variants of a product follow variantMode of its type:
--                  perType -> variants owned by the type, perProduct -> owned by the product, sharedWithType -> of variantSharedTypeGUID,
--                  none -> no variants)
-- A price that exists is never changed or duplicated ("exists" = same product + variant + price list + unit, any date).
-- The amount of a created price is copied, in this order, from: the product-level price of that price list and unit valid today ->
-- the lowest price the product has in that price list and unit -> 0.00 (a placeholder to be filled in - the Prices table shows it).
-- validFrom = today. Prices that have no unit yet count as unit_pcs, but run update_prices.sql first.
-- Run it in the Supabase SQL editor after update_prices.sql. Idempotent: a second run finds nothing missing.
-- To fill another unit change v_unit below; to fill only some price lists set v_price_types (NULL = every product price list).
-- WARNING: the dashboard reads every table with ONE request of 1000 rows (PRODUCT_READ_PARAMS) and Supabase returns at most 1000 rows per
-- request, so a productPriceTable with more than 1000 rows is shown only in part. The script prints a WARNING when it gets there: then
-- restrict v_price_types (e.g. ARRAY['pt_retail']) or read the table in pages first.
-- =====================================================================================
DO $$
DECLARE
  v_unit  text := 'unit_pcs';
  v_today text := to_char(current_date, 'YYYY-MM-DD');
  v_order numeric;
  v_n     integer;
  v_total bigint;
  -- price lists to fill: NULL = every price list that appliesTo 'product'; e.g. ARRAY['pt_retail', 'pt_wholesale']
  v_price_types text[] := NULL;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."measureUnitTable" WHERE "rowGUID" = v_unit) THEN
    RAISE EXCEPTION 'measureUnitTable has no row %: run update_prices.sql first', v_unit;
  END IF;
  SELECT coalesce(max("orderInList"), 0) INTO v_order FROM public."productPriceTable";

  WITH ptypes AS (
    SELECT "rowGUID" AS price_type
      FROM public."priceTypeTable"
     WHERE (jsonb_typeof("rowJSON"->'appliesTo') IS DISTINCT FROM 'array' OR "rowJSON"->'appliesTo' ? 'product')
       AND (v_price_types IS NULL OR "rowGUID" = ANY (v_price_types))
  ), targets AS (
    -- the product itself (all variants) ...
    SELECT p."rowGUID" AS product_guid, 'empty'::text AS parent_guid
      FROM public."productTable" p
    UNION ALL
    -- ... and each of its variants
    SELECT p."rowGUID", v."rowGUID"
      FROM public."productTable" p
      JOIN public."productTypeTable" t ON t."rowGUID" = p."rowOwnerGUID"
      JOIN public."variantTable" v ON v."rowOwnerGUID" = CASE t."rowJSON"->>'variantMode'
                                                          WHEN 'perType'        THEN t."rowGUID"
                                                          WHEN 'perProduct'     THEN p."rowGUID"
                                                          WHEN 'sharedWithType' THEN t."rowJSON"->>'variantSharedTypeGUID'
                                                        END
  ), missing AS (
    SELECT tg.product_guid, tg.parent_guid, pt.price_type
      FROM targets tg
     CROSS JOIN ptypes pt
     WHERE NOT EXISTS (
       SELECT 1 FROM public."productPriceTable" x
        WHERE x."rowOwnerGUID" = tg.product_guid
          AND x."rowParentGUID" = tg.parent_guid
          AND x."rowJSON"->>'priceTypeGUID' = pt.price_type
          AND coalesce(nullif(x."rowJSON"->>'measureUnit', ''), 'unit_pcs') = v_unit)
  ), numbered AS (
    SELECT m.*, row_number() OVER (ORDER BY m.product_guid, m.parent_guid, m.price_type) AS n FROM missing m
  )
  INSERT INTO public."productPriceTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
  SELECT gen_random_uuid()::text,
         n.product_guid,
         n.parent_guid,
         v_order + n.n * 1000,
         jsonb_build_object(
           'priceTypeGUID', n.price_type,
           'price', round(coalesce(
              -- the product-level price of that list + unit valid today
              (SELECT (x."rowJSON"->>'price')::numeric FROM public."productPriceTable" x
                WHERE x."rowOwnerGUID" = n.product_guid AND x."rowParentGUID" = 'empty'
                  AND x."rowJSON"->>'priceTypeGUID' = n.price_type
                  AND coalesce(nullif(x."rowJSON"->>'measureUnit', ''), 'unit_pcs') = v_unit
                  AND coalesce(x."rowJSON"->>'validFrom', '') <> '' AND x."rowJSON"->>'validFrom' <= v_today
                  AND jsonb_typeof(x."rowJSON"->'price') = 'number'
                ORDER BY x."rowJSON"->>'validFrom' DESC LIMIT 1),
              -- the lowest price of the product in that list + unit
              (SELECT min((x."rowJSON"->>'price')::numeric) FROM public."productPriceTable" x
                WHERE x."rowOwnerGUID" = n.product_guid
                  AND x."rowJSON"->>'priceTypeGUID' = n.price_type
                  AND coalesce(nullif(x."rowJSON"->>'measureUnit', ''), 'unit_pcs') = v_unit
                  AND jsonb_typeof(x."rowJSON"->'price') = 'number'),
              0), 2),
           'measureUnit', v_unit,
           'validFrom', v_today)
    FROM numbered n;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE '% price(s) created for % (products and variants x product price lists)', v_n, v_unit;
  SELECT count(*) INTO v_total FROM public."productPriceTable";
  IF v_total > 1000 THEN
    RAISE WARNING 'productPriceTable has % rows: the dashboard reads only the first 1000 of a table (one request). Restrict v_price_types or page the read.', v_total;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check (expect 0): products / variants still without a price in a product price list
--   SELECT count(*) FROM public."productTable" p CROSS JOIN public."priceTypeTable" pt
--    WHERE (jsonb_typeof(pt."rowJSON"->'appliesTo') IS DISTINCT FROM 'array' OR pt."rowJSON"->'appliesTo' ? 'product')
--      AND NOT EXISTS (SELECT 1 FROM public."productPriceTable" x WHERE x."rowOwnerGUID" = p."rowGUID" AND x."rowParentGUID" = 'empty' AND x."rowJSON"->>'priceTypeGUID' = pt."rowGUID");
-- Placeholders to fill in: SELECT * FROM public."productPriceTable" WHERE ("rowJSON"->>'price')::numeric = 0;
