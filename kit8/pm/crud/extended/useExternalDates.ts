// B5 (ganttCrossProjectLinksEnabled): the dates of the tasks of OTHER projects that a task waits for (rowJSON.externalPredecessors).
// The scheduler writes startAt (rowJSON) and rowDuration (the exclusive finish) of every task, so reading the row is enough.
// The result goes to the store (setExternalDates), which re-schedules the open project. Without the switch nothing is read.
import { useEffect, useMemo } from 'react';
import { usePMStore } from '../../store/store_pm';
import { usePMApi } from '../shared/queryShared';

/** the external task ids of the tasks (pure; sorted, unique, lower case) */
export function externalGuidsOf(tasks: { rowJSON?: { externalPredecessors?: { taskGUID?: string }[] } | null }[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) for (const e of t.rowJSON?.externalPredecessors ?? []) if (e?.taskGUID) set.add(String(e.taskGUID).toLowerCase());
  return [...set].sort();
}

export function useExternalDates() {
  const api = usePMApi();
  const on = usePMStore((s) => s.extFlags.ganttCrossProjectLinksEnabled === true);
  const tasksById = usePMStore((s) => s.tasksById);
  const key = useMemo(() => (on ? externalGuidsOf(Object.values(tasksById)).join(',') : ''), [on, tasksById]);
  useEffect(() => {
    const st = usePMStore.getState();
    if (!key) {
      if (Object.keys(st.externalDates).length) st.setExternalDates({});
      return;
    }
    let dead = false;
    (async () => {
      const dates: Record<string, { startMs: number; finishMs: number }> = {};
      for (const guid of key.split(',')) {
        try {
          const row = await api.readTask(guid);
          const startMs = row?.rowJSON?.startAt ? Date.parse(row.rowJSON.startAt) : NaN;
          const finishMs = row?.rowDuration ? Date.parse(row.rowDuration as string) : NaN;
          if (Number.isFinite(startMs) && Number.isFinite(finishMs)) dates[guid] = { startMs, finishMs };
        } catch {
          // an unreadable task (no access, deleted) is simply not a constraint
        }
      }
      if (!dead) usePMStore.getState().setExternalDates(dates);
    })();
    return () => {
      dead = true;
    };
  }, [key, api]);
}
