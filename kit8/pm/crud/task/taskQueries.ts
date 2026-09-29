// React Query hooks for rows of project_task_table (stages / tasks / milestones):
// per-project data (tasks + deps), deep-link task lookup, optimistic create / update /
// move / delete, and the fractional ordering helpers used by the tree.

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { isTreeAncestorPath, orderGapTooSmall, toLtreeLabel } from '../../view/project/scheduling';
import { PMTaskRow } from '../../model/types';
import { pmKeys, usePMApi, useProjectMutation } from '../shared/queryShared';

export function useReadProjectDataQuery(projectGUID: string | null | undefined) {
  const api = usePMApi();
  const hydrate = usePMStore((s) => s.hydrate);
  const selected = usePMStore((s) => s.selectedProjectGUID);
  const query = useQuery({
    queryKey: pmKeys.projectData(projectGUID),
    queryFn: () => api.readProjectData(projectGUID as string),
    enabled: !!projectGUID,
  });
  useEffect(() => {
    if (projectGUID && query.data && selected === projectGUID) hydrate(projectGUID, query.data.tasks, query.data.deps);
  }, [projectGUID, query.data, selected, hydrate]);
  return query;
}

/** Single task (deep links to /pm/project/task?taskGUID=...). */
export function useReadTaskQuery(taskGUID: string | null | undefined) {
  const api = usePMApi();
  return useQuery({
    queryKey: pmKeys.task(taskGUID),
    queryFn: () => api.readTask(taskGUID as string),
    enabled: !!taskGUID,
  });
}

export function useCreateTaskMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<PMTaskRow, PMTaskRow>(
    projectGUID,
    (row) => api.createTask(row),
    (data, row) => ({ ...data, tasks: [...data.tasks, row] })
  );
}

/** Several rows at once (Duplicate: a row + its subtree), parents before children. */
export function useCreateTasksMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<PMTaskRow[], PMTaskRow[]>(
    projectGUID,
    (rows) => api.createTasks(rows),
    (data, rows) => ({ ...data, tasks: [...data.tasks, ...rows] })
  );
}

export function useUpdateTaskMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<{ rowGUID: string; patch: Partial<PMTaskRow> }, PMTaskRow>(
    projectGUID,
    ({ rowGUID, patch }) => api.updateTask(rowGUID, patch),
    (data, { rowGUID, patch }) => ({
      ...data,
      tasks: data.tasks.map((t) =>
        t.rowGUID === rowGUID ? { ...t, ...patch, rowJSON: patch.rowJSON ? { ...t.rowJSON, ...patch.rowJSON } : t.rowJSON } : t
      ),
    })
  );
}

export interface PMMoveVars {
  rowGUID: string;
  oldTreePath: string;
  newTreePath: string; // differs from oldTreePath only when re-parenting
  orderInList: number;
  /** extra sibling re-spacing, only when fractional gaps collapsed */
  rebalance?: { rowGUID: string; orderInList: number }[];
}

/** New ltree path of `row` when moved under `newParent` (null = directly under the project). */
export function movedTreePath(row: PMTaskRow, newParent: PMTaskRow | null): string {
  const parentPath = newParent ? newParent.treePath : toLtreeLabel(row.projectGUID);
  return `${parentPath}.${toLtreeLabel(row.rowGUID)}`;
}

/** Drag-to-reorder / re-parent. Touches only the moved row (+ rare rebalance). */
export function useMoveTaskMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<PMMoveVars, void>(
    projectGUID,
    async (vars) => {
      for (const r of vars.rebalance || []) {
        if (r.rowGUID !== vars.rowGUID) await api.updateTask(r.rowGUID, { orderInList: r.orderInList });
      }
      const patch: Partial<PMTaskRow> = { orderInList: vars.orderInList };
      if (vars.oldTreePath !== vars.newTreePath) patch.treePath = vars.newTreePath;
      await api.updateTask(vars.rowGUID, patch); // the DB trigger re-paths the subtree
    },
    (data, vars) => {
      const rebalance = new Map((vars.rebalance || []).map((r) => [r.rowGUID, r.orderInList]));
      const moved = vars.oldTreePath !== vars.newTreePath;
      return {
        ...data,
        tasks: data.tasks.map((t) => {
          let next = t;
          if (rebalance.has(t.rowGUID)) next = { ...next, orderInList: rebalance.get(t.rowGUID)! };
          if (t.rowGUID === vars.rowGUID) next = { ...next, orderInList: vars.orderInList };
          if (moved) {
            if (t.treePath === vars.oldTreePath) next = { ...next, treePath: vars.newTreePath };
            else if (isTreeAncestorPath(vars.oldTreePath, t.treePath))
              next = { ...next, treePath: vars.newTreePath + t.treePath.slice(vars.oldTreePath.length) };
          }
          return next;
        }),
      };
    }
  );
}

export function useDeleteTaskMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<string, void>(
    projectGUID,
    (rowGUID) => api.deleteTask(rowGUID),
    (data, rowGUID) => {
      const row = data.tasks.find((t) => t.rowGUID === rowGUID);
      if (!row) return data;
      const removed = new Set(
        data.tasks.filter((t) => t.rowGUID === rowGUID || isTreeAncestorPath(row.treePath, t.treePath)).map((t) => t.rowGUID)
      );
      return {
        tasks: data.tasks.filter((t) => !removed.has(t.rowGUID)),
        deps: data.deps.filter((d) => !removed.has(d.rowGUID) && !removed.has(d.rowDependsOnGUID)),
      };
    }
  );
}

/**
 * Order value for inserting between two siblings; if the gap collapsed, also returns a
 * rebalance list for that sibling group (the only case that touches more than one row).
 */
export function orderForInsert(
  siblings: PMTaskRow[],
  beforeGUID: string | null,
  afterGUID: string | null,
  movingGUID: string | null
): { orderInList: number; rebalance?: { rowGUID: string; orderInList: number }[] } {
  const list = siblings.filter((t) => t.rowGUID !== movingGUID).sort((a, b) => a.orderInList - b.orderInList);
  const before = beforeGUID ? list.find((t) => t.rowGUID === beforeGUID) : undefined;
  const after = afterGUID ? list.find((t) => t.rowGUID === afterGUID) : undefined;
  const lo = before?.orderInList ?? null;
  const hi = after?.orderInList ?? null;
  if (!orderGapTooSmall(lo, hi)) {
    const orderInList = lo === null && hi === null ? 1024 : lo === null ? (hi as number) - 1024 : hi === null ? lo + 1024 : (lo + hi) / 2;
    return { orderInList };
  }
  // rebalance: re-space the whole sibling list with the moving row inserted in place
  const movingKey = movingGUID ?? '__new__';
  const ordered = list.map((t) => t.rowGUID);
  const insertAt = after ? ordered.indexOf(after.rowGUID) : ordered.length;
  ordered.splice(insertAt, 0, movingKey);
  const spaced = ordered.map((g, i) => ({ rowGUID: g, orderInList: (i + 1) * 1024 }));
  const mine = spaced.find((r) => r.rowGUID === movingKey)!;
  return { orderInList: mine.orderInList, rebalance: spaced.filter((r) => r.rowGUID !== '__new__') };
}
