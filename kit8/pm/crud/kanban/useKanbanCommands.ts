// Kanban commands (one object, like usePMCrud): used by the board, the tree -> board bridge and the
// "Kanban Stages" window. Every write is optimistic (React Query cache -> Zustand) and rolled back on error.
//
//   moveTasksToStage(taskGUIDs, stageGUID, index?)  cards -> column (index = place in the column as shown)
//   moveTreeRowToStage(guid, stageGUID, index?)     a tree row: a task, or a stage = all its tasks
//   createStage(name, color) · updateStage(guid, patch) · moveStage(guid, -1 | 1) · deleteStage(guid)
//
// The stage of a task is independent of its progress % (never written here).

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { usePMKanbanStore } from '../../store/store_kanban';
import { newGUID } from '../api/apiUtils';
import { PMKanbanStateWrite } from '../api/kanbanApi';
import { PMKanbanStageJSON, PMProjectKanbanData, PMProjectKanbanStageRow, PMTaskKanbanStateRow, PM_KANBAN_ORDER_STEP, PM_KANBAN_STAGE_NAME_MAX } from '../../model/kanbanTypes';
import { applyKanbanStateWrites, buildKanbanBoard, kanbanLeavesOf, planKanbanMove } from '../../view/kanban/kanbanModel';
import { pmKeys, usePMApi } from '../shared/queryShared';
import { useKanbanMutation } from './kanbanQueries';

const readOnlyMessage = 'The Kanban tables are missing - run kit8/sql/init/create_pm_kanban_tables.sql in Supabase.';

