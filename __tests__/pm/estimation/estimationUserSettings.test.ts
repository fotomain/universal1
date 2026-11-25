// The last state of the estimation dashboard of a user on a work place (kit8/pm/estimation/settings): model, store (memory + device + rows) and the API shape.
const device: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async (k: string) => device[k] ?? null, setItem: async (k: string, v: string) => { device[k] = v; } } }));
import {
  ESTIMATION_DASHBOARD_ROW, ESTIMATION_SETTINGS_TABLE, normalizeDashboardSettings, normalizeProjectSettings, patchState, rowOfState, stateFromRows, ESTIMATION_SETTINGS_EMPTY,
  type EstimationSettingsRow,
} from '../../../kit8/pm/estimation/settings/estimationUserSettingsModel';
import {
  ESTIMATION_SETTINGS_SAVE_DELAY_MS, flushEstimationSettings, patchEstimationSettings, resetEstimationSettingsForTests, startEstimationSettings, stateFromCache, useEstimationSettingsStore,
} from '../../../kit8/pm/estimation/settings/estimationUserSettingsStore';

const U = 'user-1';
const row = (owner: string, wp: string, settings: any): EstimationSettingsRow => ({ rowOwnerGUID: owner, rowParentGUID: U, userWorkPlaceGUID: wp, rowJSON: { estimationSettings: settings } });

/** a client that keeps the rows in memory and records every call */
function fakeClient(initial: EstimationSettingsRow[] = [], opts: { missing?: boolean } = {}) {
  const rows = [...initial];
  const calls: any[] = [];
  const missing = { error: { code: '42P01', message: `relation "${ESTIMATION_SETTINGS_TABLE}" does not exist` }, data: null };
  return {
    rows, calls,
    from: (_t: string) => ({
      select: () => ({ eq: () => ({ in: (_c: string, places: string[]) => { calls.push({ op: 'select', places }); return Promise.resolve(opts.missing ? missing : { data: rows.filter((r) => places.includes(r.userWorkPlaceGUID)), error: null }); } }) }),
      upsert: (payload: any[], o: any) => {
        calls.push({ op: 'upsert', payload, onConflict: o.onConflict });
        if (opts.missing) return Promise.resolve(missing);
        for (const p of payload) {
          const i = rows.findIndex((r) => r.rowOwnerGUID === p.rowOwnerGUID && r.rowParentGUID === p.rowParentGUID && r.userWorkPlaceGUID === p.userWorkPlaceGUID);
          if (i >= 0) rows[i] = { ...rows[i], ...p }; else rows.push(p);
        }
        return Promise.resolve({ error: null });
      },
    }),
  };
}

beforeEach(() => { jest.useFakeTimers(); for (const k of Object.keys(device)) delete device[k]; resetEstimationSettingsForTests(); });
afterEach(() => { jest.useRealTimers(); });

