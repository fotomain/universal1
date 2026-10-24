/** @jest-environment jsdom */
// Monitor07CustomerBalance / Monitor07VendorBalance (documentation/PARTNER_BALANCE.html): the lines (partner -> contract -> task), the numbers, the flags, the filters sent to the database (dates, sums bigger / smaller
// than), the sort, the drill-down, the status badge. The data hook and the calls are replaced.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, qa, renderUI, textOf, toggleSwitch, typeInto } from '../../ui/pmUiTestKit';

const mockReport: { data: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; reload: jest.Mock } = { data: [], isLoading: false, error: null, live: true, changedAt: null, reload: jest.fn() };
const mockItems = { data: { projects: [{ value: 'pr1', label: 'Alpha' }], tasks: [], partners: [{ value: 'pt1', label: 'Supplier One' }], contracts: [], legalEntities: [] }, isLoading: false, error: null, live: false, changedAt: null, reload: jest.fn() };
const mockOptions: any[] = [];
jest.mock('../../../../kit8/pm/reports/common/useReportData', () => ({ useReportData: (o: any) => { mockOptions.push(o); return o.realtimeTable ? mockReport : mockItems; } }));
const mockFetchReport = jest.fn(async (..._a: any[]): Promise<any[]> => []);
const mockFetchItems = jest.fn(async (..._a: any[]) => ({}));
const mockFetchMovements = jest.fn(async (..._a: any[]): Promise<any[]> => []);
jest.mock('../../../../kit8/pm/reports/partner_balance/partnerBalanceApi', () => ({
  ...jest.requireActual('../../../../kit8/pm/reports/partner_balance/partnerBalanceApi'),
  fetchPartnerBalanceReport: (...a: any[]) => (mockFetchReport as any)(...a),
  fetchPartnerBalanceFilterItems: (...a: any[]) => (mockFetchItems as any)(...a),
  fetchPartnerBalanceMovements: (...a: any[]) => (mockFetchMovements as any)(...a),
}));
const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
const mockTipTexts: (string | undefined)[] = [];
jest.mock('../../../../kit8/pm/inner/tooltip/PMTooltip', () => ({
  ...jest.requireActual('../../../../kit8/pm/inner/tooltip/PMTooltip'),
  usePMTip: (text?: string) => { mockTipTexts.push(text); return { ref: { current: null }, accessibilityHint: text }; },
}));
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});

const mockClient = { rpc: jest.fn() };
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));

const Dashboard = require('../../../../kit8/pm/reports/partner_balance/PartnerBalanceDashboard').default;
const Table = require('../../../../kit8/pm/reports/partner_balance/PartnerBalanceTable').default;

const row = (o: Record<string, any>) => ({
  partner: 'pt1', partnerTitle: 'Supplier One', contract: 'c1', contractTitle: 'C-1', contractFinishDate: '2030-12-31', currencyForContract: 'EUR', currencyForAccounting: 'EUR', currencyForBudget: 'EUR',
  project: null, projectTitle: null, task: null, taskTitle: null,
  sumForContractBegin: 0, sumForContractPlus: 275, sumForContractMinus: 140, sumForContractEnd: 135,
  sumForAccountingBegin: 0, sumForAccountingPlus: 275, sumForAccountingMinus: 140, sumForAccountingEnd: 135,
  sumForBudgetBegin: 0, sumForBudgetPlus: 275, sumForBudgetMinus: 140, sumForBudgetEnd: 135, ...o,
});
const sheet = () => {
  mockReport.data = [
    row({}),
    row({ partner: 'pt2', partnerTitle: 'Supplier Two', contract: 'c3', contractTitle: 'C-3', contractFinishDate: '2030-06-30', sumForContractBegin: 10, sumForContractPlus: 60, sumForContractMinus: 0, sumForContractEnd: 70 }),
  ];
};
const cell = (role: string, key: string, col: string) => `monitor07-${role}-table-cell-${key}-${col}`;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const lastReportOptions = () => [...mockOptions].reverse().find((o) => o.realtimeTable);

beforeEach(() => { sheet(); mockReport.error = null; mockReport.isLoading = false; mockReport.live = true; mockReport.changedAt = Date.now(); mockOptions.length = 0; mockTipTexts.length = 0; mockFetchReport.mockClear(); mockFetchMovements.mockClear(); mockPush.mockClear(); });
afterEach(() => { cleanupUI(); });

