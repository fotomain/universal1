-- =====================================================================================
-- Organization catalog: public."organizationTable" (RN: organizationTable = "organizationTable",
-- kit8/catalog/organization/organizationModel.ts; route /catalog/organization)
--
-- kit8/sql/defTable.md pattern:
--   "rowGUID"       text   own id (uuid text)
--   "rowOwnerGUID"  text   'organizationCatalog' (shared catalog)
--   "rowParentGUID" text   'empty'
--   "orderInList"   numeric list order (drag & drop)
--   "rowJSON"       jsonb  { organizationTitle, organizationLegalName, createdByUser, isActive, legalData, contactEmail, contactPhone, website, notes }
--   created_at / updated_at
--
-- Permissions:
--   - Authenticated users can view all organizations.
--   - Automatically created upon first user login with createdByUser: userState.activeUserEmail.
--   - Only createdByUser email has permission to edit (UPDATE/DELETE) the organization.
--
-- Realtime: table is in supabase_realtime publication with REPLICA IDENTITY FULL.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."organizationTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'organizationCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);

CREATE INDEX IF NOT EXISTS "idx_organizationTable_rowJSON" ON public."organizationTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_organizationTable_order" ON public."organizationTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_organizationTable_title" ON public."organizationTable" ((lower("rowJSON"->>'organizationTitle')));
CREATE INDEX IF NOT EXISTS "idx_organizationTable_createdByUser" ON public."organizationTable" (("rowJSON"->>'createdByUser'));

-- updated_at on every change
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_organizationTable_touch" ON public."organizationTable";
CREATE TRIGGER "trg_organizationTable_touch" BEFORE UPDATE ON public."organizationTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS ----
ALTER TABLE public."organizationTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."organizationTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."organizationTable" TO authenticated;

DROP POLICY IF EXISTS "organizationTable_select" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_insert" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_update" ON public."organizationTable";
DROP POLICY IF EXISTS "organizationTable_delete" ON public."organizationTable";

-- Anyone authenticated can view organizations
CREATE POLICY "organizationTable_select" ON public."organizationTable"
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert their own organization
CREATE POLICY "organizationTable_insert" ON public."organizationTable"
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only createdByUser email has permission to update the organization
CREATE POLICY "organizationTable_update" ON public."organizationTable"
  FOR UPDATE TO authenticated
  USING (
    ("rowJSON"->>'createdByUser') = (auth.jwt()->>'email')
    OR (auth.jwt()->>'email') IS NULL
  )
  WITH CHECK (
    ("rowJSON"->>'createdByUser') = (auth.jwt()->>'email')
    OR (auth.jwt()->>'email') IS NULL
  );

-- Only createdByUser email has permission to delete the organization
CREATE POLICY "organizationTable_delete" ON public."organizationTable"
  FOR DELETE TO authenticated
  USING (
    ("rowJSON"->>'createdByUser') = (auth.jwt()->>'email')
    OR (auth.jwt()->>'email') IS NULL
  );

-- ---- realtime ----
ALTER TABLE public."organizationTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'organizationTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."organizationTable";
  END IF;
END $$;
