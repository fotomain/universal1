/** @jest-environment jsdom */
// Monitor01Dashboard: the table of the sheet, the tabs, the fast filters, the two modes, and the Sum explorer behind every number. The rows hook and the drill-down call are replaced.
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, mustGet, press, q, qa, renderUI, textOf, toggleSwitch, typeInto } from '../../ui/pmUiTestKit';

const mockHook: { rows: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; checkedAt: number | null; reload: () => void } = { rows: [], isLoading: false, error: null, live: true, changedAt: Date.now(), checkedAt: null, reload: jest.fn() };
jest.mock('../../../../kit8/pm/reports/monitor01/useMonitor01Rows', () => ({ useMonitor01Rows: jest.fn(() => mockHook) }));
const mockFetch = jest.fn();
const mockRefresh = jest.fn(async (..._a: any[]) => ({ tasks: 3, upserted: 4, deleted: 0 }));
jest.mock('../../../../kit8/pm/reports/monitor01/monitor01Api', () => ({ fetchMonitor01Sources: (...a: any[]) => mockFetch(...a), refreshMonitor01Now: (...a: any[]) => (mockRefresh as any)(...a) }));
jest.mock('../../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: (p: any) => ({ type: 'read', p }) } }) }) }));
// the tips of the cells (usePMTip): the texts it was asked for, in the order of the render
const mockTipTexts: (string | undefined)[] = [];
jest.mock('../../../../kit8/pm/inner/tooltip/PMTooltip', () => ({
  ...jest.requireActual('../../../../kit8/pm/inner/tooltip/PMTooltip'),
  usePMTip: (text?: string) => { mockTipTexts.push(text); return { ref: { current: null }, accessibilityHint: text }; },
}));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
// Project / Task / Resource are SelectItemFromListApp (picked, not typed): the double is a plain TextInput whose onChangeText IS onSelect, so a test "types" the GUID it wants picked,
// as the vendor invoice filter tests do (kit8/documents/vendor/invoice). mockSelects keeps the latest props of each field (items, value, placeholder) for the tests that check them.
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});

const Monitor01Dashboard = require('../../../../kit8/pm/reports/monitor01/Monitor01Dashboard').default;
import { useMonitor01Rows } from '../../../../kit8/pm/reports/monitor01/useMonitor01Rows';
import { parseMonitor01Row } from '../../../../kit8/pm/reports/monitor01/monitor01Model';

