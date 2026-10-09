-- =====================================================================================
-- UNIVERSAL1 - PERSON DESCRIPTORS: kit8/sql/init/delete_person_descriptors.sql
-- Removes what create_person_descriptors.sql added: the person sets / plan lines, the property values and variants of persons, the
-- experienceYears descriptor, 'personType' from the targets of the shared descriptors, and the demo contracts 'contract_<person>'.
-- =====================================================================================
DELETE FROM public."variantValueTable" WHERE "rowGUID" LIKE 'pvv\_%' ESCAPE '\';
DELETE FROM public."variantTable"      WHERE "rowGUID" LIKE 'pvar\_%' ESCAPE '\';
DELETE FROM public."propertyValueTable" WHERE "rowGUID" LIKE 'pp\_exp\_%' ESCAPE '\' OR "rowGUID" LIKE 'pp\_cert\_%' ESCAPE '\';
DELETE FROM public."descriptorPlanTable" WHERE "rowGUID" LIKE 'dp\_emp\_%' ESCAPE '\' OR "rowGUID" LIKE 'dp\_con\_%' ESCAPE '\';
DELETE FROM public."descriptorDestinationTable" WHERE "rowGUID" IN ('ds_emp_prop', 'ds_emp_var', 'ds_con_prop', 'ds_con_var');
DELETE FROM public."descriptorGenusTable" WHERE "rowGUID" = 'experienceYears';
UPDATE public."descriptorGenusTable" g
   SET "rowJSON" = jsonb_set(g."rowJSON", '{targetKinds}', COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements(g."rowJSON"->'targetKinds') k WHERE k <> '"personType"'::jsonb), '[]'::jsonb))
 WHERE g."rowGUID" IN ('seniority', 'workLanguage', 'certification');
UPDATE public."descriptorGenusTable" g SET "rowJSON" = g."rowJSON" - 'multiple' WHERE g."rowGUID" = 'certification';
DELETE FROM public."contractTable" WHERE "rowGUID" LIKE 'contract\_%' ESCAPE '\' AND "rowParentGUID" = 'person';
NOTIFY pgrst, 'reload schema';
