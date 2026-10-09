// undoGanttAction: record the project state before every Gantt action, restore it on undo.
//
//   record(type, label)  - call right BEFORE an action mutates anything; snapshots the
//                          whole project (tasks + dependencies) from the React Query cache
//                          and pushes it to undoGanttActionTable (expo-sqlite / web store).
//   undo()               - takes the newest record of this user+project, diffs it against
//                          the current data (undoGanttPlan.ts) and writes the difference
//                          back to Supabase: deleted tasks/dependencies are re-inserted,
//                          moved / stretched / re-ordered / recolored rows get their old
//                          values, rows created by the action are deleted again.
//
//   redo()               - applies the newest UNDONE action again: every undo pushes the state it replaced to
//                          the redo stack (redoGanttKey), redo restores that state and puts the step back on
//                          the undo stack. A new action (record) clears the redo stack.
//
// Works for every action that goes through usePMCrud: stretch (resize), move, sql_for_delete
// task, sql_for_delete dependency, add task/dependency, progress, reorder, indent, inline edits...

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { PMProjectData } from '../../model/types';
import { errorMessage, newGUID } from '../../crud/api/apiUtils';
import { pmKeys, usePMApi } from '../../crud/shared/queryShared';
import { useUndoGanttStorage } from './undoGanttContext';
import { computeUndoPlan, isEmptyUndoPlan } from './undoGanttPlan';
import { redoGanttKey, UNDO_GANTT_KEEP_LAST, undoGanttKey, UndoGanttActionType, UndoGanttEntry } from './undoGanttTypes';

// strictly increasing "timestamp" so two actions in the same millisecond keep their order
let lastStamp = 0;
function stamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 0.001;
  return lastStamp;
}

