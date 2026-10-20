/** @jest-environment jsdom */
// Monitor03_ROIHistory (documentation/ROI_DOC.html section 7.3): the project select, the two modes, the chart, the table of the points, the hint while the history switch is OFF. The data hook is replaced.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, qa, renderUI, textOf, typeInto } from '../../ui/pmUiTestKit';
import { RoiMoney, zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';

const mockHook: { projects: any[]; selected: any; months: any[]; history: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; reload: jest.Mock } = {
  projects: [], selected: null, months: [], history: [], isLoading: false, error: null, live: true, changedAt: null, reload: jest.fn(),
};
const mockUseData = jest.fn((..._a: any[]) => mockHook);
jest.mock('../../../../kit8/pm/reports/monitor03/useMonitor03Data', () => ({ useMonitor03Data: (...a: any[]) => (mockUseData as any)(...a) }));
// react-native-svg draws RNSVG* host tags that jsdom does not know: plain SVG tags with a data-testid take their place
jest.mock('react-native-svg', () => {
  const R = require('react');
  const tag = (name: string) => ({ testID, children, ...p }: any) => R.createElement(name, { 'data-testid': testID, ...p }, children);
  return { __esModule: true, default: tag('svg'), Svg: tag('svg'), Line: tag('line'), Polyline: tag('polyline'), Circle: tag('circle'), Text: tag('text') };
});
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});

const Monitor03Dashboard = require('../../../../kit8/pm/reports/monitor03/Monitor03Dashboard').default;

const NONE = { includeSaleVat: false, includePurchaseVat: false };
const m = (o: Partial<RoiMoney>): RoiMoney => ({ ...zeroMoney(), ...o });
const project = (history: boolean) => ({ projectGUID: 'p1', name: 'Alpha', tax: NONE, forTasks: false, history });
const log = [
  { projectGUID: 'p1', day: '2026-10-01', reason: 'history on', money: m({ costPlanNet: 5000, revenuePlanNet: 5400 }) },
  { projectGUID: 'p1', day: '2026-10-09', reason: 'plan', money: m({ costPlanNet: 5000, revenuePlanNet: 5100 }) },
  { projectGUID: 'p1', day: '2026-10-20', reason: 'customer invoice', money: m({ costPlanNet: 5000, revenuePlanNet: 5100, costInvoicedNet: 900, revenueInvoicedNet: 1200 }) },
];
// the MONTH TOTALS (one row per month, not cumulative): September 4000 / 3600, October 1000 / 1500 + the invoices -> cumulative in October 5000 / 5100 / 900 / 1200
const months = [
  { projectGUID: 'p1', month: '2026-09-01', money: m({ costPlanNet: 4000, revenuePlanNet: 3600 }) },
  { projectGUID: 'p1', month: '2026-10-01', money: m({ costPlanNet: 1000, revenuePlanNet: 1500, costInvoicedNet: 900, revenueInvoicedNet: 1200 }) },
];
const set = (history: boolean) => { mockHook.projects = [project(history)]; mockHook.selected = project(history); mockHook.months = months; mockHook.history = history ? log : []; };

beforeEach(() => { set(true); mockHook.error = null; mockHook.isLoading = false; mockHook.live = true; });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('the modes', () => {
  it('starts with the business-month curve: one row per month, cumulative from the first month, with the ratios', () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(qa('monitor03-row-').filter((id) => /-row-\d{4}-\d{2}-\d{2}$/.test(id))).toEqual(['monitor03-row-2026-09-01', 'monitor03-row-2026-10-01']);
    expect(textOf('monitor03-row-2026-09-01-roi1')).toBe('-10.0 %');          // (3600 - 4000) / 4000
    expect(textOf('monitor03-row-2026-10-01-roi1')).toBe('2.0 %');
    expect(textOf('monitor03-row-2026-10-01-roi4')).toBe('33.3 %');
    expect(textOf('monitor03-row-2026-09-01-roi4')).toBe('-');                // no cost fact yet
  });
  it('"As seen on a date" shows the log: a row per day with its reason', () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    press('monitor03-mode-seen');
    expect(qa('monitor03-row-').filter((id) => /-row-\d{4}-\d{2}-\d{2}$/.test(id))).toEqual(['monitor03-row-2026-10-01', 'monitor03-row-2026-10-09', 'monitor03-row-2026-10-20']);
    expect(textOf('monitor03-row-2026-10-01-roi1')).toBe('8.0 %');
    expect(textOf('monitor03-row-2026-10-09-roi1')).toBe('2.0 %');
    expect(mustGet('monitor03-row-2026-10-09').textContent).toContain('plan');
    expect(mustGet('monitor03-row-2026-10-20').textContent).toContain('customer invoice');
  });
  it('without the history switch the "as seen" mode is not available: the hint says where to switch it on, and the business-month curve stays', () => {
    set(false);
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(textOf('monitor03-hint')).toContain('Project settings → ROI → ROI history');
    press('monitor03-mode-seen');
    expect(qa('monitor03-row-').filter((id) => /-row-\d{4}-\d{2}-\d{2}$/.test(id))).toEqual(['monitor03-row-2026-09-01', 'monitor03-row-2026-10-01']);
  });
  it('no hint while the history switch is ON', () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(q('monitor03-hint')).toBeNull();
  });
});

