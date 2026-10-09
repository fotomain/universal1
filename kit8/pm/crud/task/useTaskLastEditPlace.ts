// rowJSON.lastEditPlace of a task: where the user edited it last (model/lastEditPlace.ts).
//   recordEditPlace(taskGUID, { surface, section, genus?, lineGUID? })
//     - nothing happens when the place is the one the task already has (the usual case: many edits in one place = no writes)
//     - the cache gets the place at once (the next opening reads it), the RPC pm_set_task_last_edit_place saves it ~0.6 s later
//       (the last place wins) and when the hook goes away
//     - quiet: a failure (SQL not installed yet, offline) never opens an error banner - the place is a convenience, not data
//   It is not an undo step and does not touch the schedule.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { PMProjectData } from '../../model/types';
import { lastEditPlaceOf, makeLastEditPlace, PMLastEditPlace, PMLastEditPlaceInput, sameLastEditPlace } from '../../model/lastEditPlace';
import { pmKeys, usePMApi } from '../shared/queryShared';

const SAVE_DELAY_MS = 600;

export function useTaskLastEditPlace(ownerGUID: string, projectGUID: string | null) {
  const api = usePMApi();
  const qc = useQueryClient();
  /** the place waiting to be saved, per task */
  const pending = useRef(new Map<string, PMLastEditPlace>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const batch = Array.from(pending.current.entries());
    pending.current.clear();
    for (const [rowGUID, place] of batch) {
      Promise.resolve(api.setTaskLastEditPlace(rowGUID, place)).catch(() => undefined);
    }
  }, [api]);
  useEffect(() => flush, [flush]);

  const recordEditPlace = useCallback((taskGUID: string, input: PMLastEditPlaceInput) => {
    if (!projectGUID || !taskGUID) return;
    const place = makeLastEditPlace(input, ownerGUID);
    if (!place) return;
    const known = pending.current.get(taskGUID) ?? lastEditPlaceOf(usePMStore.getState().tasksById[taskGUID]?.rowJSON);
    if (sameLastEditPlace(known, place)) return;
    pending.current.set(taskGUID, place);
    qc.setQueryData<PMProjectData>(pmKeys.projectData(projectGUID), (old) =>
      old ? { ...old, tasks: old.tasks.map((t) => (t.rowGUID === taskGUID ? { ...t, rowJSON: { ...t.rowJSON, lastEditPlace: place } } : t)) } : old
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [ownerGUID, projectGUID, qc, flush]);

  return useMemo(() => ({ recordEditPlace }), [recordEditPlace]);
}