const raw = (over: Record<string, any> = {}) => ({
  rowOwnerGUID: 't1', genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: 'task01',
  resourceRoleName: 'Data Analyst', qtyPlanned: 24, qtyContracted: 24, sumForBudget: 480, qtyRestToContract: 0, qtyReceived: 0, qtyVendorInvoiced: 0, qtyUsed: 0, qtyOnHand: 0, lineCount: 1, hasStalePlan: false, updated_at: '1', ...over,
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
// the tree Project → Resource role → Month → Task: the keys of the subtotal lines (one line per unit) and of the chevrons
// (the example has two projects: Alpha p1 with the Time rows, Beta p2 with the Material rows)
const PROJECT = (unit: string) => `node|p|p1|${unit}`;
const PROJECT_BETA = (unit: string) => `node|p|p2|${unit}`;
const ROLE_TIME = (unit: string) => `node|p|p1|r|timeGenus|r1|${unit}`;
const ROLE_MATERIAL = (unit: string) => `node|p|p2|r|materialGenus|r2|${unit}`;
const MONTH_TIME = (unit: string) => `node|p|p1|r|timeGenus|r1|m|2026-10-01|${unit}`;
const NODE_PROJECT = 'p|p1';
const NODE_PROJECT_BETA = 'p|p2';
const NODE_ROLE_TIME = 'p|p1|r|timeGenus|r1';
const NODE_ROLE_MATERIAL = 'p|p2|r|materialGenus|r2';
const NODE_MONTH_TIME = 'p|p1|r|timeGenus|r1|m|2026-10-01';
const NODE_MONTH_MATERIAL = 'p|p2|r|materialGenus|r2|m|2026-10-01';
const toggle = (nodeKey: string) => `monitor01-table-toggle-${nodeKey}`;
const item = (key: string) => `monitor01-table-item-${key}`;

beforeEach(() => {
  mockHook.rows = sheet(); mockHook.live = true; mockHook.checkedAt = null; mockHook.error = null; mockHook.isLoading = false; mockHook.changedAt = Date.now();
  (globalThis as any).__pmTestReduxState = { [require('../../../../kit8/catalog/product/productModel').PRODUCT_TABLES.measureUnit.entity]: { entityDataFromServer: [{ rowGUID: 'unit_hour', rowJSON: { title: 'hour' } }, { rowGUID: 'unit_pcs', rowJSON: { title: 'pcs' } }] } };
  mockFetch.mockImplementation(async (_c: any, measure: string) => ({ measure, totalCount: 1, sum: measure === 'contracted' ? 24 : 24, rows: [{ rowGUID: 'm1', sourceName: 'x', day: '2026-10-14', taskGUID: 't1', taskName: 'task01', projectGUID: 'p1', genusGUID: 'timeGenus', roleGUID: 'r1', roleName: 'Data Analyst', unit: 'unit_hour', qty: 24 }] }));
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('the table of the sheet', () => {
  it('the dividers Plan | Fact | Vendor Invoice | Customer Invoice of the body are the left edges of Ordered, Vendor Invoice / Qty and Customer Invoice / Qty (same columns as the header); a row keeps its full width (a scrollbar of the list must not squeeze the columns)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    const bw = (id: string) => getComputedStyle(q(id)!).borderLeftWidth;
    expect(bw(cell(KEY_T1, 'ordered'))).toBe('2px');
    expect(bw(cell(KEY_T1, 'received'))).not.toBe('2px');
    expect(bw(cell(KEY_T1, 'used'))).not.toBe('2px');
    expect(bw(cell(KEY_T1, 'vendorInvoiced'))).toBe('2px');
    expect(bw(cell(KEY_T1, 'customerInvoiced'))).toBe('2px');
    const row = getComputedStyle(q(`monitor01-table-item-${KEY_T1}`)!);
    expect(row.width).toBe('1858px'); // 150 + 190 + 104 + 160 + 72 + 3 x 94 + 112 + 4 x 94 + (94 + 112) x 2
    expect(row.flexShrink).toBe('0');
  });
  it('every header cell has a tip = its title (the groups too; also when the column is too narrow for the text)', () => {
    mockHook.rows = [parseMonitor01Row(raw())];
    renderUI(<Monitor01Dashboard mode="standalone" />);
    const heads = ['project', 'role', 'month', 'task', 'unit', 'planned', 'contracted', 'restToContract', 'sumForBudget', 'ordered', 'received', 'used', 'onHand', 'vendorInvoiced', 'sumVendorInvoiced', 'customerInvoiced', 'sumCustomerInvoiced'];
    for (const m of heads) {
      const el = q(`monitor01-table-head-${m}`)!;
      const money = ['sumForBudget', 'sumVendorInvoiced', 'sumCustomerInvoiced'].includes(m);        // the tip of a money column = its title + the VAT basis in force (Cost by default)
      expect(mockTipTexts).toContain((el.textContent || '').trim() + (money ? ' - Cost' : ''));
      expect(el.parentElement!.getAttribute('aria-label')).toBe((el.textContent || '').trim()); // the cell itself carries the title
    }
    for (const [key, title] of [['Plan', 'Plan'], ['Fact', 'Fact'], ['VendorInvoice', 'Vendor Invoice'], ['CustomerInvoice', 'Customer Invoice']]) {
      expect(mockTipTexts).toContain(title);
      expect(q(`monitor01-table-group-${key}`)!.getAttribute('aria-label')).toBe(title);
    }
    for (const t of ['Received', 'Quantity', 'Amount - Cost']) expect(mockTipTexts).toContain(t);          // the money tips carry the VAT basis
  });

  it('the two header rows: 1st level Plan | Fact | Vendor Invoice (after Fact), 2nd level the columns, Vendor Invoice has Qty and Sum; Ordered is the first of the Fact group', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-group-Plan')).toBe('Plan');
    expect(textOf('monitor01-table-group-Fact')).toBe('Fact');
    expect(textOf('monitor01-table-group-VendorInvoice')).toBe('Vendor Invoice');
    expect(textOf('monitor01-table-group-CustomerInvoice')).toBe('Customer Invoice');
    expectInOrder(['monitor01-table-group-Plan', 'monitor01-table-group-Fact', 'monitor01-table-group-VendorInvoice', 'monitor01-table-group-CustomerInvoice']);
    const cols = ['planned', 'contracted', 'restToContract', 'sumForBudget', 'ordered', 'received', 'used', 'onHand', 'vendorInvoiced', 'sumVendorInvoiced', 'customerInvoiced', 'sumCustomerInvoiced'];
    expect(cols.map((m) => textOf(`monitor01-table-head-${m}`))).toEqual(['Planned', 'Contracted', 'Rest to contract', 'Budget', 'Ordered', 'Received', 'Actually used', 'On-hand', 'Quantity', 'Amount', 'Quantity', 'Amount']);
    expectInOrder(cols.map((m) => `monitor01-table-head-${m}`));
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
    expect(q('monitor01-table-head-project')).not.toBeNull();                                         // the tree starts at the project, also in the project mode
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
    expect(textOf(`monitor01-table-budget-${PROJECT('unit_hour')}`)).toBe('1,080.50');
    expect(textOf(`monitor01-table-budget-${PROJECT_BETA('unit_pcs')}`)).toBe('3,000.00');
    expect(textOf(`monitor01-table-budget-${ROLE_MATERIAL('unit_pcs')}`)).toBe('3,000.00');
    expect(textOf(`monitor01-table-budget-${MONTH_TIME('unit_hour')}`)).toBe('1,080.50');
  });

  it('the numbers of the sheet: 24 / 24 / 0 and 24 / blank / 24; the totals per unit (48 hours)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'planned'))).toBe('24');
    expect(textOf(cell(KEY_T1, 'contracted'))).toBe('24');
    expect(textOf(cell(KEY_T1, 'restToContract'))).toBe('');
    expect(textOf(cell(KEY_T1, 'received'))).toBe('');               // facts without data stay blank
    expect(textOf(cell(KEY_T1, 'onHand'))).toBe('');
    expect(textOf(cell('t3|timeGenus|r1|unit_hour|2026-10-01', 'restToContract'))).toBe('24');
    expect(textOf(cell('total|unit_hour', 'planned'))).toBe('48');      // the 48 of the sheet
    expect(textOf(cell('total|unit_pcs', 'planned'))).toBe('300');
    expect(textOf(cell(ROLE_MATERIAL('unit_pcs'), 'restToContract'))).toBe('155');
    expect(textOf(cell(PROJECT('unit_hour'), 'planned'))).toBe('48');
    expect(textOf(cell(PROJECT_BETA('unit_pcs'), 'planned'))).toBe('300');
  });

  it('the tree Project → Resource role → Month → Task name: every level is a line of its own column, the rows hold the task name and the unit (catalog titles)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(item('total|unit_hour'))).toContain('Total');
    expect(textOf(item(PROJECT('unit_hour')))).toContain('Alpha');
    expect(textOf(item(ROLE_TIME('unit_hour')))).toContain('Data Analyst');
    expect(textOf(item(MONTH_TIME('unit_hour')))).toContain('Oct 2026');
    expect(textOf(item(KEY_T1))).toContain('task01');
    expect(textOf(item(KEY_T1))).toContain('hour');
    expect(textOf(item(KEY_T1))).not.toContain('Data Analyst');                     // the role is on the line above, not repeated in every row
    expect(textOf(item(PROJECT_BETA('unit_pcs')))).toContain('Beta');
    expect(textOf(item(ROLE_MATERIAL('unit_pcs')))).toContain('10m pipe section');
    expectInOrder([item(PROJECT('unit_hour')), item(ROLE_TIME('unit_hour')), item(MONTH_TIME('unit_hour')), item(KEY_T1), item(PROJECT_BETA('unit_pcs')), item(ROLE_MATERIAL('unit_pcs'))]);
  });
  it('a project with hours AND pieces has a subtotal line per unit; only the first has the label and the chevron', () => {
    mockHook.rows = [raw(), raw({ rowOwnerGUID: 't9', taskName: 'task09', genusGUID: 'materialGenus', resourceRoleGUID: 'r2', resourceRoleName: 'Pipe', measureUnit: 'unit_pcs', qtyPlanned: 100 })].map(parseMonitor01Row);
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(item(PROJECT('unit_hour')))).toContain('Alpha');
    expect(textOf(item(PROJECT('unit_pcs')))).not.toContain('Alpha');
    expect(textOf(item(PROJECT('unit_pcs')))).toContain('pcs');
    expect(qa('monitor01-table-toggle-node').length + qa('monitor01-table-toggle-p|p1').length).toBe(qa('monitor01-table-toggle-p|p1').length);
    expect(qa('monitor01-table-toggle-p|p1|')).toHaveLength(4);                      // 2 roles + 2 months; the project has ONE chevron
    expect(q(toggle('p|p1'))).not.toBeNull();
    expectInOrder([item(PROJECT('unit_hour')), item(PROJECT('unit_pcs')), item(ROLE_TIME('unit_hour'))]);
    press(toggle('p|p1'));
    expect(q(item(PROJECT('unit_pcs')))).not.toBeNull();                              // closed: both lines stay
    expect(q(item(ROLE_TIME('unit_hour')))).toBeNull();
  });
  it('every node line is a subtotal that opens its own numbers', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(ROLE_TIME('unit_hour'), 'planned'))).toBe('48');
    expect(textOf(cell(MONTH_TIME('unit_hour'), 'contracted'))).toBe('24');
    expect(textOf(cell(PROJECT_BETA('unit_pcs'), 'planned'))).toBe('300');
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
    expect(q(item(ROLE_MATERIAL('unit_pcs')))).toBeNull();
    expect(q(item(ROLE_TIME('unit_hour')))).not.toBeNull();
    expect(q(item('total|unit_pcs'))).toBeNull();
    expect(q(item(PROJECT_BETA('unit_pcs')))).toBeNull();                 // a project without rows of the tab is not drawn
    press('monitor01-tab-material');
    expect(q(item(ROLE_TIME('unit_hour')))).toBeNull();
    expect(textOf(cell('total|unit_pcs', 'planned'))).toBe('300');
  });
});

