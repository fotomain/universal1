-- ===============================================================================================
-- UNIVERSAL1 - delete_bim_data.sql: deletes the BIM DATA, keeps the structure (the tables, functions and policies of start1 / start2 PART 55 stay and work).
-- What goes: the rows of bim_import_job_table, bim_property_table, bim_element_table, bim_chunk_table, bim_storey_table, bim_model_table (of ONE project or of ALL), the key
-- projectIsBIMBased of the projects, and - optionally - the tasks that the import made.
-- What stays: the projects and their tasks (unless you switch v_delete_tasks on), every other table.
-- THE FILES: the chunk files of the Storage bucket "bim" are NOT removed by SQL (Supabase refuses a direct SQL delete of its storage rows; the real files would stay as orphans).
-- This script queues every path in bim_storage_cleanup_table and prints how many. Then remove the files in ONE of these ways:
--    * Supabase -> Storage -> bucket bim -> select the folders -> Delete, or
--    * python py/bim/server/drain_storage.py   (needs SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment; it reads the queue, removes the files through the Storage API and empties the queue).
-- IRREVERSIBLE: the model has to be imported again (the converter + the importer can rebuild it from the IFC). Safe to run twice.
-- Run in the Supabase SQL Editor. Set the two switches below first.
-- ===============================================================================================

DO $$
DECLARE
  -- NULL = ALL projects; or a project GUID, e.g. 'aabd1dde-97e6-4359-97e4-0efcb847589b' (BIM example 1)
  v_project      uuid    := NULL;
  -- true = also delete the tasks the import made (the rows whose rowJSON has bimIfcGuid / bimGroupKey / bimStoreyGuid); false = the tasks stay and keep their keys as plain JSON
  v_delete_tasks boolean := false;
  v_models  integer := 0;
  v_files   integer := 0;
  v_tasks   integer := 0;
  v_marks   integer := 0;
BEGIN
  IF to_regclass('public.bim_model_table') IS NULL THEN
    RAISE NOTICE 'delete_bim_data: there are no bim_ tables here - nothing to delete';
    RETURN;
  END IF;
  -- 1. the paths of the files go to the queue (also the ones whose rows are gone already stay there)
  INSERT INTO public.bim_storage_cleanup_table ("storagePath")
  SELECT c."storagePath" FROM public.bim_chunk_table c WHERE v_project IS NULL OR c."rowProjectGUID" = v_project
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_files = ROW_COUNT;
  -- 2. the models; the storeys, chunks, elements, properties and jobs go with them (foreign keys ON DELETE CASCADE); the chunk trigger re-queues the paths (no change)
  DELETE FROM public.bim_model_table WHERE v_project IS NULL OR "rowProjectGUID" = v_project;
  GET DIAGNOSTICS v_models = ROW_COUNT;
  DELETE FROM public.bim_import_job_table WHERE v_project IS NULL OR "rowProjectGUID" = v_project;
  -- 3. the tasks of the import (optional). A stage / task of a BIM import is recognised by its keys; links and lines of such tasks (there are none after an import) go with them
  IF v_delete_tasks THEN
    PERFORM set_config('app.task_bulk', 'on', true);
    DELETE FROM public.project_task_table t
     WHERE (v_project IS NULL OR t."projectGUID" = v_project)
       AND (t."rowJSON" ? 'bimIfcGuid' OR t."rowJSON" ? 'bimGroupKey' OR t."rowJSON" ? 'bimStoreyGuid');
    GET DIAGNOSTICS v_tasks = ROW_COUNT;
    PERFORM set_config('app.task_bulk', 'off', true);
  END IF;
  -- 4. the project mark (the guard of a signed-in user does not run in the SQL editor)
  UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'projectIsBIMBased' WHERE "rowJSON" ? 'projectIsBIMBased' AND (v_project IS NULL OR "rowGUID" = v_project);
  GET DIAGNOSTICS v_marks = ROW_COUNT;
  RAISE NOTICE 'delete_bim_data: % model(s) deleted, % project(s) un-marked, % task(s) deleted, % file path(s) queued for removal (see the header of this file: remove the files in Storage)', v_models, v_marks, v_tasks, v_files;
END $$;

SELECT count(*) AS files_waiting_for_removal FROM public.bim_storage_cleanup_table;
