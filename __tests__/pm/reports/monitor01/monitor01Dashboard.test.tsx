/** @jest-environment jsdom */
// Monitor01Dashboard: the table of the sheet, the tabs, the fast filters, the two modes, and the Sum explorer behind every number. The rows hook and the drill-down call are replaced.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, mustGet, press, q, qa, renderUI, textOf, toggleSwitch, typeInto } from '../../ui/pmUiTestKit';

const mockHook: { rows: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; reload: () => void } = { rows: [], isLoading: false, error: null, live: true, changedAt: Date.now(), reload: jest.fn() };
jest.mock('../../../../kit8/pm/reports/monitor01/useMonitor01Rows', () => ({ useMonitor01Rows: jest.fn(() => mockHook) }));
const mockFetch = jest.fn();
const mockRefresh = jest.fn(async (..._a: any[]) => ({ tasks: 3, upserted: 4, deleted: 0 }));
jest.mock('../../../../kit8/pm/reports/monitor01/monitor01Api', () => ({ fetchMonitor01Sources: (...a: any[]) => mockFetch(...a), refreshMonitor01Now: (...a: any[]) => (mockRefresh as any)(...a) }));
jest.mock('../../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: (p: any) => ({ type: 'read', p }) } }) }) }));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));

const Monitor01Dashboard = require('../../../../kit8/pm/reports/monitor01/Monitor01Dashboard').default;
import { useMonitor01Rows } from '../../../../kit8/pm/reports/monitor01/useMonitor01Rows';
import { parseMonitor01Row } from '../../../../kit8/pm/reports/monitor01/monitor01Model';

const raw = (over: Record<string, any> = {}) => ({
  rowOwnerGUID: 't1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: 'task01',
  resourceRoleName: 'Data Analyst', qtyPlanned: 24, qtyContracted: 24, sumForBudget: 480, qtyRestToContract: 0, qtyDelivered: 0, qtyUsed: 0, qtyOnHand: 0, lineCount: 1, hasStalePlan: false, updated_at: '1', ...over,
});
// the example of the sheet
const sheet = () => [
  raw(),
  raw({ rowOwnerGUID: 't3', taskName: 'task03', qtyContracted: 0, qtyRestToContract: 24, sumForBudget: 600.5 }),
  raw({ rowOwnerGUID: 't3', taskName: 'task03', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: '10m pipe section', measureUnit: 'unit_pcs', qtyPlanned: 100, qtyContracted: 65, sumForBudget: 1000, qtyRestToContract: 35, projectName: 'Beta', rowProjectGUID: 'p2' }),
  raw({ rowOwnerGUID: 't4', taskName: 'task04', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: '10m pipe section', measureUnit: 'unit_pcs', qtyPlanned: 200, qtyContracted: 80, sumForBudget: 2000, qtyRestToContract: 120, projectName: 'Beta', rowProjectGUID: 'p2' }),
].map(parseMonitor01Row);
const KEY_T1 = 't1|timeGenus|r1|unit_hour|2026-10-01';
const rowIds = () => qa('monitor01-table-item-').filter((id) => /\|\d{4}-\d{2}-\d{2}$/.test(id));
const cell = (key: string, m: string) => `monitor01-table-cell-${key}-${m}`;

beforeEach(() => {
  mockHook.rows = sheet(); mockHook.live = true; mockHook.error = null; mockHook.isLoading = false; mockHook.changedAt = Date.now();
  (globalThis as any).__pmTestReduxState = { [require('../../../../kit8/catalog/product/productModel').PRODUCT_TABLES.measureUnit.entity]: { entityDataFromServer: [{ rowGUID: 'unit_hour', rowJSON: { title: 'hour' } }, { rowGUID: 'unit_pcs', rowJSON: { title: 'pcs' } }] } };
  mockFetch.mockImplementation(async (_c: any, measure: string) => ({ measure, totalCount: 1, sum: measure === 'contracted' ? 24 : 24, rows: [{ rowGUID: 'm1', sourceName: 'x', day: '2026-10-14', taskGUID: 't1', taskName: 'task01', projectGUID: 'p1', genusGUID: 'timeGenus', roleGUID: 'r1', roleName: 'Data Analyst', unit: 'unit_hour', qty: 24 }] }));
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('the table of the sheet', () => {
  it('the two header rows: Plan | Fact and the columns; the resource role column; the six measures', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-group-Plan')).toBe('Plan');
    expect(textOf('monitor01-table-group-Fact')).toBe('Fact');
    const heads = ['planned', 'contracted', 'restToContract', 'sumForBudget', 'delivered', 'used', 'onHand'].map((m) => textOf(`monitor01-table-head-${m}`));
    expect(heads).toEqual(['Planned', 'Contracted', 'Rest to contract', 'Sum for budget', 'Delivered', 'Actually used', 'On-hand']);
    expectInOrder(['monitor01-table-head-planned', 'monitor01-table-head-contracted', 'monitor01-table-head-restToContract', 'monitor01-table-head-sumForBudget', 'monitor01-table-head-delivered']);
  });

  it('headers: "Task name" (not task.name), every header starts with a capital letter, no ROW DESCRIPTION column and no "requirements dimensions"', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expect(['project', 'role', 'month', 'task', 'unit'].map((k) => textOf(`monitor01-table-head-${k}`))).toEqual(['Project', 'Resource role', 'Month', 'Task name', 'Unit']);
    const head = q('monitor01-table-head')!;
    Array.from(head.querySelectorAll('[data-testid^="monitor01-table-head-"]')).forEach((e) => expect((e.textContent || '')[0]).toBe((e.textContent || '')[0].toUpperCase()));
    const all = document.body.textContent || '';
    expect(all).not.toContain('ROW DESCRIPTION');
    expect(all).not.toMatch(/requirements dimensions/i);
    expect(all).not.toContain('task.name');
    expect(q(`monitor01-table-item-${KEY_T1}`)!.textContent).not.toContain('Data Analyst line');   // no description text in the rows either
  });

  it('every header text is centered', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    ['project', 'role', 'month', 'task', 'unit', 'planned', 'sumForBudget', 'onHand'].forEach((k) => expect(getComputedStyle(mustGet(`monitor01-table-head-${k}`)).textAlign).toBe('center'));
    expect(getComputedStyle(mustGet('monitor01-table-group-Plan').firstElementChild as HTMLElement).textAlign).toBe('center');
  });

  it('the header has the background of the header of ReusableTable (surfaceVariant of the paper theme, else the MD3 default)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(getComputedStyle(mustGet('monitor01-table-head')).backgroundColor).toBe('rgb(231, 224, 236)');
  });

  it('sumForBudget: a column of each row, subtotal and total', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(`monitor01-table-budget-${KEY_T1}`)).toBe('480.00');
    expect(textOf('monitor01-table-budget-total|unit_hour')).toBe('1,080.50');
    expect(textOf('monitor01-table-budget-sub|materialGenus|unit_pcs')).toBe('3,000.00');
  });

  it('the numbers of the sheet: 24 / 24 / 0 and 24 / blank / 24; the totals per unit (48 hours)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'planned'))).toBe('24');
    expect(textOf(cell(KEY_T1, 'contracted'))).toBe('24');
    expect(textOf(cell(KEY_T1, 'restToContract'))).toBe('0');
    expect(textOf(cell(KEY_T1, 'delivered'))).toBe('');               // facts without data stay blank
    expect(textOf(cell(KEY_T1, 'onHand'))).toBe('0');
    expect(textOf(cell('t3|timeGenus|r1|unit_hour|2026-10-01', 'restToContract'))).toBe('24');
    expect(textOf(cell('total|unit_hour', 'planned'))).toBe('48');      // the 48 of the sheet
    expect(textOf(cell('total|unit_pcs', 'planned'))).toBe('300');
    expect(textOf(cell('sub|materialGenus|unit_pcs', 'restToContract'))).toBe('155');
  });

  it('column A names every kind of row; roles, months and tasks are in the rows; units use the catalog', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-item-total|unit_hour')).toContain('Total');
    expect(textOf('monitor01-table-item-group|timeGenus')).toContain('Time');
    expect(textOf(`monitor01-table-item-${KEY_T1}`)).toContain('Data Analyst');
    expect(textOf(`monitor01-table-item-${KEY_T1}`)).toContain('Oct 2026');
    expect(textOf(`monitor01-table-item-${KEY_T1}`)).toContain('task01');
    expect(textOf(`monitor01-table-item-${KEY_T1}`)).toContain('hour');
    expect(textOf('monitor01-table-item-sub|timeGenus|unit_hour')).toContain('Subtotal Time');
  });

  it('no rows: the hint', () => {
    mockHook.rows = [];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-empty')).toContain('Post the plan');
  });
});