describe('model', () => {
  test('a dashboard row keeps only known keys and values', () => {
    expect(normalizeDashboardSettings({ lastProjectGUID: 'p1', lastTab: 'norms', junk: 1 })).toEqual({ lastProjectGUID: 'p1', lastTab: 'norms' });
    expect(normalizeDashboardSettings({ lastProjectGUID: 5, lastTab: 'nope' })).toEqual({ lastProjectGUID: null });
    expect(normalizeDashboardSettings(null)).toEqual({});
  });
  test('a project row: layout / currency from the lists, widths only positive numbers', () => {
    expect(normalizeProjectSettings({ lastDocumentGUID: 'd1', tasksTreeWidth: 401.4, layout: 'quote', currencyBasis: 'accounting', tableColumnsWidth: { t: { a: 100.2, b: -1, c: 'x' }, u: 5 } }))
      .toEqual({ lastDocumentGUID: 'd1', tasksTreeWidth: 401, layout: 'quote', currencyBasis: 'accounting', tableColumnsWidth: { t: { a: 100 } } });
    expect(normalizeProjectSettings({ tasksTreeWidth: 0, layout: 'weird', currencyBasis: 'x' })).toEqual({});
  });
  test('the rows of ONE work place: its own row wins, the row of "empty" is the starting value, other work places are not seen', () => {
    const state = stateFromRows([
      row('dashboard', 'empty', { lastProjectGUID: 'old' }), row('dashboard', 'wp-a', { lastProjectGUID: 'mine' }),
      row('p1', 'empty', { layout: 'trades' }), row('p2', 'wp-b', { layout: 'quote' }), row('p3', 'wp-a', { layout: 'advanced' }),
    ], 'wp-a');
    expect(state.dashboard.lastProjectGUID).toBe('mine');
    expect(state.byProject).toEqual({ p1: { layout: 'trades' }, p3: { layout: 'advanced' } });
  });
  test('patchState returns the SAME object when nothing changes (no save is made for it)', () => {
    const a = patchState(ESTIMATION_SETTINGS_EMPTY, 'p1', { layout: 'advanced' });
    expect(a).not.toBe(ESTIMATION_SETTINGS_EMPTY);
    expect(patchState(a, 'p1', { layout: 'advanced' })).toBe(a);
    expect(patchState(a, ESTIMATION_DASHBOARD_ROW, { lastTab: 'summary' }).dashboard).toEqual({ lastTab: 'summary' });
  });
  test('rowOfState builds the row to upsert for one owner key', () => {
    const s = patchState(ESTIMATION_SETTINGS_EMPTY, 'p1', { tasksTreeWidth: 333 });
    expect(rowOfState(s, 'p1', U, 'wp-a')).toEqual({ rowOwnerGUID: 'p1', rowParentGUID: U, userWorkPlaceGUID: 'wp-a', rowJSON: { estimationSettings: { tasksTreeWidth: 333 } } });
  });
  test('the device copy is read safely', () => {
    expect(stateFromCache('not json')).toEqual(ESTIMATION_SETTINGS_EMPTY);
    expect(stateFromCache(JSON.stringify({ dashboard: { lastTab: 'export' }, byProject: { p: { layout: 'quote', zz: 1 } } }))).toEqual({ dashboard: { lastTab: 'export' }, byProject: { p: { layout: 'quote' } } });
  });
});

