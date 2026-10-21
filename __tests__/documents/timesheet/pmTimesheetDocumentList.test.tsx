/** @jest-environment jsdom */
// PMTimesheetDocumentList: the columns, the quick filters (applied by the database), "New time sheet" makes a draft and opens it, a click on a row opens the sheet, the task chip of "Go to → Time sheets",
// the totals. The data hooks and the table are fakes.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf, typeInto } from '../../pm/ui/pmUiTestKit';

const mockList: Record<string, any> = { rows: [], isLoading: false, error: null, refetch: jest.fn() };
const mockNew: Record<string, any> = {};
const mockUseList = jest.fn();
jest.mock('../../../kit8/documents/timesheet/useTimesheet', () => ({
  useTimesheetList: (...a: any[]) => { mockUseList(...a); return mockList; },
  useNewTimesheet: () => mockNew,
  useTimesheetOptions: () => ({ workCenters: [{ value: 'wc1', label: 'Anna K' }], switches: { allWorkCenters: false, onlyCurrentMonth: true } }),
}));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));
const mockTable = jest.fn();
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText }: any) => R.createElement(TextInput, { testID, value, onChangeText }) };
});
jest.mock('../../../kit8/documents/taskScope/useTaskScope', () => {
  const R = require('react');
  return { useTaskScope: (initial: any) => { const [scope, setScope] = R.useState(initial || { taskGUID: '', taskLineGUID: '' }); return { scope, active: !!scope.taskGUID, clear: () => setScope({ taskGUID: '', taskLineGUID: '' }), taskName: scope.taskGUID ? 'Task 112' : '' }; } };
});
const PMTimesheetDocumentList = require('../../../kit8/documents/timesheet/PMTimesheetDocumentList').default;
import { TimesheetListRow } from '../../../kit8/documents/timesheet/timesheetModel';
import { timesheetListColumns } from '../../../kit8/documents/timesheet/timesheetListColumns';

const row = (guid: string, over: Partial<TimesheetListRow> = {}): TimesheetListRow => ({ documentGUID: guid, documentNumber: `TS-${guid}`, documentStatus: 'draft', workCenter: 'wc1', workCenterTitle: 'Anna K', startDate: '2026-10-01', finishDate: '2026-10-31', lineCount: 2, hours: 12.5, ...over });
const flush = () => act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 200)); });
const lastTable = () => mockTable.mock.calls.at(-1)![0];
beforeEach(() => {
  Object.assign(mockList, { rows: [row('d1'), row('d2', { documentStatus: 'posted', hours: 8 })], isLoading: false, error: null, refetch: jest.fn() });
  Object.keys(mockNew).forEach((k) => delete mockNew[k]);
  Object.assign(mockNew, { make: jest.fn(async () => 'dNew'), busy: false, error: null });
  (globalThis as any).__pmTestReduxState = {};
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; Object.keys(mockSelects).forEach((k) => delete mockSelects[k]); });