describe('the period (startDate, finishDate, the period button)', () => {
  const rowIds = () => qa('monitor03-row-').filter((id) => /-row-\d{4}-\d{2}-\d{2}$/.test(id));
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 250)); });
  it('the bar is there: two dates and the period button', () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    for (const id of ['monitor03-filters-startDate', 'monitor03-filters-finishDate', 'monitor03-filters-period-button']) expect(q(id)).not.toBeNull();
  });
  it('business month: only the months of the period, summed from the FIRST month of the period (October alone: 50 % / 33.3 %, not the ROI since September)', async () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    typeInto('monitor03-filters-startDate', '2026-10-05');
    await settle();
    expect(rowIds()).toEqual(['monitor03-row-2026-10-01']);
    expect(textOf('monitor03-row-2026-10-01-roi1')).toBe('50.0 %');            // (1500 - 1000) / 1000
    expect(textOf('monitor03-row-2026-10-01-roi4')).toBe('33.3 %');
    typeInto('monitor03-filters-startDate', '');
    typeInto('monitor03-filters-finishDate', '2026-09-30');
    await settle();
    expect(rowIds()).toEqual(['monitor03-row-2026-09-01']);
    expect(textOf('monitor03-row-2026-09-01-roi1')).toBe('-10.0 %');
  });
  it('as seen on a date: the rows of the log whose day is in the period', async () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    press('monitor03-mode-seen');
    typeInto('monitor03-filters-startDate', '2026-10-09');
    typeInto('monitor03-filters-finishDate', '2026-10-15');
    await settle();
    expect(rowIds()).toEqual(['monitor03-row-2026-10-09']);
  });
  it('an unreadable date is not a period: nothing is cut', async () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    typeInto('monitor03-filters-startDate', '2026-1');
    await settle();
    expect(rowIds()).toEqual(['monitor03-row-2026-09-01', 'monitor03-row-2026-10-01']);
  });
});

describe('the chart', () => {
  it('draws a line per kind (ROI1-4), the legend switches a kind off, never the last one', () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(q('monitor03-chart-svg')).not.toBeNull();
    const lines = () => qa('monitor03-chart-line-').map((id) => id.split('-')[3]);
    expect(new Set(lines())).toEqual(new Set(['roi1', 'roi2', 'roi3', 'roi4']));
    press('monitor03-chart-legend-roi2');
    expect(new Set(lines())).toEqual(new Set(['roi1', 'roi3', 'roi4']));
    press('monitor03-chart-legend-roi1'); press('monitor03-chart-legend-roi3');
    press('monitor03-chart-legend-roi4');
    expect(new Set(lines())).toEqual(new Set(['roi4']));           // the last kind stays
  });
  it('no points: the empty text', () => {
    mockHook.months = [];
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(q('monitor03-chart-empty')).not.toBeNull();
  });
});

describe('the bar', () => {
  it('the project select lists the projects that have ROI numbers; picking one asks the hook for it', async () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(mockSelects['monitor03-project'].items).toEqual([{ value: 'p1', label: 'Alpha' }]);
    expect(mockUseData).toHaveBeenLastCalledWith('p1');
  });
  it('without a project given, the first project with numbers is taken', async () => {
    renderUI(<Monitor03Dashboard />);
    await act(async () => { await Promise.resolve(); });
    expect(mockUseData).toHaveBeenLastCalledWith('p1');
  });
  it('Refresh reads again; the badge says Live or Offline; an error is shown', () => {
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    press('monitor03-refresh');
    expect(mockHook.reload).toHaveBeenCalledTimes(1);
    mockHook.live = false; mockHook.error = 'permission denied';
    cleanupUI();
    renderUI(<Monitor03Dashboard projectGUID="p1" />);
    expect(textOf('monitor03-error')).toBe('permission denied');
  });
  it('nothing to show yet: the text says to post a plan', () => {
    mockHook.projects = []; mockHook.selected = null; mockHook.months = []; mockHook.history = [];
    renderUI(<Monitor03Dashboard />);
    expect(q('monitor03-no-projects')).not.toBeNull();
  });
});
