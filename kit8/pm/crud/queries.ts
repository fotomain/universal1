// React Query layer: owns the Supabase fetch/mutate lifecycle (caching, optimistic
// updates with rollback, realtime invalidation, scheduler write-back) and hydrates the
// Zustand store (store/store_pm.ts) whenever the cached project data changes.
//
// The CRUD hooks live per entity (split so each stays small):
//   crud/project/projectQueries.ts       projects list / search / create / update / delete / demo
//   crud/task/taskQueries.ts             tasks: project data, create / update / move / delete
//   crud/dependency/dependencyQueries.ts dependencies + closure
// This file keeps the cross-cutting hooks (owner uid, realtime, write-back) and
// re-exports everything so existing imports from './queries' keep working.
//
// Rule of thumb: components never call api.* directly and never write server rows into
// Zustand themselves - they call a mutation; the mutation edits the React Query cache
// optimistically; the cache hydrates Zustand; Skia repaints.

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import { projectTable, projectTaskDependenciesTable, projectTaskTable } from '../model/constants';
import { PMScheduleWrite } from './api/api_pm';
import { usePMStore } from '../store/store_pm';
import { PMProjectData, PMProjectRow } from '../model/types';
import { errorMessage } from './api/apiUtils';
import { pmKeys, usePMApi } from './shared/queryShared';

export { pmKeys, usePMApi, useProjectMutation, useProjectsListMutation } from './shared/queryShared';
export * from './project/projectQueries';
export * from './task/taskQueries';
export * from './dependency/dependencyQueries';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Owner of PM rows = the REAL Supabase auth uid (what RLS compares with auth.uid()).
 * Do not use redux activeUserGUID here: it is truncated to 32 chars ("userGUID32"),
 * which is not a valid uuid and makes PostgREST answer 400 Bad Request.
 */
export function usePMOwnerGUID(): string {
  const { supabase } = useSupabase();
  const [uid, setUid] = useState('');
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setUid(data.session?.user?.id ?? '');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUid(session?.user?.id ?? ''));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);
  return UUID_RE.test(uid) ? uid : '';
}

// =====================================================================================
// Realtime: other clients' changes invalidate the cache (debounced, and never while one
// of our own mutations is in flight so optimistic state is not overwritten mid-drag).
// =====================================================================================

export function useProjectRealtime(ownerGUID: string | null | undefined, projectGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    if (!ownerGUID) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function run() {
        if (qc.isMutating() > 0) {
          timer = setTimeout(run, 400);
          return;
        }
        qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) });
        if (projectGUID) qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) });
        qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
      }, 350);
    };

    let channel = supabase
      .channel(`pm-gantt:${ownerGUID}:${projectGUID || 'none'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: projectTable, filter: `rowOwnerGUID=eq.${ownerGUID}` }, invalidate);
    if (projectGUID) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: projectTaskTable, filter: `projectGUID=eq.${projectGUID}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: projectTaskDependenciesTable, filter: `projectGUID=eq.${projectGUID}` }, invalidate);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, qc, ownerGUID, projectGUID]);
}

// =====================================================================================
// Scheduler write-back: the client-side CPM result (start / finish / rolled-up progress)
// is persisted so SQL always has real dates (rowJSON.startAt + rowDuration).
// =====================================================================================

export function useScheduleWriteBack(projectGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!projectGUID) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = async () => {
      const s = usePMStore.getState();
      if (s.loadedProjectGUID !== projectGUID || inFlight.current || qc.isMutating() > 0) return;
      const writes: PMScheduleWrite[] = [];
      for (const t of s.tasks) {
        const r = s.schedule[t.rowGUID];
        if (!r) continue;
        const sameStart = t.rowJSON?.startAt ? Date.parse(t.rowJSON.startAt) === r.startMs : false;
        const sameFinish = t.rowDuration ? Date.parse(t.rowDuration) === r.finishMs : false;
        const progressChanged = r.isSummary && Math.abs((t.rowProgress || 0) - r.progress) > 0.05;
        if (!sameStart || !sameFinish || progressChanged) {
          writes.push({ rowGUID: t.rowGUID, startAt: r.startAt, finishAt: r.finishAt, ...(r.isSummary ? { rowProgress: r.progress } : {}) });
        }
      }
      const project = s.projectsById[projectGUID];
      // same formula as SQL pm_recalc_project_progress (which stays the source of truth)
      const projectProgress = s.projectProgress;
      const projectFinish = s.tasks.length ? new Date(s.projectFinishMs).toISOString() : null;
      const projectChanged =
        !!project &&
        ((projectFinish && (!project.rowDuration || Date.parse(project.rowDuration) !== s.projectFinishMs)) ||
          Math.abs((project.rowProgress || 0) - projectProgress) > 0.05);
      if (!writes.length && !projectChanged) return;

      inFlight.current = true;
      try {
        await api.applySchedule(projectGUID, writes, projectFinish, projectProgress);
        const byGUID = new Map(writes.map((w) => [w.rowGUID, w]));
        qc.setQueryData<PMProjectData>(pmKeys.projectData(projectGUID), (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((t) => {
                  const w = byGUID.get(t.rowGUID);
                  return w
                    ? { ...t, rowDuration: w.finishAt, rowProgress: w.rowProgress ?? t.rowProgress, rowJSON: { ...t.rowJSON, startAt: w.startAt } }
                    : t;
                }),
              }
            : old
        );
        if (project) {
          qc.setQueryData<PMProjectRow[]>(pmKeys.projects(project.rowOwnerGUID), (old) =>
            old?.map((p) => (p.rowGUID === projectGUID ? { ...p, rowDuration: projectFinish, rowProgress: projectProgress } : p))
          );
        }
      } catch (e) {
        usePMStore.getState().setError(`Could not save schedule: ${errorMessage(e)}`);
      } finally {
        inFlight.current = false;
      }
    };

    const unsubscribe = usePMStore.subscribe((state, prev) => {
      if (state.schedule === prev.schedule && state.projectsById === prev.projectsById) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 800);
    });
    timer = setTimeout(flush, 800);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [api, qc, projectGUID]);
}
