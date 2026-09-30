// Realtime auto refresh: the same user editing in several browsers / devices sees every
// change without reloading.
//
//   other browser edits → Supabase (Postgres) → Realtime channel (postgres_changes)
//   → invalidate React Query (debounced, paused while one of OUR mutations is in flight
//     so optimistic state is never overwritten mid-drag) → refetch → hydrate() → Zustand
//   → Skia repaints.
//
// Needs the PM tables in the `supabase_realtime` publication with REPLICA IDENTITY FULL:
// kit8/sql/init/create_pm_tables.sql (new DB) or update_pm_tables_realtime.sql (existing DB).
// After a reconnect (sleep, network drop) everything is refetched, because events sent
// while the socket was down are lost.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import { projectTable, projectTaskDependenciesTable, projectTaskTable, projectUserSettingsTable } from '../../model/constants';
import { PMProjectData, PMProjectRow } from '../../model/types';
import { pmKeys } from '../shared/queryShared';
import {
  hasInvalidation,
  invalidationFor,
  isDeleteRelevant,
  mergeInvalidation,
  nextRealtimeInstance,
  PMRealtimeInvalidation,
  PMRealtimeTable,
  PM_REALTIME_NOTHING,
} from './projectRealtime';

const DEBOUNCE_MS = 350;
const RETRY_WHILE_MUTATING_MS = 400;

export function useProjectRealtime(ownerGUID: string | null | undefined, projectGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    if (!ownerGUID) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: PMRealtimeInvalidation = PM_REALTIME_NOTHING;
    let wasSubscribed = false;

    const flush = () => {
      if (qc.isMutating() > 0) {
        timer = setTimeout(flush, RETRY_WHILE_MUTATING_MS);
        return;
      }
      timer = null;
      const todo = pending;
      pending = PM_REALTIME_NOTHING;
      if (todo.projects) {
        qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) });
        qc.invalidateQueries({ queryKey: ['pm', 'project'] });
        qc.invalidateQueries({ queryKey: ['pm', 'projectSearch'] });
      }
      if (todo.projectData && projectGUID) {
        qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) });
        qc.invalidateQueries({ queryKey: ['pm', 'task'] });
      }
      if (todo.closure) qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
      if (todo.userSettings) qc.invalidateQueries({ queryKey: pmKeys.userSettings(ownerGUID) });
    };

    const schedule = (what: PMRealtimeInvalidation) => {
      if (!hasInvalidation(what)) return;
      pending = mergeInvalidation(pending, what);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    const onChange = (table: PMRealtimeTable) => () => schedule(invalidationFor(table));
    const onDelete = (table: PMRealtimeTable) => (payload: { old?: Record<string, unknown> }) => {
      const userSettingsRows = qc.getQueryData<{ rows: { rowGUID: string }[] }>(pmKeys.userSettings(ownerGUID));
      const cache = {
        projects: qc.getQueryData<PMProjectRow[]>(pmKeys.projects(ownerGUID)),
        projectData: projectGUID ? qc.getQueryData<PMProjectData>(pmKeys.projectData(projectGUID)) : undefined,
        userSettingsRowGUIDs: userSettingsRows?.rows?.map((r) => r.rowGUID),
      };
      if (isDeleteRelevant(table, payload?.old, cache)) schedule(invalidationFor(table));
    };

    const upserts = ['INSERT', 'UPDATE'] as const;
    // unique topic per hook instance: supabase.channel(topic) RETURNS the existing channel for a known topic, and
    // adding listeners to an already subscribed channel throws (dashboard + task page are both mounted in the stack)
    let channel: any = supabase.channel(`pm-gantt:${ownerGUID}:${projectGUID || 'none'}:${nextRealtimeInstance()}`);
    const listen = (table: string, kind: PMRealtimeTable, filter: string | null) => {
      for (const event of upserts) {
        channel = channel.on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, onChange(kind));
      }
      // DELETE events are never filterable on the server - matched against the cache instead
      channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onDelete(kind));
    };

    listen(projectTable, 'project', `rowOwnerGUID=eq.${ownerGUID}`);
    listen(projectUserSettingsTable, 'userSettings', `rowParentGUID=eq.${ownerGUID}`);
    if (projectGUID) {
      listen(projectTaskTable, 'task', `projectGUID=eq.${projectGUID}`);
      listen(projectTaskDependenciesTable, 'dependency', `projectGUID=eq.${projectGUID}`);
    }

    channel.subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') return;
      // re-subscribed after a drop: changes made meanwhile were not delivered -> refetch all
      if (wasSubscribed) {
        schedule({ projects: true, projectData: !!projectGUID, closure: true, userSettings: true });
      }
      wasSubscribed = true;
    });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, qc, ownerGUID, projectGUID]);
}
