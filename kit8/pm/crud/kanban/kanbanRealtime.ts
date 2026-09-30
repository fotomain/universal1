// Pure helpers of the Kanban realtime channel (crud/kanban/useKanbanRealtime.ts), unit-tested.
// Same rules as crud/realtime/projectRealtime.ts: INSERT / UPDATE are filtered on the server,
// DELETE events are not filterable and (RLS + REPLICA IDENTITY FULL) carry only the primary key,
// so a DELETE matters when its rowGUID is one of the rows this client has cached.

import type { PMKanbanStageRow, PMProjectKanbanData } from '../../model/kanbanTypes';

export type PMKanbanRealtimeTable = 'kanbanCatalog' | 'projectKanbanStage' | 'projectTaskKanbanState';

export interface PMKanbanRealtimeInvalidation {
  catalog: boolean;
  projectKanban: boolean;
}

export const PM_KANBAN_REALTIME_NOTHING: PMKanbanRealtimeInvalidation = { catalog: false, projectKanban: false };

export function kanbanInvalidationFor(table: PMKanbanRealtimeTable): PMKanbanRealtimeInvalidation {
  return table === 'kanbanCatalog' ? { catalog: true, projectKanban: false } : { catalog: false, projectKanban: true };
}

export function mergeKanbanInvalidation(a: PMKanbanRealtimeInvalidation, b: PMKanbanRealtimeInvalidation): PMKanbanRealtimeInvalidation {
  return { catalog: a.catalog || b.catalog, projectKanban: a.projectKanban || b.projectKanban };
}

export interface PMKanbanRealtimeCache {
  catalog?: PMKanbanStageRow[];
  projectKanban?: PMProjectKanbanData;
}

export function isKanbanDeleteRelevant(table: PMKanbanRealtimeTable, old: Record<string, unknown> | null | undefined, cache: PMKanbanRealtimeCache): boolean {
  const guid = old && typeof old.rowGUID === 'string' ? old.rowGUID : '';
  if (!guid) return false;
  switch (table) {
    case 'kanbanCatalog':
      return !!cache.catalog?.some((r) => r.rowGUID === guid);
    case 'projectKanbanStage':
      return !!cache.projectKanban?.stages.some((r) => r.rowGUID === guid);
    case 'projectTaskKanbanState':
      return !!cache.projectKanban?.states.some((r) => r.rowGUID === guid);
  }
}