describe('the collapsible tree', () => {
  it('everything is open at the start; every Project / Resource role / Month line has a chevron (the first line of the node only), the Task lines have none', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    [NODE_PROJECT, NODE_PROJECT_BETA, NODE_ROLE_TIME, NODE_ROLE_MATERIAL, NODE_MONTH_TIME, NODE_MONTH_MATERIAL].forEach((k) => expect(q(toggle(k))).not.toBeNull());
    expect(qa('monitor01-table-toggle-')).toHaveLength(6);                  // 2 projects, 2 roles, 2 months
    expect(q(item(KEY_T1))).not.toBeNull();
    expect(mustGet(toggle(NODE_PROJECT)).getAttribute('aria-expanded')).toBe('true');
    expect(textOf('monitor01-toolbar')).toContain('Expand all');
    expect(textOf('monitor01-toolbar')).toContain('Collapse all');
  });
  it('a chevron collapses its node: the subtotal stays, everything below it goes; pressing again opens it', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(toggle(NODE_ROLE_TIME));
    expect(q(item(ROLE_TIME('unit_hour')))).not.toBeNull();              // the subtotal of the role stays ...
    expect(q(item(MONTH_TIME('unit_hour')))).toBeNull();                 // ... its month and its tasks are gone
    expect(q(item(KEY_T1))).toBeNull();
    expect(q(item(ROLE_MATERIAL('unit_pcs')))).not.toBeNull();           // the other project / role is open
    expect(mustGet(toggle(NODE_ROLE_TIME)).getAttribute('aria-expanded')).toBe('false');
    expect(textOf(cell(ROLE_TIME('unit_hour'), 'planned'))).toBe('48');   // the subtotal is still the sum of what is hidden
    press(toggle(NODE_ROLE_TIME));
    expect(q(item(KEY_T1))).not.toBeNull();
  });
  it('collapsing a project hides all its levels; opening it shows them as they were left (a collapsed role below stays collapsed)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(toggle(NODE_MONTH_TIME));
    press(toggle(NODE_PROJECT));
    expect(q(item(ROLE_TIME('unit_hour')))).toBeNull();
    expect(q(item(PROJECT('unit_hour')))).not.toBeNull();
    expect(q(item(ROLE_MATERIAL('unit_pcs')))).not.toBeNull();           // Beta is not touched
    press(toggle(NODE_PROJECT));
    expect(q(item(ROLE_TIME('unit_hour')))).not.toBeNull();
    expect(q(item(MONTH_TIME('unit_hour')))).not.toBeNull();             // the month line is there ...
    expect(q(item(KEY_T1))).toBeNull();                                  // ... but it is still collapsed
  });
  it('Collapse all leaves the Project lines with their subtotals; Expand all opens everything', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press('monitor01-toolbar-collapse');
    expect(qa('monitor01-table-item-node|')).toHaveLength(2);            // the two projects: one line each (hours / pieces)
    expect(rowIds()).toHaveLength(0);
    expect(textOf(cell(PROJECT('unit_hour'), 'planned'))).toBe('48');
    expect(textOf(cell(PROJECT_BETA('unit_pcs'), 'planned'))).toBe('300');
    press('monitor01-toolbar-expand');
    expect(rowIds()).toHaveLength(4);
    expect(q(item(MONTH_TIME('unit_hour')))).not.toBeNull();
  });
  it('the TotalsRow and the totals stay while the tree is collapsed', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press('monitor01-toolbar-collapse');
    expect(textOf('monitor01-table-totals-unit_hour-planned')).toBe('48');
    expect(textOf(cell('total|unit_hour', 'planned'))).toBe('48');
  });
  it('the collapsed nodes are kept when the data changes (a realtime event does not open or close anything)', () => {
    const view = renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(toggle(NODE_ROLE_TIME));
    mockHook.rows = [...mockHook.rows.slice(0, 1).map((r) => ({ ...r, qtyPlanned: 30, updated_at: '2' })), ...mockHook.rows.slice(1)];
    view.rerender(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(q(item(KEY_T1))).toBeNull();
    expect(textOf(cell(ROLE_TIME('unit_hour'), 'planned'))).toBe('54');   // the new number is in the closed subtotal
  });
  it('the months of a role are in ascending order, also across a year', () => {
    mockHook.rows = [
      raw({ rowOwnerGUID: 'a3', taskName: 'task03', periodMonth: '2027-01-01' }),
      raw({ rowOwnerGUID: 'a2', taskName: 'task02', periodMonth: '2026-12-01' }),
      raw({ rowOwnerGUID: 'a1', taskName: 'task01', periodMonth: '2026-02-01' }),
    ].map(parseMonitor01Row);
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    const base = 'node|p|p1|r|timeGenus|r1|m|';
    expectInOrder([item(`${base}2026-02-01|unit_hour`), item(`${base}2026-12-01|unit_hour`), item(`${base}2027-01-01|unit_hour`)]);
    expect(textOf(item(`${base}2027-01-01|unit_hour`))).toContain('Jan 2027');
  });
  it('two projects (the full data set): every project has its roles, months and tasks under it, projects by name', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expectInOrder([item(PROJECT('unit_hour')), item(KEY_T1), item(PROJECT_BETA('unit_pcs')), item(ROLE_MATERIAL('unit_pcs')), item('t3|materialGenus|r2|unit_pcs|2026-10-01')]);
    press(toggle(NODE_PROJECT));
    expect(q(item(KEY_T1))).toBeNull();
    expect(q(item(ROLE_MATERIAL('unit_pcs')))).not.toBeNull();                        // Beta is not touched
  });
});

