// Thin Supabase CRUD layer for the PM Gantt module, split by entity:
//
//   crud/project/projectApi.ts        project_table
//   crud/task/taskApi.ts              project_task_table + scheduler write-back RPC
//   crud/dependency/dependencyApi.ts  project_task_dependencies_table (+ closure reads)
//
// createPMApi() composes them into the single object the React Query hooks use. It is
// bound to the app's Supabase client (the one from WithSupabase that owns the auth
// session, so RLS sees auth.uid()). No Zustand / React Query here.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createProjectApi } from './crud/project/projectApi';
import { createTaskApi } from './crud/task/taskApi';
import { createDependencyApi } from './crud/dependency/dependencyApi';

export { newGUID } from './crud/shared/apiUtils';
export type { PMScheduleWrite } from './crud/task/taskApi';
export type { PMDependencyPatch } from './crud/dependency/dependencyApi';

export function createPMApi(sb: SupabaseClient) {
  return {
    ...createProjectApi(sb),
    ...createTaskApi(sb),
    ...createDependencyApi(sb),
  };
}

export type PMApi = ReturnType<typeof createPMApi>;