describe('the tabs', () => {
  it('Time · Material · Expense · All, with the number of rows', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-tab-all-count')).toBe('4');
    expect(textOf('monitor01-tab-time-count')).toBe('2');
    expect(textOf('monitor01-tab-material-count')).toBe('2');
    expect(q('monitor01-tab-expense-count')).toBeNull();
  });
  it('a tab shows only its genus', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press('monitor01-tab-time');
    expect(q('monitor01-table-item-group|materialGenus')).toBeNull();
    expect(q('monitor01-table-item-group|timeGenus')).not.toBeNull();
    expect(q('monitor01-table-item-total|unit_pcs')).toBeNull();
    press('monitor01-tab-material');
    expect(q('monitor01-table-item-group|timeGenus')).toBeNull();
    expect(textOf(cell('total|unit_pcs', 'planned'))).toBe('300');
  });
});

describe('the TotalsRow at the bottom', () => {
  it('after the last row, with sumForBudget and the quantities; one line per unit, and the money of all units', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expectInOrder(['monitor01-table-item-total|unit_hour', 'monitor01-table-totals']);
    const lastRow = rowIds()[rowIds().length - 1];
    expectInOrder([lastRow, 'monitor01-table-totals']);
    expect(textOf('monitor01-table-totals-unit_hour-budget')).toBe('1,080.50');
    expect(textOf('monitor01-table-totals-unit_hour-planned')).toBe('48');
    expect(textOf('monitor01-table-totals-unit_hour-contracted')).toBe('24');
    expect(textOf('monitor01-table-totals-unit_hour-restToContract')).toBe('24');
    expect(textOf('monitor01-table-totals-unit_pcs-planned')).toBe('300');
    expect(textOf('monitor01-table-totals-unit_pcs-budget')).toBe('3,000.00');
    expect(textOf('monitor01-table-totals-all-budget')).toBe('4,080.50');          // the money of all the rows shown
    expect(textOf('monitor01-table-totals')).toContain('Totals');
  });
  it('follows the filters and the tab', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 'task03');
    await wait(250);
    expect(textOf('monitor01-table-totals-unit_hour-budget')).toBe('600.50');
    expect(textOf('monitor01-table-totals-all-budget')).toBe('1,600.50');
    press('monitor01-tab-time');
    expect(q('monitor01-table-totals-unit_pcs-budget')).toBeNull();
    expect(q('monitor01-table-totals-all')).toBeNull();                              // one unit: one line
    expect(textOf('monitor01-table-totals-unit_hour-budget')).toBe('600.50');
  });
  it('no rows: the TotalsRow shows 0.00', async () => {
    mockHook.rows = [];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-totals-none-budget')).toBe('0.00');
  });
});