describe('Vendor Invoice: Qty and Sum', () => {
  it('a row, a subtotal, the Totals and the total line show the Qty (a button) and the Sum (money, 0 = blank) of the posted vendor invoices', () => {
    mockHook.rows = [
      parseMonitor01Row(raw({ qtyVendorInvoiced: 8, sumVendorInvoiced: 1234.5 })),
      parseMonitor01Row(raw({ rowOwnerGUID: 't3', taskName: 'task03', qtyVendorInvoiced: 0, sumVendorInvoiced: 0 })),
    ];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'vendorInvoiced'))).toBe('8');
    expect(textOf(`monitor01-table-sumVendorInvoiced-${KEY_T1}`)).toBe('1,234.50');
    expect(textOf('monitor01-table-sumVendorInvoiced-total|unit_hour')).toBe('1,234.50');
    expect(textOf(`monitor01-table-sumVendorInvoiced-${PROJECT('unit_hour')}`)).toBe('1,234.50');
    expect(textOf('monitor01-table-totals-unit_hour-sumVendorInvoiced')).toBe('1,234.50');
    expect(textOf('monitor01-table-totals-unit_hour-vendorInvoiced')).toBe('8');
    expect(textOf(`monitor01-table-sumVendorInvoiced-t3|timeGenus|r1|unit_hour|2026-10-01`)).toBe(''); // a zero shows nothing
  });
});

