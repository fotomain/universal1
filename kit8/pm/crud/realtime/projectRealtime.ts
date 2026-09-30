// Pure helpers for the PM realtime channel (crud/realtime/useProjectRealtime.ts).
// No React / Supabase here, so the matching rules are unit-tested on their own.
//
// Supabase Realtime rules this file works around:
// * INSERT / UPDATE events can be filtered on the server (`projectGUID=eq.<uuid>`).
// * DELETE events can NOT be filtered, and with RLS on + REPLICA IDENTITY FULL the old
//   record carries only the primary key(s). So a DELETE is "ours" when its primary key is
//   one of the rows we have cached (project list, project data, user settings).

import { PMProjectData, PMProjectRow } from '../../model/types';

/** Tables the PM channel listens to (must be in the supabase_realtime publication). */
export type PMRealtimeTable = 'project' | 'task' | 'dependency' | 'userSettings';

/** What to refetch after a change. */
export interface PMRealtimeInvalidation {
  projects: boolean;
  projectData: boolean;
  closure: boolean;
  userSettings: boolean;
}

export const PM_REALTIME_NOTHING: PMRealtimeInvalidation = { projects: false, projectData: false, closure: false, userSettings: false };

export function invalidationFor(table: PMRealtimeTable): PMRealtimeInvalidation {
  switch (table) {
    case 'project':
      return { ...PM_REALTIME_NOTHING, projects: true, projectData: true };
    case 'task':
    case 'dependency':
      // tasks feed the project progress chip + closure, deps feed the closure
      return { ...PM_REALTIME_NOTHING, projects: true, projectData: true, closure: true };
    case 'userSettings':
      return { ...PM_REALTIME_NOTHING, userSettings: true };
  }
}

export function mergeInvalidation(a: PMRealtimeInvalidation, b: PMRealtimeInvalidation): PMRealtimeInvalidation {
  return {
    projects: a.projects || b.projects,
    projectData: a.projectData || b.projectData,
    closure: a.closure || b.closure,
    userSettings: a.userSettings || b.userSettings,
  };
}

export function hasInvalidation(i: PMRealtimeInvalidation): boolean {
  return i.projects || i.projectData || i.closure || i.userSettings;
}

/** Cached state used to decide whether an unfiltered DELETE concerns this client. */
export interface PMRealtimeCache {
  projects?: PMProjectRow[] | undefined;
  projectData?: PMProjectData | undefined;
  userSettingsRowGUIDs?: string[] | undefined;
}

type OldRecord = Record<string, unknown> | null | undefined;

/** true when a DELETE of `old` (primary key only) touches a row this client shows. */
export function isDeleteRelevant(table: PMRealtimeTable, old: OldRecord, cache: PMRealtimeCache): boolean {
  if (!old) return false;
  const guid = typeof old.rowGUID === 'string' ? old.rowGUID : '';
  if (!guid) return false;
  switch (table) {
    case 'project':
      return !!cache.projects?.some((p) => p.rowGUID === guid);
    case 'task':
      return !!cache.projectData?.tasks.some((t) => t.rowGUID === guid);
    case 'dependency': {
      const from = typeof old.rowDependsOnGUID === 'string' ? old.rowDependsOnGUID : '';
      const tasks = cache.projectData?.tasks;
      const deps = cache.projectData?.deps;
      if (deps?.some((d) => d.rowGUID === guid && (!from || d.rowDependsOnGUID === from))) return true;
      // the link may not be cached yet (just created elsewhere): it still matters when both ends are ours
      return !!tasks?.some((t) => t.rowGUID === guid);
    }
    case 'userSettings':
      return !!cache.userSettingsRowGUIDs?.includes(guid);
  }
}
