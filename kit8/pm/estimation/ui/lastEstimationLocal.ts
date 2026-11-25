// lastEstimationLocal - the estimation dashboard remembers the project the user worked on last and, per estimation project, the estimate (document) opened last.
// Kept ON THIS DEVICE (AsyncStorage + memory, no SQL), like homeSettingsLocal. An id that no longer exists is simply not used by the caller (it falls back to the first estimate / the picker).
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'estimationLastOpened';

export interface LastEstimation {
  /** the project the user opened (the one that was asked: it may name another project as its estimation) */
  projectGUID: string | null;
  /** estimation project -> the estimate opened last in it */
  documentByProject: Record<string, string>;
}
export const LAST_ESTIMATION_EMPTY: LastEstimation = { projectGUID: null, documentByProject: {} };

/** a stored value -> a safe LastEstimation (anything else is dropped) */
export function normalizeLastEstimation(v: unknown): LastEstimation {
  const o: any = v && typeof v === 'object' ? v : {};
  const docs: Record<string, string> = {};
  if (o.documentByProject && typeof o.documentByProject === 'object') for (const [k, g] of Object.entries(o.documentByProject)) if (typeof g === 'string' && g) docs[k] = g;
  return { projectGUID: typeof o.projectGUID === 'string' && o.projectGUID ? o.projectGUID : null, documentByProject: docs };
}

let state: LastEstimation = LAST_ESTIMATION_EMPTY;
let loadPromise: Promise<LastEstimation> | null = null;

const storage = (): any => { try { return require('@react-native-async-storage/async-storage').default; } catch { return null; } };

export function loadLastEstimation(): Promise<LastEstimation> {
  if (!loadPromise) {
    loadPromise = Promise.resolve(storage()?.getItem(STORAGE_KEY))
      .then((v: unknown) => { if (typeof v === 'string') state = normalizeLastEstimation(JSON.parse(v)); return state; })
      .catch(() => state);
  }
  return loadPromise;
}

/** change what is remembered (only when it differs) */
export function saveLastEstimation(patch: { projectGUID?: string | null; documentGUID?: string | null; documentProjectGUID?: string | null }): void {
  const next: LastEstimation = { projectGUID: state.projectGUID, documentByProject: { ...state.documentByProject } };
  if (patch.projectGUID !== undefined) next.projectGUID = patch.projectGUID;
  if (patch.documentProjectGUID && patch.documentGUID !== undefined) { if (patch.documentGUID) next.documentByProject[patch.documentProjectGUID] = patch.documentGUID; else delete next.documentByProject[patch.documentProjectGUID]; }
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  try { Promise.resolve(storage()?.setItem(STORAGE_KEY, JSON.stringify(state))).catch(() => {}); } catch { /* the choice is only not kept */ }
}

/** the remembered choice; `ready` turns true once the device storage has answered */
export function useLastEstimation(): { ready: boolean; last: LastEstimation } {
  const [last, setLast] = useState<LastEstimation | null>(null);
  useEffect(() => { let alive = true; void loadLastEstimation().then((v) => { if (alive) setLast(v); }); return () => { alive = false; }; }, []);
  return { ready: last !== null, last: last ?? LAST_ESTIMATION_EMPTY };
}

/** test helper: forget the memory and the loaded state */
export function resetLastEstimationForTests(): void { state = LAST_ESTIMATION_EMPTY; loadPromise = null; }