describe('the two modes and the fast filters', () => {
  it('project mode: no Project filter, no project column', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(q('monitor01-filters-project')).toBeNull();
    expect(q('monitor01-filters-startDate')).not.toBeNull();
    expect(q('monitor01-filters-finishDate')).not.toBeNull();
    expect(q('monitor01-filters-task')).not.toBeNull();
    expect(q('monitor01-filters-resource')).not.toBeNull();
    expect(textOf(`monitor01-table-item-${KEY_T1}`)).not.toContain('Alpha');
    expect((useMonitor01Rows as jest.Mock).mock.calls[0][0]).toBe('p1');
  });
  it('standalone: the FULL data set (the hook gets no project) with the Project filter and the project of each row', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expect((useMonitor01Rows as jest.Mock).mock.calls[0][0]).toBeNull();
    expect(q('monitor01-filters-project')).not.toBeNull();
    expect(textOf(`monitor01-table-item-${KEY_T1}`)).toContain('Alpha');
  });
  it('dates use DateInputApp (calendar trigger); the text filters use TextInputApp whose clear icon sits INSIDE the field (no separate Clear button)', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expect(q('monitor01-filters-startDate-datepicker-trigger')).not.toBeNull();
    expect(q('monitor01-filters-finishDate-datepicker-trigger')).not.toBeNull();
    ['project', 'task', 'resource'].forEach((k) => { expect(q(`monitor01-filters-${k}-clear`)).toBeNull(); expect(q(`monitor01-filters-${k}-datepicker-trigger`)).toBeNull(); });
    expect(q('monitor01-filters-startDate-clear-button')).toBeNull();
    expect(document.body.textContent).not.toContain('Clear');
  });
  it('all the filter inputs are in ONE row (no wrapping; it scrolls sideways when narrow)', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    const bar = mustGet('monitor01-filters');
    const inner = bar.firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).flexWrap).toBe('nowrap');
    expect(getComputedStyle(inner).flexDirection).toBe('row');
    const ids = ['startDate', 'finishDate', 'project', 'task', 'resource'].map((k) => `monitor01-filters-${k}`);
    ids.forEach((id) => expect(inner.contains(mustGet(id))).toBe(true));
    expectInOrder(ids);
  });
  it('typing in Task filters the rows after the debounce; the totals follow', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 'task03');
    expect(q(`monitor01-table-item-${KEY_T1}`)).not.toBeNull();       // not yet: the filter waits for the last key
    await wait(250);
    expect(q(`monitor01-table-item-${KEY_T1}`)).toBeNull();
    expect(q('monitor01-table-item-t3|timeGenus|r1|unit_hour|2026-10-01')).not.toBeNull();
    expect(textOf(cell('total|unit_hour', 'planned'))).toBe('24');
  });
  it('Project and Resource filters; startDate / finishDate cut months', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-project', 'beta');
    await wait(250);
    expect(rowIds()).toHaveLength(2);
    typeInto('monitor01-filters-project', '');
    typeInto('monitor01-filters-resource', 'pipe');
    await wait(250);
    expect(q(`monitor01-table-item-${KEY_T1}`)).toBeNull();
    typeInto('monitor01-filters-resource', '');
    typeInto('monitor01-filters-startDate', '2026-11-01');
    await wait(250);
    expect(rowIds()).toHaveLength(0);
    expect(inputValue('monitor01-filters-startDate')).toBe('2026-11-01');
  });
});

