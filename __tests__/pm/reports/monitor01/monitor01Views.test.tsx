/** @jest-environment jsdom */
// Monitor01: the top tabs Report | Settings (Settings → Fields: the check boxes of the numeric fields, in a ReusableTable with the groups as folders), the View button of the toolbar
// (Save View · Restore View) and what a restored View does to the report. The rows hook, the API and the database (rpc) are replaced.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, qa, renderUI, textOf, toggleSwitch, typeInto } from '../../ui/pmUiTestKit';

const mockHook: { rows: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; checkedAt: number | null; reload: () => void } = { rows: [], isLoading: false, error: null, live: true, changedAt: Date.now(), checkedAt: null, reload: () => {} };
jest.mock('../../../../kit8/pm/reports/monitor01/useMonitor01Rows', () => ({ useMonitor01Rows: jest.fn(() => mockHook) }));
jest.mock('../../../../kit8/pm/reports/monitor01/monitor01Api', () => ({ fetchMonitor01Sources: jest.fn(), refreshMonitor01Now: jest.fn(async () => ({ tasks: 0, upserted: 0, deleted: 0 })) }));
jest.mock('../../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: (p: any) => ({ type: 'read', p }) } }) }) }));
jest.mock('../../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('../../../../kit8/pm/inner/tooltip/PMTooltip', () => ({
  ...jest.requireActual('../../../../kit8/pm/inner/tooltip/PMTooltip'),
  usePMTip: (text?: string) => ({ ref: { current: null }, accessibilityHint: text }),
}));
// the database: only rpc is used by the Views
const mockRpc = jest.fn();
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({
  useSupabase: () => ({
    supabase: {
      rpc: (...a: any[]) => mockRpc(...a),
      from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
      channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }), subscribe: () => ({}) }),
      removeChannel: () => {},
    },
  }),
}));
jest.doMock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  usePathname: () => '/x',
  useGlobalSearchParams: () => ({}),
}));
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});

const Monitor01Dashboard = require('../../../../kit8/pm/reports/monitor01/Monitor01Dashboard').default;
import { parseMonitor01Row } from '../../../../kit8/pm/reports/monitor01/monitor01Model';

const raw = (over: Record<string, any> = {}) => ({
  rowOwnerGUID: 't1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: 'task01',
  resourceRoleName: 'Data Analyst', qtyPlanned: 24, qtyContracted: 24, sumForBudget: 480, qtyRestToContract: 0, qtyReceived: 0, qtyVendorInvoiced: 0, qtyUsed: 0, qtyOnHand: 0, lineCount: 1, hasStalePlan: false, updated_at: '1', ...over,
});
const sheet = () => [raw(), raw({ rowOwnerGUID: 't2', taskName: 'task02', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: 'Pipe', measureUnit: 'unit_pcs', qtyPlanned: 100 })].map(parseMonitor01Row);
const T = 'monitor01';
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const heads = () => qa('monitor01-table-head-').filter((id) => !/-(project|role|month|task|unit)$/.test(id)).map((id) => id.replace('monitor01-table-head-', ''));
const ALL = ['planned', 'contracted', 'restToContract', 'sumForBudget', 'ordered', 'received', 'used', 'onHand', 'vendorInvoiced', 'sumVendorInvoiced', 'customerInvoiced', 'sumCustomerInvoiced'];
const cb = (id: string) => `${T}-fields-table-cell-${id}-checked`;
const checked = (id: string) => mustGet(cb(id)).getAttribute('aria-checked') === 'true';

const view = (over: Record<string, any> = {}) => ({ viewGUID: 'v1', viewTitle: 'Only hours', forOtherUsersEnabled: false, settings: { hiddenFields: ['sumForBudget', 'onHand'], tab: 'time', filters: { startDate: '2026-01-01', finishDate: '2026-12-31', projectGUID: '', taskGUID: 't1', resourceGUID: '' }, projectKind: 'projects', vatBasis: 'net' }, ownerGUID: 'u1', ownerName: 'Anna K', isMine: true, updatedAt: '2026-10-29T10:00:00Z', ...over });
let views: any[] = [];

