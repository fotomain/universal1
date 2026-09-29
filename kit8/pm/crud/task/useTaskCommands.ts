// Task / stage / milestone commands (tree toolbar, hover panels, edit modal, inline cell
// editors, chart drags, keyboard). Every command that changes data records one
// undoGanttAction BEFORE mutating, so the Undo button can restore the previous state.
// Commands read the latest state via usePMStore.getState() so gesture callbacks never
// act on stale closures.

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { DAY_MS, PM_ROUTES } from '../../constants';
import { approvePM } from '../../PMApproveYesNoCancelModalWindow';
import { newGUID } from '../shared/apiUtils';
import {
  movedTreePath,
  orderForInsert,
  useCreateTaskMutation,
  useCreateTasksMutation,
  useDeleteTaskMutation,
  useMoveTaskMutation,
  useUpdateTaskMutation,
} from './taskQueries';
import { usePMStore } from '../../store';
import { isTreeAncestorPath, projectTreePath, ROOT_KEY, toLtreeLabel, workDaysBetween } from '../../scheduling';
import { PMTaskRow } from '../../types';
import type { PMUndo } from '../../undo/useUndoGanttAction';
import { copyTaskInfo, shareTask } from '../../taskShare';

export type PMBarEditMode = 'move' | 'resize-start' | 'resize-end';