describe('filters at the start, dates, the Monitor01Toolbar and Auto refresh', () => {
  it('the filters are EMPTY at the start and then ALL the data is visible', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    ['startDate', 'finishDate', 'project', 'task', 'resource'].forEach((k) => expect(inputValue(`monitor01-filters-${k}`)).toBe(''));
    expect(rowIds()).toHaveLength(4);                                   // every row of the sheet
    expect(textOf('monitor01-tab-all-count')).toBe('4');
  });
  it('emptying a filter again shows all the data again', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-startDate', '2026-11-01');
    typeInto('monitor01-filters-task', 'task03');
    await wait(250);
    expect(rowIds()).toHaveLength(0);
    typeInto('monitor01-filters-startDate', '');
    typeInto('monitor01-filters-task', '');
    await wait(250);
    expect(rowIds()).toHaveLength(4);
  });
  it('the date inputs are wide enough for the whole date (200 px) and eight digits are turned into the date', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    const widths: string[] = [];
    for (let el: HTMLElement | null = mustGet('monitor01-filters-startDate'); el && el !== document.body; el = el.parentElement) widths.push(getComputedStyle(el).width);
    expect(widths).toContain('200px');                                  // the box of the field (the picker and clear icons are inside it)
    typeInto('monitor01-filters-startDate', '20261101');
    expect(inputValue('monitor01-filters-startDate')).toBe('2026-11-01');
    typeInto('monitor01-filters-finishDate', '31122026');
    expect(inputValue('monitor01-filters-finishDate')).toBe('2026-12-31');
    await wait(250);
    expect(rowIds()).toHaveLength(0);                                    // the rows are in October 2026
  });
  it('Monitor01Toolbar sits right after "Monitor01  Roles requirements": Refresh button and the Auto refresh switch', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expectInOrder(['monitor01-title', 'monitor01-toolbar', 'monitor01-toolbar-refresh', 'monitor01-toolbar-auto', 'monitor01-age']);
    expect(textOf('monitor01-toolbar')).toContain('Refresh');
    expect(textOf('monitor01-toolbar')).toContain('Auto refresh');
  });
  it('Refresh reads the data again', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press('monitor01-toolbar-refresh');
    await flush();
    expect(mockHook.reload).toHaveBeenCalledTimes(1);
  });
  it('Auto refresh ON (default): a realtime change shows at once - also while a filter is set, and after the filter was changed', async () => {
    const view = renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 'task03');
    await wait(250);
    expect(rowIds()).toHaveLength(2);
    mockHook.rows = [...sheet(), parseMonitor01Row(raw({ rowOwnerGUID: 't9', taskName: 'task03 new', qtyPlanned: 5, qtyContracted: 0, qtyRestToContract: 5, resourceRoleGUID: 'r9' }))];
    view.rerender(<Monitor01Dashboard mode="standalone" />);
    expect(rowIds()).toHaveLength(3);
    typeInto('monitor01-filters-task', 'task0');
    await wait(250);
    expect(rowIds()).toHaveLength(5);
    mockHook.rows = mockHook.rows.slice(0, 3);
    view.rerender(<Monitor01Dashboard mode="standalone" />);
    expect(rowIds()).toHaveLength(3);
  });
  it('Auto refresh OFF: the table stays a snapshot (filters still work on it) until Refresh shows the new data', async () => {
    const view = renderUI(<Monitor01Dashboard mode="standalone" />);
    toggleSwitch('monitor01-toolbar-auto');
    expect(textOf('monitor01-age')).toContain('Auto refresh is off');
    mockHook.rows = [...sheet(), parseMonitor01Row(raw({ rowOwnerGUID: 't9', taskName: 'task09', resourceRoleGUID: 'r9' }))];
    view.rerender(<Monitor01Dashboard mode="standalone" />);
    expect(rowIds()).toHaveLength(4);                                     // the snapshot: the new row is not shown
    typeInto('monitor01-filters-task', 'task0');
    await wait(250);
    expect(rowIds()).toHaveLength(4);                                     // a filter works on the snapshot
    press('monitor01-toolbar-refresh');
    await flush();
    expect(mockHook.reload).toHaveBeenCalledTimes(1);
    mockHook.changedAt = Date.now() + 5000;                               // the reload arrived
    view.rerender(<Monitor01Dashboard mode="standalone" />);
    expect(rowIds()).toHaveLength(5);
    toggleSwitch('monitor01-toolbar-auto');                               // back ON: live again
    expect(textOf('monitor01-age')).not.toContain('Auto refresh is off');
  });
});

