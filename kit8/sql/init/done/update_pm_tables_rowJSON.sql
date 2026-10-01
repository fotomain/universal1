-- =====================================================================================
-- Non-destructive upgrade for databases created with the old pm_gantt_tables.sql:
-- adds "rowJSON" to the dependency + closure tables without dropping any data.
-- (Fresh installs: just run create_pm_tables.sql, which already contains these columns.)
-- =====================================================================================
ALTER TABLE public.project_task_dependencies_table
  ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.project_task_dependency_closure_table
  ADD COLUMN IF NOT EXISTS "rowJSON" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_task_deps_rowJSON
  ON public.project_task_dependencies_table USING GIN ("rowJSON" jsonb_path_ops);

-- clients may edit a dependency's rowJSON (e.g. dependencyColor)
GRANT UPDATE ("linkType", "lagDays", "rowJSON") ON public.project_task_dependencies_table TO authenticated;

-- task colors used to be stored as rowJSON.color -> copy them to rowJSON.taskColor
UPDATE public.project_task_table
   SET "rowJSON" = ("rowJSON" - 'color') || jsonb_build_object('taskColor', "rowJSON"->'color')
 WHERE "rowJSON" ? 'color' AND NOT ("rowJSON" ? 'taskColor');
