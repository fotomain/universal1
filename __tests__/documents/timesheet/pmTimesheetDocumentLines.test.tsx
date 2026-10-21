/** @jest-environment jsdom */
// PMTimesheetDocumentLines: ONE COLUMN FOR EVERY DAY of the period (both dates included), the hour cells EMPTY at the start, the order Project -> Task -> Role -> Budget item -> Business unit -> hours (each is enabled
// after the one before it), the 24-hour rule in the cell, empty / 0 removes the entered hour, the totals, a posted sheet is read only. The selects and the number cell are fakes that record their props.
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf } from '../../pm/ui/pmUiTestKit';

const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockCells: Record<string, any> = {};
jest.mock('../../../kit8/pm/components/PMNumberInputApp', () => ({ __esModule: true, default: (p: any) => { mockCells[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockButtons: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const Real = jest.requireActual('../../../kit8/ui/components/common/ButtonApp').default;
  const Spy = (p: any) => { if (p.testID) mockButtons[p.testID] = p; return R.createElement(Real, p); };
  return { __esModule: true, default: Spy, ButtonApp: Spy };
});
const PMTimesheetDocumentLines = require('../../../kit8/documents/timesheet/PMTimesheetDocumentLines').default;
import { TimesheetEntered, TimesheetHeader, TimesheetLine } from '../../../kit8/documents/timesheet/timesheetModel';

const T = 'timesheet';
const header = (over: Partial<TimesheetHeader> = {}): TimesheetHeader => ({ rowGUID: 'h1', organization: 'o1', workCenter: 'wc1', startDate: '2026-10-05', finishDate: '2026-10-11', documentNumber: 'TS-00001', status: 'draft', ...over });
const line = (guid: string, over: Partial<TimesheetLine> = {}): TimesheetLine => ({ rowGUID: guid, project: 'p1', task: 't1', role: 'r1', budgetItem: 'b1', businessUnit: '', orderInList: 1, hours: 0, unitSumForBudget: 100, rateSource: 'taskLine', unitPrice: null, unitPriceCurrency: '', ...over });
const opt = (v: string) => ({ value: v, label: `Title ${v}` });
const options = (over: Record<string, any> = {}) => ({
  switches: { allWorkCenters: false, onlyCurrentMonth: true }, workCenters: [opt('wc1')], projects: [opt('p1')],
  tasksOf: jest.fn(async (p: string) => (p ? [opt('t1')] : [])), rolesOf: jest.fn(async (t: string) => (t ? [opt('r1'), opt('r2')] : [])), budgetItemsOf: jest.fn(async (t: string, r: string) => (t && r ? [opt('b1')] : [])),
  businessUnitsOf: jest.fn(async () => []), titleOf: jest.fn(async (_t: string, id: string) => id), isLoading: false, ...over,
});
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const fns = () => ({ onAddLine: jest.fn(), onSetLine: jest.fn(), onDeleteLine: jest.fn(), onSetHours: jest.fn(), onInsertLine: jest.fn(), onMoveLine: jest.fn() });
function show(over: Record<string, any> = {}) {
  const f = fns();
  const props = { header: header(), lines: [line('l1')], entered: [] as TimesheetEntered[], options: options(), edit: true, loading: false, ...f, ...over };
  renderUI(<PMTimesheetDocumentLines testID={T} {...props} />);
  return { ...f, props };
}
afterEach(() => { cleanupUI(); jest.clearAllMocks(); [mockSelects, mockCells, mockButtons].forEach((m) => Object.keys(m).forEach((k) => delete m[k])); });

describe('one column for every day of the period', () => {
  it('7 days (both dates included) = 7 day columns; the title is the weekday and the day', async () => {
    show();
    await flush();
    expect(qa(`${T}-day-2026`)).toHaveLength(7);
    expect(textOf(`${T}-day-2026-10-05`)).toBe('Mon 05');
    expect(textOf(`${T}-day-2026-10-11`)).toBe('Sun 11');
  });
  it('a one-day period has one column; a whole month has 31', async () => {
    show({ header: header({ startDate: '2026-10-05', finishDate: '2026-10-05' }) });
    await flush();
    expect(qa(`${T}-day-2026`)).toHaveLength(1);
    show({ header: header({ startDate: '2026-10-01', finishDate: '2026-10-31' }) });
    await flush();
    expect(qa(`${T}-day-2026`)).toHaveLength(31);
  });
  it('moving the finish date adds / removes columns', async () => {
    const { props } = show();
    await flush();
    expect(qa(`${T}-day-2026`)).toHaveLength(7);
    renderUI(<PMTimesheetDocumentLines testID={T} {...props} header={header({ finishDate: '2026-10-08' })} />);
    await flush();
    expect(qa(`${T}-day-2026`)).toHaveLength(4);
  });
});

describe('the hour cells are EMPTY at the start; only entered hours are shown', () => {
  it('every cell of a new line has no value; an entered cell shows its hours', async () => {
    show({ entered: [{ lineGUID: 'l1', day: '2026-10-06', hours: 8 }] });
    await flush();
    const cells = Object.keys(mockCells).filter((k) => k.includes('-hours-'));
    expect(cells).toHaveLength(7);
    for (const k of cells) expect(mockCells[k].value).toBe(k.endsWith('2026-10-06') ? 8 : null);
    expect(mockCells[`${T}-line-l1-hours-2026-10-06`]).toMatchObject({ tableName: 'project_timesheet_lines_data_entered', tableFieldName: 'timesheetHours', max: 24 });
  });
  it('typing hours saves that cell (line, day, hours); an emptied cell sends null (removes the row)', async () => {
    const { onSetHours } = show({ entered: [{ lineGUID: 'l1', day: '2026-10-06', hours: 8 }] });
    await flush();
    act(() => mockCells[`${T}-line-l1-hours-2026-10-07`].onCommit(6.5));
    expect(onSetHours).toHaveBeenLastCalledWith('l1', '2026-10-07', 6.5);
    act(() => mockCells[`${T}-line-l1-hours-2026-10-06`].onCommit(null));
    expect(onSetHours).toHaveBeenLastCalledWith('l1', '2026-10-06', null);
  });
  it('more than 24 hours in a day over the lines of the sheet is refused with a message and nothing is saved', async () => {
    const { onSetHours } = show({ lines: [line('l1'), line('l2', { task: 't2' })], entered: [{ lineGUID: 'l2', day: '2026-10-06', hours: 20 }] });
    await flush();
    act(() => mockCells[`${T}-line-l1-hours-2026-10-06`].onCommit(5));
    expect(onSetHours).not.toHaveBeenCalled();
    expect(textOf(`${T}-cell-error`)).toMatch(/at most 24/);
    act(() => mockCells[`${T}-line-l1-hours-2026-10-06`].onCommit(4));
    expect(onSetHours).toHaveBeenCalledWith('l1', '2026-10-06', 4);
    expect(q(`${T}-cell-error`)).toBeNull();
  });
  it('a number above 24 in one cell is refused', async () => {
    const { onSetHours } = show();
    await flush();
    act(() => mockCells[`${T}-line-l1-hours-2026-10-06`].onCommit(25));
    expect(onSetHours).not.toHaveBeenCalled();
    expect(textOf(`${T}-cell-error`)).toMatch(/at most 24/);
  });
});

describe('the totals', () => {
  it('Total per line, the hours of every day and the grand total (calculated from the entered hours)', async () => {
    show({ lines: [line('l1'), line('l2', { task: 't2' })], entered: [{ lineGUID: 'l1', day: '2026-10-06', hours: 8 }, { lineGUID: 'l1', day: '2026-10-07', hours: 4.5 }, { lineGUID: 'l2', day: '2026-10-06', hours: 2 }] });
    await flush();
    expect(textOf(`${T}-line-l1-total`)).toBe('12.5');
    expect(textOf(`${T}-line-l2-total`)).toBe('2');
    expect(textOf(`${T}-day-total-2026-10-06`)).toBe('10');
    expect(textOf(`${T}-day-total-2026-10-08`)).toBe('');
    expect(textOf(`${T}-grand-total`)).toBe('14.5');
    // the same totals ALSO right after "Hour cost" (before the day columns)
    expect(textOf(`${T}-line-l1-total-first`)).toBe('12.5');
    expect(textOf(`${T}-line-l2-total-first`)).toBe('2');
    expect(textOf(`${T}-grand-total-first`)).toBe('14.5');
    const header = textOf(`${T}-header-row`);
    expect(header.indexOf('Hour cost')).toBeLessThan(header.indexOf('Total hours'));
    expect(header.indexOf('Total hours')).toBeLessThan(header.indexOf('Mon 05'));
    expect(header.split('Total hours')).toHaveLength(3);          // the column header is there twice: after Hour cost and at the end of the line
  });
});

describe('the input order: Project -> Task -> Role -> Budget item -> Business unit -> hours', () => {
  const states = (id: string) => ['project', 'task', 'role', 'budgetItem', 'businessUnit'].map((k) => !mockSelects[`${T}-line-${id}-${k}`].disabled);
  it('a new line: only the project is enabled', async () => {
    show({ lines: [line('l1', { project: '', task: '', role: '', budgetItem: '' })] });
    await flush();
    expect(states('l1')).toEqual([true, false, false, false, false]);
    expect(mockCells[`${T}-line-l1-hours-2026-10-05`].editable).toBe(false);
  });
  it('project chosen: the task opens; task chosen: the role opens; role chosen: the budget item and the hours open', async () => {
    show({ lines: [line('l1', { task: '', role: '', budgetItem: '' })] });
    await flush();
    expect(states('l1')).toEqual([true, true, false, false, false]);
    cleanupUI();
    show({ lines: [line('l1', { role: '', budgetItem: '' })] });
    await flush();
    expect(states('l1')).toEqual([true, true, true, false, false]);
    expect(mockCells[`${T}-line-l1-hours-2026-10-05`].editable).toBe(false);
    cleanupUI();
    show({ lines: [line('l1')] });
    await flush();
    expect(states('l1')).toEqual([true, true, true, true, false]);
    expect(mockCells[`${T}-line-l1-hours-2026-10-05`].editable).toBe(true);
  });
  it('the business unit opens only when the task has task lines that book the work center (units to offer)', async () => {
    show({ options: options({ businessUnitsOf: jest.fn(async () => [opt('bu1'), opt('bu2')]) }) });
    await flush();
    expect(states('l1')).toEqual([true, true, true, true, true]);
    expect(mockSelects[`${T}-line-l1-businessUnit`].items.map((i: any) => i.value)).toEqual(['bu1', 'bu2']);
  });
  it('no work center on the sheet: the role stays closed', async () => {
    show({ header: header({ workCenter: '' }) });
    await flush();
    expect(states('l1')).toEqual([true, true, false, false, false]);
  });
  it('the options are read from the task: the role of the task and the work center, the budget item of the task and the role', async () => {
    const o = options();
    show({ options: o });
    await flush();
    expect(o.tasksOf).toHaveBeenCalledWith('p1');
    expect(o.rolesOf).toHaveBeenCalledWith('t1');
    expect(o.budgetItemsOf).toHaveBeenCalledWith('t1', 'r1');
    expect(o.businessUnitsOf).toHaveBeenCalledWith('t1');
    expect(mockSelects[`${T}-line-l1-role`].items.map((i: any) => i.value)).toEqual(['r1', 'r2']);
  });
  it('choosing a value sends it; clearing sends null', async () => {
    const { onSetLine } = show();
    await flush();
    act(() => mockSelects[`${T}-line-l1-role`].onSelect('r2'));
    expect(onSetLine).toHaveBeenLastCalledWith('l1', { timesheetLineRole: 'r2' });
    act(() => mockSelects[`${T}-line-l1-task`].onSelect(''));
    expect(onSetLine).toHaveBeenLastCalledWith('l1', { timesheetLineTask: null });
    act(() => mockSelects[`${T}-line-l1-project`].onSelect('p9'));
    expect(onSetLine).toHaveBeenLastCalledWith('l1', { timesheetLineProject: 'p9' });
  });
});

describe('values that came from the base Time line', () => {
  it('a role / budget item / business unit that is not in the loaded lists is shown with its title (not blank)', async () => {
    const o = options({ rolesOf: jest.fn(async () => [opt('r1')]), titleOf: jest.fn(async (_t: string, id: string) => `Base ${id}`) });
    show({ options: o, lines: [line('l1', { role: 'r-base', budgetItem: 'b-base', businessUnit: 'u-base' })] });
    await flush();
    await flush();
    expect(o.titleOf).toHaveBeenCalledWith('resourceRoleTable', 'r-base');
    expect(o.titleOf).toHaveBeenCalledWith('budgetItemTable', 'b-base');
    expect(o.titleOf).toHaveBeenCalledWith('businessUnitTable', 'u-base');
    expect(mockSelects[`${T}-line-l1-role`].items[0]).toEqual({ value: 'r-base', label: 'Base r-base' });
    expect(mockSelects[`${T}-line-l1-budgetItem`].items[0]).toEqual({ value: 'b-base', label: 'Base b-base' });
    expect(mockSelects[`${T}-line-l1-businessUnit`].items[0]).toEqual({ value: 'u-base', label: 'Base u-base' });
  });
  it('a value that is in the list is not asked for again', async () => {
    const o = options();
    show({ options: o });
    await flush();
    expect(o.titleOf).not.toHaveBeenCalled();
  });
});

describe('the rate of an hour and the commands', () => {
  it('the cost of an hour is shown: the Time line numbers, the price of a contract / role with its currency; a line with a role and no price says so (Post would name what is missing)', async () => {
    show({ lines: [line('l1'), line('l2', { task: 't2', unitSumForBudget: null, rateSource: '', role: 'r1' }), line('l3', { task: 't3', unitSumForBudget: null, rateSource: 'contract', unitPrice: 32.7381, unitPriceCurrency: 'EUR' }),
      line('l4', { task: 't4', unitSumForBudget: null, rateSource: 'role', unitPrice: 50, unitPriceCurrency: '' }), line('l5', { task: 't5', unitSumForBudget: null, rateSource: '', role: '' })] });
    await flush();
    expect(textOf(`${T}-line-l1-rate`)).toBe('100');
    expect(textOf(`${T}-line-l2-rate`)).toBe('no rate');
    expect(textOf(`${T}-line-l3-rate`)).toBe('32.74 EUR');
    expect(textOf(`${T}-line-l4-rate`)).toBe('50');
    expect(textOf(`${T}-line-l5-rate`)).toBe('');
  });
  it('Add line calls its command', async () => {
    const { onAddLine } = show();
    await flush();
    press(`${T}-add-line`);
    expect(onAddLine).toHaveBeenCalledTimes(1);
  });
  it('a sheet with no lines says how to start', async () => {
    show({ lines: [] });
    await flush();
    expect(textOf(`${T}-no-lines`)).toMatch(/Add a line/);
  });
});

describe('a posted sheet is read only', () => {
  it('no Add line, no Delete; every select and every hour cell is closed', async () => {
    show({ header: header({ status: 'posted' }), edit: false, entered: [{ lineGUID: 'l1', day: '2026-10-06', hours: 8 }] });
    await flush();
    expect(q(`${T}-add-line`)).toBeNull();
    expect(q(`${T}-line-l1-menu-button`)).not.toBeNull();
    for (const k of ['project', 'task', 'role', 'budgetItem', 'businessUnit']) expect(mockSelects[`${T}-line-l1-${k}`].disabled).toBe(true);
    for (const k of Object.keys(mockCells)) expect(mockCells[k].editable).toBe(false);
    expect(mockCells[`${T}-line-l1-hours-2026-10-06`].value).toBe(8);
  });
  it('no sheet: the loading / not-found text', async () => {
    show({ header: null, loading: true });
    expect(textOf(`${T}-lines-empty`)).toBe('Loading…');
    show({ header: null, loading: false });
    expect(textOf(`${T}-lines-empty`)).toMatch(/not found/);
  });
});

describe('the context menu of a line (the ⋮ button, a right click, a long press)', () => {
  const open = async (guid = 'l1', over: Record<string, any> = {}) => { const r = show(over); await flush(); press(`${T}-line-${guid}-menu-button`); return r; };
  const items = () => qa(`${T}-line-menu-`).filter((i) => !/-(backdrop|caption|icon|more)$/.test(i));
  it('a draft: add below / above, duplicate, move up / down / first / last, copy GUID, delete - in this order, the caption names the line', async () => {
    await open('l2', { lines: [line('l1'), line('l2', { task: 't2' }), line('l3', { task: 't3' })] });
    expect(items()).toEqual(['add-below', 'add-above', 'duplicate', 'move-up', 'move-down', 'make-first', 'make-last', 'copy-guid', 'delete'].map((k) => `${T}-line-menu-${k}`));
    expect(q(`${T}-line-menu`)).not.toBeNull();
  });
  it('Add line below / above ask for a new line next to this one', async () => {
    const { onInsertLine } = await open('l1');
    press(`${T}-line-menu-add-below`);
    expect(onInsertLine).toHaveBeenLastCalledWith('l1', false);
    press(`${T}-line-l1-menu-button`);
    press(`${T}-line-menu-add-above`);
    expect(onInsertLine).toHaveBeenLastCalledWith('l1', true);
    expect(q(`${T}-line-menu`)).toBeNull();                       // an item closes the menu
  });
  it('Duplicate starts the new line with the project and the task only (a copy of the role would break the unique key)', async () => {
    const { onInsertLine } = await open('l1');
    press(`${T}-line-menu-duplicate`);
    expect(onInsertLine).toHaveBeenCalledWith('l1', false, { timesheetLineProject: 'p1', timesheetLineTask: 't1' });
  });
  it('Duplicate is closed while the line has no project', async () => {
    await open('l1', { lines: [line('l1', { project: '', task: '', role: '', budgetItem: '' })] });
    expect(mockMenuItem(`${T}-line-menu-duplicate`).getAttribute('aria-disabled')).toBe('true');
  });
  it('the moves call onMoveLine; the first line cannot go up, the last cannot go down', async () => {
    const { onMoveLine } = await open('l2', { lines: [line('l1'), line('l2', { task: 't2' }), line('l3', { task: 't3' })] });
    press(`${T}-line-menu-move-up`);
    expect(onMoveLine).toHaveBeenLastCalledWith('l2', 'up');
    press(`${T}-line-l2-menu-button`);
    press(`${T}-line-menu-make-last`);
    expect(onMoveLine).toHaveBeenLastCalledWith('l2', 'last');
    cleanupUI();
    await open('l1', { lines: [line('l1'), line('l2', { task: 't2' })] });
    expect(mockMenuItem(`${T}-line-menu-move-up`).getAttribute('aria-disabled')).toBe('true');
    expect(mockMenuItem(`${T}-line-menu-make-first`).getAttribute('aria-disabled')).toBe('true');
    expect(mockMenuItem(`${T}-line-menu-move-down`).getAttribute('aria-disabled')).not.toBe('true');
  });
  it('Delete deletes the line; Copy GUID copies it', async () => {
    const { onDeleteLine } = await open('l1');
    press(`${T}-line-menu-copy-guid`);
    expect(require('expo-clipboard').setStringAsync).toHaveBeenCalledWith('l1');
    press(`${T}-line-l1-menu-button`);
    press(`${T}-line-menu-delete`);
    expect(onDeleteLine).toHaveBeenCalledWith('l1');
  });
  it('a right click on a line opens the same menu', async () => {
    show();
    await flush();
    const row = q(`${T}-line-l1`) as HTMLElement;
    act(() => { row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 })); });
    expect(q(`${T}-line-menu`)).not.toBeNull();
  });
  it('a posted sheet: only Copy GUID', async () => {
    await open('l1', { header: header({ status: 'posted' }), edit: false });
    expect(items()).toEqual([`${T}-line-menu-copy-guid`]);
  });
});
function mockMenuItem(id: string): HTMLElement { return q(id) as HTMLElement; }