describe('the two reports are one screen with a role', () => {
  it('the vendor report says what a positive number means; the customer report the other way', () => {
    renderUI(<Dashboard role="vendor" />);
    expect(textOf('monitor07-vendor-title')).toBe('Monitor07VendorBalance');
    expect(textOf('monitor07-vendor-sign')).toContain('we owe the vendor');
    cleanupUI();
    renderUI(<Dashboard role="customer" />);
    expect(textOf('monitor07-customer-title')).toBe('Monitor07CustomerBalance');
    expect(textOf('monitor07-customer-sign')).toContain('the customer owes us');
  });
  it('the data is asked for the role, with the realtime table of the ledger', () => {
    renderUI(<Dashboard role="vendor" />);
    const o = lastReportOptions();
    expect(o.realtimeTable).toBe('partner_balance_ledger');
    expect(o.watch).toBe(true);
    expect(o.enabled).toBe(true);
  });
});

describe('the lines and the numbers', () => {
  it('a partner line per partner, the contracts under it only when it is opened; the numbers are Begin, Plus, Minus, End', () => {
    renderUI(<Dashboard role="vendor" />);
    expect(qa('monitor07-vendor-table-line-')).toEqual(['monitor07-vendor-table-line-p|pt1', 'monitor07-vendor-table-line-p|pt2']);
    expect(['Begin', 'Plus', 'Minus', 'End'].map((p) => textOf(cell('vendor', 'p|pt1', `contract${p}`)))).toEqual(['0.00', '275.00', '140.00', '135.00']);
    press('monitor07-vendor-table-toggle-p|pt1');
    expect(qa('monitor07-vendor-table-line-')).toEqual(['monitor07-vendor-table-line-p|pt1', 'monitor07-vendor-table-line-c|pt1|c1', 'monitor07-vendor-table-line-p|pt2']);
    expect(textOf('monitor07-vendor-table-finish-c|pt1|c1')).toBe('2030-12-31');
    expect(textOf('monitor07-vendor-table-currency-c|pt1|c1')).toBe('EUR');
  });
  it('the footer is the sum of the rows, one line per currency', () => {
    renderUI(<Dashboard role="vendor" />);
    expect(textOf('monitor07-vendor-table-footer-EUR-contractEnd')).toBe('205.00');
    expect(textOf('monitor07-vendor-table-footer-EUR-contractBegin')).toBe('10.00');
  });
  it('an empty answer shows the empty text', () => {
    mockReport.data = [];
    renderUI(<Dashboard role="vendor" />);
    expect(q('monitor07-vendor-table-empty')).not.toBeNull();
  });
  it('the headers have tips: Begin, Plus, Minus, End and the sum kinds', () => {
    renderUI(<Dashboard role="vendor" />);
    const tips = mockTipTexts.filter(Boolean) as string[];
    expect(tips.some((t) => t.startsWith('The balance before the first day'))).toBe(true);
    expect(tips.some((t) => t.includes('a credit note lands here'))).toBe(true);
    expect(tips.some((t) => t.startsWith('In the currency of the contract'))).toBe(true);
  });
  it('a negative End is red (the unusual way), a positive one is not', () => {
    mockReport.data = [row({ sumForContractEnd: -5 })];
    renderUI(<Dashboard role="vendor" />);
    const color = (id: string) => getComputedStyle(mustGet(id)).color;
    expect(color(cell('vendor', 'p|pt1', 'contractEnd'))).not.toBe(color(cell('vendor', 'p|pt1', 'contractPlus')));
  });
  it('MIXED currencies: a partner whose contracts have two currencies shows "mixed" in the contract sum, not a total', () => {
    mockReport.data = [row({}), row({ contract: 'c5', contractTitle: 'C-5', currencyForContract: 'USD', sumForContractEnd: 5 })];
    renderUI(<Dashboard role="vendor" />);
    expect(textOf(cell('vendor', 'p|pt1', 'contractEnd'))).toBe('mixed');
    expect(textOf('monitor07-vendor-table-currency-p|pt1')).toBe('mixed');
    expect(qa('monitor07-vendor-table-footer-')).toEqual(expect.arrayContaining(['monitor07-vendor-table-footer-EUR', 'monitor07-vendor-table-footer-USD']));
  });
});

describe('the flags', () => {
  it('showSumForAccounting / showSumForBudget add their four columns; the last shown kind cannot be switched off', async () => {
    renderUI(<Dashboard role="vendor" />);
    expect(q(cell('vendor', 'p|pt1', 'accountingEnd'))).toBeNull();
    toggleSwitch('monitor07-vendor-options-showSumForAccounting');
    await flush();
    expect(textOf(cell('vendor', 'p|pt1', 'accountingEnd'))).toBe('135.00');
    expect(q(cell('vendor', 'p|pt1', 'budgetEnd'))).toBeNull();
    toggleSwitch('monitor07-vendor-options-showSumForContract');
    await flush();
    expect(q(cell('vendor', 'p|pt1', 'contractEnd'))).toBeNull();
    toggleSwitch('monitor07-vendor-options-showSumForAccounting');          // the last kind: refused
    await flush();
    expect(q(cell('vendor', 'p|pt1', 'accountingEnd'))).not.toBeNull();
  });
  it('the first shown kind is the one the sum filters judge', async () => {
    renderUI(<Dashboard role="vendor" />);
    expect(lastReportOptions().deps[0]).toContain('"sumKind":"contract"');
    toggleSwitch('monitor07-vendor-options-showSumForAccounting');
    toggleSwitch('monitor07-vendor-options-showSumForContract');
    await flush();
    expect(lastReportOptions().deps[0]).toContain('"sumKind":"accounting"');
  });
});