describe('Customer Invoice: Qty and Sum (the last group; the Deliverable = Revenue genus)', () => {
  const REV = (over: Record<string, any> = {}) => raw({ rowOwnerGUID: 't9', taskName: 'task09', genusGUID: 'revenueGenus', resourceRoleGUID: 'r9', resourceRoleName: 'Stage #1 Revenue', measureUnit: 'unit_pcs', qtyPlanned: 0, qtyContracted: 0, sumForBudget: 0, qtyRestToContract: 0, qtyCustomerInvoiced: 4, sumCustomerInvoiced: 2500.5, ...over });
  it('a Deliverable row shows the Qty (a button) and the Sum (money) of the posted customer invoices; the subtotals, the total line and the TotalsRow too', () => {
    mockHook.rows = [parseMonitor01Row(REV()), parseMonitor01Row(raw({ qtyCustomerInvoiced: 0, sumCustomerInvoiced: 0 }))];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    const key = 't9|revenueGenus|r9|unit_pcs|2026-10-01';
    expect(textOf(cell(key, 'customerInvoiced'))).toBe('4');
    expect(textOf(`monitor01-table-sumCustomerInvoiced-${key}`)).toBe('2,500.50');
    expect(textOf('monitor01-table-sumCustomerInvoiced-total|unit_pcs')).toBe('2,500.50');
    expect(textOf('monitor01-table-totals-unit_pcs-sumCustomerInvoiced')).toBe('2,500.50');
    expect(textOf('monitor01-table-totals-unit_pcs-customerInvoiced')).toBe('4');
    expect(textOf(`monitor01-table-sumCustomerInvoiced-${KEY_T1}`)).toBe('');   // a zero shows nothing
    expect(textOf(`monitor01-table-sumVendorInvoiced-${key}`)).toBe('');        // the vendor invoice columns are not the customer ones
  });
  it('a click on the Qty lists the POSTED customer invoices (measure customerInvoiced); Open shows the invoice in the customer invoice form', async () => {
    mockHook.rows = [parseMonitor01Row(REV())];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    const key = 't9|revenueGenus|r9|unit_pcs|2026-10-01';
    press(cell(key, 'customerInvoiced'));
    await flush();
    expect(mockFetch.mock.calls.map((c) => c[1])).toEqual(['customerInvoiced']);
  });
  it('the Deliverable tab shows only the Revenue rows and is counted; All has them too', () => {
    mockHook.rows = [...sheet(), parseMonitor01Row(REV())];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(q('monitor01-tab-deliverable')).not.toBeNull();
    expect(textOf('monitor01-tab-deliverable-count')).toBe('1');
    expect(textOf('monitor01-tab-all-count')).toBe('5');
    press('monitor01-tab-deliverable');
    expect(rowIds().every((id) => id.includes('revenueGenus'))).toBe(true);
    expect(rowIds()).toHaveLength(1);
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
    typeInto('monitor01-filters-task', 't3');
    await wait(250);
    expect(textOf('monitor01-table-totals-unit_hour-budget')).toBe('600.50');
    expect(textOf('monitor01-table-totals-all-budget')).toBe('1,600.50');
    press('monitor01-tab-time');
    expect(q('monitor01-table-totals-unit_pcs-budget')).toBeNull();
    expect(q('monitor01-table-totals-all')).toBeNull();                              // one unit: one line
    expect(textOf('monitor01-table-totals-unit_hour-budget')).toBe('600.50');
  });
  it('no rows: the TotalsRow shows nothing for the money (0 is blank)', async () => {
    mockHook.rows = [];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-totals-none-budget')).toBe('');
  });
});

