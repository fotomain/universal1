-- =====================================================================================
-- Partner catalog: public."partnerTable"   (RN: partnersTable = "partnerTable",
-- kit8/catalog/partner/partnerModel.ts; routes /partner/list, /partner/edit)
--
-- kit8/sql/defTable.md pattern:
--   "rowGUID"       text   own id (uuid text)
--   "rowOwnerGUID"  text   'partnerCatalog' (shared catalog or organization GUID)
--   "rowParentGUID" text   'empty'
--   "orderInList"   numeric list order (drag & drop)
--   "rowJSON"       jsonb  { partnerTitle, partnerLegalName, partnerKind, isActive, partnerIsSupplier, partnerIsCustomer, legalData, supplierData, customerData }
--   created_at / updated_at
--
-- Security: Authenticated users only.
-- Realtime: table is in supabase_realtime publication with REPLICA IDENTITY FULL.
--
-- Non-destructive, safe to run more than once. Remove: DROP TABLE public."partnerTable";
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."partnerTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'partnerCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);

CREATE INDEX IF NOT EXISTS "idx_partnerTable_rowJSON" ON public."partnerTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_partnerTable_order" ON public."partnerTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_partnerTable_title" ON public."partnerTable" ((lower("rowJSON"->>'partnerTitle')));

-- Unique indexes on registration and VAT numbers when present
CREATE UNIQUE INDEX IF NOT EXISTS "idx_partnerTable_vat" ON public."partnerTable" (upper("rowJSON"->'legalData'->>'vatNo'))
  WHERE ("rowJSON"->'legalData'->>'vatNo') IS NOT NULL AND ("rowJSON"->'legalData'->>'vatNo') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "idx_partnerTable_reg" ON public."partnerTable" (("rowJSON"->'legalData'->>'registrationNo'))
  WHERE ("rowJSON"->'legalData'->>'registrationNo') IS NOT NULL AND ("rowJSON"->'legalData'->>'registrationNo') <> '';

-- updated_at on every change
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_partnerTable_touch" ON public."partnerTable";
CREATE TRIGGER "trg_partnerTable_touch" BEFORE UPDATE ON public."partnerTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS ------------------------------------------------------------------------------
ALTER TABLE public."partnerTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."partnerTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."partnerTable" TO authenticated;

DROP POLICY IF EXISTS "partnerTable_select" ON public."partnerTable";
DROP POLICY IF EXISTS "partnerTable_insert" ON public."partnerTable";
DROP POLICY IF EXISTS "partnerTable_update" ON public."partnerTable";
DROP POLICY IF EXISTS "partnerTable_delete" ON public."partnerTable";

CREATE POLICY "partnerTable_select" ON public."partnerTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "partnerTable_insert" ON public."partnerTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "partnerTable_update" ON public."partnerTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "partnerTable_delete" ON public."partnerTable" FOR DELETE TO authenticated USING (true);

-- ---- realtime ---------------------------------------------------------------------------
ALTER TABLE public."partnerTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'partnerTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."partnerTable";
  END IF;
END $$;

-- ---- seed (skipped if rowGUID already exists) --------------------------------------------
INSERT INTO public."partnerTable" ("rowGUID", "orderInList", "rowJSON")
VALUES
  ('33333333-3333-4333-a333-333333333333', 1024, '{
    "partnerTitle": "Baltic Timber Supply",
    "partnerLegalName": "Baltic Timber Supply SIA",
    "partnerKind": "company",
    "isActive": true,
    "partnerIsSupplier": true,
    "partnerIsCustomer": false,
    "legalData": {
      "registrationNo": "40003001234",
      "vatNo": "LV40003001234",
      "legalAddress": "Eksporta iela 10, Riga, LV-1010",
      "country": "LV",
      "bankIban": "LV80HABA0551000000003"
    },
    "supplierData": {
      "paymentTermsDays": 14,
      "defaultCurrency": "EUR",
      "notes": "Raw wood supply partner"
    },
    "customerData": {
      "paymentTermsDays": 30,
      "creditLimit": 0,
      "defaultCurrency": "EUR",
      "discountPercent": 0
    }
  }'::jsonb),
  ('44444444-4444-4444-a444-444444444444', 2048, '{
    "partnerTitle": "Nordic Furniture Group",
    "partnerLegalName": "Nordic Furniture Group AB",
    "partnerKind": "company",
    "isActive": true,
    "partnerIsSupplier": false,
    "partnerIsCustomer": true,
    "legalData": {
      "registrationNo": "5560123456",
      "vatNo": "SE556012345601",
      "legalAddress": "Sveavägen 44, Stockholm, 11134",
      "country": "SE",
      "bankIban": "SE4550000000055601234560"
    },
    "supplierData": {
      "paymentTermsDays": 14,
      "defaultCurrency": "EUR",
      "notes": ""
    },
    "customerData": {
      "paymentTermsDays": 45,
      "creditLimit": 50000,
      "defaultCurrency": "EUR",
      "discountPercent": 8
    }
  }'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;