export function useKanbanCommands(projectGUID: string | null | undefined) {
  const api = usePMApi();

  const saveStates = useKanbanMutation<PMKanbanStateWrite[], unknown>(
    projectGUID,
    (writes) => api.saveTaskKanbanStates(projectGUID as string, writes),
    (data, writes) => ({ ...data, states: applyKanbanStateWrites(data.states, projectGUID as string, writes) })
  );

  const createStageM = useKanbanMutation<PMProjectKanbanStageRow, unknown>(
    projectGUID,
    (row) => api.createProjectKanbanStage({ rowGUID: row.rowGUID, projectGUID: row.rowOwnerGUID, orderInList: row.orderInList, rowJSON: row.rowJSON }),
    (data, row) => ({ ...data, stages: [...data.stages, row] })
  );

  const updateStageM = useKanbanMutation<{ rowGUID: string; orderInList?: number; rowJSON?: PMKanbanStageJSON }, unknown>(
    projectGUID,
    (v) => api.updateProjectKanbanStage(v.rowGUID, { ...(v.orderInList !== undefined ? { orderInList: v.orderInList } : {}), ...(v.rowJSON ? { rowJSON: v.rowJSON } : {}) }),
    (data, v) => ({
      ...data,
      stages: data.stages
        .map((s) => (s.rowGUID === v.rowGUID ? { ...s, ...(v.orderInList !== undefined ? { orderInList: v.orderInList } : {}), ...(v.rowJSON ? { rowJSON: v.rowJSON } : {}) } : s))
        .sort((a, b) => a.orderInList - b.orderInList),
    })
  );

  const reorderStagesM = useKanbanMutation<{ rowGUID: string; orderInList: number }[], unknown>(
    projectGUID,
    (order) => api.saveProjectKanbanStagesOrder(order),
    (data, order) => {
      const next = new Map(order.map((o) => [o.rowGUID, o.orderInList]));
      return { ...data, stages: data.stages.map((s) => (next.has(s.rowGUID) ? { ...s, orderInList: next.get(s.rowGUID)! } : s)).sort((a, b) => a.orderInList - b.orderInList) };
    }
  );

  const deleteStageM = useKanbanMutation<string, unknown>(
    projectGUID,
    (rowGUID) => api.deleteProjectKanbanStage(rowGUID),
    // the SQL trigger drops the states of that stage: those tasks fall back to the first stage
    (data, rowGUID) => ({
      ...data,
      stages: data.stages.filter((s) => s.rowGUID !== rowGUID),
      states: data.states.filter((s) => s.rowJSON?.stageGUID !== rowGUID),
    })
  );

  const qc = useQueryClient();
  /** The project's Kanban cache (React Query = server truth + optimistic writes), null = not loaded / read-only. */
  const current = useCallback((): { stages: PMProjectKanbanStageRow[]; statesByTask: Record<string, PMTaskKanbanStateRow> } | null => {
    if (!projectGUID) return null;
    const data = qc.getQueryData<PMProjectKanbanData>(pmKeys.projectKanban(projectGUID));
    if (!data) return null;
    if (data.missing) {
      usePMStore.getState().setError(readOnlyMessage);
      return null;
    }
    const statesByTask: Record<string, PMTaskKanbanStateRow> = {};
    for (const st of data.states) statesByTask[st.rowParentGUID] = st;
    return { stages: [...data.stages].sort((a, b) => a.orderInList - b.orderInList), statesByTask };
  }, [projectGUID, qc]);

  const moveTasksToStage = useCallback(
    (taskGUIDs: string[], stageGUID: string, index?: number) => {
      const cur = current();
      const s = usePMStore.getState();
      if (!cur || s.loadedProjectGUID !== projectGUID) return;
      const k = { ...cur, scopeGUID: usePMKanbanStore.getState().scopeGUID };
      // plan on the WHOLE project (not the scope): hidden cards of the column keep their order
      const board = buildKanbanBoard({ tasksById: s.tasksById, tree: s.tree, schedule: s.schedule, stages: k.stages, statesByTask: k.statesByTask, scopeGUID: null });
      let at = index;
      if (at !== undefined && k.scopeGUID) {
        // index is relative to the scoped column: translate it to the full column
        const scoped = buildKanbanBoard({ tasksById: s.tasksById, tree: s.tree, schedule: s.schedule, stages: k.stages, statesByTask: k.statesByTask, scopeGUID: k.scopeGUID });
        const scopedCol = scoped.columns.find((c) => c.stage.rowGUID === stageGUID);
        const fullCol = board.columns.find((c) => c.stage.rowGUID === stageGUID);
        const anchor = scopedCol?.cards[at]?.guid;
        at = anchor && fullCol ? fullCol.cards.findIndex((c) => c.guid === anchor) : undefined;
        if (at !== undefined && at < 0) at = undefined;
      }
      const writes = planKanbanMove(board, k.statesByTask, taskGUIDs.filter((g) => !!s.tasksById[g]), stageGUID, at);
      if (writes.length) saveStates.mutate(writes);
    },
    [current, projectGUID, saveStates]
  );

  const moveTreeRowToStage = useCallback(
    (guid: string, stageGUID: string, index?: number) => {
      const s = usePMStore.getState();
      const leaves = kanbanLeavesOf(guid, s.tasksById, s.tree);
      if (!leaves.length) {
        s.setError('This stage has no tasks yet - add tasks to it first.');
        return;
      }
      moveTasksToStage(leaves, stageGUID, index);
    },
    [moveTasksToStage]
  );

  const createStage = useCallback(
    (name: string, color: string) => {
      const cur = current();
      if (!cur) return;
      const stages = cur.stages;
      const last = stages.length ? stages[stages.length - 1].orderInList : 0;
      createStageM.mutate({
        rowGUID: newGUID(),
        rowOwnerGUID: projectGUID as string,
        rowParentGUID: 'empty',
        orderInList: last + PM_KANBAN_ORDER_STEP,
        rowJSON: { stageName: name.trim().slice(0, PM_KANBAN_STAGE_NAME_MAX), stageColor: color },
      });
    },
    [current, createStageM, projectGUID]
  );

  const updateStage = useCallback(
    (rowGUID: string, patch: Partial<PMKanbanStageJSON>) => {
      const stage = current()?.stages.find((s) => s.rowGUID === rowGUID);
      if (!stage) return;
      const rowJSON = { ...stage.rowJSON, ...patch };
      if (patch.stageName !== undefined) rowJSON.stageName = patch.stageName.trim().slice(0, PM_KANBAN_STAGE_NAME_MAX);
      updateStageM.mutate({ rowGUID, rowJSON });
    },
    [current, updateStageM]
  );

  /** Moves a column one place left (-1) or right (1); the columns are renumbered 1024, 2048, ... */
  const moveStage = useCallback(
    (rowGUID: string, dir: -1 | 1) => {
      const cur = current();
      if (!cur) return;
      const stages = [...cur.stages];
      const i = stages.findIndex((s) => s.rowGUID === rowGUID);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= stages.length) return;
      [stages[i], stages[j]] = [stages[j], stages[i]];
      const order = stages
        .map((s, n) => ({ rowGUID: s.rowGUID, orderInList: (n + 1) * PM_KANBAN_ORDER_STEP, prev: s.orderInList }))
        .filter((o) => o.orderInList !== o.prev)
        .map(({ rowGUID: g, orderInList }) => ({ rowGUID: g, orderInList }));
      if (order.length) reorderStagesM.mutate(order);
    },
    [current, reorderStagesM]
  );

  /** Deletes a column (the caller asks first); its tasks go back to the first remaining column. */
  const deleteStage = useCallback(
    (rowGUID: string) => {
      const cur = current();
      if (!cur) return;
      if (cur.stages.length <= 1) {
        usePMStore.getState().setError('A project needs at least one Kanban stage.');
        return;
      }
      deleteStageM.mutate(rowGUID);
    },
    [current, deleteStageM]
  );

  return useMemo(
    () => ({ moveTasksToStage, moveTreeRowToStage, createStage, updateStage, moveStage, deleteStage, isSaving: saveStates.isPending }),
    [moveTasksToStage, moveTreeRowToStage, createStage, updateStage, moveStage, deleteStage, saveStates.isPending]
  );
}

export type PMKanbanCommands = ReturnType<typeof useKanbanCommands>;
