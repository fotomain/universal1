-- =====================================================================================
-- UNIVERSAL1 - PERSON TYPES: kit8/sql/init/create_person_type_table.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_person_type_table.sql. Run AFTER create_tables.sql (personTable) and
--  create_product_tables.sql (kit8_setup_def_table); the descriptor data is the next script: create_person_descriptors.sql.)
--
-- personTypeTable: the twin of productTypeTable / resourceRoleTypeTable for PEOPLE (sheet "W1 V3 ER DESCRIPTORS PLAN", rule R12):
--   Employee · Contractor. A type decides which descriptor sets (Property / Variant) its persons use - like a product type.
--   rowGUID = the code ('personTypeEmployee') · rowOwnerGUID 'personTypeCatalog' · rowParentGUID 'empty' · orderInList · rowJSON
--   rowJSON { title, description, propertySet, variantSet, variantMode ('perProduct' = the variants belong to the PERSON), uniqueVariants,
--             variantTitleTemplate, isActive }
-- The type of a person is personTable.rowJSON.personType (the owner of a person stays 'personCatalog': the Person screens and the
-- contracts keep working). personIsEmployee is kept in step with it (Employee = true).
--
-- Data: this script ALSO fills the demo persons so that 50 % are Employees and 50 % Contractors (every person without a type, by
-- order: odd = Employee, even = Contractor) and adds 6 demo persons when the catalog has fewer than 8.
-- IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS, seeds ON CONFLICT DO NOTHING; a person that has a type keeps it.
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."personTable"') IS NULL OR to_regprocedure('public.kit8_setup_def_table(text)') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/done/create_tables.sql and kit8/sql/init/create_product_tables.sql first (personTable, kit8_setup_def_table)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."personTypeTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'personTypeCatalog',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID")
);
CREATE INDEX IF NOT EXISTS "idx_personTypeTable_owner_order" ON public."personTypeTable" ("rowOwnerGUID", "orderInList");
SELECT public.kit8_setup_def_table('personTypeTable');
CREATE INDEX IF NOT EXISTS "idx_personTable_type" ON public."personTable" (("rowJSON"->>'personType'));

-- access: signed-in users (as personTable)
REVOKE ALL ON public."personTypeTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."personTypeTable" TO authenticated;
DROP POLICY IF EXISTS "personTypeTable_select" ON public."personTypeTable";
DROP POLICY IF EXISTS "personTypeTable_insert" ON public."personTypeTable";
DROP POLICY IF EXISTS "personTypeTable_update" ON public."personTypeTable";
DROP POLICY IF EXISTS "personTypeTable_delete" ON public."personTypeTable";
CREATE POLICY "personTypeTable_select" ON public."personTypeTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "personTypeTable_insert" ON public."personTypeTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "personTypeTable_update" ON public."personTypeTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "personTypeTable_delete" ON public."personTypeTable" FOR DELETE TO authenticated USING (true);

-- the two types (the descriptor sets ds_emp_* / ds_con_* are created by create_person_descriptors.sql)
INSERT INTO public."personTypeTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('personTypeEmployee', 'personTypeCatalog', 'empty', 1000, '{"title": "Employee", "description": "Works for the company under an employment contract (cost = salary of the contract)",
    "propertySet": "ds_emp_prop", "variantSet": "ds_emp_var", "variantMode": "perProduct", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb),
  ('personTypeContractor', 'personTypeCatalog', 'empty', 2000, '{"title": "Contractor", "description": "External person under a service contract (cost = rate of the contract)",
    "propertySet": "ds_con_prop", "variantSet": "ds_con_var", "variantMode": "perProduct", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- demo persons: the catalog should have at least 8 (the two original ones + 6) so that 50 / 50 means something
INSERT INTO public."personTable" ("rowGUID", "orderInList", "rowJSON")
SELECT v.guid, v.ord, jsonb_build_object(
         'personFirstName', v.first, 'personLastName', v.last, 'personTitle', v.first || ' ' || v.last,
         'personEmail', lower(v.first || '.' || v.last) || '@example.com', 'personPhone', v.phone, 'isActive', true, 'personIsEmployee', false)
  FROM (VALUES
    ('person_demo_03', 3072, 'Anna',  'Berzina',  '+371 2000 0003'),
    ('person_demo_04', 4096, 'Peter', 'Ozols',    '+371 2000 0004'),
    ('person_demo_05', 5120, 'Maria', 'Kalnina',  '+371 2000 0005'),
    ('person_demo_06', 6144, 'Ivan',  'Petrov',   '+371 2000 0006'),
    ('person_demo_07', 7168, 'Sofia', 'Lindgren', '+46 70 000 0007'),
    ('person_demo_08', 8192, 'Marcus','Weber',    '+49 151 0000 0008')
  ) AS v(guid, ord, first, last, phone)
 WHERE (SELECT count(*) FROM public."personTable") < 8
ON CONFLICT ("rowGUID") DO NOTHING;

-- 50 % Employee / 50 % Contractor of ALL persons without a type: by order, odd = Employee, even = Contractor
WITH numbered AS (
  SELECT "rowGUID", row_number() OVER (ORDER BY "orderInList", "rowGUID") AS n, "rowJSON"->>'personType' AS current_type
    FROM public."personTable"
)
UPDATE public."personTable" p
   SET "rowJSON" = p."rowJSON" || jsonb_build_object(
         'personType', CASE WHEN n.n % 2 = 1 THEN 'personTypeEmployee' ELSE 'personTypeContractor' END,
         'personIsEmployee', n.n % 2 = 1)
  FROM numbered n
 WHERE p."rowGUID" = n."rowGUID" AND COALESCE(n.current_type, '') = '';

DO $$
DECLARE
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
  ELSIF NOT v_all AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'personTypeTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."personTypeTable";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT "rowJSON"->>'personType' AS type, count(*) FROM public."personTable" GROUP BY 1;