export function useTaskCommands(ownerGUID: string, projectGUID: string | null, undo: PMUndo) {
  const router = useRouter();
  const createTaskMutation = useCreateTaskMutation(projectGUID);
  const createTasksMutation = useCreateTasksMutation(projectGUID);
  const updateTaskMutation = useUpdateTaskMutation(projectGUID);
  const moveTaskMutation = useMoveTaskMutation(projectGUID);
  const deleteTaskMutation = useDeleteTaskMutation(projectGUID);
  const { record } = undo;

  return useMemo(() => {
    const st = () => usePMStore.getState();
    const isSummary = (guid: string) => {
      const s = st();
      return (s.tree.childrenById[guid]?.length ?? 0) > 0 || s.tasksById[guid]?.rowJSON.rowKind === 'stage';
    };
    const siblingsOf = (parentGUID: string | null): PMTaskRow[] => {
      const s = st();
      return (s.tree.childrenById[parentGUID ?? ROOT_KEY] || []).map((g) => s.tasksById[g]).filter(Boolean);
    };
    const calendar = () => {
      const s = st();
      return { skipWeekends: !!(projectGUID && s.projectsById[projectGUID]?.rowJSON.skipWeekends) };
    };

    const insertRow = (params: {
      parentGUID: string | null;
      afterGUID: string | null; // insert right after this sibling (null = at the end)
      beforeGUID?: string | null; // insert right before this sibling (wins over afterGUID)
      rowKind: 'stage' | 'task' | 'milestone';
      name: string;
      durationDays: number;
    }) => {
      const s = st();
      if (!projectGUID || !ownerGUID) return null;
      const siblings = siblingsOf(params.parentGUID);
      let before: string | null;
      let after: string | null;
      if (params.beforeGUID) {
        const i = siblings.findIndex((t) => t.rowGUID === params.beforeGUID);
        before = siblings[i - 1]?.rowGUID ?? null;
        after = params.beforeGUID;
      } else if (params.afterGUID) {
        const i = siblings.findIndex((t) => t.rowGUID === params.afterGUID);
        before = params.afterGUID;
        after = siblings[i + 1]?.rowGUID ?? null;
      } else {
        before = siblings[siblings.length - 1]?.rowGUID ?? null;
        after = null;
      }
      const { orderInList, rebalance } = orderForInsert(siblings, before, after, null);
      const parent = params.parentGUID ? s.tasksById[params.parentGUID] : null;
      const rowGUID = newGUID();
      const row: PMTaskRow = {
        rowGUID,
        treePath: `${parent ? parent.treePath : projectTreePath(projectGUID)}.${rowGUID.toLowerCase().replace(/-/g, '_')}`,
        projectGUID,
        rowOwnerGUID: ownerGUID,
        rowDuration: null,
        rowProgress: 0,
        orderInList,
        rowJSON: { rowKind: params.rowKind, name: params.name, durationDays: params.durationDays },
      };
      record('task-create', `Add ${params.rowKind}`);
      // rare: fractional gap collapsed -> re-space siblings first
      for (const r of rebalance || []) updateTaskMutation.mutate({ rowGUID: r.rowGUID, patch: { orderInList: r.orderInList } });
      createTaskMutation.mutate(row);
      if (params.parentGUID && s.expandedByProject[projectGUID]?.[params.parentGUID] === false) s.toggleExpanded(params.parentGUID);
      s.setSelected(rowGUID);
      return rowGUID;
    };

    const moveTo = (guid: string, parentGUID: string | null, before: string | null, after: string | null, label = 'Reorder') => {
      const s = st();
      const row = s.tasksById[guid];
      if (!row) return;
      const parent = parentGUID ? s.tasksById[parentGUID] : null;
      if (parent && (parent.rowGUID === guid || isTreeAncestorPath(row.treePath, parent.treePath))) return;
      const { orderInList, rebalance } = orderForInsert(siblingsOf(parentGUID), before, after, guid);
      record('task-reorder', label);
      moveTaskMutation.mutate({ rowGUID: guid, oldTreePath: row.treePath, newTreePath: movedTreePath(row, parent), orderInList, rebalance });
    };

    const rootOf = (guid: string) => {
      const s = st();
      let g = guid;
      for (let p = s.tree.parentById[g]; p; p = s.tree.parentById[p]) g = p;
      return g;
    };

    return {
      createStage: (afterGUID: string | null = null) =>
        insertRow({ parentGUID: null, afterGUID: afterGUID ? rootOf(afterGUID) : null, rowKind: 'stage', name: 'New stage', durationDays: 0 }),

      /** "+" on a row: inside a stage -> new last child, on a task -> new sibling below it. */
      createTask: (guid: string | null, rowKind: 'task' | 'milestone' = 'task') => {
        const s = st();
        const name = rowKind === 'milestone' ? 'New milestone' : 'New task';
        const durationDays = rowKind === 'milestone' ? 0 : 1;
        if (!guid) return insertRow({ parentGUID: null, afterGUID: null, rowKind, name, durationDays });
        if (isSummary(guid)) return insertRow({ parentGUID: guid, afterGUID: null, rowKind, name, durationDays });
        return insertRow({ parentGUID: s.tree.parentById[guid] ?? null, afterGUID: guid, rowKind, name, durationDays });
      },

      /** Tree hover panel "+ above": new task as the sibling right before the row. */
      createTaskAbove: (guid: string) => {
        const s = st();
        if (!s.tasksById[guid]) return null;
        return insertRow({ parentGUID: s.tree.parentById[guid] ?? null, afterGUID: null, beforeGUID: guid, rowKind: 'task', name: 'New task', durationDays: 1 });
      },

      /** Tree hover panel "+ below": new task as the sibling right after the row. */
      createTaskBelow: (guid: string) => {
        const s = st();
        if (!s.tasksById[guid]) return null;
        return insertRow({ parentGUID: s.tree.parentById[guid] ?? null, afterGUID: guid, rowKind: 'task', name: 'New task', durationDays: 1 });
      },

      /**
       * Duplicate: a copy of the row right below the original (same parent). A stage is copied with
       * its whole subtree. The copy keeps duration, start constraint, progress, color and notes;
       * the top row is named "<name> (copy)". Dependencies are not copied. One Undo step.
       */
      duplicateTask: (guid: string) => {
        const s = st();
        const src = s.tasksById[guid];
        if (!src || !projectGUID || !ownerGUID) return null;
        const parentGUID = s.tree.parentById[guid] ?? null;
        const siblings = siblingsOf(parentGUID);
        const i = siblings.findIndex((t) => t.rowGUID === guid);
        const { orderInList, rebalance } = orderForInsert(siblings, guid, siblings[i + 1]?.rowGUID ?? null, null);
        const parent = parentGUID ? s.tasksById[parentGUID] : null;
        const rows: PMTaskRow[] = [];
        const copy = (orig: PMTaskRow, parentPath: string, order: number, isTop: boolean): string => {
          const rowGUID = newGUID();
          const treePath = `${parentPath}.${toLtreeLabel(rowGUID)}`;
          const { created_at: _c, updated_at: _u, ...rest } = orig;
          rows.push({
            ...rest,
            rowGUID,
            treePath,
            projectGUID,
            rowOwnerGUID: ownerGUID,
            orderInList: order,
            rowDuration: null, // scheduler output - written back after the insert
            rowJSON: { ...orig.rowJSON, name: isTop ? `${orig.rowJSON.name} (copy)` : orig.rowJSON.name },
          });
          for (const kid of s.tree.childrenById[orig.rowGUID] || []) {
            const k = s.tasksById[kid];
            if (k) copy(k, treePath, k.orderInList, false); // parents first (the DB checks the parent)
          }
          return rowGUID;
        };
        const copyGUID = copy(src, parent ? parent.treePath : projectTreePath(projectGUID), orderInList, true);
        record('task-create', `Duplicate "${src.rowJSON.name}"`);
        for (const r of rebalance || []) updateTaskMutation.mutate({ rowGUID: r.rowGUID, patch: { orderInList: r.orderInList } });
        createTasksMutation.mutate(rows);
        s.setSelected(copyGUID);
        return copyGUID;
      },

      edit: (guid: string) => st().setEditing(guid),

      /** Hover panels "Copy task info": plain-text summary + deep link on the clipboard. */
      copyTaskInfo: (guid: string) => copyTaskInfo(guid),
      /** Hover panels "Share task": share sheet / Web Share / copy the deep link. */
      shareTask: (guid: string) => shareTask(guid),

      deleteTask: async (guid: string) => {
        const s = st();
        const row = s.tasksById[guid];
        if (!row) return;
        const kids = (s.tree.childrenById[guid] || []).length;
        const kind = s.schedule[guid]?.isSummary || kids ? 'stage' : row.rowJSON.rowKind === 'milestone' ? 'milestone' : 'task';
        const ok = await approvePM({
          title: `Delete ${kind} "${row.rowJSON.name}"?`,
          message: `${kids ? `The ${kids} row(s) inside it and all their dependencies will be deleted too.` : 'Its dependencies will be deleted too.'} You can undo it with the Undo button.`,
          yesLabel: 'Delete',
          destructive: true,
        });
        if (!ok || !st().tasksById[guid]) return;
        record('task-delete', `Delete "${row.rowJSON.name}"`);
        deleteTaskMutation.mutate(guid);
      },

      openInfo: (guid: string) =>
        router.push({ pathname: PM_ROUTES.task, params: { taskGUID: guid, projectGUID: projectGUID ?? '' } } as any),

      startLink: (guid: string) => st().setLinkSource(guid),
      cancelLink: () => st().setLinkSource(null),

      moveBy: (guid: string, delta: -1 | 1) => {
        const s = st();
        const parent = s.tree.parentById[guid] ?? null;
        const sibs = siblingsOf(parent).map((t) => t.rowGUID);
        const i = sibs.indexOf(guid);
        if (i < 0) return;
        if (delta < 0 && i > 0) moveTo(guid, parent, sibs[i - 2] ?? null, sibs[i - 1], 'Move up');
        if (delta > 0 && i < sibs.length - 1) moveTo(guid, parent, sibs[i + 1], sibs[i + 2] ?? null, 'Move down');
      },

      /** Becomes the last child of the previous sibling (which turns into a summary). */
      indent: (guid: string) => {
        const s = st();
        const parent = s.tree.parentById[guid] ?? null;
        const sibs = siblingsOf(parent).map((t) => t.rowGUID);
        const i = sibs.indexOf(guid);
        if (i <= 0) return;
        const newParent = sibs[i - 1];
        const kids = siblingsOf(newParent).map((t) => t.rowGUID);
        moveTo(guid, newParent, kids[kids.length - 1] ?? null, null, 'Indent');
        if (projectGUID && s.expandedByProject[projectGUID]?.[newParent] === false) s.toggleExpanded(newParent);
      },

      /** Becomes the sibling right after its current parent. */
      outdent: (guid: string) => {
        const s = st();
        const parent = s.tree.parentById[guid];
        if (!parent) return;
        const grand = s.tree.parentById[parent] ?? null;
        const sibs = siblingsOf(grand).map((t) => t.rowGUID);
        const i = sibs.indexOf(parent);
        moveTo(guid, grand, parent, sibs[i + 1] ?? null, 'Outdent');
      },

      /** Tree drag-and-drop: row `fromIndex` dropped into gap `slot` (0..rows.length). */
      dropRow: (fromIndex: number, slot: number) => {
        const s = st();
        const rows = s.visibleRows;
        const guid = rows[fromIndex];
        if (!guid || slot === fromIndex || slot === fromIndex + 1) return;
        const above = slot > 0 ? rows[slot - 1] : null;
        const below = slot < rows.length ? rows[slot] : null;

        if (s.tasksById[guid]?.rowJSON.rowKind === 'stage') {
          // stages live directly under the project
          const roots = siblingsOf(null).map((t) => t.rowGUID).filter((g) => g !== guid);
          let target: string | null = below ? rootOf(below) : null;
          if (below && target !== below) target = roots[roots.indexOf(target as string) + 1] ?? null;
          if (target === guid) target = null;
          const before = target ? roots[roots.indexOf(target) - 1] ?? null : roots[roots.length - 1] ?? null;
          moveTo(guid, null, before, target, 'Move stage');
          return;
        }

        const aboveExpandedSummary =
          above && above !== guid && isSummary(above) && s.expandedByProject[projectGUID ?? '']?.[above] !== false;
        if (aboveExpandedSummary) {
          const kids = siblingsOf(above).map((t) => t.rowGUID).filter((g) => g !== guid);
          moveTo(guid, above, null, kids[0] ?? null, 'Move row');
        } else if (above) {
          const parent = s.tree.parentById[above] ?? null;
          const sibs = siblingsOf(parent).map((t) => t.rowGUID).filter((g) => g !== guid);
          const i = sibs.indexOf(above);
          moveTo(guid, parent, above, sibs[i + 1] ?? null, 'Move row');
        } else {
          const roots = siblingsOf(null).map((t) => t.rowGUID).filter((g) => g !== guid);
          moveTo(guid, null, null, roots[0] ?? null, 'Move row');
        }
      },

      /** Bar drag / resize from the chart, in whole calendar days. */
      applyBarEdit: (guid: string, mode: PMBarEditMode, daysDelta: number) => {
        const s = st();
        const t = s.tasksById[guid];
        const r = s.schedule[guid];
        if (!t || !r || !daysDelta || r.isSummary) return;
        const cal = calendar();
        if (mode === 'move') {
          const start = r.startMs + daysDelta * DAY_MS;
          record('task-move', `Move "${t.rowJSON.name}"`);
          updateTaskMutation.mutate({ rowGUID: guid, patch: { rowJSON: { ...t.rowJSON, manualStartAt: new Date(start).toISOString() } } });
        } else if (mode === 'resize-end') {
          const finish = Math.max(r.startMs + DAY_MS, r.finishMs + daysDelta * DAY_MS);
          const durationDays = Math.max(1, workDaysBetween(r.startMs, finish, cal));
          record('task-resize', `Stretch "${t.rowJSON.name}"`);
          updateTaskMutation.mutate({ rowGUID: guid, patch: { rowJSON: { ...t.rowJSON, durationDays } } });
        } else {
          const start = Math.min(r.finishMs - DAY_MS, r.startMs + daysDelta * DAY_MS);
          const durationDays = Math.max(1, workDaysBetween(start, r.finishMs, cal));
          record('task-resize', `Stretch "${t.rowJSON.name}"`);
          updateTaskMutation.mutate({
            rowGUID: guid,
            patch: { rowJSON: { ...t.rowJSON, durationDays, manualStartAt: new Date(start).toISOString() } },
          });
        }
      },

      setProgress: (guid: string, progress: number) => {
        const p = Math.round(Math.min(100, Math.max(0, progress)));
        const t = st().tasksById[guid];
        if (!t || Math.round(t.rowProgress) === p) return;
        record('task-progress', `Progress of "${t.rowJSON.name}"`);
        updateTaskMutation.mutate({ rowGUID: guid, patch: { rowProgress: p } });
      },

      /** Inline "Days" cell: working days (milestones stay 0, stages are rolled up). */
      setDurationDays: (guid: string, days: number) => {
        const t = st().tasksById[guid];
        if (!t || isSummary(guid) || t.rowJSON.rowKind === 'milestone') return;
        const durationDays = Math.max(1, Math.round(days));
        if (durationDays === t.rowJSON.durationDays) return;
        record('task-resize', `Duration of "${t.rowJSON.name}"`);
        updateTaskMutation.mutate({ rowGUID: guid, patch: { rowJSON: { ...t.rowJSON, durationDays } } });
      },

      /** Inline "Start" cell: "start no earlier than" (null = as soon as possible). */
      setStartConstraint: (guid: string, startMs: number | null) => {
        const t = st().tasksById[guid];
        if (!t || isSummary(guid)) return;
        const manualStartAt = startMs === null ? null : new Date(startMs).toISOString();
        if ((t.rowJSON.manualStartAt ?? null) === manualStartAt) return;
        record('task-move', `Start of "${t.rowJSON.name}"`);
        updateTaskMutation.mutate({ rowGUID: guid, patch: { rowJSON: { ...t.rowJSON, manualStartAt } } });
      },

      updateTask: (guid: string, patch: Partial<PMTaskRow>, label = 'Edit task') => {
        record('task-update', label);
        updateTaskMutation.mutate({ rowGUID: guid, patch });
      },
    };
  }, [router, ownerGUID, projectGUID, createTaskMutation, createTasksMutation, updateTaskMutation, moveTaskMutation, deleteTaskMutation, record]);
}
