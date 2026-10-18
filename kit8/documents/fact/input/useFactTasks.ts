// useFactTasks - the tasks of a project a fact document can be made for (the leaves of the task tree: a stage has no lines, so no facts).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';

export interface FactTaskItem { guid: string; name: string }

/** the leaves: tasks that are not the owner (parent) of another task, in the order of the tree */
export function leafTasks(rows: { rowGUID: string; rowOwnerGUID: string; treePath?: string; rowJSON?: any }[]): FactTaskItem[] {
  const parents = new Set(rows.map((r) => r.rowOwnerGUID));
  return rows
    .filter((r) => !parents.has(r.rowGUID))
    .sort((a, b) => String(a.treePath ?? '').localeCompare(String(b.treePath ?? '')))
    .map((r) => ({ guid: String(r.rowGUID), name: String(r.rowJSON?.taskDescription || r.rowJSON?.title || r.rowGUID) }));
}

export function useFactTasks(projectGUID: string): FactTaskItem[] {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: ['pm', 'factTasks', projectGUID],
    enabled: !!projectGUID,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_task_table').select('rowGUID,rowOwnerGUID,treePath,rowJSON').eq('projectGUID', projectGUID);
      if (error) throw new Error(error.message || String(error));
      return leafTasks(data || []);
    },
  });
  return useMemo(() => q.data ?? [], [q.data]);
}
