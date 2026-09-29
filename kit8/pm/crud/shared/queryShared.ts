// React Query plumbing shared by crud/project, crud/task and crud/dependency.

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import { createPMApi, PMApi } from '../api/api_pm';
import { usePMStore } from '../../store/store_pm';
import { PMProjectData, PMProjectRow } from '../../model/types';
import { errorMessage } from '../api/apiUtils';

export const pmKeys = {
  all: ['pm'] as const,
  projects: (ownerGUID: string | null | undefined) => ['pm', 'projects', ownerGUID] as const,
  project: (projectGUID: string | null | undefined) => ['pm', 'project', projectGUID] as const,
  projectSearch: (ownerGUID: string | null | undefined, text: string) => ['pm', 'projectSearch', ownerGUID, text] as const,
  projectData: (projectGUID: string | null | undefined) => ['pm', 'projectData', projectGUID] as const,
  task: (taskGUID: string | null | undefined) => ['pm', 'task', taskGUID] as const,
  upstream: (taskGUID: string | null | undefined) => ['pm', 'closure', 'up', taskGUID] as const,
  downstream: (taskGUID: string | null | undefined) => ['pm', 'closure', 'down', taskGUID] as const,
};

export function usePMApi(): PMApi {
  const { supabase } = useSupabase();
  return useMemo(() => createPMApi(supabase), [supabase]);
}

/** Optimistic mutation on the per-project cache (tasks + deps), rolled back on error. */
export function useProjectMutation<TVars, TResult>(
  projectGUID: string | null | undefined,
  mutationFn: (vars: TVars, current: PMProjectData | undefined) => Promise<TResult>,
  applyOptimistic: (data: PMProjectData, vars: TVars) => PMProjectData
) {
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  const key = pmKeys.projectData(projectGUID);
  return useMutation({
    mutationFn: (vars: TVars) => mutationFn(vars, qc.getQueryData<PMProjectData>(key)),
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PMProjectData>(key);
      if (prev) qc.setQueryData<PMProjectData>(key, applyOptimistic(prev, vars));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      setError(errorMessage(err));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
    },
  });
}

/** Optimistic mutation on the projects list of one owner. */
export function useProjectsListMutation<TVars, TResult>(
  ownerGUID: string | null | undefined,
  mutationFn: (vars: TVars) => Promise<TResult>,
  applyOptimistic: (list: PMProjectRow[], vars: TVars) => PMProjectRow[]
) {
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  const key = pmKeys.projects(ownerGUID);
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PMProjectRow[]>(key);
      if (prev) qc.setQueryData<PMProjectRow[]>(key, applyOptimistic(prev, vars));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      setError(errorMessage(err));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['pm', 'projectSearch'] });
      qc.invalidateQueries({ queryKey: ['pm', 'project'] });
    },
  });
}
