-- =====================================================================================
-- UNIVERSAL1 - PERSON TYPES: kit8/sql/init/delete_person_type_table.sql
-- Drops personTypeTable (data included!). personTable.rowJSON.personType stays as it is; the person descriptor data
-- (create_person_descriptors.sql) is removed by delete_person_descriptors.sql.
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'personTypeTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."personTypeTable";
  END IF;
  DROP TABLE IF EXISTS public."personTypeTable" CASCADE;
END $$;
NOTIFY pgrst, 'reload schema';
