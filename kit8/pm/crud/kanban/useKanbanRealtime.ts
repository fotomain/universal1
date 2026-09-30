// Realtime auto refresh of the Kanban tables: every browser / device of the user sees stage and card
// changes without reloading.
//
//   other browser moves a card → Supabase → Realtime (postgres_changes) → invalidate React Query
//   (debounced, paused while one of OUR mutations is in flight) → refetch → Zustand → board re-renders
//
//   kanban_stage_table               no filter (small shared catalog)
//   project_kanban_stage_table       rowOwnerGUID=eq.<project>
//   project_task_kanban_state_table  rowOwnerGUID=eq.<project>
// Needs kit8/sql/init/create_pm_kanban_tables.sql (adds the tables to the supabase_realtime publication).

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import { kanbanStageTable, projectKanbanStageTable, projectTaskKanbanStateTable } from '../../model/constants';
import type { PMKanbanStageRow, PMProjectKanbanData } from '../../model/kanbanTypes';
import { pmKeys } from '../shared/queryShared';
import {
  isKanbanDeleteRelevant,
  kanbanInvalidationFor,
  mergeKanbanInvalidation,
  PMKanbanRealtimeInvalidation,
  PMKanbanRealtimeTable,
  PM_KANBAN_REALTIME_NOTHING,
} from './kanbanRealtime';
import { nextRealtimeInstance } from '../realtime/projectRealtime';

const DEBOUNCE_MS = 300;
const RETRY_WHILE_MUTATING_MS = 400;

export function useKanbanRealtime(ownerGUID: string | null | undefined, projectGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    if (!ownerGUID) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: PMKanbanRealtimeInvalidation = PM_KANBAN_REALTIME_NOTHING;
    let wasSubscribed = false;

    const flush = () => {
      if (qc.isMutating() > 0) {
        timer = setTimeout(flush, RETRY_WHILE_MUTATING_MS);
        return;
      }
      timer = null;
      const todo = pending;
      pending = PM_KANBAN_REALTIME_NOTHING;
      if (todo.catalog) qc.invalidateQueries({ queryKey: pmKeys.kanbanCatalog() });
      if (todo.projectKanban && projectGUID) qc.invalidateQueries({ queryKey: pmKeys.projectKanban(projectGUID) });
    };
    const schedule = (what: PMKanbanRealtimeInvalidation) => {
      if (!what.catalog && !what.projectKanban) return;
      pending = mergeKanbanInvalidation(pending, what);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };
    const onChange = (t: PMKanbanRealtimeTable) => () => schedule(kanbanInvalidationFor(t));
    const onDelete = (t: PMKanbanRealtimeTable) => (payload: { old?: Record<string, unknown> }) => {
      const cache = {
        catalog: qc.getQueryData<{ rows: PMKanbanStageRow[] }>(pmKeys.kanbanCatalog())?.rows,
        projectKanban: projectGUID ? qc.getQueryData<PMProjectKanbanData>(pmKeys.projectKanban(projectGUID)) : undefined,
      };
      if (isKanbanDeleteRelevant(t, payload?.old, cache)) schedule(kanbanInvalidationFor(t));
    };

    // unique topic per hook instance (see useProjectRealtime: supabase.channel() reuses a subscribed channel of the same topic)
    let channel: any = supabase.channel(`pm-kanban:${ownerGUID}:${projectGUID || 'none'}:${nextRealtimeInstance()}`);
    const listen = (table: string, kind: PMKanbanRealtimeTable, filter: string | null) => {
      for (const event of ['INSERT', 'UPDATE'] as const) {
        channel = channel.on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, onChange(kind));
      }
      channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onDelete(kind));
    };
    listen(kanbanStageTable, 'kanbanCatalog', null);
    if (projectGUID) {
      listen(projectKanbanStageTable, 'projectKanbanStage', `rowOwnerGUID=eq.${projectGUID}`);
      listen(projectTaskKanbanStateTable, 'projectTaskKanbanState', `rowOwnerGUID=eq.${projectGUID}`);
    }
    channel.subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') return;
      if (wasSubscribed) schedule({ catalog: true, projectKanban: !!projectGUID }); // reconnect: events were lost
      wasSubscribed = true;
    });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, qc, ownerGUID, projectGUID]);
}
