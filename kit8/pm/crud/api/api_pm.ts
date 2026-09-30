// Thin Supabase CRUD layer for the PM Gantt module, split by entity:
//
//   api/projectApi.ts        project_table
//   api/taskApi.ts           project_task_table + scheduler write-back RPC
//   api/dependencyApi.ts     project_task_dependencies_table (+ closure reads)
//   api/projectUserSettingsApi.ts  project_user_settings_table (per user settings of a project)
//   api/kanbanApi.ts         kanban_stage_table + project_kanban_stage_table + project_task_kanban_state_table
//
// createPMApi() composes them into the single object the React Query hooks use. It is
// bound to the app's Supabase client (the one from WithSupabase that owns the auth
// session, so RLS sees auth.uid()). No Zustand / React Query here.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createProjectApi } from './projectApi';
import { createTaskApi } from './taskApi';
import { createDependencyApi } from './dependencyApi';
import { createProjectUserSettingsApi } from './projectUserSettingsApi';
import { createKanbanApi } from './kanbanApi';

export { newGUID } from './apiUtils';
export type { PMScheduleWrite } from './taskApi';
export type { PMDependencyPatch } from './dependencyApi';
export { PMMissingTableError, isMissingTableError } from './projectUserSettingsApi';
export { PMKanbanMissingError } from './kanbanApi';
export type { PMKanbanStateWrite } from './kanbanApi';

export function createPMApi(sb: SupabaseClient) {
  return {
    ...createProjectApi(sb),
    ...createTaskApi(sb),
    ...createDependencyApi(sb),
    ...createProjectUserSettingsApi(sb),
    ...createKanbanApi(sb),
  };
}

export type PMApi = ReturnType<typeof createPMApi>;
