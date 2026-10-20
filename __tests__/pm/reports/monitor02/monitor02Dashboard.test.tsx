/** @jest-environment jsdom */
// Monitor02_ROINow (documentation/ROI_DOC.html section 7.2): the lines (project + tasks), the footer, the switches, the filters, Refresh, Auto refresh. The data hook and the calls are replaced.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, qa, renderUI, textOf, toggleSwitch, typeInto } from '../../ui/pmUiTestKit';
import { RoiMoney, zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';

const mockHook: { projects: any[]; months: any[]; tasks: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; reload: jest.Mock } = {
  projects: [], months: [], tasks: [], isLoading: false, error: null, live: true, changedAt: null, reload: jest.fn(),
};
const mockUseData = jest.fn((..._a: any[]) => mockHook);
jest.mock('../../../../kit8/pm/reports/monitor02/useMonitor02Data', () => ({ useMonitor02Data: (...a: any[]) => (mockUseData as any)(...a) }));
const mockRefresh = jest.fn(async (..._a: any[]) => ({ tasks: 2, upserted: 3, deleted: 0 }));
jest.mock('../../../../kit8/pm/reports/monitor01/monitor01Api', () => ({ refreshMonitor01Now: (...a: any[]) => (mockRefresh as any)(...a) }));
const mockOpenLink = jest.fn();
jest.mock('../../../../kit8/pm/view/project/dashboardDeepLink', () => ({ openDashboardLink: (...a: any[]) => mockOpenLink(...a) }));
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
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

const Monitor02Dashboard = require('../../../../kit8/pm/reports/monitor02/Monitor02Dashboard').default;

const NONE = { includeSaleVat: false, includePurchaseVat: false };
const m = (o: Partial<RoiMoney>): RoiMoney => ({ ...zeroMoney(), ...o });
const alpha = { projectGUID: 'p1', name: 'Alpha', tax: NONE, forTasks: true, history: false };
const beta = { projectGUID: 'p2', name: 'Beta', tax: NONE, forTasks: false, history: false };
const sheet = () => {
  mockHook.projects = [alpha];
  mockHook.months = [
    { projectGUID: 'p1', month: '2026-09-01', money: m({ costPlanNet: 4000, revenuePlanNet: 3600, revenueUsedNet: 1800, costInvoicedNet: 1500 }) },
    { projectGUID: 'p1', month: '2026-10-01', money: m({ costPlanNet: 1000, revenuePlanNet: 1500, revenueUsedNet: 1100, costInvoicedNet: 900, revenueInvoicedNet: 1200 }) },
  ];
  mockHook.tasks = [
    { projectGUID: 'p1', taskGUID: 't-design', taskName: 'Design', money: m({ costPlanNet: 1000, revenuePlanNet: 1500, revenueUsedNet: 1100, costInvoicedNet: 900, revenueInvoicedNet: 1200 }) },
    { projectGUID: 'p1', taskGUID: 't-build', taskName: 'Build', money: m({ costPlanNet: 4000, revenuePlanNet: 3600, revenueUsedNet: 1800, costInvoicedNet: 1500 }) },
  ];
};
const cell = (key: string, col: string) => `monitor02-table-cell-${key}-${col}`;

beforeEach(() => { sheet(); mockHook.error = null; mockHook.isLoading = false; mockHook.live = true; mockHook.changedAt = Date.now(); mockTipTexts.length = 0; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('the lines', () => {
  it('a line per project and, under it, a line per task (the project has ROI for tasks ON)', () => {
    renderUI(<Monitor02Dashboard />);
    expect(qa('monitor02-table-line-')).toEqual(['monitor02-table-line-p|p1', 'monitor02-table-line-t|t-design', 'monitor02-table-line-t|t-build']);
    expect(textOf('monitor02-title')).toBe('Monitor02');
  });
  it('the numbers of the page: Design ROI1 50 %, ROI2 10 %, ROI3 20 %, ROI4 33.3 %; Build ROI1 -10 %, ROI4 -100 %', () => {
    renderUI(<Monitor02Dashboard />);
    expect(['roi1', 'roi2', 'roi3', 'roi4'].map((k) => textOf(cell('t|t-design', k)))).toEqual(['50.0 %', '10.0 %', '20.0 %', '33.3 %']);
    expect(textOf(cell('t|t-build', 'roi1'))).toBe('-10.0 %');
    expect(textOf(cell('t|t-build', 'roi4'))).toBe('-100.0 %');
    expect(['planCost', 'planRevenue', 'usedRevenue', 'factCost', 'billedRevenue'].map((k) => textOf(cell('t|t-design', k)))).toEqual(['1 000.00', '1 500.00', '1 100.00', '900.00', '1 200.00']);
  });
  it('the project line is the sum of its months; the ROI of the project is of the SUMS (not the average of the tasks)', () => {
    renderUI(<Monitor02Dashboard />);
    expect(textOf(cell('p|p1', 'planCost'))).toBe('5 000.00');
    expect(textOf(cell('p|p1', 'roi1'))).toBe('2.0 %');                       // (5100 - 5000) / 5000
    expect(textOf(cell('p|p1', 'roi3'))).toBe('-76.0 %');
  });
  it('the footer is the sum of the project lines', () => {
    renderUI(<Monitor02Dashboard />);
    expect(textOf('monitor02-table-footer-planCost')).toBe('5 000.00');
    expect(textOf('monitor02-table-footer-roi1')).toBe('2.0 %');
  });
  it('a project with ROI for tasks OFF has no task lines (and the report does not show a project without the switch at all: the hook gives only the projects with it ON)', () => {
    mockHook.projects = [{ ...alpha, forTasks: false }];
    renderUI(<Monitor02Dashboard />);
    expect(qa('monitor02-table-line-')).toEqual(['monitor02-table-line-p|p1']);
    mockHook.projects = [];
    cleanupUI();
    renderUI(<Monitor02Dashboard />);
    expect(qa('monitor02-table-line-')).toEqual([]);
    expect(q('monitor02-table-empty')).not.toBeNull();
    expect(textOf('monitor02-table-footer-roi1')).toBe('-');
  });
  it('no cost = "-" (grey), a negative ROI is red, a positive one green', () => {
    renderUI(<Monitor02Dashboard />);
    const color = (id: string) => getComputedStyle(mustGet(id)).color;
    expect(color(cell('t|t-design', 'roi1'))).not.toBe(color(cell('t|t-build', 'roi1')));
  });
});

describe('the bar', () => {
  it('Project and Task are picked from the loaded data; the Project filter cuts the lines', async () => {
    mockHook.projects = [alpha, beta];
    mockHook.months = [...mockHook.months, { projectGUID: 'p2', month: '2026-10-01', money: m({ costPlanNet: 100, revenuePlanNet: 300 }) }];
    renderUI(<Monitor02Dashboard />);
    expect(mockSelects['monitor02-filters-project'].items.map((i: any) => i.value)).toEqual(['p1', 'p2']);
    expect(mockSelects['monitor02-filters-task'].items.map((i: any) => i.value)).toEqual(['t-design', 't-build']);
    expect(qa('monitor02-table-line-')).toContain('monitor02-table-line-p|p2');
    typeInto('monitor02-filters-project', 'p2');
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(qa('monitor02-table-line-')).toEqual(['monitor02-table-line-p|p2']);
  });
  it('the period is read from the dates (a month range) and given to the data hook; an unreadable date is not a filter', async () => {
    renderUI(<Monitor02Dashboard />);
    expect(mockUseData).toHaveBeenLastCalledWith({ from: null, to: null }, { live: true });
    typeInto('monitor02-filters-startDate', '2026-10-01');
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(mockUseData).toHaveBeenLastCalledWith({ from: '2026-10-01', to: null }, { live: true });
    typeInto('monitor02-filters-finishDate', '2026-1');
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(mockUseData).toHaveBeenLastCalledWith({ from: '2026-10-01', to: null }, { live: true });
  });
  it('Auto refresh OFF stops the live updates (a snapshot); the badge says so', () => {
    renderUI(<Monitor02Dashboard />);
    expect(textOf('monitor02-age')).toContain('Live');
    toggleSwitch('monitor02-toolbar-auto');
    expect(mockUseData).toHaveBeenLastCalledWith({ from: null, to: null }, { live: false });
    expect(textOf('monitor02-age')).toContain('Auto refresh is off');
  });
  it('Refresh computes the numbers NOW (the database function, works without pg_cron), then reads again; a refusal is shown', async () => {
    renderUI(<Monitor02Dashboard />);
    press('monitor02-toolbar-refresh');
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh.mock.calls[0][1]).toBeNull();
    expect(mockHook.reload).toHaveBeenCalled();
    mockRefresh.mockRejectedValueOnce(new Error('not allowed'));
    press('monitor02-toolbar-refresh');
    await flush();
    expect(textOf('monitor02-refresh-error')).toContain('not allowed');
  });
  it('an error of the read is shown, not hidden', () => {
    mockHook.error = 'permission denied for table x';
    renderUI(<Monitor02Dashboard />);
    expect(textOf('monitor02-error')).toBe('permission denied for table x');
  });
});

describe('the table', () => {
  it('every header has a tip with its formula; ROI2 and ROI3 say that the revenue is a part against the whole plan cost', () => {
    renderUI(<Monitor02Dashboard />);
    const tips = mockTipTexts.filter(Boolean) as string[];
    expect(tips.some((t) => t.startsWith('ROI1 plan - plan = (Revenue plan - Cost plan) / Cost plan'))).toBe(true);
    expect(tips.some((t) => t.startsWith('ROI2') && t.includes('Revenue fact input'))).toBe(true);
    expect(tips.some((t) => t.startsWith('ROI3') && t.includes('whole plan cost'))).toBe(true);
    expect(tips.some((t) => t.startsWith('ROI2') && t.includes('negative by construction'))).toBe(true);
    expect(tips.some((t) => t.startsWith('ROI4 fact - fact = (Customer invoiced - Cost fact) / Cost fact'))).toBe(true);
    expect(tips.some((t) => t.includes('no vendor'))).toBe(true);
  });
  it('a double click on a task opens it in the dashboard; one click does nothing; a project line is not a link', () => {
    renderUI(<Monitor02Dashboard />);
    press('monitor02-table-task-t|t-design');
    expect(mockOpenLink).not.toHaveBeenCalled();
    press('monitor02-table-task-t|t-design');
    expect(mockOpenLink).toHaveBeenCalledTimes(1);
    expect(mockOpenLink.mock.calls[0][0]).toMatchObject({ projectGUID: 'p1', taskGUID: 't-design' });
    expect(q('monitor02-table-task-p|p1')).toBeNull();
  });
});
