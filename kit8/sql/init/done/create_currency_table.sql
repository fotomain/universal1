-- =====================================================================================
-- Currency catalog: public."currencyTable"   (RN: currenciesTable = "currencyTable",
-- kit8/catalog/currency/currencyModel.ts; routes /currency/list, /currency/edit)
--
-- kit8/sql/defTable.md pattern, same column types as the other reusable tables (create_tables.sql):
--   "rowGUID"       text   own id (uuid text)
--   "rowOwnerGUID"  text   'currencyCatalog' (the catalog is shared)
--   "rowParentGUID" text   'empty'
--   "orderInList"   numeric list order (drag & drop)
--   "rowJSON"       jsonb  { currencyCode, currencyName, currencySymbol, currencyNumericCode, decimalDigits, isActive }
--   created_at / updated_at
--
-- Auto refresh in every browser: the table is in the supabase_realtime publication; the app listens
-- with redux-saga (kit8/redux/reusable/reusableRootSaga.ts realtimeWorker) and applies INSERT / UPDATE /
-- DELETE to the list. REPLICA IDENTITY FULL -> UPDATE / DELETE events carry the old row.
-- RLS: everybody may read the catalog, signed-in users may change it.
--
-- Non-destructive, safe to run more than once. Remove: DROP TABLE public."currencyTable";
-- =====================================================================================

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
CREATE INDEX IF NOT EXISTS "idx_currencyTable_rowJSON" ON public."currencyTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_currencyTable_order" ON public."currencyTable" ("orderInList");
-- one row per ISO code
CREATE UNIQUE INDEX IF NOT EXISTS "idx_currencyTable_code" ON public."currencyTable" (upper("rowJSON"->>'currencyCode'));

-- updated_at on every change (the edit screen uses it to notice changes from other windows)
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_currencyTable_touch" ON public."currencyTable";
CREATE TRIGGER "trg_currencyTable_touch" BEFORE UPDATE ON public."currencyTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS ------------------------------------------------------------------------------
ALTER TABLE public."currencyTable" ENABLE ROW LEVEL SECURITY;
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

-- ---- realtime ---------------------------------------------------------------------------
ALTER TABLE public."currencyTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'currencyTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."currencyTable";
  END IF;
END $$;

-- ---- seed (skipped for codes that already exist) ------------------------------------------
INSERT INTO public."currencyTable" ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object('currencyCode', v.code, 'currencyName', v.name, 'currencySymbol', v.sym,
                                 'currencyNumericCode', v.num, 'decimalDigits', v.dec, 'isActive', true)
  FROM (VALUES
    (1024,  'EUR', 'Euro',              '€',   '978', 2),
    (2048,  'USD', 'US Dollar',         '$',   '840', 2),
    (3072,  'GBP', 'Pound Sterling',    '£',   '826', 2),
    (4096,  'CHF', 'Swiss Franc',       'CHF', '756', 2),
    (5120,  'JPY', 'Yen',               '¥',   '392', 0),
    (6144,  'CNY', 'Yuan Renminbi',     '¥',   '156', 2),
    (7168,  'SEK', 'Swedish Krona',     'kr',  '752', 2),
    (8192,  'NOK', 'Norwegian Krone',   'kr',  '578', 2),
    (9216,  'DKK', 'Danish Krone',      'kr',  '208', 2),
    (10240, 'PLN', 'Zloty',             'zł',  '985', 2)
  ) AS v(ord, code, name, sym, num, dec)
 WHERE NOT EXISTS (SELECT 1 FROM public."currencyTable" c WHERE upper(c."rowJSON"->>'currencyCode') = v.code);