describe('Refresh now (the report must not wait for a worker that does not run)', () => {
  it('the Refresh button asks the database to recompute the tasks NOW, then reads the rows again', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press('monitor01-toolbar-refresh');
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh.mock.calls[0][1]).toBeNull();                      // the full data set: no project
    expect(mockHook.reload).toHaveBeenCalledTimes(1);
  });
  it('in the project mode the project is handed over', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press('monitor01-toolbar-refresh');
    await flush();
    expect(mockRefresh.mock.calls[0][1]).toBe('p1');
  });
  it('the FIRST look at an empty report computes the plan data at once - once', async () => {
    mockHook.rows = [];
    const view = renderUI(<Monitor01Dashboard mode="standalone" />);
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockHook.reload).toHaveBeenCalledTimes(1);
    view.rerender(<Monitor01Dashboard mode="standalone" />);
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);                         // not again
  });
  it('a report that has rows does not call it by itself', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    await flush();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
  it('an error of the database is shown, and the rows are still read', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('permission denied for function monitor01_apply'));
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press('monitor01-toolbar-refresh');
    await flush();
    expect(textOf('monitor01-refresh-error')).toContain('permission denied for function monitor01_apply');
    expect(mockHook.reload).toHaveBeenCalledTimes(1);
  });
});

