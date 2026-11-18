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
      // ALL pages: a request returns 1000 rows at most
      const rows: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('project_task_table').select('rowGUID,rowOwnerGUID,treePath,rowJSON').eq('projectGUID', projectGUID).order('rowGUID', { ascending: true }).range(from, from + 999);
        if (error) throw new Error(error.message || String(error));
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return leafTasks(rows);
    },
  });
  return useMemo(() => q.data ?? [], [q.data]);
}
