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
// Works for every action that goes through usePMCrud: stretch (resize), move, delete
// task, delete dependency, add task/dependency, progress, reorder, indent, inline edits...

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { PMProjectData } from '../../model/types';
import { errorMessage, newGUID } from '../../crud/api/apiUtils';
import { pmKeys, usePMApi } from '../../crud/shared/queryShared';
import { useUndoGanttStorage } from './undoGanttContext';
import { computeUndoPlan, isEmptyUndoPlan } from './undoGanttPlan';
import { UNDO_GANTT_KEEP_LAST, undoGanttKey, UndoGanttActionType, UndoGanttEntry } from './undoGanttTypes';

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
  const restoring = useRef(false);

  const refreshInfo = useCallback(async () => {
    if (!undoKey) return;
    const [n, top] = await Promise.all([storage.count(undoKey), storage.peek(undoKey)]);
    const s = usePMStore.getState();
    if (s.selectedProjectGUID === projectGUID) s.setUndoInfo(n, top?.rowJSON.label ?? null);
  }, [storage, undoKey, projectGUID]);

  // project switch -> show that project's undo count
  useEffect(() => {
    if (undoKey) enqueue(refreshInfo).catch(() => undefined);
  }, [undoKey, refreshInfo]);

  const record = useCallback(
    (actionType: UndoGanttActionType, label: string) => {
      if (!undoKey || !projectGUID || restoring.current) return;
      const before = qc.getQueryData<PMProjectData>(pmKeys.projectData(projectGUID));
      if (!before) return;
      const orderInList = stamp();
      const entry: UndoGanttEntry = {
        rowGUID: newGUID(),
        undoKey,
        rowOwnerGUID: projectGUID,
        rowParentGUID: userGUID,
        orderInList,
        rowJSON: {
          undoKey,
          actionType,
          label,
          createdAt: new Date(orderInList).toISOString(),
          projectGUID,
          userGUID,
          // deep copy: the cache objects are replaced, never mutated, but be safe
          before: JSON.parse(JSON.stringify(before)),
        },
      };
      // optimistic counter so the Undo button enables immediately
      const s = usePMStore.getState();
      s.setUndoInfo(s.undoCount + 1, label);
      enqueue(async () => {
        await storage.push(entry, UNDO_GANTT_KEEP_LAST);
        await refreshInfo();
      }).catch((e) => usePMStore.getState().setError(`Could not store undo step: ${errorMessage(e)}`));
    },
    [qc, storage, undoKey, projectGUID, userGUID, refreshInfo]
  );

  const undoMutation = useMutation({
    mutationFn: async () => {
      if (!undoKey || !projectGUID) return null;
      const entry = await enqueue(() => storage.peek(undoKey));
      if (!entry) return null;
      const key = pmKeys.projectData(projectGUID);
      await qc.cancelQueries({ queryKey: key });
      const current = qc.getQueryData<PMProjectData>(key) ?? (await api.readProjectData(projectGUID));
      const target = entry.rowJSON.before;
      const plan = computeUndoPlan(current, target);

      restoring.current = true;
      qc.setQueryData<PMProjectData>(key, target); // optimistic: the UI jumps back at once
      try {
        if (!isEmptyUndoPlan(plan)) {
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
        }
        await enqueue(() => storage.remove(entry.rowGUID));
        return entry.rowJSON.label;
      } catch (e) {
        qc.setQueryData(key, current); // roll the optimistic restore back, the refetch fixes the rest
        throw e;
      } finally {
        restoring.current = false;
      }
    },
    onError: (err) => usePMStore.getState().setError(`Undo failed: ${errorMessage(err)}`),
    onSettled: () => {
      if (projectGUID) qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) });
      qc.invalidateQueries({ queryKey: ['pm', 'closure'] });
      enqueue(refreshInfo).catch(() => undefined);
    },
  });

  const undo = useCallback(() => {
    if (!undoMutation.isPending) undoMutation.mutate();
  }, [undoMutation]);

  const clear = useCallback(async () => {
    if (!undoKey) return;
    await enqueue(() => storage.clear(undoKey));
    await refreshInfo();
  }, [storage, undoKey, refreshInfo]);

  return useMemo(() => ({ record, undo, clear, isUndoing: undoMutation.isPending }), [record, undo, clear, undoMutation.isPending]);
}

export type PMUndo = ReturnType<typeof useUndoGanttAction>;