describe('the filters go to the database', () => {
  it('dateFrom, dateTo, sumBiggerThan, sumSmallerThan (a minus and a comma are fine); the call has them', async () => {
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-dateFrom', '2030-01-05');
    typeInto('monitor07-vendor-filters-dateTo', '2030-01-31');
    typeInto('monitor07-vendor-filters-sumBiggerThan', '30');
    typeInto('monitor07-vendor-filters-sumSmallerThan', '-5,5');
    await wait(250);
    const o = lastReportOptions();
    await o.load({});
    const p = mockFetchReport.mock.calls[mockFetchReport.mock.calls.length - 1][1];
    expect(p).toMatchObject({ role: 'vendor', from: '2030-01-05', to: '2030-01-31', filters: { sumBiggerThan: 30, sumSmallerThan: -5.5, sumKind: 'contract', hideSettled: true }, sort: { sortBy: 'partnerName', sortDir: 'asc' } });
  });
  it('dateFrom after dateTo: a message and the report is not asked', async () => {
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-dateFrom', '2030-02-01');
    typeInto('monitor07-vendor-filters-dateTo', '2030-01-01');
    await wait(250);
    expect(textOf('monitor07-vendor-range-error')).toContain('dateFrom is after dateTo');
    expect(lastReportOptions().enabled).toBe(false);
  });
  it('an unreadable amount is a message, not a filter', async () => {
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-sumBiggerThan', 'abc');
    await wait(250);
    expect(textOf('monitor07-vendor-input-error')).toContain('cannot be read');
    expect(lastReportOptions().deps[0]).not.toContain('sumBiggerThan');
  });
  it('the lists of the selects come from the database; the task waits for the project, the contract for the partner', async () => {
    renderUI(<Dashboard role="vendor" />);
    expect(mockSelects['monitor07-vendor-filters-projectFilter'].items.map((i: any) => i.value)).toEqual(['pr1']);
    expect(mockSelects['monitor07-vendor-filters-taskFilter'].disabled).toBe(true);
    typeInto('monitor07-vendor-filters-projectFilter', 'pr1');
    await wait(250);
    expect(mockSelects['monitor07-vendor-filters-taskFilter'].disabled).toBe(false);
    const itemsOpts = [...mockOptions].reverse().find((o) => !o.realtimeTable);
    expect(itemsOpts.deps).toEqual(['vendor', 'pr1', '']);
  });
});

describe('the sort', () => {
  it('by partner name (default), Budget sum End, Contract finish date; the direction button turns it round; the database gets it', async () => {
    renderUI(<Dashboard role="vendor" />);
    press('monitor07-vendor-options-sort-sumForBudgetEnd');
    await flush();
    let o = lastReportOptions();
    await o.load({});
    expect(mockFetchReport.mock.calls[mockFetchReport.mock.calls.length - 1][1].sort).toEqual({ sortBy: 'sumForBudgetEnd', sortDir: 'desc' });
    press('monitor07-vendor-options-sortDir');
    await flush();
    o = lastReportOptions();
    await o.load({});
    expect(mockFetchReport.mock.calls[mockFetchReport.mock.calls.length - 1][1].sort).toEqual({ sortBy: 'sumForBudgetEnd', sortDir: 'asc' });
    press('monitor07-vendor-options-sort-contractFinishDate');
    await flush();
    o = lastReportOptions();
    await o.load({});
    expect(mockFetchReport.mock.calls[mockFetchReport.mock.calls.length - 1][1].sort).toEqual({ sortBy: 'contractFinishDate', sortDir: 'asc' });
  });
});

