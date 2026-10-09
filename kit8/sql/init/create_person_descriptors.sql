-- =====================================================================================
-- UNIVERSAL1 - PERSON DESCRIPTORS: kit8/sql/init/create_person_descriptors.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_person_descriptors.sql.)
-- Run AFTER create_product_tables.sql, create_resource_role_tables.sql and create_person_type_table.sql.
--
-- A PERSON has his own Properties and Variants, built on the same descriptor tables as the products and the roles (sheet
-- "W1 V3 ER DESCRIPTORS PLAN", rule R12 mirrored for people). They are separate from the ones of a role:
--   role Property = what the role REQUIRES      person Property = what the person IS      (Experience 7 years, Certification PMP ...)
--   role Variant  = what is BOOKED (Senior, EN) person Variant  = what he CAN BE BOOKED AS (Senior, English)
-- The two sides meet on the DESCRIPTOR (descriptorGenus + descriptorValue are shared), not on the plan line: Seniority = Senior is the same
-- pair on both sides, although the plan lines (dp18 / dp_emp_v1) belong to different sets.
--
-- Rows added (all with fixed ids, ON CONFLICT DO NOTHING; IDEMPOTENT):
--   descriptorGenusTable        seniority / workLanguage / certification get targetKinds + 'personType' (rule R11); certification gets
--                               "multiple": true = a person has SEVERAL, each one is its own propertyValue row; new genus experienceYears
--                               (number; "satisfies": "minExperienceYears" = it answers the role requirement of that descriptor)
--   descriptorDestinationTable  ds_emp_prop / ds_emp_var (Employee), ds_con_prop / ds_con_var (Contractor)   owner = personType
--   descriptorPlanTable         Property: experienceYears (required), certification | Variant: seniority, workLanguage (both required)
--   propertyValueTable          per person: experience years + 1..3 SEPARATE certification rows           owner = person
--   variantTable / variantValueTable  per person: 1..2 variants (Seniority, Working language)            owner = person (variantMode perProduct)
--   contractTable               every person without an ACTIVE contract gets one: Employee = Employment (per Month), Contractor = Service (per Day)
-- The cost of a person on a task line comes from his contract (per hour = the sum of the period / the working hours of the period);
-- when the line has no contract the rate of the resource role is used (kit8/pm/view/task/finances/taskLineContractCost.ts).
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."personTypeTable"') IS NULL THEN RAISE EXCEPTION 'Run kit8/sql/init/create_person_type_table.sql first'; END IF;
  IF to_regclass('public."resourceRoleTypeTable"') IS NULL THEN RAISE EXCEPTION 'Run kit8/sql/init/create_resource_role_tables.sql first (the descriptors seniority, workLanguage, certification)'; END IF;
  IF to_regclass('public."contractTable"') IS NULL THEN RAISE EXCEPTION 'Run kit8/sql/init/done/create_tables.sql first (contractTable)'; END IF;
END $$;

-- ---- several certificates = several rows of the SAME plan line: the unique index (owner, plan line) of propertyValueTable must allow it ----------------
-- (create_product_tables.sql now creates it with the list value in the key; a database made before keeps the old two-column index: replace it here)
DROP INDEX IF EXISTS public."idx_propertyValueTable_owner_plan";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_propertyValueTable_owner_plan" ON public."propertyValueTable" ("rowOwnerGUID", "rowParentGUID", (coalesce("rowJSON"->>'descriptorValueGUID', ''))) WHERE "rowOwnerGUID" <> 'empty' AND "rowParentGUID" <> 'empty';

-- ---- descriptors (rule R11: the genus lists the kind of the owner of the set) ---------------------------------------------
UPDATE public."descriptorGenusTable" g
   SET "rowJSON" = jsonb_set(g."rowJSON", '{targetKinds}', COALESCE(g."rowJSON"->'targetKinds', '[]'::jsonb) || '"personType"'::jsonb)
 WHERE g."rowGUID" IN ('seniority', 'workLanguage', 'certification')
   AND NOT (COALESCE(g."rowJSON"->'targetKinds', '[]'::jsonb) ? 'personType');

-- several certifications = several rows (rule R8 is relaxed for a descriptor with "multiple": true)
UPDATE public."descriptorGenusTable" g SET "rowJSON" = g."rowJSON" || '{"multiple": true}'::jsonb WHERE g."rowGUID" = 'certification';

