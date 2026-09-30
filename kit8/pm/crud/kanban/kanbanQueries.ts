// React Query hooks of the Kanban tables -> Zustand (store/store_kanban.ts).
//
//   useReadKanbanStageCatalogQuery()        kanban_stage_table                       -> store.catalog
//   useReadProjectKanbanQuery(project)      project_kanban_stage_table + task states -> store.stages / statesByTask
//                                           (first open of a project: its stages are copied from the catalog)
//   useKanbanMutation(project, fn, apply)   optimistic write on the project's Kanban cache, rolled back on error
//
// Auto refresh: crud/kanban/useKanbanRealtime.ts invalidates these queries on every change of the tables.

import { useEffect } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePMKanbanStore } from '../../store/store_kanban';
import { usePMStore } from '../../store/store_pm';
import { PMProjectKanbanData } from '../../model/kanbanTypes';
import { errorMessage } from '../api/apiUtils';
import { PMKanbanMissingError } from '../api/kanbanApi';
import { pmKeys, usePMApi } from '../shared/queryShared';

export function useReadKanbanStageCatalogQuery(enabled = true) {
  const api = usePMApi();
  const hydrate = usePMKanbanStore((s) => s.hydrateCatalog);
  const query = useQuery({ queryKey: pmKeys.kanbanCatalog(), queryFn: () => api.readKanbanStageCatalog(), enabled });
  useEffect(() => {
    if (query.data) hydrate(query.data.rows, query.data.missing);
  }, [query.data, hydrate]);
  return query;
}

/**
 * Stages + task states of one project (no store side effects - the "Kanban Stages" window may edit a
 * project that is not the selected one). The first read of a project without stages copies the catalog
 * into it (RPC pm_kanban_ensure_project_stages), once per project and session.
 */
export function useProjectKanbanData(projectGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: pmKeys.projectKanban(projectGUID),
    queryFn: () => api.readProjectKanban(projectGUID as string),
    enabled: !!projectGUID,
  });
  const data = query.data;
  useEffect(() => {
    const ensuredProjects = ensuredOf(qc);
    if (!projectGUID || !data || data.missing || data.stages.length || ensuredProjects[projectGUID]) return;
    ensuredProjects[projectGUID] = true;
    const key = pmKeys.projectKanban(projectGUID);
    api
      .ensureProjectKanbanStages(projectGUID)
      .then((stages) => {
        const cur = qc.getQueryData<PMProjectKanbanData>(key);
        qc.setQueryData<PMProjectKanbanData>(key, { states: cur?.states ?? [], missing: false, stages });
      })
      .catch((err) => {
        delete ensuredProjects[projectGUID];
        if (err instanceof PMKanbanMissingError) return;
        usePMStore.getState().setError(errorMessage(err));
      });
  }, [data, projectGUID, api, qc]);
  return query;
}

/** projects whose stages were already ensured, per QueryClient (= per app session; shared by every mounted hook) */
const ensuredByClient = new WeakMap<QueryClient, Record<string, boolean>>();
function ensuredOf(qc: QueryClient): Record<string, boolean> {
  let m = ensuredByClient.get(qc);
  if (!m) ensuredByClient.set(qc, (m = {}));
  return m;
}

/** useProjectKanbanData + hydrates the Kanban store (the board of the selected project). */
export function useReadProjectKanbanQuery(projectGUID: string | null | undefined) {
  const hydrate = usePMKanbanStore((s) => s.hydrateProject);
  const query = useProjectKanbanData(projectGUID);
  useEffect(() => {
    usePMKanbanStore.getState().resetProject(projectGUID ?? null);
  }, [projectGUID]);
  useEffect(() => {
    if (query.data && projectGUID) hydrate(projectGUID, query.data.stages, query.data.states, query.data.missing);
  }, [query.data, projectGUID, hydrate]);
  return query;
}

/** Optimistic mutation on the Kanban cache of one project (stages + states), rolled back on error. */
export function useKanbanMutation<TVars, TResult>(
  projectGUID: string | null | undefined,
  mutationFn: (vars: TVars) => Promise<TResult>,
  applyOptimistic: (data: PMProjectKanbanData, vars: TVars) => PMProjectKanbanData
) {
  const qc = useQueryClient();
  const key = pmKeys.projectKanban(projectGUID);
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PMProjectKanbanData>(key);
      if (prev) qc.setQueryData<PMProjectKanbanData>(key, applyOptimistic(prev, vars));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      usePMStore.getState().setError(errorMessage(err));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