describe('the data age', () => {
  it('live while the channel is open', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-age')).toContain('Live');
    expect(textOf('monitor01-age')).toContain('refresh 2 s');
  });
  it('offline says so and keeps the last data', () => {
    mockHook.live = false;
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-age')).toContain('Offline');
    expect(q(`monitor01-table-item-${KEY_T1}`)).not.toBeNull();
  });
  it('an error of the load is shown', () => {
    mockHook.error = 'permission denied';
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-error')).toBe('permission denied');
  });
});

describe('every number opens its source transactions', () => {
  it('a cell: the filter has exactly the keys of the row; the list adds up to the cell', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell(KEY_T1, 'planned'));
    await flush();
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), 'planned', { taskGUID: 't1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', month: '2026-10-01' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-title')).toContain('Data Analyst · Oct 2026 · task01 · Planned');
    expect(textOf('monitor01-sum-value')).toBe('24.00 hour');
    expect(textOf('monitor01-sum-check')).toContain('✓');
  });
  it('rest to contract is made of two lists: planned − contracted', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell('t3|timeGenus|r1|unit_hour|2026-10-01', 'restToContract'));
    await flush();
    expect(mockFetch.mock.calls.map((c) => c[1]).sort()).toEqual(['contracted', 'planned']);
    expect(q('monitor01-sum-source-planned')).not.toBeNull();
    expect(textOf('monitor01-sum-source-contracted')).toContain('−');
  });
  it('on-hand is made of delivered and used - without data yet', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell(KEY_T1, 'onHand'));
    await flush();
    expect(mockFetch.mock.calls.map((c) => c[1]).sort()).toEqual(['delivered', 'used']);
  });
  it('"Actually used" is the list of the POSTED fact documents; Open shows the document in the fact input form', async () => {
    mockFetch.mockImplementation(async (_c: any, measure: string) => ({ measure, totalCount: 1, sum: 24, rows: [{ rowGUID: 'fl1', sourceName: 'taskFactUsageTimeline', day: '2026-10-14', taskGUID: 't1', taskName: 'task01', projectGUID: 'p1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', qty: 24, documentGUID: 'doc1', documentNumber: 'FI-00007' }] }));
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell(KEY_T1, 'used'));
    await flush();
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), 'used', { taskGUID: 't1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', month: '2026-10-01' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-source-used')).toContain('Posted fact documents');
    expect(textOf('monitor01-sum-source-used')).toContain('FI-00007');
    mockPush.mockClear();
    press('monitor01-sum-open-fl1');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/fact', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'doc1' } });
  });
  it('a subtotal and a total are opened with the keys they share (and the project in the project mode)', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell('sub|materialGenus|unit_pcs', 'planned'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'planned', { genusGUID: 'materialGenus', unit: 'unit_pcs', projectGUID: 'p1' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-title')).toContain('Subtotal Material');
    press('monitor01-sum-close');
    press(cell('total|unit_hour', 'contracted'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'contracted', { unit: 'unit_hour', projectGUID: 'p1' }, 0, expect.any(Number));
  });
  it('under a text filter the total lists exactly the tasks that are shown', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 'task03');
    await wait(250);
    press(cell('total|unit_hour', 'planned'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'planned', { unit: 'unit_hour', taskGUIDs: ['t3'] }, 0, expect.any(Number));
  });
  it('Open on a transaction goes to the Plan view of its task', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell(KEY_T1, 'planned'));
    await flush();
    press('monitor01-sum-open-m1');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/plan', params: { taskGUID: 't1', projectGUID: 'p1' } });
  });
});
