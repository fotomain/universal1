// React Query hooks for projects (project_table): list, database search, create /
// update / sql_for_delete with optimistic updates, and the demo seed.

import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { buildDemoData } from '../../model/seedDemo';
import { todayUTC } from '../../view/project/scheduling';
import { PMProjectRow } from '../../model/types';
import { errorMessage, newGUID } from '../api/apiUtils';
import { pmKeys, usePMApi, useProjectsListMutation } from '../shared/queryShared';

export function useReadProjectsQuery(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const setProjects = usePMStore((s) => s.setProjects);
  const query = useQuery({
    queryKey: pmKeys.projects(ownerGUID),
    queryFn: () => api.readProjects(ownerGUID as string),
    enabled: !!ownerGUID,
  });
  useEffect(() => {
    if (query.data) setProjects(query.data);
  }, [query.data, setProjects]);
  return query;
}

/** One project by id (deep links); the list query above is what the dashboard uses. */
export function useReadProjectQuery(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useQuery({
    queryKey: pmKeys.project(projectGUID),
    queryFn: () => api.readProject(projectGUID as string),
    enabled: !!projectGUID,
  });
}

/** Substring search by project name in the database (SelectProjectFromList). */
export function useProjectSearchQuery(ownerGUID: string | null | undefined, text: string, enabled: boolean) {
  const api = usePMApi();
  return useQuery({
    queryKey: pmKeys.projectSearch(ownerGUID, text.trim().toLowerCase()),
    queryFn: () => api.searchProjects(ownerGUID as string, text),
    enabled: !!ownerGUID && enabled,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useCreateProjectMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectsListMutation<PMProjectRow, PMProjectRow>(
    ownerGUID,
    (row) => api.createProject(row),
    (list, row) => [...list, row]
  );
}

/** Builds a new project row client-side so the optimistic id == the persisted id. */
export function useBuildProjectRow(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const lastOrder = usePMStore((s) => {
    const last = s.projectOrder[s.projectOrder.length - 1];
    return last ? s.projectsById[last]?.orderInList ?? null : null;
  });
  return (name: string, startMs?: number) => api.buildProjectRow(ownerGUID as string, name, lastOrder, startMs);
}

export function useUpdateProjectMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectsListMutation<{ rowGUID: string; patch: Partial<PMProjectRow> }, PMProjectRow>(
    ownerGUID,
    (v) => api.updateProject(v.rowGUID, v.patch),
    (list, v) =>
      list.map((p) =>
        p.rowGUID === v.rowGUID ? { ...p, ...v.patch, rowJSON: v.patch.rowJSON ? { ...p.rowJSON, ...v.patch.rowJSON } : p.rowJSON } : p
      )
  );
}

export function useDeleteProjectMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectsListMutation<string, void>(
    ownerGUID,
    (rowGUID) => api.deleteProject(rowGUID),
    (list, rowGUID) => list.filter((p) => p.rowGUID !== rowGUID)
  );
}

/** Inserts the TRD use case (Project 1 + Project 2). */
export function useSeedDemoMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  return useMutation({
    mutationFn: async () => {
      const s = usePMStore.getState();
      const last = s.projectOrder[s.projectOrder.length - 1];
      const demo = buildDemoData(ownerGUID as string, todayUTC(), newGUID, last ? s.projectsById[last]?.orderInList ?? null : null);
      await api.createProjects(demo.projects);
      const stages = demo.tasks.filter((t) => t.rowJSON.rowKind === 'stage');
      const leaves = demo.tasks.filter((t) => t.rowJSON.rowKind !== 'stage');
      await api.createTasks(stages); // parents first: the DB validates the ltree parent
      await api.createTasks(leaves);
      await api.createDependencies(demo.deps);
      return demo;
    },
    onSuccess: (demo) => {
      const s = usePMStore.getState();
      for (const p of demo.projects) s.addRecentProject(p.rowGUID);
      s.selectProject(demo.projects[0]?.rowGUID ?? null);
    },
    onError: (err) => setError(errorMessage(err)),
    onSettled: () => qc.invalidateQueries({ queryKey: pmKeys.all }),
  });
}