describe('the tasks of a contract and the rows behind a number', () => {
  it('opening a contract reads its tasks (group "task", the partner and the contract named, the sum filters left out)', async () => {
    mockFetchReport.mockResolvedValueOnce([row({ project: 'pr1', projectTitle: 'Alpha', task: 't3', taskTitle: 'Task 112', sumForContractEnd: 80 })]);
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-sumBiggerThan', '1');
    await wait(250);
    press('monitor07-vendor-table-toggle-p|pt1');
    press('monitor07-vendor-table-toggle-c|pt1|c1');
    await flush();
    const call = mockFetchReport.mock.calls.find((c) => c[1].group === 'task')!;
    expect(call[1]).toMatchObject({ role: 'vendor', group: 'task', filters: { partnerFilter: 'pt1', partnerContractFilter: 'c1' } });
    expect(call[1].filters.sumBiggerThan).toBeUndefined();
    expect(call[1].filters.hideSettled).toBeUndefined();
    expect(qa('monitor07-vendor-table-line-').some((k) => k.startsWith('monitor07-vendor-table-line-t|pt1|c1|pr1|t3'))).toBe(true);
  });
  it('a contract without a contract is asked as "none"', async () => {
    mockReport.data = [row({ contract: '', contractTitle: '', contractFinishDate: null })];
    renderUI(<Dashboard role="vendor" />);
    press('monitor07-vendor-table-toggle-p|pt1');
    press('monitor07-vendor-table-toggle-c|pt1|none');
    await flush();
    expect(mockFetchReport.mock.calls.find((c) => c[1].group === 'task')![1].filters.partnerContractFilter).toBe('none');
  });
  it('a press on a number lists the rows behind it; a press on a row opens the document', async () => {
    mockFetchMovements.mockResolvedValueOnce([{ id: 'm1', periodDay: '2030-01-03', operationType: 'vendorCredit', registratorKind: 'vendorInvoice', registratorGUID: 'doc-1', documentNumber: 'VI-1', project: 'pr1', projectTitle: 'Alpha', task: 't3', taskTitle: 'Task 112',
      currencyForContract: 'EUR', sumForContract: 220, sumForAccounting: 220, sumForBudget: 220 }]);
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-dateFrom', '2030-01-05');
    typeInto('monitor07-vendor-filters-dateTo', '2030-01-31');
    await wait(250);
    press('monitor07-vendor-table-toggle-p|pt1');
    press(cell('vendor', 'c|pt1|c1', 'contractMinus'));
    await flush();
    expect(mockFetchMovements.mock.calls[0][1]).toEqual({ role: 'vendor', partner: 'pt1', contract: 'c1', project: null, task: null, from: '2030-01-05', to: '2030-01-31' });
    expect(textOf('monitor07-vendor-movements-amount-m1')).toBe('220.00');
    press('monitor07-vendor-movements-row-m1');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/vendor-invoice', params: { documentGUID: 'doc-1' } });
  });
  it('Begin lists the rows before dateFrom, End the rows up to dateTo', async () => {
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-dateFrom', '2030-01-05');
    typeInto('monitor07-vendor-filters-dateTo', '2030-01-31');
    await wait(250);
    press('monitor07-vendor-table-toggle-p|pt1');
    press(cell('vendor', 'c|pt1|c1', 'contractBegin'));
    await flush();
    expect(mockFetchMovements.mock.calls[0][1]).toMatchObject({ from: null, to: '2030-01-04' });
    cleanupUI();
    renderUI(<Dashboard role="vendor" />);
    typeInto('monitor07-vendor-filters-dateFrom', '2030-01-05');
    typeInto('monitor07-vendor-filters-dateTo', '2030-01-31');
    await wait(250);
    press('monitor07-vendor-table-toggle-p|pt1');
    press(cell('vendor', 'c|pt1|c1', 'contractEnd'));
    await flush();
    expect(mockFetchMovements.mock.calls[1][1]).toMatchObject({ from: null, to: '2030-01-31' });
  });
  it('a partner line is not a link (it adds up several contracts)', () => {
    renderUI(<Dashboard role="vendor" />);
    press(cell('vendor', 'p|pt1', 'contractEnd'));
    expect(mockFetchMovements).not.toHaveBeenCalled();
  });
});

describe('the bar', () => {
  it('Auto refresh OFF stops the live updates; the badge says so', () => {
    renderUI(<Dashboard role="vendor" />);
    expect(textOf('monitor07-vendor-age')).toContain('Live');
    toggleSwitch('monitor07-vendor-toolbar-auto');
    expect(lastReportOptions().watch).toBe(false);
    expect(textOf('monitor07-vendor-age')).toContain('Auto refresh is off');
  });
  it('Refresh reads again', () => {
    renderUI(<Dashboard role="vendor" />);
    press('monitor07-vendor-toolbar-refresh');
    expect(mockReport.reload).toHaveBeenCalled();
  });
  it('an error of the read is shown, not hidden', () => {
    mockReport.error = 'permission denied for table x';
    renderUI(<Dashboard role="vendor" />);
    expect(textOf('monitor07-vendor-error')).toBe('permission denied for table x');
  });
});

describe('the table alone', () => {
  it('renders with no rows and no footer', () => {
    renderUI(<Table lines={[]} footer={[]} kinds={[]} expanded={new Set()} colors={{ text: '#000', border: '#ccc', surface: '#fff', primary: '#00f', headerBackground: '#eee', negative: '#f00' }} onToggle={jest.fn()} />);
    expect(q('partner-balance-table-empty')).not.toBeNull();
  });
});
