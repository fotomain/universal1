// The run: which calls, in which order, in which pieces; what a failure does.
import { CALENDARS_WITH_DAYS, fileKeys, INITIAL_GROUPS, INITIAL_TABLES, INSTALL_CHUNK, InitialDataStatus } from '../../kit8/initial/data/code/initialDataModel';
import { loadAllInitialFiles } from '../../kit8/initial/data/code/loadInitialJson';
import { InitialDataRunError, InitialProgress, runInitialData } from '../../kit8/initial/data/code/runInitialData';

const mockFillRatesOfDay = jest.fn();
jest.mock('../../kit8/initial/data/code/rates/ratesApi', () => ({
  fillRatesOfDay: (...a: any[]) => mockFillRatesOfDay(...a),
  readCurrencies: async () => [{ rowGUID: 'g-USD', rowJSON: { currencyCode: 'USD' } }],
}));

const files = loadAllInitialFiles();
function emptyStatus(over: Partial<InitialDataStatus> = {}): InitialDataStatus {
  const tables: InitialDataStatus['tables'] = {};
  for (const t of INITIAL_TABLES) tables[t.table] = { rows: 0, found: [] };
  tables.managementCalendarDaysTable = { rows: 0, found: [] };
  tables.application_permission_table = { rows: 0, found: [] };
  return { tables, year: 2026, signedIn: true, canWrite: true, canWriteApplication: true, isApplicationAdmin: false, bootstrap: true, ...over };
}
/** a Supabase whose rpc records the calls; failOn = a table whose install answers an error */
function fakeSupabase(failOn?: string) {
  const calls: { name: string; args: any }[] = [];
  const rpc = async (name: string, args: any) => {
    calls.push({ name, args });
    if (name === 'initial_data_install') {
      if (args.p_table === failOn) return { data: null, error: { message: 'boom' } };
      return { data: { inserted: args.p_rows.length, skipped: 0 }, error: null };
    }
    if (name === 'initial_data_fill_calendars') return { data: 6, error: null };
    if (name === 'initial_data_bootstrap_admin') return { data: true, error: null };
    return { data: null, error: null };
  };
  return { rpc, calls };
}
const ALL = INITIAL_GROUPS.map((g) => g.id);

beforeEach(() => { mockFillRatesOfDay.mockReset(); mockFillRatesOfDay.mockResolvedValue({ day: '2025-12-31', added: { USD: '2025-12-30' }, upToDate: [], unsupported: [], noRate: [] }); });