beforeEach(() => {
  mockHook.rows = sheet(); mockHook.live = true; mockHook.checkedAt = null; mockHook.error = null; mockHook.isLoading = false; mockHook.changedAt = Date.now();
  (globalThis as any).__pmTestReduxState = {};
  views = [];
  mockRpc.mockImplementation(async (fn: string, args: any) => {
    if (fn === 'report_view_list') return { data: views, error: null };
    if (fn === 'report_view_save') return { data: 'saved-guid', error: null };
    if (fn === 'report_view_share') return { data: args.p_enabled, error: null };
    if (fn === 'report_view_delete') return { data: true, error: null };
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  });
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });

const mount = () => renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
const openSettings = () => { press(`${T}-top-tab-settings`); };
const openMenu = async () => { press(`${T}-view-button`); await wait(30); };

describe('the top tabs Report | Settings', () => {
  it('the Report tab is first and holds the current functionality; Settings has the sub tab Fields', () => {
    mount();
    expect(textOf(`${T}-top-tab-report`)).toContain('Report');
    expect(textOf(`${T}-top-tab-settings`)).toContain('Settings');
    expect(q('monitor01-table')).not.toBeNull();
    expect(q(`${T}-tab-all`)).not.toBeNull();                 // Time · Material · Expense · All stay on the Report tab
    expect(q(`${T}-settings`)).toBeNull();
    openSettings();
    expect(q(`${T}-settings`)).not.toBeNull();
    expect(q(`${T}-settings-tab-fields`)).not.toBeNull();
    expect(q(`${T}-fields`)).not.toBeNull();
    expect(q('monitor01-table')).toBeNull();
    expect(q(`${T}-tab-all`)).toBeNull();
    press(`${T}-top-tab-report`);
    expect(q('monitor01-table')).not.toBeNull();
  });
  it('the View button is on the toolbar of both tabs; Refresh / Auto refresh belong to the Report tab only', () => {
    mount();
    expect(q(`${T}-view-button`)).not.toBeNull();
    expect(q(`${T}-toolbar-refresh`)).not.toBeNull();
    openSettings();
    expect(q(`${T}-view-button`)).not.toBeNull();
    expect(q(`${T}-toolbar-refresh`)).toBeNull();
    expect(q(`${T}-toolbar-auto`)).toBeNull();
  });
});

describe('Settings → Fields', () => {
  it('lists the 12 numeric fields, every one checked by default, with the groups as folders', () => {
    mount();
    openSettings();
    for (const id of ALL) expect(checked(id)).toBe(true);
    expect(qa(`${T}-fields-table-row-`)).toHaveLength(12);
    expect(textOf(`${T}-fields-count`)).toBe('12 of 12 fields are in the report');
    expect(q(`${T}-fields-table-folders`)).not.toBeNull();
  });
  it('an unchecked field leaves the report: no column, no cell; a group without a field has no header', () => {
    mount();
    expect(heads()).toEqual(ALL);
    openSettings();
    press(cb('contracted'));
    expect(checked('contracted')).toBe(false);
    expect(textOf(`${T}-fields-count`)).toBe('11 of 12 fields are in the report');
    for (const id of ['ordered', 'received', 'used', 'onHand']) press(cb(id));
    press(`${T}-top-tab-report`);
    expect(heads()).toEqual(['planned', 'restToContract', 'sumForBudget', 'vendorInvoiced', 'sumVendorInvoiced', 'customerInvoiced', 'sumCustomerInvoiced']);
    expect(q('monitor01-table-group-Plan')).not.toBeNull();
    expect(q('monitor01-table-group-Fact')).toBeNull();
    expect(qa('monitor01-table-cell-').some((id) => id.endsWith('-contracted') || id.endsWith('-used'))).toBe(false);
    expect(qa('monitor01-table-cell-').some((id) => id.endsWith('-planned'))).toBe(true);
    // checked again: back where it was
    openSettings();
    press(cb('contracted'));
    press(`${T}-top-tab-report`);
    expect(heads()).toContain('contracted');
  });
  it('Clear all / Select all work on every field; with no field checked the report says so', () => {
    mount();
    openSettings();
    press(`${T}-fields-clear-all`);
    for (const id of ALL) expect(checked(id)).toBe(false);
    expect(textOf(`${T}-fields-count`)).toBe('0 of 12 fields are in the report');
    expect(q(`${T}-fields-none`)).not.toBeNull();
    press(`${T}-top-tab-report`);
    expect(heads()).toEqual([]);
    expect(q(`${T}-no-fields`)).not.toBeNull();
    openSettings();
    press(`${T}-fields-select-all`);
    for (const id of ALL) expect(checked(id)).toBe(true);
    press(`${T}-top-tab-report`);
    expect(heads()).toEqual(ALL);
    expect(q(`${T}-no-fields`)).toBeNull();
  });
  it('Select all / Clear all are off when they would change nothing', () => {
    mount();
    openSettings();
    expect((mustGet(`${T}-fields-select-all`) as any).getAttribute('aria-disabled')).toBe('true');
    press(cb('onHand'));
    expect((mustGet(`${T}-fields-select-all`) as any).getAttribute('aria-disabled')).not.toBe('true');
  });
});

