-- =====================================================================================
-- Person catalog: public."personTable"   (RN: personsTable = "personTable",
-- kit8/catalog/person/personModel.ts; routes /person/list, /person/edit)
--
-- kit8/sql/defTable.md pattern, same column types as currencyTable (create_currency_table.sql):
--   "rowGUID"       text   own id (uuid text)
--   "rowOwnerGUID"  text   'personCatalog' (shared catalog or organization GUID)
--   "rowParentGUID" text   'empty'
--   "orderInList"   numeric list order (drag & drop)
--   "rowJSON"       jsonb  { personFirstName, personLastName, personTitle, personEmail, personPhone, isActive, personIsEmployee, employeeData }
--   created_at / updated_at
--
-- Security / GDPR: NO anon SELECT. Personal identifiable data is restricted to authenticated users.
-- Realtime: table is in supabase_realtime publication with REPLICA IDENTITY FULL.
--
-- Non-destructive, safe to run more than once. Remove: DROP TABLE public."personTable";
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."personTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'personCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);

CREATE INDEX IF NOT EXISTS "idx_personTable_rowJSON" ON public."personTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_personTable_order" ON public."personTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_personTable_title" ON public."personTable" ((lower("rowJSON"->>'personTitle')));

-- updated_at on every change
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_personTable_touch" ON public."personTable";
CREATE TRIGGER "trg_personTable_touch" BEFORE UPDATE ON public."personTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS (GDPR: Authenticated only, NO anon access to personal data) ----
ALTER TABLE public."personTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."personTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."personTable" TO authenticated;

DROP POLICY IF EXISTS "personTable_select" ON public."personTable";
DROP POLICY IF EXISTS "personTable_insert" ON public."personTable";
DROP POLICY IF EXISTS "personTable_update" ON public."personTable";
DROP POLICY IF EXISTS "personTable_delete" ON public."personTable";

CREATE POLICY "personTable_select" ON public."personTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "personTable_insert" ON public."personTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "personTable_update" ON public."personTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "personTable_delete" ON public."personTable" FOR DELETE TO authenticated USING (true);

-- ---- realtime ---------------------------------------------------------------------------
ALTER TABLE public."personTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'personTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."personTable";
  END IF;
END $$;

-- ---- seed (skipped if rowGUID already exists) --------------------------------------------
INSERT INTO public."personTable" ("rowGUID", "orderInList", "rowJSON")
VALUES
  ('11111111-1111-4111-a111-111111111111', 1024, '{
    "personFirstName": "John",
    "personLastName": "Doe",
    "personTitle": "John Doe",
    "personEmail": "john.doe@example.com",
    "personPhone": "+1 555 0100",
    "isActive": true,
    "personIsEmployee": true,
    "employeeData": {
      "employeeNumber": "EMP-001",
      "position": "Lead Software Engineer",
      "department": "Engineering",
      "personalCode": "010190-12345",
      "bankIban": "LV80HABA0551000000001"
    }
  }'::jsonb),
  ('22222222-2222-4222-a222-222222222222', 2048, '{
    "personFirstName": "Jane",
    "personLastName": "Smith",
    "personTitle": "Jane Smith",
    "personEmail": "jane.smith@example.com",
    "personPhone": "+1 555 0200",
    "isActive": true,
    "personIsEmployee": true,
    "employeeData": {
      "employeeNumber": "EMP-002",
      "position": "Operations Director",
      "department": "Management",
      "personalCode": "150588-54321",
      "bankIban": "LV80HABA0551000000002"
    }
  }'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;
