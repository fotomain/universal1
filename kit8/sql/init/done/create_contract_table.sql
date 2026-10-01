-- =====================================================================================
-- Contract catalog: public."contractTable"   (RN: contractsTable = "contractTable",
-- kit8/catalog/contract/contractModel.ts; embedded inside PersonEdit / PartnerEdit)
--
-- kit8/sql/defTable.md pattern:
--   "rowGUID"       text    own id (uuid text)
--   "rowOwnerGUID"  text    personTable."rowGUID" or partnerTable."rowGUID"
--   "rowParentGUID" text    'person' or 'partner' (matches contractPartyType)
--   "orderInList"   numeric -(days since 1970-01-01) of contractStartDate (ascending = newest first)
--   "rowJSON"       jsonb   { contractPartyType, contractNumber, contractTitle, contractType, contractStatus,
--                             contractSignedDate, contractStartDate, contractFinishDate, contractPaymentsPeriod,
--                             contractCurrency, contractSumBeforeVAT, contractVATRate, contractVAT, contractTotal, notes }
--   created_at / updated_at
--
-- No foreign keys on purpose: matches Undo and soft-delete restore pattern in kit8.
-- Security / GDPR: Restricted to authenticated users only.
-- Realtime: Scoped by rowOwnerGUID (person or partner).
--
-- Non-destructive, safe to run more than once. Remove: DROP TABLE public."contractTable";
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."contractTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  -- Party type check
  CONSTRAINT "contractTable_party_chk"
    CHECK ("rowParentGUID" IN ('person', 'partner') AND "rowJSON"->>'contractPartyType' = "rowParentGUID"),
  -- Sum check
  CONSTRAINT "contractTable_sum_chk"
    CHECK (jsonb_typeof("rowJSON"->'contractSumBeforeVAT') = 'number' AND ("rowJSON"->>'contractSumBeforeVAT')::numeric >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_contractTable_owner_order" ON public."contractTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_contractTable_rowJSON" ON public."contractTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_contractTable_number" ON public."contractTable" ((lower("rowJSON"->>'contractNumber')));

-- updated_at on every change
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_contractTable_touch" ON public."contractTable";
CREATE TRIGGER "trg_contractTable_touch" BEFORE UPDATE ON public."contractTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS (GDPR: Authenticated only) ----------------------------------------------------
ALTER TABLE public."contractTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."contractTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."contractTable" TO authenticated;

DROP POLICY IF EXISTS "contractTable_select" ON public."contractTable";
DROP POLICY IF EXISTS "contractTable_insert" ON public."contractTable";
DROP POLICY IF EXISTS "contractTable_update" ON public."contractTable";
DROP POLICY IF EXISTS "contractTable_delete" ON public."contractTable";

CREATE POLICY "contractTable_select" ON public."contractTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "contractTable_insert" ON public."contractTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contractTable_update" ON public."contractTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contractTable_delete" ON public."contractTable" FOR DELETE TO authenticated USING (true);

-- ---- realtime ---------------------------------------------------------------------------
ALTER TABLE public."contractTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contractTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."contractTable";
  END IF;
END $$;

-- ---- seed demo contracts ----------------------------------------------------------------
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
VALUES
  -- Contract for Person (John Doe: 11111111-1111-4111-a111-111111111111)
  ('55555555-5555-4555-a555-555555555555', '11111111-1111-4111-a111-111111111111', 'person', -20500, '{
    "contractPartyType": "person",
    "contractNumber": "EMP-2026-001",
    "contractTitle": "Employment Agreement - Lead Engineer",
    "contractType": "Employment",
    "contractStatus": "active",
    "contractSignedDate": "2026-01-15",
    "contractStartDate": "2026-02-01",
    "contractFinishDate": null,
    "contractPaymentsPeriod": "Month",
    "contractCurrency": "EUR",
    "contractSumBeforeVAT": 5500,
    "contractVATRate": 0,
    "contractVAT": 0,
    "contractTotal": 5500,
    "notes": "Full time employment agreement"
  }'::jsonb),
  -- Contract for Partner (Baltic Timber Supply: 33333333-3333-4333-a333-333333333333)
  ('66666666-6666-4666-a666-666666666666', '33333333-3333-4333-a333-333333333333', 'partner', -20550, '{
    "contractPartyType": "partner",
    "contractNumber": "SUP-2026-088",
    "contractTitle": "Master Wood Supply Agreement 2026",
    "contractType": "Supply",
    "contractStatus": "active",
    "contractSignedDate": "2026-01-10",
    "contractStartDate": "2026-01-15",
    "contractFinishDate": "2026-12-31",
    "contractPaymentsPeriod": "Month",
    "contractCurrency": "EUR",
    "contractSumBeforeVAT": 12000,
    "contractVATRate": 21,
    "contractVAT": 2520,
    "contractTotal": 14520,
    "notes": "Monthly timber deliveries"
  }'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;
