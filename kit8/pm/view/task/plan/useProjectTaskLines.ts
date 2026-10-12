// useProjectTaskLines - the finance lines (task_line_table) of EVERY task of ONE project, read once for the project-wide post state:
//   * the "posted" column of the task tree (PMProjectTasksTree: nothing · green ✓ · dark orange ✓),
//   * the project Actions button (Post unposted tasks · Repost all tasks).
// The tables of one task are read by ReusableTable into redux (taskLineReusable, by task); this is the OTHER view of the same rows, by project, kept
// in React Query (key ['pm','taskLines',project] - the refresh of the project re-reads it too) and kept current by Supabase Realtime
// (useProjectTaskLinesRealtime, mounted once by the dashboard). Pure helpers (postStatusByTask, linesByTask) are exported for the tests.
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../../providers/WithSupabase';
import { nextRealtimeInstance } from '../../../crud/realtime/projectRealtime';
import { taskLineTable } from '../finances/taskLineModel';
import type { TaskLineRow } from '../finances/taskLineModel';
import { postableLines, taskPostState } from './taskLinePlanModel';
import type { TaskPostState } from './taskLinePlanModel';

export const projectTaskLinesKey = (projectGUID: string | null | undefined) => ['pm', 'taskLines', projectGUID] as const;

const COLUMNS = 'rowGUID,rowProjectGUID,rowOwnerGUID,rowParentGUID,orderInList,rowJSON';
const PAGE = 1000;
const EMPTY: TaskLineRow[] = [];
const DEBOUNCE_MS = 400;

/** what the tree shows for a task: nothing (not posted · no budgeted line) · posted · posted, but changed since */
export type TaskPostIndicator = 'posted' | 'changed';

/** the lines grouped by task (rowOwnerGUID) */
export function linesByTask(lines: TaskLineRow[]): Record<string, TaskLineRow[]> {
  const out: Record<string, TaskLineRow[]> = {};
  for (const l of lines || []) (out[l.rowOwnerGUID] ||= []).push(l);
  return out;
}

/** the state of the Post button of every task that has lines (a task without lines is not in the result) */
export function postStateByTask(byTask: Record<string, TaskLineRow[]>): Record<string, TaskPostState> {
  const out: Record<string, TaskPostState> = {};
  for (const [task, lines] of Object.entries(byTask)) out[task] = taskPostState(lines);
  return out;
}

/** the tree indicator of every task: only the tasks that are posted ('posted') or posted and changed ('changed') - the others show an empty space */
export function postIndicatorByTask(byTask: Record<string, TaskLineRow[]>): Record<string, TaskPostIndicator> {
  const out: Record<string, TaskPostIndicator> = {};
  for (const [task, state] of Object.entries(postStateByTask(byTask))) {
    if (state === 'posted') out[task] = 'posted';
    else if (state === 'postNeeded') out[task] = 'changed';
  }
  return out;
}

/** the tasks Post would handle: 'unposted' = the ones that are not 'posted' yet, 'all' = every task that has a budgeted line */
export function tasksToPost(byTask: Record<string, TaskLineRow[]>, which: 'unposted' | 'all'): string[] {
  return Object.entries(byTask)
    .filter(([, lines]) => postableLines(lines).length > 0 && (which === 'all' || taskPostState(lines) !== 'posted'))
    .map(([task]) => task);
}

/** every line of the project (all pages) */
export function useProjectTaskLinesQuery(projectGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  return useQuery({
    queryKey: projectTaskLinesKey(projectGUID),
    enabled: !!projectGUID,
    staleTime: 30_000,
    queryFn: async (): Promise<TaskLineRow[]> => {
      const rows: TaskLineRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from(taskLineTable)
          .select(COLUMNS)
          .eq('rowProjectGUID', projectGUID as string)
          .order('rowGUID', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message || String(error));
        const page = (data || []) as unknown as TaskLineRow[];
        rows.push(...page);
        if (page.length < PAGE) break;
      }
      return rows;
    },
  });
}

/** the lines of the project + what is derived from them (the same cache everywhere: the tree, the Actions button) */
export function useProjectTaskLines(projectGUID: string | null | undefined) {
  const query = useProjectTaskLinesQuery(projectGUID);
  const lines = query.data ?? EMPTY;
  const byTask = useMemo(() => linesByTask(lines), [lines]);
  const indicators = useMemo(() => postIndicatorByTask(byTask), [byTask]);
  return { lines, byTask, indicators, isLoading: query.isLoading, refetch: query.refetch };
}

/** Realtime: any change of a line of the project re-reads them (debounced). Mount ONCE per dashboard. */
export function useProjectTaskLinesRealtime(projectGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  useEffect(() => {
    if (!projectGUID) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; qc.invalidateQueries({ queryKey: projectTaskLinesKey(projectGUID) }); }, DEBOUNCE_MS);
    };
    let channel: any = supabase.channel(`pm-task-lines:${projectGUID}:${nextRealtimeInstance()}`);
    for (const event of ['INSERT', 'UPDATE'] as const) {
      channel = channel.on('postgres_changes', { event, schema: 'public', table: taskLineTable, filter: `rowProjectGUID=eq.${projectGUID}` }, refresh);
    }
    // DELETE events cannot be filtered on the server (and carry the primary key only): any delete may be ours
    channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: taskLineTable }, refresh);
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, qc, projectGUID]);
}
