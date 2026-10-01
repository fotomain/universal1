-- =====================================================================================
-- Departament catalog: public."departamentTable" (RN: departamentTable = "departamentTable",
-- kit8/catalog/departament/departamentModel.ts; TabDepartaments on Organization screen)
--
-- kit8/sql/defTable.md pattern:
--   "rowGUID"       text   own id (uuid text)
--   "rowOwnerGUID"  text   organizationTable.rowGUID (the owning organization)
--   "rowParentGUID" text   'empty' for root departments, or parent departament rowGUID (hierarchy as tree)
--   "orderInList"   numeric list order
--   "rowJSON"       jsonb  { departmentName, departmentCode, description, headPersonGUID, headPersonName, isActive }
--   created_at / updated_at
--
-- Realtime: table is in supabase_realtime publication with REPLICA IDENTITY FULL.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."departamentTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);

CREATE INDEX IF NOT EXISTS "idx_departamentTable_rowOwner" ON public."departamentTable" ("rowOwnerGUID");
CREATE INDEX IF NOT EXISTS "idx_departamentTable_rowParent" ON public."departamentTable" ("rowParentGUID");
CREATE INDEX IF NOT EXISTS "idx_departamentTable_order" ON public."departamentTable" ("orderInList");
CREATE INDEX IF NOT EXISTS "idx_departamentTable_rowJSON" ON public."departamentTable" USING GIN ("rowJSON" jsonb_path_ops);
CREATE INDEX IF NOT EXISTS "idx_departamentTable_name" ON public."departamentTable" ((lower("rowJSON"->>'departmentName')));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_departamentTable_touch" ON public."departamentTable";
CREATE TRIGGER "trg_departamentTable_touch" BEFORE UPDATE ON public."departamentTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS ----
ALTER TABLE public."departamentTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."departamentTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."departamentTable" TO authenticated;

DROP POLICY IF EXISTS "departamentTable_select" ON public."departamentTable";
DROP POLICY IF EXISTS "departamentTable_insert" ON public."departamentTable";
DROP POLICY IF EXISTS "departamentTable_update" ON public."departamentTable";
DROP POLICY IF EXISTS "departamentTable_delete" ON public."departamentTable";

CREATE POLICY "departamentTable_select" ON public."departamentTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "departamentTable_insert" ON public."departamentTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "departamentTable_update" ON public."departamentTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "departamentTable_delete" ON public."departamentTable" FOR DELETE TO authenticated USING (true);

-- ---- realtime ----
ALTER TABLE public."departamentTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'departamentTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."departamentTable";
  END IF;
END $$;