INSERT INTO public."descriptorGenusTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('experienceYears', 'descriptorGenusCatalog', 'empty', 28000,
   '{"title": "Experience, years", "valueType": "number", "unit": "years", "allowedDescriptionModes": ["property"], "targetKinds": ["personType"], "satisfies": "minExperienceYears", "matchRule": "atLeast", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- ---- descriptor sets of the two person types ------------------------------------------------------------------------------
INSERT INTO public."descriptorDestinationTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('ds_emp_prop', 'personTypeEmployee',   'property', 41000, '{"title": "Employee – properties"}'::jsonb),
  ('ds_emp_var',  'personTypeEmployee',   'variant',  41100, '{"title": "Employee – variants"}'::jsonb),
  ('ds_con_prop', 'personTypeContractor', 'property', 42000, '{"title": "Contractor – properties"}'::jsonb),
  ('ds_con_var',  'personTypeContractor', 'variant',  42100, '{"title": "Contractor – variants"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

INSERT INTO public."descriptorPlanTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('dp_emp_p1', 'ds_emp_prop', 'experienceYears', 43000, '{"required": true,  "sort": 10, "showInCard": true}'::jsonb),
  ('dp_emp_p2', 'ds_emp_prop', 'certification',   43100, '{"required": false, "sort": 20, "showInCard": true}'::jsonb),
  ('dp_emp_v1', 'ds_emp_var',  'seniority',       43200, '{"required": true,  "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp_emp_v2', 'ds_emp_var',  'workLanguage',    43300, '{"required": true,  "sort": 20, "inVariantTitle": true}'::jsonb),
  ('dp_con_p1', 'ds_con_prop', 'experienceYears', 44000, '{"required": true,  "sort": 10, "showInCard": true}'::jsonb),
  ('dp_con_p2', 'ds_con_prop', 'certification',   44100, '{"required": false, "sort": 20, "showInCard": true}'::jsonb),
  ('dp_con_v1', 'ds_con_var',  'seniority',       44200, '{"required": true,  "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp_con_v2', 'ds_con_var',  'workLanguage',    44300, '{"required": true,  "sort": 20, "inVariantTitle": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- ---- values of every person --------------------------------------------------------------------------------------------------
-- Property: experience years (one row) + 1..3 certifications, each its OWN row on the same plan line (certification is "multiple")
WITH cfg AS (
  SELECT p."rowGUID" AS pg, row_number() OVER (ORDER BY p."orderInList", p."rowGUID") AS n,
         CASE WHEN p."rowJSON"->>'personType' = 'personTypeContractor' THEN 'dp_con_' ELSE 'dp_emp_' END AS pre
    FROM public."personTable" p
)
INSERT INTO public."propertyValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'pp_exp_' || pg, pg, pre || 'p1', 200000 + n, jsonb_build_object('value', 2 + (n * 3) % 9) FROM cfg
ON CONFLICT ("rowGUID") DO NOTHING;

WITH cfg AS (
  SELECT p."rowGUID" AS pg, row_number() OVER (ORDER BY p."orderInList", p."rowGUID") AS n,
         CASE WHEN p."rowJSON"->>'personType' = 'personTypeContractor' THEN 'dp_con_' ELSE 'dp_emp_' END AS pre
    FROM public."personTable" p
)
INSERT INTO public."propertyValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'pp_cert_' || pg || '_' || k, pg, pre || 'p2', 210000 + n * 10 + k,
       jsonb_build_object('descriptorValueGUID', (ARRAY['dv18', 'dv19', 'dv20', 'dv21'])[1 + ((n + k) % 4)])
  FROM cfg CROSS JOIN generate_series(1, 3) AS k
 WHERE k <= 1 + (n % 3)
ON CONFLICT ("rowGUID") DO NOTHING;

-- Variants: Seniority (Junior .. Lead by order) x English; every second person can also be booked in Latvian
WITH cfg AS (
  SELECT p."rowGUID" AS pg, row_number() OVER (ORDER BY p."orderInList", p."rowGUID") AS n,
         CASE WHEN p."rowJSON"->>'personType' = 'personTypeContractor' THEN 'dp_con_' ELSE 'dp_emp_' END AS pre
    FROM public."personTable" p
), combo AS (
  SELECT pg, n, pre, k,
         (ARRAY['dv11', 'dv12', 'dv13', 'dv14'])[1 + (n % 4)] AS sen,
         (ARRAY['Junior', 'Middle', 'Senior', 'Lead'])[1 + (n % 4)] AS sen_title,
         CASE k WHEN 1 THEN 'dv15' ELSE 'dv16' END AS lang,
         CASE k WHEN 1 THEN 'English' ELSE 'Latvian' END AS lang_title
    FROM cfg CROSS JOIN generate_series(1, 2) AS k
   WHERE k = 1 OR n % 2 = 0
)
INSERT INTO public."variantTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'pvar_' || pg || '_' || k, pg, 'empty', 220000 + n * 10 + k,
       jsonb_build_object('title', sen_title || ', ' || lang_title, 'descriptorKey', pre || 'v1=' || sen || '|' || pre || 'v2=' || lang, 'isActive', true)
  FROM combo
ON CONFLICT ("rowGUID") DO NOTHING;

WITH cfg AS (
  SELECT p."rowGUID" AS pg, row_number() OVER (ORDER BY p."orderInList", p."rowGUID") AS n,
         CASE WHEN p."rowJSON"->>'personType' = 'personTypeContractor' THEN 'dp_con_' ELSE 'dp_emp_' END AS pre
    FROM public."personTable" p
), combo AS (
  SELECT pg, n, pre, k,
         (ARRAY['dv11', 'dv12', 'dv13', 'dv14'])[1 + (n % 4)] AS sen,
         CASE k WHEN 1 THEN 'dv15' ELSE 'dv16' END AS lang
    FROM cfg CROSS JOIN generate_series(1, 2) AS k
   WHERE k = 1 OR n % 2 = 0
)
INSERT INTO public."variantValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'pvv_' || pg || '_' || k || '_' || part, 'pvar_' || pg || '_' || k, pre || CASE part WHEN 's' THEN 'v1' ELSE 'v2' END, 230000 + n * 10 + k,
       jsonb_build_object('descriptorValueGUID', CASE part WHEN 's' THEN sen ELSE lang END)
  FROM combo CROSS JOIN (VALUES ('s'), ('l')) AS parts(part)
ON CONFLICT ("rowGUID") DO NOTHING;

-- ---- a contract for every person without an ACTIVE one (the Time line of a task takes the cost from it) ------------------------
WITH cfg AS (
  SELECT p."rowGUID" AS pg, p."rowJSON"->>'personTitle' AS title, row_number() OVER (ORDER BY p."orderInList", p."rowGUID") AS n,
         (p."rowJSON"->>'personType') = 'personTypeContractor' AS contractor
    FROM public."personTable" p
   WHERE NOT EXISTS (SELECT 1 FROM public."contractTable" c
                      WHERE c."rowOwnerGUID" = p."rowGUID" AND c."rowParentGUID" = 'person' AND c."rowJSON"->>'contractStatus' = 'active')
), sums AS (
  SELECT *, CASE WHEN contractor THEN 160 + (n * 23) % 240 ELSE 2400 + (n * 350) % 3200 END AS amount FROM cfg
)
INSERT INTO public."contractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
SELECT 'contract_' || pg, pg, 'person', -20454,
       jsonb_build_object(
         'contractPartyType', 'person',
         'contractNumber', CASE WHEN contractor THEN 'SRV-2026-' ELSE 'EMP-2026-' END || lpad(n::text, 3, '0'),
         'contractTitle', CASE WHEN contractor THEN 'Service agreement - ' ELSE 'Employment agreement - ' END || title,
         'contractType', CASE WHEN contractor THEN 'Service' ELSE 'Employment' END,
         'contractStatus', 'active', 'contractSignedDate', '2025-12-15', 'contractStartDate', '2026-01-01',
         'contractFinishDate', CASE WHEN contractor THEN to_jsonb('2026-12-31'::text) ELSE 'null'::jsonb END,
         'contractPaymentsPeriod', CASE WHEN contractor THEN 'Day' ELSE 'Month' END,
         'contractCurrency', 'EUR', 'contractSumBeforeVAT', amount, 'contractVATRate', 0, 'contractVAT', 0, 'contractTotal', amount,
         'notes', CASE WHEN contractor THEN 'Paid per working day' ELSE 'Paid per month' END)
  FROM sums
ON CONFLICT ("rowGUID") DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT "rowJSON"->>'personType', count(*) FROM public."personTable" GROUP BY 1;
--   SELECT p."rowJSON"->>'personTitle', count(*) FILTER (WHERE v."rowParentGUID" LIKE '%p2') AS certificates
--     FROM public."personTable" p LEFT JOIN public."propertyValueTable" v ON v."rowOwnerGUID" = p."rowGUID" GROUP BY 1;
