// The last state of the estimation dashboard of the signed-in user on THIS work place - a zustand store (instant reads, no spinner), kept in three places:
//   memory (this store)  ->  the device (AsyncStorage: the dashboard opens where the user left it even offline / before the database answers)
//                        ->  estimation_dashboard_user_settings_table (per user + work place: the same state on every start of this work place; SQL PART 58)
// Writes: patchEstimationSettings(ownerKey, patch) changes the store at once, caches it on the device and upserts the changed rows after SAVE_DELAY_MS.
// Reads: startEstimationSettings(...) loads the device copy first, then the rows; the dashboard waits for `ready` (the rows answered, or READY_WAIT_MS passed).
import { create } from 'zustand';
import {
  ESTIMATION_DASHBOARD_ROW, ESTIMATION_SETTINGS_EMPTY, patchState, rowOfState, stateFromRows, normalizeDashboardSettings, normalizeProjectSettings,
  type EstimationAnySettings, type EstimationUserSettingsState,
} from './estimationUserSettingsModel';
import { createEstimationUserSettingsApi } from './estimationUserSettingsApi';

export const ESTIMATION_SETTINGS_SAVE_DELAY_MS = 800;
/** the rows do not answer: the dashboard goes on with the device copy */
export const ESTIMATION_SETTINGS_READY_WAIT_MS = 1500;
const CACHE_PREFIX = 'estimationDashboardUserSettings:';

interface StoreShape {
  state: EstimationUserSettingsState;
  /** the device copy is read and the rows answered (or gave up) */
  ready: boolean;
  /** the table is not in the database yet (SQL upgrade not run): only the device keeps the state */
  tableMissing: boolean;
}
export const useEstimationSettingsStore = create<StoreShape>(() => ({ state: ESTIMATION_SETTINGS_EMPTY, ready: false, tableMissing: false }));

interface Session { client: any; userGUID: string; workPlaceGUID: string; dirty: Set<string>; timer: ReturnType<typeof setTimeout> | null; flushing: Promise<void> | null; alive: boolean }
let session: Session | null = null;

const storage = (): any => { try { return require('@react-native-async-storage/async-storage').default; } catch { return null; } };
const cacheKey = (s: Pick<Session, 'userGUID' | 'workPlaceGUID'>) => `${CACHE_PREFIX}${s.userGUID}:${s.workPlaceGUID}`;

/** the device copy -> state (anything that is not a known setting is dropped) */
export function stateFromCache(raw: unknown): EstimationUserSettingsState {
  let o: any = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { o = null; } }
  const byProject: Record<string, any> = {};
  if (o?.byProject && typeof o.byProject === 'object') for (const [k, v] of Object.entries(o.byProject)) byProject[k] = normalizeProjectSettings(v);
  return { dashboard: normalizeDashboardSettings(o?.dashboard), byProject };
}

function writeCache(s: Session) {
  try { Promise.resolve(storage()?.setItem(cacheKey(s), JSON.stringify(useEstimationSettingsStore.getState().state))).catch(() => {}); } catch { /* only not kept on the device */ }
}

async function flush(s: Session): Promise<void> {
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  if (s.flushing) { await s.flushing; }
  const st = useEstimationSettingsStore.getState();
  if (!s.dirty.size || st.tableMissing) return;
  const keys = [...s.dirty];
  const rows = keys.map((k) => rowOfState(st.state, k, s.userGUID, s.workPlaceGUID));
  s.dirty.clear();
  s.flushing = createEstimationUserSettingsApi(s.client).saveRows(rows)
    .then((r) => { if (r.missing) useEstimationSettingsStore.setState({ tableMissing: true }); })
    .catch(() => { keys.forEach((k) => s.dirty.add(k)); }) // kept for the next change
    .finally(() => { s.flushing = null; });
  await s.flushing;
}

/** Starts (or restarts, when the user / work place changed) the memory of the dashboard. Safe to call again with the same arguments. */
export async function startEstimationSettings(args: { client: any; userGUID: string; workPlaceGUID: string }): Promise<void> {
  if (session && session.userGUID === args.userGUID && session.workPlaceGUID === args.workPlaceGUID) { session.client = args.client; return; }
  if (session) { session.alive = false; void flush(session); }
  const s: Session = { ...args, dirty: new Set(), timer: null, flushing: null, alive: true };
  session = s;
  useEstimationSettingsStore.setState({ state: ESTIMATION_SETTINGS_EMPTY, ready: false, tableMissing: false });

  // 1. the device copy: instant
  try {
    const raw = await Promise.resolve(storage()?.getItem(cacheKey(s)));
    if (s.alive && typeof raw === 'string') useEstimationSettingsStore.setState({ state: stateFromCache(raw) });
  } catch { /* nothing kept */ }

  // 2. the rows: they win over the device copy until the dashboard is ready, then they only add what is not known
  const remote = (async () => {
    try {
      const res = await createEstimationUserSettingsApi(s.client).readRows(s.userGUID, s.workPlaceGUID);
      if (!s.alive) return;
      if (res.missing) { useEstimationSettingsStore.setState({ tableMissing: true }); return; }
      const fromRows = stateFromRows(res.rows, s.workPlaceGUID);
      const ready = useEstimationSettingsStore.getState().ready;
      const cur = useEstimationSettingsStore.getState().state;
      const byProject = { ...cur.byProject };
      for (const [k, v] of Object.entries(fromRows.byProject)) if (!s.dirty.has(k) && (!ready || !byProject[k])) byProject[k] = v;
      const dashboard = s.dirty.has(ESTIMATION_DASHBOARD_ROW) ? cur.dashboard : ready ? { ...fromRows.dashboard, ...cur.dashboard } : fromRows.dashboard;
      useEstimationSettingsStore.setState({ state: { dashboard, byProject } });
      writeCache(s);
    } catch { /* offline: the device copy stays */ }
  })();
  await Promise.race([remote, new Promise((r) => setTimeout(r, ESTIMATION_SETTINGS_READY_WAIT_MS))]);
  if (s.alive) useEstimationSettingsStore.setState({ ready: true });
}

/** Changes the remembered state of one owner key ('dashboard' or an estimation project GUID). Nothing changes (no save) while the values are the same. */
export function patchEstimationSettings(ownerKey: string, patch: EstimationAnySettings): void {
  const st = useEstimationSettingsStore.getState();
  const next = patchState(st.state, ownerKey, patch);
  if (next === st.state) return;
  useEstimationSettingsStore.setState({ state: next });
  const s = session;
  if (!s) return;
  writeCache(s);
  s.dirty.add(ownerKey);
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => { void flush(s); }, ESTIMATION_SETTINGS_SAVE_DELAY_MS);
}

/** Saves what is waiting now (the dashboard closes). */
export function flushEstimationSettings(): Promise<void> { return session ? flush(session) : Promise.resolve(); }

/** test helper: forget the session and the state */
export function resetEstimationSettingsForTests(): void {
  if (session?.timer) clearTimeout(session.timer);
  if (session) session.alive = false;
  session = null;
  useEstimationSettingsStore.setState({ state: ESTIMATION_SETTINGS_EMPTY, ready: false, tableMissing: false });
}
