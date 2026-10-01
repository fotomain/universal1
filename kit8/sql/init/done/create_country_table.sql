-- =====================================================================================
-- Country catalog: public."countryTable" (RN: countryTable = "countryTable",
-- kit8/catalog/country/countryModel.ts; route /catalog/country)
--
-- kit8/sql/defTable.md pattern:
--   "rowGUID"       text   own id (uuid text)
--   "rowOwnerGUID"  text   'countryCatalog' (the catalog is shared)
--   "rowParentGUID" text   'empty'
--   "orderInList"   numeric list order (drag & drop)
--   "rowJSON"       jsonb  { countryName, countryCode, countryCodeAlpha3, countryNumericCode, phonePrefix, currencyCode, flagEmoji, isActive }
--   created_at / updated_at
--
-- Realtime: table is in supabase_realtime publication with REPLICA IDENTITY FULL.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."countryTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'countryCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT "countryTable_code_chk" CHECK (("rowJSON"->>'countryCode') ~ '^[A-Z]{2,3}$')
);

CREATE INDEX IF NOT EXISTS "idx_countryTable_rowJSON" ON public."countryTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_countryTable_order" ON public."countryTable" ("orderInList");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_countryTable_code" ON public."countryTable" (upper("rowJSON"->>'countryCode'));
CREATE INDEX IF NOT EXISTS "idx_countryTable_name" ON public."countryTable" ((lower("rowJSON"->>'countryName')));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_countryTable_touch" ON public."countryTable";
CREATE TRIGGER "trg_countryTable_touch" BEFORE UPDATE ON public."countryTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS ----
ALTER TABLE public."countryTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."countryTable" FROM anon, authenticated;
GRANT SELECT ON public."countryTable" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."countryTable" TO authenticated;

DROP POLICY IF EXISTS "countryTable_select" ON public."countryTable";
DROP POLICY IF EXISTS "countryTable_insert" ON public."countryTable";
DROP POLICY IF EXISTS "countryTable_update" ON public."countryTable";
DROP POLICY IF EXISTS "countryTable_delete" ON public."countryTable";

CREATE POLICY "countryTable_select" ON public."countryTable" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "countryTable_insert" ON public."countryTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "countryTable_update" ON public."countryTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "countryTable_delete" ON public."countryTable" FOR DELETE TO authenticated USING (true);

-- ---- realtime ----
ALTER TABLE public."countryTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'countryTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."countryTable";
  END IF;
END $$;

-- ---- seed (default countries) ----
INSERT INTO public."countryTable" ("orderInList", "rowJSON")
SELECT v.ord, jsonb_build_object(
  'countryName', v.name,
  'countryCode', v.code2,
  'countryCodeAlpha3', v.code3,
  'countryNumericCode', v.num,
  'phonePrefix', v.prefix,
  'currencyCode', v.curr,
  'flagEmoji', v.flag,
  'isActive', true
)
FROM (VALUES
  (1000,  'Latvia',         'LV', 'LVA', '428', '+371', 'EUR', '🇱🇻'),
  (2000,  'Estonia',        'EE', 'EST', '233', '+372', 'EUR', '🇪🇪'),
  (3000,  'Lithuania',      'LT', 'LTU', '440', '+370', 'EUR', '🇱🇹'),
  (4000,  'United States',  'US', 'USA', '840', '+1',   'USD', '🇺🇸'),
  (5000,  'United Kingdom', 'GB', 'GBR', '826', '+44',  'GBP', '🇬🇧'),
  (6000,  'Germany',        'DE', 'DEU', '276', '+49',  'EUR', '🇩🇪'),
  (7000,  'France',         'FR', 'FRA', '250', '+33',  'EUR', '🇫🇷'),
  (8000,  'Spain',          'ES', 'ESP', '724', '+34',  'EUR', '🇪🇸'),
  (9000,  'Italy',          'IT', 'ITA', '380', '+39',  'EUR', '🇮🇹'),
  (10000, 'Poland',         'PL', 'POL', '616', '+48',  'PLN', '🇵🇱'),
  (11000, 'Sweden',         'SE', 'SWE', '752', '+46',  'SEK', '🇸🇪'),
  (12000, 'Norway',         'NO', 'NOR', '578', '+47',  'NOK', '🇳🇴'),
  (13000, 'Finland',        'FI', 'FIN', '246', '+358', 'EUR', '🇫🇮'),
  (14000, 'Denmark',        'DK', 'DNK', '208', '+45',  'DKK', '🇩🇰'),
  (15000, 'Switzerland',    'CH', 'CHE', '756', '+41',  'CHF', '🇨🇭'),
  (16000, 'Canada',         'CA', 'CAN', '124', '+1',   'CAD', '🇨🇦'),
  (17000, 'Japan',          'JP', 'JPN', '392', '+81',  'JPY', '🇯🇵'),
  (18000, 'Australia',      'AU', 'AUS', '036', '+61',  'AUD', '🇦🇺')
) AS v(ord, name, code2, code3, num, prefix, curr, flag)
WHERE NOT EXISTS (
  SELECT 1 FROM public."countryTable" c
  WHERE upper(c."rowJSON"->>'countryCode') = v.code2
);