describe('View → Save View', () => {
  it('the View button opens a menu with Save View and Restore View', async () => {
    mount();
    await openMenu();
    expect(q(`${T}-view-save`)).not.toBeNull();
    expect(q(`${T}-view-restore`)).not.toBeNull();
  });
  it('Save View asks for the ReportViewTitle (obligatory) and saves the current settings: the checked fields, the tab, the filters', async () => {
    mount();
    openSettings();
    press(cb('onHand'));
    press(cb('sumForBudget'));
    press(`${T}-top-tab-report`);
    press(`${T}-tab-time`);
    typeInto(`${T}-filters-startDate`, '2026-02-01');
    await openMenu();
    press(`${T}-view-save`);
    await flush();
    expect(q(`${T}-view-save-window`)).not.toBeNull();
    expect((mustGet(`${T}-view-save-window-save`) as any).getAttribute('aria-disabled')).toBe('true');   // no title: no Save
    typeInto(`${T}-view-save-window-title`, '  Only hours ');
    toggleSwitch(`${T}-view-save-window-for-others`);
    press(`${T}-view-save-window-save`);
    await flush();
    const call = mockRpc.mock.calls.find((c) => c[0] === 'report_view_save')!;
    expect(call[1]).toMatchObject({ p_report: 'Monitor01', p_title: 'Only hours', p_for_others: true });
    expect(call[1].p_settings).toMatchObject({ version: 1, hiddenFields: ['sumForBudget', 'onHand'], tab: 'time', vatBasis: 'cost' });
    expect(call[1].p_settings.filters.projectGUID).toBe('');
    expect(q(`${T}-view-save-window`)).toBeNull();           // closed after the save
  });
  it('a title that one of your Views has already: the window says Save replaces it', async () => {
    views = [view()];
    mount();
    await openMenu();
    press(`${T}-view-save`);
    await flush();
    typeInto(`${T}-view-save-window-title`, 'only HOURS');
    await flush();
    expect(q(`${T}-view-save-window-replace`)).not.toBeNull();
    expect(textOf(`${T}-view-save-window-save`)).toContain('Replace');
    typeInto(`${T}-view-save-window-title`, 'Another');
    expect(q(`${T}-view-save-window-replace`)).toBeNull();
  });
  it('the error of the database stays in the window (nothing is lost)', async () => {
    mockRpc.mockImplementation(async (fn: string) => (fn === 'report_view_save' ? { data: null, error: { message: 'report_view_save: sign in first' } } : { data: [], error: null }));
    mount();
    await openMenu();
    press(`${T}-view-save`);
    await flush();
    typeInto(`${T}-view-save-window-title`, 'x');
    press(`${T}-view-save-window-save`);
    await flush();
    expect(textOf(`${T}-view-save-window-error`)).toContain('sign in first');
    expect(q(`${T}-view-save-window`)).not.toBeNull();
  });
});