// one serial queue for all storage writes -> undo never overtakes a pending record
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export function useUndoGanttAction(userGUID: string, projectGUID: string | null | undefined) {
  const storage = useUndoGanttStorage();
  const qc = useQueryClient();
  const api = usePMApi();
  const undoKey = userGUID && projectGUID ? undoGanttKey(userGUID, projectGUID) : null;
  const redoKey = userGUID && projectGUID ? redoGanttKey(userGUID, projectGUID) : null;
  const restoring = useRef(false);

  const refreshInfo = useCallback(async () => {
    if (!undoKey || !redoKey) return;
    const [n, top, rn, rtop] = await Promise.all([storage.count(undoKey), storage.peek(undoKey), storage.count(redoKey), storage.peek(redoKey)]);
    const s = usePMStore.getState();
    if (s.selectedProjectGUID === projectGUID) {
      s.setUndoInfo(n, top?.rowJSON.label ?? null);
      s.setRedoInfo(rn, rtop?.rowJSON.label ?? null);
    }
  }, [storage, undoKey, redoKey, projectGUID]);

  // project switch -> show that project's undo / redo counts
  useEffect(() => {
    if (undoKey) enqueue(refreshInfo).catch(() => undefined);
  }, [undoKey, refreshInfo]);

  /** One stack record: `before` = the project state the record restores. */
  const makeEntry = useCallback(
    (key: string, actionType: UndoGanttActionType, label: string, before: PMProjectData): UndoGanttEntry => {
      const orderInList = stamp();
      return {
        rowGUID: newGUID(),
        undoKey: key,
        rowOwnerGUID: projectGUID as string,
        rowParentGUID: userGUID,
        orderInList,
        rowJSON: {
          undoKey: key,
          actionType,
          label,
          createdAt: new Date(orderInList).toISOString(),
          projectGUID: projectGUID as string,
          userGUID,
          // deep copy: the cache objects are replaced, never mutated, but be safe
          before: JSON.parse(JSON.stringify(before)),
        },
      };
    },
    [projectGUID, userGUID]
  );

  const record = useCallback(
    (actionType: UndoGanttActionType, label: string) => {
      if (!undoKey || !redoKey || !projectGUID || restoring.current) return;
      const before = qc.getQueryData<PMProjectData>(pmKeys.projectData(projectGUID));
      if (!before) return;
      const entry = makeEntry(undoKey, actionType, label, before);
      // optimistic counter so the Undo button enables immediately; a new action ends the redo history
      const s = usePMStore.getState();
      s.setUndoInfo(s.undoCount + 1, label);
      s.setRedoInfo(0, null);
      enqueue(async () => {
        await storage.push(entry, UNDO_GANTT_KEEP_LAST);
        await storage.clear(redoKey);
        await refreshInfo();
      }).catch((e) => usePMStore.getState().setError(`Could not store undo step: ${errorMessage(e)}`));
    },
    [qc, storage, undoKey, redoKey, projectGUID, makeEntry, refreshInfo]
  );

  /** Writes the difference between `current` and `target` to the database (the cache jumps to `target` at once). */
  const restoreTo = useCallback(
    async (key: readonly unknown[], current: PMProjectData, target: PMProjectData) => {
      const plan = computeUndoPlan(current, target);
      qc.setQueryData<PMProjectData>(key, target); // optimistic: the UI jumps at once
      if (isEmptyUndoPlan(plan)) return;
      for (const d of plan.deleteDeps) await api.deleteDependency(d.rowGUID, d.rowDependsOnGUID);
      for (const t of plan.deleteTasks) await api.deleteTask(t.rowGUID);
      // parents first; consecutive inserts of the same depth go in one request
      let i = 0;
      while (i < plan.writeTasks.length) {
        const w = plan.writeTasks[i];
        if (w.kind === 'insert') {
          const d = w.row.treePath.split('.').length;
          const batch = [];
          while (i < plan.writeTasks.length && plan.writeTasks[i].kind === 'insert' && plan.writeTasks[i].row.treePath.split('.').length === d) {
            batch.push(plan.writeTasks[i].row);
            i++;
          }
          await api.createTasks(batch);
        } else {
          const { rowGUID, treePath, orderInList, rowProgress, rowJSON, rowDuration } = w.row;
          await api.updateTask(rowGUID, { treePath, orderInList, rowProgress, rowJSON, rowDuration });
          i++;
        }
      }
      if (plan.insertDeps.length) await api.createDependencies(plan.insertDeps);
      for (const d of plan.updateDeps) {
        await api.updateDependency(d.rowGUID, d.rowDependsOnGUID, {
          linkType: d.linkType,
          lagDays: d.lagDays,
          // rowJSON only when it matters (keeps undo working on a DB without the column)
          ...((d.rowJSON && Object.keys(d.rowJSON).length) ||
          Object.keys(current.deps.find((c) => c.rowGUID === d.rowGUID && c.rowDependsOnGUID === d.rowDependsOnGUID)?.rowJSON || {}).length
            ? { rowJSON: d.rowJSON || {} }
            : {}),
        });
      }
    },
    [qc, api]
  );

  /**
   * Undo and Redo are the same move between two stacks: take the newest record of `fromKey`, restore its state,
   * and push the state it replaced to `toKey` (so the other button can go back).
   */
  const step = useCallback(
    async (fromKey: string | null, toKey: string | null) => {
      if (!fromKey || !toKey || !projectGUID) return null;
      const entry = await enqueue(() => storage.peek(fromKey));
      if (!entry) return null;
      const key = pmKeys.projectData(projectGUID);
      await qc.cancelQueries({ queryKey: key });
      const current = qc.getQueryData<PMProjectData>(key) ?? (await api.readProjectData(projectGUID));
      restoring.current = true;
      try {
        await restoreTo(key, current, entry.rowJSON.before);
        const back = makeEntry(toKey, entry.rowJSON.actionType, entry.rowJSON.label, current);
        await enqueue(async () => {
          await storage.remove(entry.rowGUID);
          await storage.push(back, UNDO_GANTT_KEEP_LAST);
        });
        return entry.rowJSON.label;
      } catch (e) {
        qc.setQueryData(key, current); // roll the optimistic restore back, the refetch fixes the rest
        throw e;
      } finally {
        restoring.current = false;
      }
    },
    [storage, qc, api, projectGUID, restoreTo, makeEntry]
  );
  const onSettled = useCallback(() => {
    if (projectGUID) qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) });
    qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
    enqueue(refreshInfo).catch(() => undefined);
  }, [qc, projectGUID, refreshInfo]);

  const undoMutation = useMutation({
    mutationFn: () => step(undoKey, redoKey),
    onError: (err) => usePMStore.getState().setError(`Undo failed: ${errorMessage(err)}`),
    onSettled,
  });
  const redoMutation = useMutation({
    mutationFn: () => step(redoKey, undoKey),
    onError: (err) => usePMStore.getState().setError(`Redo failed: ${errorMessage(err)}`),
    onSettled,
  });
  const busy = undoMutation.isPending || redoMutation.isPending;

  const undo = useCallback(() => {
    if (!undoMutation.isPending && !redoMutation.isPending) undoMutation.mutate();
  }, [undoMutation, redoMutation]);
  const redo = useCallback(() => {
    if (!undoMutation.isPending && !redoMutation.isPending) redoMutation.mutate();
  }, [undoMutation, redoMutation]);

  const clear = useCallback(async () => {
    if (!undoKey || !redoKey) return;
    await enqueue(async () => {
      await storage.clear(undoKey);
      await storage.clear(redoKey);
    });
    await refreshInfo();
  }, [storage, undoKey, redoKey, refreshInfo]);

  /** Forget the undo steps only (the redo steps stay) / the redo steps only. The project data is not touched. */
  const clearUndo = useCallback(async () => {
    if (!undoKey) return;
    await enqueue(() => storage.clear(undoKey));
    await refreshInfo();
  }, [storage, undoKey, refreshInfo]);
  const clearRedo = useCallback(async () => {
    if (!redoKey) return;
    await enqueue(() => storage.clear(redoKey));
    await refreshInfo();
  }, [storage, redoKey, refreshInfo]);

  return useMemo(() => ({ record, undo, redo, clear, clearUndo, clearRedo, isUndoing: busy }), [record, undo, redo, clear, clearUndo, clearRedo, busy]);
}

export type PMUndo = ReturnType<typeof useUndoGanttAction>;