describe('store', () => {
  test('start: the rows of this work place are read (and the starting rows of "empty"); the state is ready', async () => {
    const client = fakeClient([row('dashboard', 'wp-a', { lastProjectGUID: 'p1' }), row('p1', 'wp-a', { layout: 'trades' }), row('p1', 'wp-b', { layout: 'quote' })]);
    await startEstimationSettings({ client, userGUID: U, workPlaceGUID: 'wp-a' });
    expect(client.calls[0]).toEqual({ op: 'select', places: ['wp-a', 'empty'] });
    const st = useEstimationSettingsStore.getState();
    expect(st.ready).toBe(true);
    expect(st.state.dashboard.lastProjectGUID).toBe('p1');
    expect(st.state.byProject.p1).toEqual({ layout: 'trades' });
  });

  test('a change is in the store at once, on the device at once, in the table after the delay - one upsert for all changed rows, key = (owner, user, work place)', async () => {
    const client = fakeClient();
    await startEstimationSettings({ client, userGUID: U, workPlaceGUID: 'wp-a' });
    patchEstimationSettings('p1', { tasksTreeWidth: 410 });
    patchEstimationSettings('p1', { layout: 'advanced' });
    patchEstimationSettings(ESTIMATION_DASHBOARD_ROW, { lastProjectGUID: 'p1' });
    expect(useEstimationSettingsStore.getState().state.byProject.p1).toEqual({ tasksTreeWidth: 410, layout: 'advanced' });
    expect(JSON.parse(device[`estimationDashboardUserSettings:${U}:wp-a`]).byProject.p1.tasksTreeWidth).toBe(410);
    expect(client.calls.filter((c) => c.op === 'upsert')).toHaveLength(0);
    jest.advanceTimersByTime(ESTIMATION_SETTINGS_SAVE_DELAY_MS + 1);
    await Promise.resolve(); await Promise.resolve();
    const up = client.calls.filter((c) => c.op === 'upsert');
    expect(up).toHaveLength(1);
    expect(up[0].onConflict).toBe('rowOwnerGUID,rowParentGUID,userWorkPlaceGUID');
    expect(up[0].payload.map((p: any) => `${p.rowOwnerGUID}|${p.userWorkPlaceGUID}`).sort()).toEqual(['dashboard|wp-a', 'p1|wp-a']);
  });

  test('the same value again saves nothing', async () => {
    const client = fakeClient();
    await startEstimationSettings({ client, userGUID: U, workPlaceGUID: 'wp-a' });
    patchEstimationSettings('p1', { layout: 'quote' });
    await flushEstimationSettings();
    const n = client.calls.filter((c) => c.op === 'upsert').length;
    patchEstimationSettings('p1', { layout: 'quote' });
    await flushEstimationSettings();
    expect(client.calls.filter((c) => c.op === 'upsert')).toHaveLength(n);
  });

  test('another work place of the same user has its own state', async () => {
    const client = fakeClient();
    await startEstimationSettings({ client, userGUID: U, workPlaceGUID: 'wp-a' });
    patchEstimationSettings('p1', { layout: 'quote' });
    await flushEstimationSettings();
    await startEstimationSettings({ client, userGUID: U, workPlaceGUID: 'wp-b' });
    expect(useEstimationSettingsStore.getState().state.byProject.p1).toBeUndefined();
    patchEstimationSettings('p1', { layout: 'trades' });
    await flushEstimationSettings();
    expect(client.rows.map((r) => `${r.userWorkPlaceGUID}:${r.rowJSON.estimationSettings?.layout}`).sort()).toEqual(['wp-a:quote', 'wp-b:trades']);
  });

  test('the device copy is used when the table is not there yet (SQL upgrade not run): nothing throws, the state stays on the device', async () => {
    device[`estimationDashboardUserSettings:${U}:wp-a`] = JSON.stringify({ dashboard: { lastProjectGUID: 'p9' }, byProject: {} });
    const client = fakeClient([], { missing: true });
    await startEstimationSettings({ client, userGUID: U, workPlaceGUID: 'wp-a' });
    const st = useEstimationSettingsStore.getState();
    expect(st.tableMissing).toBe(true);
    expect(st.ready).toBe(true);
    expect(st.state.dashboard.lastProjectGUID).toBe('p9');
    patchEstimationSettings('p9', { layout: 'quote' });
    await flushEstimationSettings();
    expect(JSON.parse(device[`estimationDashboardUserSettings:${U}:wp-a`]).byProject.p9.layout).toBe('quote');
  });

  test('rows that arrive after the dashboard is ready only add what is not known (the project on screen does not change under the user)', async () => {
    let release: (v: any) => void = () => undefined;
    const slow = fakeClient([row('dashboard', 'wp-a', { lastProjectGUID: 'late' })]);
    const original = slow.from;
    (slow as any).from = (t: string) => { const q = original(t); return { ...q, select: () => ({ eq: () => ({ in: () => new Promise((r) => { release = r; }) }) }) }; };
    device[`estimationDashboardUserSettings:${U}:wp-a`] = JSON.stringify({ dashboard: { lastProjectGUID: 'cached' }, byProject: {} });
    const started = startEstimationSettings({ client: slow, userGUID: U, workPlaceGUID: 'wp-a' });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    jest.advanceTimersByTime(2000); // READY_WAIT_MS: the rows are late, the dashboard goes on with the device copy
    await started;
    expect(useEstimationSettingsStore.getState().ready).toBe(true);
    expect(useEstimationSettingsStore.getState().state.dashboard.lastProjectGUID).toBe('cached');
    release({ data: [row('dashboard', 'wp-a', { lastProjectGUID: 'late', lastTab: 'summary' }), row('p5', 'wp-a', { layout: 'trades' })], error: null });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const st = useEstimationSettingsStore.getState().state;
    expect(st.dashboard.lastProjectGUID).toBe('cached'); // not taken from the late rows
    expect(st.dashboard.lastTab).toBe('summary');        // what was unknown is added
    expect(st.byProject.p5).toEqual({ layout: 'trades' });
  });
});