describe('the two modes and the fast filters', () => {
  it('project mode: no Project filter; the tree still starts with the project line', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(q('monitor01-filters-project')).toBeNull();
    expect(q('monitor01-filters-startDate')).not.toBeNull();
    expect(q('monitor01-filters-finishDate')).not.toBeNull();
    expect(q('monitor01-filters-task')).not.toBeNull();
    expect(q('monitor01-filters-resource')).not.toBeNull();
    expect(textOf(item(PROJECT('unit_hour')))).toContain('Alpha');
    expect((useMonitor01Rows as jest.Mock).mock.calls[0][0]).toBe('p1');
  });
  it('standalone: the FULL data set (the hook gets no project) with the Project filter and the project of each row', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expect((useMonitor01Rows as jest.Mock).mock.calls[0][0]).toBeNull();
    expect(q('monitor01-filters-project')).not.toBeNull();
    expect(textOf(item(PROJECT('unit_hour')))).toContain('Alpha');
  });
  it('dates use DateInputApp (calendar trigger); Project / Task / Resource are SelectItemFromListApp, clearable, picked from the data (never typed)', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    expect(q('monitor01-filters-startDate-datepicker-trigger')).not.toBeNull();
    expect(q('monitor01-filters-finishDate-datepicker-trigger')).not.toBeNull();
    (['project', 'task', 'resource'] as const).forEach((k) => {
      expect(q(`monitor01-filters-${k}`)).not.toBeNull();
      expect(q(`monitor01-filters-${k}-datepicker-trigger`)).toBeNull();
      expect(mockSelects[`monitor01-filters-${k}`].clearable).toBe(true);
    });
    expect(mockSelects['monitor01-filters-project'].placeholder).toBe('Project');
    expect(mockSelects['monitor01-filters-task'].placeholder).toBe('Task');
    expect(mockSelects['monitor01-filters-resource'].placeholder).toBe('Resource');
    expect(q('monitor01-filters-startDate-clear-button')).toBeNull();
  });
  it('the items of Task / Resource are the tasks / roles actually loaded, and narrow to the selected project', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    const taskValues = () => mockSelects['monitor01-filters-task'].items.map((i: any) => i.value).sort();
    const resourceValues = () => mockSelects['monitor01-filters-resource'].items.map((i: any) => i.value).sort();
    expect(mockSelects['monitor01-filters-project'].items).toEqual([{ value: 'p1', label: 'Alpha' }, { value: 'p2', label: 'Beta' }]);
    expect(taskValues()).toEqual(['t1', 't3', 't4']);             // every task of every project
    expect(resourceValues()).toEqual(['r1', 'r2']);
    typeInto('monitor01-filters-project', 'p2');
    await wait(250);
    expect(taskValues()).toEqual(['t3', 't4']);                   // only the tasks of Beta
    expect(resourceValues()).toEqual(['r2']);
  });
  it('picking a project clears a Task that does not belong to it (a stale GUID would silently show nothing)', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 't1');
    await wait(250);
    expect(inputValue('monitor01-filters-task')).toBe('t1');
    typeInto('monitor01-filters-project', 'p2');                  // t1 has no row in Beta
    await wait(250);
    expect(inputValue('monitor01-filters-task')).toBe('');
    expect(inputValue('monitor01-filters-project')).toBe('p2');
    expect(q(`monitor01-table-item-${KEY_T1}`)).toBeNull();          // t1 is of Alpha (p1), not Beta
    expect(rowIds()).toHaveLength(2);                                // the two Beta rows of t3 / t4
  });
  it('a task that still belongs to the newly picked project is kept', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 't3');                     // t3 has a row in BOTH Alpha and Beta
    await wait(250);
    typeInto('monitor01-filters-project', 'p2');
    await wait(250);
    expect(inputValue('monitor01-filters-task')).toBe('t3');
  });
  it('all the filter inputs are in ONE row (no wrapping; it scrolls sideways when narrow)', () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    const bar = mustGet('monitor01-filters');
    const inner = bar.firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).flexWrap).toBe('nowrap');
    expect(getComputedStyle(inner).flexDirection).toBe('row');
    const ids = ['startDate', 'finishDate', 'period-button', 'project', 'task', 'resource'].map((k) => `monitor01-filters-${k}`);
    ids.forEach((id) => expect(inner.contains(mustGet(id))).toBe(true));
    expectInOrder(ids);
  });
  it('the period button (after Finish date) picks a whole range of months at once', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press('monitor01-filters-period-button');
    press('monitor01-filters-period-modal-month-2026-11');                 // November: no row of the sheet is in it
    press('monitor01-filters-period-modal-select');
    await wait(250);
    expect(rowIds()).toHaveLength(0);
    expect(inputValue('monitor01-filters-startDate')).toBe('2026-11-01');
    expect(inputValue('monitor01-filters-finishDate')).toBe('2026-11-30');
    press('monitor01-filters-period-button');                              // re-opened: shows what is active
    expect(inputValue('monitor01-filters-period-modal-from')).toBe('2026-11-01');
    press('monitor01-filters-period-modal-cancel');
  });
  it('typing in Task filters the rows after the debounce; the totals follow', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 't3');
    expect(q(`monitor01-table-item-${KEY_T1}`)).not.toBeNull();       // not yet: the filter waits for the last key
    await wait(250);
    expect(q(`monitor01-table-item-${KEY_T1}`)).toBeNull();
    expect(q('monitor01-table-item-t3|timeGenus|r1|unit_hour|2026-10-01')).not.toBeNull();
    expect(textOf(cell('total|unit_hour', 'planned'))).toBe('24');
  });
  it('Project and Resource filters; startDate / finishDate cut months', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-project', 'p2');
    await wait(250);
    expect(rowIds()).toHaveLength(2);
    typeInto('monitor01-filters-project', '');
    typeInto('monitor01-filters-resource', 'r2');
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
    typeInto('monitor01-filters-task', 't3');
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
    typeInto('monitor01-filters-task', 't3');
    await wait(250);
    expect(rowIds()).toHaveLength(2);
    // a new row of the SAME task (t3) arrives live - unlike a text search, an exact GUID filter never widens by accident on an unrelated row
    mockHook.rows = [...sheet(), parseMonitor01Row(raw({ rowOwnerGUID: 't3', taskName: 'task03', genusGUID: 'expenseGenus', qtyPlanned: 5, qtyContracted: 0, qtyRestToContract: 5, resourceRoleGUID: 'r9' }))];
    view.rerender(<Monitor01Dashboard mode="standalone" />);
    expect(rowIds()).toHaveLength(3);
    typeInto('monitor01-filters-task', '');
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
    typeInto('monitor01-filters-task', '');
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
  it('Realtime is silent but the stamp is answered: "Live: checked every 3 s", not Offline (the safety net works)', () => {
    mockHook.live = false;
    mockHook.checkedAt = Date.now();
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-age')).toContain('Live: checked every 3 s');
    expect(textOf('monitor01-age')).not.toContain('Offline');
  });
  it('Realtime is silent and nothing was checked for a long time: Offline', () => {
    mockHook.live = false;
    mockHook.checkedAt = Date.now() - 60_000;
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-age')).toContain('Offline');
  });
  it('the polling follows the Auto refresh switch: on by default, off when the switch is off', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    const calls = (useMonitor01Rows as jest.Mock).mock.calls;
    expect(calls[calls.length - 1][1]).toEqual({ poll: true });
    toggleSwitch('monitor01-toolbar-auto');
    const after = (useMonitor01Rows as jest.Mock).mock.calls;
    expect(after[after.length - 1][1]).toEqual({ poll: false });
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
  it('on-hand is made of received and used - without data yet', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell(KEY_T1, 'onHand'));
    await flush();
    expect(mockFetch.mock.calls.map((c) => c[1]).sort()).toEqual(['received', 'used']);
  });
  it('"Vendor Invoiced" (after Received) is the list of the POSTED vendor invoices; Open shows the invoice in the vendor invoice form', async () => {
    mockHook.rows = [parseMonitor01Row(raw({ qtyVendorInvoiced: 8 }))];
    mockFetch.mockImplementation(async (_c: any, measure: string) => ({ measure, totalCount: 1, sum: 8, rows: [{ rowGUID: 'iv1', sourceName: 'projectStatusMovements', day: '2026-10-14', taskGUID: 't1', taskName: 'task01', projectGUID: 'p1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', qty: 8, documentGUID: 'vi1', documentNumber: 'INV-77' }] }));
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'vendorInvoiced'))).toBe('8');
    press(cell(KEY_T1, 'vendorInvoiced'));
    await flush();
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), 'vendorInvoiced', { taskGUID: 't1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', month: '2026-10-01' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-source-vendorInvoiced')).toContain('Posted vendor invoices');
    expect(textOf('monitor01-sum-source-vendorInvoiced')).toContain('INV-77');
    press('monitor01-sum-open-iv1');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'vi1' } });
  });
  it('"Ordered" (the first column of the Fact group) is the list of the POSTED purchase orders; Open shows the purchase order in its form', async () => {
    mockHook.rows = [parseMonitor01Row(raw({ qtyOrdered: 11 }))];
    mockFetch.mockImplementation(async (_c: any, measure: string) => ({ measure, totalCount: 1, sum: 11, rows: [{ rowGUID: 'po1', sourceName: 'projectStatusMovements', day: '2026-10-18', taskGUID: 't1', taskName: 'task01', projectGUID: 'p1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', qty: 11, documentGUID: 'poh1', documentNumber: 'ORD-5' }] }));
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'ordered'))).toBe('11');
    press(cell(KEY_T1, 'ordered'));
    await flush();
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), 'ordered', { taskGUID: 't1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', month: '2026-10-01' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-source-ordered')).toContain('Posted purchase orders');
    expect(textOf('monitor01-sum-source-ordered')).toContain('ORD-5');
    press('monitor01-sum-open-po1');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/purchase-order', params: { taskGUID: 't1', projectGUID: 'p1', documentGUID: 'poh1' } });
  });
  it('a row without purchase orders shows a blank Ordered cell; the Plan | Fact divider is the left edge of Ordered', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'ordered'))).toBe('');
  });
  it('a cell that is 0 shows nothing - in EVERY column, in the lines, the subtotals and the TotalsRow (the cell stays a button)', () => {
    mockHook.rows = [parseMonitor01Row(raw({ qtyPlanned: 0, qtyContracted: 0, sumForBudget: 0, qtyUsed: 5, qtyOnHand: -5, qtyRestToContract: 0, lineCount: 0 }))];
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    for (const m of ['planned', 'contracted', 'restToContract', 'ordered', 'received', 'vendorInvoiced']) expect(textOf(cell(KEY_T1, m))).toBe('');
    expect(textOf(`monitor01-table-budget-${KEY_T1}`)).toBe('');
    expect(textOf(cell(KEY_T1, 'used'))).toBe('5');
    expect(textOf(cell(KEY_T1, 'onHand'))).toBe('-5');
    expect(textOf('monitor01-table-totals-unit_hour-planned')).toBe('');
    expect(textOf('monitor01-table-totals-unit_hour-budget')).toBe('');
    expect(textOf('monitor01-table-totals-unit_hour-used')).toBe('5');
    expect(q(cell(KEY_T1, 'planned'))!.getAttribute('role')).toBe('button');
  });
  it('a row without invoices shows a blank Vendor Invoiced cell (like Received and Actually used)', () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf(cell(KEY_T1, 'vendorInvoiced'))).toBe('');
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
  it('a node line and a total are opened with the keys they share (the project, the role and its genus from the role level, the month at the month level)', async () => {
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press(cell(ROLE_MATERIAL('unit_pcs'), 'planned'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'planned', { genusGUID: 'materialGenus', unit: 'unit_pcs', projectGUID: 'p2', roleGUID: 'r2' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-title')).toContain('Subtotal Beta · 10m pipe section');
    press('monitor01-sum-close');
    press(cell(PROJECT('unit_hour'), 'planned'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'planned', { unit: 'unit_hour', projectGUID: 'p1' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-title')).toContain('Subtotal Alpha ·');
    press('monitor01-sum-close');
    press(cell(MONTH_TIME('unit_hour'), 'planned'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'planned', { genusGUID: 'timeGenus', unit: 'unit_hour', projectGUID: 'p1', roleGUID: 'r1', month: '2026-10-01' }, 0, expect.any(Number));
    expect(textOf('monitor01-sum-title')).toContain('Subtotal Alpha · Data Analyst · Oct 2026');
    press('monitor01-sum-close');
    press(cell('total|unit_hour', 'contracted'));
    await flush();
    expect(mockFetch).toHaveBeenLastCalledWith(expect.anything(), 'contracted', { unit: 'unit_hour', projectGUID: 'p1' }, 0, expect.any(Number));
  });
  it('under a text filter the total lists exactly the tasks that are shown', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    typeInto('monitor01-filters-task', 't3');
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

describe('a double click on a Task name opens the task in the dashboard', () => {
  // the window is opened inside the click (a pop-up blocker would stop it after the lookup) and pointed at the board afterwards: `target.location.href`
  let open: jest.SpyInstance;
  let target: { location: { href: string } };
  beforeEach(() => { target = { location: { href: '' } }; open = jest.spyOn(window, 'open').mockImplementation(() => target as any); });
  afterEach(() => open.mockRestore());
  const task = `monitor01-table-task-${KEY_T1}`;

  it('one click does nothing; two clicks open project + task + the tab of the genus + the line of the sum (a row of ONE line)', async () => {
    mockFetch.mockImplementation(async (_c: any, measure: string) => ({ measure, totalCount: 1, sum: 24, rows: [{ rowGUID: 'm1', lineGUID: 'l1', sourceName: 'x', day: '2026-10-14', taskGUID: 't1', projectGUID: 'p1', genusGUID: 'timeGenus', roleGUID: 'r1', unit: 'unit_hour', qty: 24 }] }));
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press(task);
    await flush();
    expect(open).not.toHaveBeenCalled();
    press(task);
    await flush();
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), 'planned', expect.objectContaining({ taskGUID: 't1', genusGUID: 'timeGenus' }), 0, 1);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(target.location.href).toBe('/pm/project/dashboard?projectGUID=p1&taskGUID=t1&view=finances&genus=timeGenus&lineGUID=l1');
  });

  it('a row of several lines opens the task and the tab without a line (no lookup)', async () => {
    mockHook.rows = [parseMonitor01Row(raw({ lineCount: 3 }))];
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press(task); press(task);
    await flush();
    expect(mockFetch).not.toHaveBeenCalledWith(expect.anything(), 'planned', expect.anything(), 0, 1);
    expect(target.location.href).toBe('/pm/project/dashboard?projectGUID=p1&taskGUID=t1&view=finances&genus=timeGenus');
  });

  it('two clicks on different tasks are not a double click', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    press(task);
    press(`monitor01-table-task-t3|timeGenus|r1|unit_hour|2026-10-01`);
    await flush();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('the context menu of a Task name (right click / long press)', () => {
  const task = `monitor01-table-task-${KEY_T1}`;
  const rightClick = (id: string) => act(() => { mustGet(id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 })); });

  it('standalone (no project board): its own Task menu with the commands that work from the task', async () => {
    renderUI(<Monitor01Dashboard mode="standalone" />);
    rightClick(task);
    await flush();
    const m = 'monitor01-task-menu';
    expect(q(m)).not.toBeNull();
    for (const id of ['open', 'copy-guid', 'facts-input', 'vendor-invoice', 'purchase-order']) expect(q(`${m}-${id}`)).not.toBeNull();
    expect(q(`${m}-create`)).not.toBeNull();
    expect(q(`${m}-goto`)).not.toBeNull();
    // a command of the project board (Edit, Delete ...) needs that board: not here
    expect(q(`${m}-edit`)).toBeNull();
    expect(q(`${m}-delete`)).toBeNull();
  });

  it('project mode with the task in the PM store: the menu of the tree itself (PMTaskRowMenu reads the store)', () => {
    const { usePMStore } = require('../../../../kit8/pm/store/store_pm');
    const { seedStore } = require('../../ui/pmUiTestKit');
    const { byName } = seedStore();
    const t = byName('Task 111');
    mockHook.rows = [parseMonitor01Row(raw({ rowOwnerGUID: t.rowGUID, rowProjectGUID: t.projectGUID }))];
    renderUI(<Monitor01Dashboard mode="project" projectGUID={t.projectGUID} />);
    rightClick(`monitor01-table-task-${t.rowGUID}|timeGenus|r1|unit_hour|2026-10-01`);
    expect(usePMStore.getState().rowMenu).toEqual(expect.objectContaining({ guid: t.rowGUID, source: 'tree' }));
    expect(q('monitor01-task-menu')).toBeNull();
    act(() => usePMStore.getState().setRowMenu(null));
  });

  it('Copy GUID / Open task close the menu; Open task opens the dashboard at the task', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => ({ location: { href: '' } }) as any);
    renderUI(<Monitor01Dashboard mode="standalone" />);
    rightClick(task);
    await flush();
    press('monitor01-task-menu-open');
    await flush();
    expect(q('monitor01-task-menu')).toBeNull();
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('the VAT basis switch (documentation/VENDOR_INVOICE_DOC.html section 13): Cost (default) | Net | With VAT', () => {
  const { resetVatBasisForTest } = require('../../../../kit8/pm/vat/useVatBasis');
  beforeEach(() => resetVatBasisForTest());
  // the budget 100 (VAT 21, 5 of it cost), a vendor invoice 50 (VAT 10.5, all cost), a customer invoice 200 (VAT 42)
  const withVat = () => [parseMonitor01Row(raw({ sumForBudget: 100, vatBudget: 21, vatInCostBudget: 5, sumVendorInvoiced: 50, vatVendorInvoiced: 10.5, vatInCostVendorInvoiced: 10.5, qtyVendorInvoiced: 1, sumCustomerInvoiced: 200, vatCustomerInvoiced: 42, qtyCustomerInvoiced: 1 }))];
  const budget = () => textOf(`monitor01-table-budget-${KEY_T1}`);
  const vendor = () => textOf(`monitor01-table-sumVendorInvoiced-${KEY_T1}`);
  const customer = () => textOf(`monitor01-table-sumCustomerInvoiced-${KEY_T1}`);

  it('the switch is in the toolbar and starts on Cost: net + the VAT that is cost (a customer invoice stays net)', () => {
    mockHook.rows = withVat();
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(q('monitor01-vat-basis')).not.toBeNull();
    expect(qa('monitor01-vat-basis-radio-').map((id) => id.replace('monitor01-vat-basis-radio-', ''))).toEqual(['cost', 'net', 'gross']);
    expect([budget(), vendor(), customer()]).toEqual(['105.00', '60.50', '200.00']);
  });
  it('Net: the amounts without VAT; With VAT: all the VAT; the totals row and the subtotals follow', () => {
    mockHook.rows = withVat();
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    press('monitor01-vat-basis-radio-net');
    expect([budget(), vendor(), customer()]).toEqual(['100.00', '50.00', '200.00']);
    press('monitor01-vat-basis-radio-gross');
    expect([budget(), vendor(), customer()]).toEqual(['121.00', '60.50', '242.00']);
    expect(textOf('monitor01-table-budget-total|unit_hour')).toBe('121.00');
    expect(textOf(`monitor01-table-budget-${PROJECT('unit_hour')}`)).toBe('121.00');
  });
  it('while all the VAT is recoverable the default basis shows exactly the net numbers of before', () => {
    mockHook.rows = sheet();
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(textOf('monitor01-table-budget-total|unit_hour')).toBe('1,080.50');
  });
  it('the header tip of each money column says the basis in force', () => {
    mockHook.rows = withVat();
    renderUI(<Monitor01Dashboard mode="project" projectGUID="p1" />);
    expect(mockTipTexts).toContain('Budget - Cost');
    expect(mockTipTexts).toContain('Amount - Cost');
    mockTipTexts.length = 0;
    press('monitor01-vat-basis-radio-gross');
    expect(mockTipTexts).toContain('Budget - With VAT');
  });
});