describe('runInitialData', () => {
  it('a new database: the administrator first, then every table in the order of the definition, calendars after their table, rates last of the required', async () => {
    const sb = fakeSupabase();
    const progress: InitialProgress[] = [];
    const res = await runInitialData({ supabase: sb, files, status: emptyStatus(), groupIds: ALL, onProgress: (p) => progress.push(p), today: '2026-11-26' });
    const names = sb.calls.map((c) => c.name === 'initial_data_install' ? c.args.p_table : c.name);
    expect(names[0]).toBe('initial_data_bootstrap_admin');
    const tableOrder = [...new Set(names.filter((n) => INITIAL_TABLES.some((t) => t.table === n)))];
    expect(tableOrder).toEqual(INITIAL_TABLES.map((t) => t.table));
    expect(names.indexOf('initial_data_fill_calendars')).toBeGreaterThan(names.lastIndexOf('managementCalendarTable'));
    expect(names.indexOf('initial_data_fill_calendars')).toBeLessThan(names.indexOf('kanban_stage_table'));
    expect(res.administrator).toBe(true);
    expect(res.calendarYears).toBe(6);
    expect(res.rates?.added).toEqual({ USD: '2025-12-30' });
    expect(mockFillRatesOfDay).toHaveBeenCalledTimes(1);
    expect(mockFillRatesOfDay.mock.calls[0][0].day).toBe('2025-12-31');
    // the rates come after the currencies, before the optional groups
    expect(progress.map((p) => p.groupId).filter((id, i, a) => a.indexOf(id) === i)).toEqual(ALL);
  });
  it('the pieces are at most INSTALL_CHUNK rows and together they are the whole file', async () => {
    const sb = fakeSupabase();
    await runInitialData({ supabase: sb, files, status: emptyStatus(), groupIds: ALL });
    const crud = sb.calls.filter((c) => c.args?.p_table === 'project_permission_profile_crud_table');
    expect(crud.length).toBe(Math.ceil(files.project_permission_profile_crud_table.rows.length / INSTALL_CHUNK));
    expect(crud.every((c) => c.args.p_rows.length <= INSTALL_CHUNK)).toBe(true);
    expect(crud.reduce((a, c) => a + c.args.p_rows.length, 0)).toBe(files.project_permission_profile_crud_table.rows.length);
  });
  it('only what the database does not have is sent; a complete table is not called at all', async () => {
    const st = emptyStatus({ isApplicationAdmin: true, bootstrap: false });
    for (const t of INITIAL_TABLES) if (t.table !== 'managementGenusTable') st.tables[t.table] = { rows: 1, found: fileKeys(t, files[t.table]) };
    st.tables.managementGenusTable = { rows: 1, found: ['costsGenus'] };
    const sb = fakeSupabase();
    await runInitialData({ supabase: sb, files, status: st, groupIds: ['genus'] });
    expect(sb.calls.length).toBe(1);
    expect(sb.calls[0].args.p_table).toBe('managementGenusTable');
    expect(sb.calls[0].args.p_rows.map((r: any) => r.rowGUID)).not.toContain('costsGenus');
    expect(sb.calls[0].args.p_rows.length).toBe(files.managementGenusTable.rows.length - 1);
  });
  it('an application administrator exists already: nobody is bootstrapped', async () => {
    const sb = fakeSupabase();
    await runInitialData({ supabase: sb, files, status: emptyStatus({ isApplicationAdmin: true, bootstrap: false }), groupIds: ['admin'] });
    expect(sb.calls.find((c) => c.name === 'initial_data_bootstrap_admin')).toBeUndefined();
  });
  it('only the chosen groups are written', async () => {
    const sb = fakeSupabase();
    await runInitialData({ supabase: sb, files, status: emptyStatus(), groupIds: ['countries', 'languages'] });
    expect([...new Set(sb.calls.map((c) => c.args.p_table))]).toEqual(['countryTable', 'language_catalog']);
  });
  it('a failure stops at its group with the group and the table; what was written stays; nothing after it is tried', async () => {
    const sb = fakeSupabase('managementGenusTable');
    let error: any;
    await runInitialData({ supabase: sb, files, status: emptyStatus(), groupIds: ALL }).catch((e) => { error = e; });
    expect(error).toBeInstanceOf(InitialDataRunError);
    expect(error.groupId).toBe('genus');
    expect(error.table).toBe('managementGenusTable');
    expect(error.message).toContain('boom');
    const tables = sb.calls.map((c) => c.args?.p_table).filter(Boolean);
    expect(tables).toContain('project_permission_profile_catalog');
    expect(tables).not.toContain('budgetItemTable');
  });
  it('a failure of the rates names the group rates (the first run may go on without them)', async () => {
    mockFillRatesOfDay.mockRejectedValue(new Error('Rates service is not reachable (offline)'));
    const sb = fakeSupabase();
    let error: any;
    await runInitialData({ supabase: sb, files, status: emptyStatus(), groupIds: ALL }).catch((e) => { error = e; });
    expect(error).toBeInstanceOf(InitialDataRunError);
    expect(error.groupId).toBe('rates');
    expect(error.message).toContain('not reachable');
    expect(sb.calls.map((c) => c.args?.p_table)).not.toContain('countryTable');
  });
  it('the progress moves from 0 to 1 and never back', async () => {
    const progress: InitialProgress[] = [];
    await runInitialData({ supabase: fakeSupabase(), files, status: emptyStatus(), groupIds: ALL, onProgress: (p) => progress.push(p) });
    const f = progress.map((p) => p.fraction);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThanOrEqual(f[i - 1]);
    expect(f[0]).toBeLessThan(0.2);
    expect(f[f.length - 1]).toBe(1);
    expect(progress[progress.length - 1].text).toBe('Done');
  });
  it('the calendars filled are the five of the model', () => { expect(CALENDARS_WITH_DAYS.length).toBe(5); });
});