describe('View → Restore View', () => {
  it('opens the list of the Views with the column "For other users enabled", the owner and the date', async () => {
    views = [view(), view({ viewGUID: 'v2', viewTitle: 'Shared by Boris', isMine: false, forOtherUsersEnabled: true, ownerName: 'Boris M' })];
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('report_view_list', { p_report: 'Monitor01' });
    const win = `${T}-view-restore-window`;
    const text = mustGet(win).textContent || '';
    expect(text).toContain('Restore View');
    expect(text).toContain('For other users enabled');
    expect(text).toContain('ReportViewTitle');
    expect(text).toContain('Only hours');
    expect(text).toContain('Shared by Boris');
    expect(text).toContain('Boris M');
    expect(mustGet(`${win}-for-others-v1`).getAttribute('aria-checked')).toBe('false');
    expect(mustGet(`${win}-for-others-v2`).getAttribute('aria-checked')).toBe('true');
    // only the owner can switch it; a colleague's View is read-only
    expect((mustGet(`${win}-for-others-v2`) as any).getAttribute('aria-disabled')).toBe('true');
    expect(q(`${win}-delete-v2`)).toBeNull();
    expect(q(`${win}-delete-v1`)).not.toBeNull();
  });
  it('Restore applies the View: the fields, the tab, the filters, the VAT basis - and closes the window', async () => {
    views = [view()];
    mount();
    expect(heads()).toEqual(ALL);
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    press(`${T}-view-restore-window-restore-v1`);
    await flush();
    expect(q(`${T}-view-restore-window`)).toBeNull();
    expect(heads()).toEqual(ALL.filter((id) => id !== 'sumForBudget' && id !== 'onHand'));
    expect(mustGet(`${T}-tab-time`).getAttribute('aria-selected')).toBe('true');
    expect(inputValueOf(`${T}-filters-startDate`)).toBe('2026-01-01');
    expect(inputValueOf(`${T}-filters-finishDate`)).toBe('2026-12-31');
    // the Fields tab shows the same state
    openSettings();
    expect(checked('onHand')).toBe(false);
    expect(checked('planned')).toBe(true);
    // the next Save View starts with the title of the restored View
    await openMenu();
    press(`${T}-view-save`);
    await flush();
    expect(inputValueOf(`${T}-view-save-window-title`)).toBe('Only hours');
  });
  it('a View that is not applicable here is applied as far as it can be: a task that is not in the rows is cleared', async () => {
    views = [view({ settings: { hiddenFields: ['onHand'], tab: 'all', filters: { taskGUID: 'gone' } } })];
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    press(`${T}-view-restore-window-restore-v1`);
    await flush();
    expect(heads()).not.toContain('onHand');
    expect(qa('monitor01-table-item-').filter((id) => /\|\d{4}-\d{2}-\d{2}$/.test(id)).length).toBeGreaterThan(0);   // the rows are not filtered down to nothing
  });
  it('a damaged View never breaks the report', async () => {
    views = [view({ settings: 'garbage' })];
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    press(`${T}-view-restore-window-restore-v1`);
    await flush();
    expect(heads()).toEqual(ALL);
  });
  it('the owner switches "For other users enabled" in the list (report_view_share)', async () => {
    views = [view()];
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    press(`${T}-view-restore-window-for-others-v1`);
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('report_view_share', { p_view: 'v1', p_enabled: true });
    expect(mustGet(`${T}-view-restore-window-for-others-v1`).getAttribute('aria-checked')).toBe('true');
  });
  it('Delete asks once more, then deletes the View (report_view_delete)', async () => {
    views = [view()];
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    press(`${T}-view-restore-window-delete-v1`);
    expect(mockRpc.mock.calls.some((c) => c[0] === 'report_view_delete')).toBe(false);
    press(`${T}-view-restore-window-delete-confirm-v1`);
    await flush();
    expect(mockRpc).toHaveBeenCalledWith('report_view_delete', { p_view: 'v1' });
    expect(q(`${T}-view-restore-window-restore-v1`)).toBeNull();
  });
  it('with no View the list says how to make one', async () => {
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    expect(mustGet(`${T}-view-restore-window`).textContent).toContain('No saved Views yet');
  });
  it('the error of the database is shown in the window', async () => {
    mockRpc.mockImplementation(async () => ({ data: null, error: { message: 'permission denied for table project_report_settings' } }));
    mount();
    await openMenu();
    press(`${T}-view-restore`);
    await flush();
    await flush();
    expect(textOf(`${T}-view-restore-window-error`)).toContain('permission denied');
  });
});

function inputValueOf(testID: string): string {
  const el = mustGet(testID) as HTMLInputElement;
  const input = (el.tagName === 'INPUT' ? el : el.querySelector('input')) as HTMLInputElement;
  return input.value;
}
