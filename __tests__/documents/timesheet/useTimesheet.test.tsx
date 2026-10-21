/** @jest-environment jsdom */
// The data hooks of the time sheet: the list, one sheet with its commands, "Create based on" (a NEW draft each time), "Create work center", the options of the selects. The Supabase client is a fake.
import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanupUI, renderUI as renderKit } from '../../pm/ui/pmUiTestKit';
// a fresh query cache for every test (the kit shares one between tests)
const renderUI = (el: React.ReactElement) => renderKit(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>);

const fake: any = { calls: [] as { name: string; args: any }[], rpc: {} as Record<string, any>, tables: {} as Record<string, any> };
const builder = (table: string) => {
  const b: any = { _table: table };
  ['select', 'eq', 'in', 'order', 'limit', 'range'].forEach((m) => { b[m] = (...a: any[]) => { b['_' + m] = a; return b; }; });
  const result = () => { fake.calls.push({ name: `from:${table}`, args: { eq: b._eq, in: b._in } }); const r = fake.tables[table]; return typeof r === 'function' ? r(b) : r ?? { data: [], error: null }; };
  b.maybeSingle = async () => { const r = result(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; };
  b.then = (res: any, rej: any) => Promise.resolve(result()).then(res, rej);
  return b;
};
fake.client = {
  rpc: jest.fn(async (name: string, args: any) => { fake.calls.push({ name, args }); const r = fake.rpc[name]; return typeof r === 'function' ? r(args) : r ?? { data: null, error: null }; }),
  from: (t: string) => builder(t),
};
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false, navigate: jest.fn() }) }));
const { useCreateTimesheetFromTask, useMyWorkCenter, useNewTimesheet, useTimesheetDocument, useTimesheetList, useTimesheetOptions } = require('../../../kit8/documents/timesheet/useTimesheet');
import { EMPTY_TIMESHEET_FILTER } from '../../../kit8/documents/timesheet/timesheetModel';

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const callsOf = (name: string) => fake.calls.filter((c: any) => c.name === name);
let latest: any;
beforeEach(() => { fake.calls = []; fake.rpc = {}; fake.tables = {}; (window as any).open = jest.fn(() => null); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

const headerRow = { rowGUID: 'h1', rowOrganizationGUID: 'o1', timesheetWorkCenter: 'wc1', startDate: '2026-10-01', finishDate: '2026-10-31', rowJSON: { documentHeader: { documentNumber: 'TS-00001', documentStatus: 'draft' } } };

it('useTimesheetList: the filter goes to the RPC as p_filter; rows are parsed; an error is a message', async () => {
  fake.rpc.timesheet_list = { data: [{ rowGUID: 'd1', documentNumber: 'TS-1', documentStatus: 'posted', timesheetWorkCenter: 'wc1', workCenterTitle: 'Anna K', startDate: '2026-10-01', finishDate: '2026-10-31', lines: 2, hours: 12 }], error: null };
  function Probe() { latest = useTimesheetList({ ...EMPTY_TIMESHEET_FILTER, workCenter: 'wc-list-1', startFrom: '2026-10-01' }, { taskGUID: 't1' }); return null; }
  renderUI(<Probe />);
  await flush();
  expect(callsOf('timesheet_list')[0].args).toEqual({ p_filter: { taskGUID: 't1', timesheetWorkCenter: 'wc-list-1', startFrom: '2026-10-01' } });
  expect(latest.rows[0]).toMatchObject({ documentGUID: 'd1', documentStatus: 'posted', hours: 12, lineCount: 2 });
  cleanupUI();
  fake.rpc.timesheet_list = { data: null, error: { message: 'permission denied' } };
  function Probe2() { latest = useTimesheetList({ ...EMPTY_TIMESHEET_FILTER, status: 'err-case' }); return null; }
  renderUI(<Probe2 />);
  await flush();
  expect(latest.error).toBe('permission denied');
});

describe('useTimesheetDocument', () => {
  const mount = (guid: string) => { function Probe() { latest = useTimesheetDocument(guid); return null; } renderUI(<Probe />); };
  beforeEach(() => {
    fake.tables.project_timesheet_header = { data: [headerRow], error: null };
    fake.tables.project_timesheet_lines = { data: [{ rowGUID: 'l1', timesheetLineProject: 'p1', timesheetLineTask: 't1', timesheetLineRole: 'r1', timesheetLineBudgetItem: 'b1', orderInList: 1, timesheetLineHours: '8.00', unitSumForBudget: '100.000000' }], error: null };
    fake.tables.project_timesheet_lines_data_entered = { data: [{ rowLineGUID: 'l1', timesheetDay: '2026-10-05', timesheetHours: '8.00' }], error: null };
  });
  it('reads the sheet, its lines and its entered hours (only ENTERED cells exist)', async () => {
    mount('h1');
    await flush();
    expect(latest.header).toMatchObject({ rowGUID: 'h1', workCenter: 'wc1', status: 'draft', documentNumber: 'TS-00001' });
    expect(latest.lines).toHaveLength(1);
    expect(latest.entered).toEqual([{ lineGUID: 'l1', day: '2026-10-05', hours: 8 }]);
  });
  it('no sheet (not in my organization): header null, no lines are read', async () => {
    fake.tables.project_timesheet_header = { data: [], error: null };
    mount('hx');
    await flush();
    expect(latest.header).toBeNull();
    expect(callsOf('from:project_timesheet_lines')).toHaveLength(0);
  });
  it('every command calls its RPC with the GUID; the sheet is read again after it', async () => {
    fake.rpc.post_timesheet = { data: { status: 'posted', lines: 1, problems: [] }, error: null };
    fake.rpc.unpost_timesheet = { data: { status: 'draft', problems: [] }, error: null };
    fake.rpc.timesheet_add_line = { data: 'new-line', error: null };
    fake.rpc.timesheet_insert_line = { data: 'ins-line', error: null };
    mount('h1');
    await flush();
    const before = callsOf('from:project_timesheet_header').length;
    await act(async () => { await latest.setHeader({ startDate: '2026-10-02', finishDate: '2026-10-30' }); });
    expect(callsOf('timesheet_set_header')[0].args).toEqual({ p_header: 'h1', p_patch: { startDate: '2026-10-02', finishDate: '2026-10-30' } });
    let id: string | null = null;
    await act(async () => { id = await latest.addLine({ timesheetLineProject: 'p1' }); });
    expect(id).toBe('new-line');
    expect(callsOf('timesheet_add_line')[0].args).toEqual({ p_header: 'h1', p_patch: { timesheetLineProject: 'p1' } });
    await act(async () => { await latest.setLine('l1', { timesheetLineRole: 'r2' }); });
    expect(callsOf('timesheet_set_line')[0].args).toEqual({ p_line: 'l1', p_patch: { timesheetLineRole: 'r2' } });
    await act(async () => { await latest.setHours('l1', '2026-10-06', 4); });
    expect(callsOf('timesheet_set_hours')[0].args).toEqual({ p_line: 'l1', p_day: '2026-10-06', p_hours: 4 });
    await act(async () => { await latest.setHours('l1', '2026-10-06', null); });
    expect(callsOf('timesheet_set_hours')[1].args).toEqual({ p_line: 'l1', p_day: '2026-10-06', p_hours: null });
    await act(async () => { id = await latest.insertLine('l1', true, { timesheetLineProject: 'p1' }); });
    expect(callsOf('timesheet_insert_line')[0].args).toEqual({ p_header: 'h1', p_ref: 'l1', p_before: true, p_patch: { timesheetLineProject: 'p1' } });
    await act(async () => { await latest.moveLine('l1', 'last'); });
    expect(callsOf('timesheet_move_line')[0].args).toEqual({ p_line: 'l1', p_where: 'last' });
    await act(async () => { await latest.deleteLine('l1'); });
    expect(callsOf('timesheet_delete_line')[0].args).toEqual({ p_line: 'l1' });
    let a: any = null;
    await act(async () => { a = await latest.post(); });
    expect(a).toMatchObject({ status: 'posted' });
    expect(callsOf('post_timesheet')[0].args).toEqual({ p_header: 'h1' });
    await act(async () => { a = await latest.unpost(); });
    expect(a).toMatchObject({ status: 'draft' });
    await act(async () => { await latest.remove(); });
    expect(callsOf('timesheet_delete')[0].args).toEqual({ p_header: 'h1' });
    await flush();
    expect(callsOf('from:project_timesheet_header').length).toBeGreaterThan(before);
  });
  it('an error of a command is shown, the command answers null / false and the sheet is read again', async () => {
    fake.rpc.timesheet_set_hours = { data: null, error: { message: 'time sheet: more than 24 hours on 2026-10-06' } };
    mount('h1');
    await flush();
    let ok: boolean | null = null;
    await act(async () => { ok = await latest.setHours('l1', '2026-10-06', 30); });
    expect(ok).toBe(false);
    expect(latest.error).toBe('time sheet: more than 24 hours on 2026-10-06');
    act(() => latest.clearError());
    expect(latest.error).toBeNull();
  });
});

describe('useCreateTimesheetFromTask', () => {
  const mount = () => { function Probe() { latest = useCreateTimesheetFromTask(); return null; } renderUI(<Probe />); };
  it('asks for a NEW draft for the task (and the task line) and opens it; again = another call (never reused)', async () => {
    fake.rpc.create_timesheet_from_task = { data: { status: 'created', documentGUID: 'dNew' }, error: null };
    mount();
    await act(async () => { await latest.create('t1', 'tl1'); });
    expect(callsOf('create_timesheet_from_task')[0].args).toEqual({ p_task: 't1', p_task_line: 'tl1' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/timesheet/form', params: { documentGUID: 'dNew' } });
    await act(async () => { await latest.create('t1'); });
    expect(callsOf('create_timesheet_from_task')).toHaveLength(2);
    expect(callsOf('create_timesheet_from_task')[1].args).toEqual({ p_task: 't1', p_task_line: null });
  });
  it('a skipped task (a stage) opens nothing; an error is shown', async () => {
    fake.rpc.create_timesheet_from_task = { data: { status: 'skipped', skipped: [{ reason: 'taskNotNormal' }] }, error: null };
    mount();
    let a: any = null;
    await act(async () => { a = await latest.create('stage1'); });
    expect(a.status).toBe('skipped');
    expect(mockPush).not.toHaveBeenCalled();
    fake.rpc.create_timesheet_from_task = { data: null, error: { message: 'boom' } };
    await act(async () => { a = await latest.create('t1'); });
    expect(a).toBeNull();
    expect(latest.error).toBe('boom');
  });
  it('nothing without a task', async () => {
    mount();
    await act(async () => { await latest.create(''); });
    expect(callsOf('create_timesheet_from_task')).toHaveLength(0);
  });
});

describe('useMyWorkCenter ("Create work center") and useNewTimesheet', () => {
  it('reads the work center of the user; create() makes it; needsBusinessUnit brings the units to choose from', async () => {
    fake.rpc.timesheet_my_work_center = { data: null, error: null };
    fake.rpc.timesheet_create_my_work_center = { data: { status: 'needsBusinessUnit' }, error: null };
    fake.tables.businessUnitTable = { data: [{ rowGUID: 'bu1', rowJSON: { title: 'Unit 1' } }, { rowGUID: 'bu2', rowJSON: { title: 'Unit 2' } }], error: null };
    function Probe() { latest = useMyWorkCenter(true); return null; }
    renderUI(<Probe />);
    await flush();
    expect(latest.workCenter).toBe('');
    let a: any = null;
    await act(async () => { a = await latest.create(null); });
    expect(a.status).toBe('needsBusinessUnit');
    expect(callsOf('timesheet_create_my_work_center')[0].args).toEqual({ p_business_unit: null });
    await flush();
    expect(latest.unitChoices).toEqual([{ value: 'bu1', label: 'Unit 1' }, { value: 'bu2', label: 'Unit 2' }]);
    fake.rpc.timesheet_create_my_work_center = { data: { status: 'created', workCenter: 'wc-new' }, error: null };
    await act(async () => { a = await latest.create('bu2'); });
    expect(callsOf('timesheet_create_my_work_center')[1].args).toEqual({ p_business_unit: 'bu2' });
    expect(a).toEqual({ status: 'created', workCenter: 'wc-new' });
    await flush();
    expect(latest.unitChoices).toBeNull();
  });
  it('useNewTimesheet makes an empty draft (the database picks my work center and the current month)', async () => {
    fake.rpc.timesheet_create = { data: 'dNew', error: null };
    function Probe() { latest = useNewTimesheet(); return null; }
    renderUI(<Probe />);
    let guid: string | null = null;
    await act(async () => { guid = await latest.make(); });
    expect(guid).toBe('dNew');
    expect(callsOf('timesheet_create')[0].args).toEqual({ p_work_center: null, p_start: null, p_finish: null });
  });
});

describe('useTimesheetOptions', () => {
  it('own work center only (switch off): the work center is read by its GUID; all work centers when the switch is on', async () => {
    fake.rpc.timesheet_all_work_centers = { data: false, error: null };
    fake.rpc.timesheet_only_current_month = { data: true, error: null };
    fake.rpc.timesheet_my_work_center = { data: 'wc-mine', error: null };
    fake.tables.workCenterTable = (b: any) => (b._in ? { data: [{ rowGUID: 'wc-mine', rowJSON: { workCenterTitle: 'Anna K' } }], error: null } : { data: [{ rowGUID: 'wc1', rowJSON: { workCenterTitle: 'B' } }, { rowGUID: 'wc2', rowJSON: { workCenterTitle: 'A', isActive: false } }], error: null });
    fake.tables.project_table = { data: [{ rowGUID: 'p1', rowJSON: { name: 'Alpha' } }], error: null };
    function Probe() { latest = useTimesheetOptions('wc-mine', true); return null; }
    renderUI(<Probe />);
    await flush();
    expect(latest.switches).toEqual({ allWorkCenters: false, onlyCurrentMonth: true });
    expect(latest.workCenters).toEqual([{ value: 'wc-mine', label: 'Anna K' }]);
    expect(latest.projects).toEqual([{ value: 'p1', label: 'Alpha' }]);
  });
  it('rolesOf / budgetItemsOf / businessUnitsOf ask the database about the task and read the titles; a stage is not a task', async () => {
    fake.rpc.timesheet_all_work_centers = { data: true, error: null };
    fake.rpc.timesheet_only_current_month = { data: false, error: null };
    fake.rpc.timesheet_possible_roles = { data: ['r2', 'r1'], error: null };
    fake.rpc.timesheet_possible_budget_items = { data: ['b1'], error: null };
    fake.rpc.timesheet_possible_business_units = { data: [], error: null };
    fake.tables.resourceRoleTable = { data: [{ rowGUID: 'r1', rowJSON: { title: 'Developer' } }, { rowGUID: 'r2', rowJSON: { title: 'Analyst' } }], error: null };
    fake.tables.budgetItemTable = { data: [{ rowGUID: 'b1', rowJSON: { title: 'Salary' } }], error: null };
    fake.tables.project_task_table = { data: [{ rowGUID: 't1', rowJSON: { taskDescription: 'Task 1' } }, { rowGUID: 's1', rowJSON: { taskDescription: 'Stage', rowKind: 'stage' } }, { rowGUID: 'm1', rowJSON: { taskDescription: 'Done', rowKind: 'milestone' } }], error: null };
    fake.tables.workCenterTable = { data: [], error: null };
    function Probe() { latest = useTimesheetOptions('wc1', true); return null; }
    renderUI(<Probe />);
    await flush();
    expect(latest.switches).toEqual({ allWorkCenters: true, onlyCurrentMonth: false });
    expect(await latest.rolesOf('t1')).toEqual([{ value: 'r2', label: 'Analyst' }, { value: 'r1', label: 'Developer' }]);
    expect(callsOf('timesheet_possible_roles')[0].args).toEqual({ p_task: 't1', p_wc: 'wc1' });
    expect(await latest.budgetItemsOf('t1', 'r1')).toEqual([{ value: 'b1', label: 'Salary' }]);
    expect(callsOf('timesheet_possible_budget_items')[0].args).toEqual({ p_task: 't1', p_role: 'r1' });
    expect(await latest.businessUnitsOf('t1')).toEqual([]);
    expect(await latest.tasksOf('p1')).toEqual([{ value: 't1', label: 'Task 1' }]);
    expect(await latest.rolesOf('')).toEqual([]);
    expect(await latest.budgetItemsOf('t1', '')).toEqual([]);
  });
});