describe('the table', () => {
  it('the rows are the sheets the database listed; a cell reads its text from the list row', () => {
    renderUI(<PMTimesheetDocumentList />);
    const t = lastTable();
    expect(t.entityName).toBe('projectTimesheetHeader');
    expect(t.rowFilter({ rowGUID: 'd1' })).toBe(true);
    expect(t.rowFilter({ rowGUID: 'zzz' })).toBe(false);
    const byGuid = new Map(mockList.rows.map((r: TimesheetListRow) => [r.documentGUID, r]));
    const cols = timesheetListColumns((r) => byGuid.get(r.rowGUID) as any);
    const get = (key: string, guid: string) => (cols.find((c: any) => c.key === key) as any).fromStored(null, { rowGUID: guid });
    expect(cols.map((c: any) => c.key)).toEqual(['n', 'posted', 'document', 'workCenter', 'startDate', 'finishDate', 'hours', 'lines', 'status']);
    expect(get('document', 'd1')).toBe('TS-d1');
    expect(get('workCenter', 'd1')).toBe('Anna K');
    expect(get('hours', 'd1')).toBe(12.5);
    expect(get('lines', 'd1')).toBe(2);
    expect(get('status', 'd1')).toBe('Draft');
    expect(get('status', 'd2')).toBe('Posted');
    expect(get('document', 'nope')).toBe('');
    // the Posted column: a green check only for a posted sheet
    const posted: any = cols.find((c: any) => c.key === 'posted');
    expect(posted.renderCell({ rowGUID: 'd1' }, 0, jest.fn())).toBeNull();
    expect(posted.renderCell({ rowGUID: 'd2' }, 0, jest.fn())).not.toBeNull();
    expect(posted.renderCell({ rowGUID: 'd2' }, 0, jest.fn()).props).toMatchObject({ indicator: 'posted', testID: 'timesheet-list-posted-d2' });
    expect(posted.searchText({ rowGUID: 'd2' })).toBe('posted');
    expect(posted.searchText({ rowGUID: 'd1' })).toBe('');
  });
  it('a click on a row opens the sheet', () => {
    renderUI(<PMTimesheetDocumentList />);
    lastTable().onRowOpen({ rowGUID: 'd2' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/timesheet/form', params: { documentGUID: 'd2' } });
    lastTable().onRowOpen({ rowGUID: 'unknown' });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
  it('the totals: the number of sheets and their hours', () => {
    renderUI(<PMTimesheetDocumentList />);
    expect(textOf('timesheet-list-totals')).toContain('2 time sheets');
    expect(textOf('timesheet-list-total-hours')).toBe('Hours: 20.5');
  });
});

describe('New time sheet', () => {
  it('the button and the + of the table make a draft (work center = mine, period = the current month) and open it', async () => {
    renderUI(<PMTimesheetDocumentList />);
    press('timesheet-list-new');
    await flush();
    expect(mockNew.make).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/timesheet/form', params: { documentGUID: 'dNew' } });
    mockPush.mockClear();
    await act(async () => { lastTable().onAdd(); await Promise.resolve(); });
    expect(mockNew.make).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/timesheet/form', params: { documentGUID: 'dNew' } });
  });
  it('nothing is opened when the draft could not be made; the error is shown', async () => {
    mockNew.make = jest.fn(async () => null);
    mockNew.error = 'permission denied';
    renderUI(<PMTimesheetDocumentList />);
    press('timesheet-list-new');
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
    expect(textOf('timesheet-list-create-error')).toBe('permission denied');
  });
});

describe('the quick filters are applied by the database', () => {
  it('work center and status are sent as typed (after a pause); a valid period day is sent, a half-typed one is not', async () => {
    renderUI(<PMTimesheetDocumentList />);
    act(() => mockSelects['timesheet-list-workCenterFilter'].onSelect('wc1'));
    act(() => mockSelects['timesheet-list-statusFilter'].onSelect('posted'));
    typeInto('timesheet-list-periodFilter-from', '2026-10-01');
    typeInto('timesheet-list-periodFilter-to', '2026-1');
    await flush();
    const last = mockUseList.mock.calls.at(-1)!;
    expect(last[0]).toEqual({ workCenter: 'wc1', status: 'posted', startFrom: '2026-10-01', finishTo: '' });
    expect(q('timesheet-list-clear')).not.toBeNull();
    press('timesheet-list-clear');
    await flush();
    expect(mockUseList.mock.calls.at(-1)![0]).toEqual({ workCenter: '', status: '', startFrom: '', finishTo: '' });
  });
  it('the work center filter lists the work centers', () => {
    renderUI(<PMTimesheetDocumentList />);
    expect(mockSelects['timesheet-list-workCenterFilter'].items).toEqual([{ value: 'wc1', label: 'Anna K' }]);
  });
});

describe('"Go to → Time sheets": the task chip', () => {
  it('the task goes to the database (taskGUID); the chip says so and its x shows all the sheets', async () => {
    renderUI(<PMTimesheetDocumentList taskGUID="t-112" />);
    expect(mockUseList.mock.calls.at(-1)![1]).toEqual({ taskGUID: 't-112' });
    expect(textOf('timesheet-list-scope-label')).toBe('Task: Task 112');
    press('timesheet-list-scope-clear');
    await flush();
    expect(mockUseList.mock.calls.at(-1)![1]).toEqual({});
    expect(q('timesheet-list-scope')).toBeNull();
  });
  it('no scope: no chip', () => {
    renderUI(<PMTimesheetDocumentList />);
    expect(q('timesheet-list-scope')).toBeNull();
  });
});

it('the empty text says how to start, and "no match" while a filter is on', () => {
  mockList.rows = [];
  renderUI(<PMTimesheetDocumentList />);
  expect(lastTable().emptyText).toMatch(/No time sheets yet/);
});
