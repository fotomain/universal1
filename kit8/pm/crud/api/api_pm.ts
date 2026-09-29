// Thin Supabase CRUD layer for the PM Gantt module, split by entity:
//
//   api/projectApi.ts        project_table
//   api/taskApi.ts           project_task_table + scheduler write-back RPC
//   api/dependencyApi.ts     project_task_dependencies_table (+ closure reads)
//
// createPMApi() composes them into the single object the React Query hooks use. It is
// bound to the app's Supabase client (the one from WithSupabase that owns the auth
// session, so RLS sees auth.uid()). No Zustand / React Query here.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createProjectApi } from './projectApi';
import { createTaskApi } from './taskApi';
import { createDependencyApi } from './dependencyApi';

export { newGUID } from './apiUtils';
export type { PMScheduleWrite } from './taskApi';
export type { PMDependencyPatch } from './dependencyApi';

export function createPMApi(sb: SupabaseClient) {
  return {
    ...createProjectApi(sb),
    ...createTaskApi(sb),
    ...createDependencyApi(sb),
  };
}

export type PMApi = ReturnType<typeof createPMApi>;
