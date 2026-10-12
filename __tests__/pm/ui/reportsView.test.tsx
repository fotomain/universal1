/** @jest-environment jsdom */
// The Reports view: no main switch on its bar, the Costs | Revenues | Network toggle after the title, the pages Costs / Revenues (sums of the task lines), and the Network section.
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';

const mockLines: { lines: any[]; isLoading: boolean } = { lines: [], isLoading: false };
jest.mock('../../../kit8/pm/view/task/plan/useProjectTaskLines', () => ({ useProjectTaskLines: () => ({ ...mockLines, byTask: {}, indicators: {}, refetch: jest.fn() }) }));
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: (p: any) => ({ type: 'read', p }) } }) }) }));

// Skia cannot run in jest: the pie is replaced by a probe that shows the rows it was given
jest.mock('../../../kit8/bi/chart/pie', () => ({
  PieChartReusable: (props: any) => require('react').createElement('div', { 'data-testid': props.testID, 'data-rows': JSON.stringify(props.data) }),
}));

import PMProjectReportsView from '../../../kit8/pm/view/reports/PMProjectReportsView';
import PMReportsSectionButtons from '../../../kit8/pm/view/reports/PMReportsSectionButtons';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const line = (rowGUID: string, task: string, genus: string, json: any) => ({ rowGUID, rowOwnerGUID: task, rowParentGUID: genus, orderInList: 0, rowJSON: json });

afterEach(() => {
  jest.clearAllMocks(); cleanupUI(); (globalThis as any).__pmTestReduxState = undefined;
  mockLines.lines = []; mockLines.isLoading = false;
  act(() => usePMStore.setState({ reportsSection: 'costs', ganttVsNetworkView: 'showGanttChart' } as any));
});

const mount = (crud = fakeCrud()) => renderUI(<PMProjectReportsView projectGUID="p" width={900} height={700} palette={palette} crud={crud} />);

describe('the buttons', () => {
  it('the bar has no main switch (it is in the app bar); the right side toggle Costs | Revenues | Network follows the word "Reports"', () => {
    seedStore();
    mount();
    expect(document.querySelector('[data-testid^="pm-gantt-vs-network-show"]')).toBeNull();
    expectInOrder(['pm-reports-title', 'pm-reports-sections-costs', 'pm-reports-sections-revenues', 'pm-reports-sections-network', 'pm-reports-currency']);
  });

  it('Revenues / Costs switch the page (and keep the Reports view); Network opens the network view', () => {
    seedStore();
    const setView = jest.fn();
    renderUI(<PMReportsSectionButtons palette={palette} setView={setView} />);
    press('pm-reports-sections-revenues');
    expect(usePMStore.getState().reportsSection).toBe('revenues');
    expect(setView).toHaveBeenLastCalledWith('showReportsView');
    press('pm-reports-sections-network');
    expect(setView).toHaveBeenLastCalledWith('showNetworkView');
    expect(usePMStore.getState().reportsSection).toBe('revenues'); // the page is remembered while the network is open
  });

  it('the row is lit by the page, and by Network while the network view is open', () => {
    seedStore();
    const setView = jest.fn();
    renderUI(<PMReportsSectionButtons palette={palette} setView={setView} />);
    expect(q('pm-reports-sections-costs')!.getAttribute('aria-selected')).toBe('true');
    act(() => usePMStore.setState({ ganttVsNetworkView: 'showNetworkView' } as any));
    expect(q('pm-reports-sections-network')!.getAttribute('aria-selected')).toBe('true');
    expect(q('pm-reports-sections-costs')!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('the pages', () => {
  const data = [
    line('l1', 'tA', 'timeGenus', { sumForContract: 100, sumVATForContract: 21, budgetItemTaskLine: 'timeBudgetItem' }),
    line('l2', 'tA', 'timeGenus', { taskResourceKind: 'equipment', sumForContract: 300, sumVATForContract: 63, budgetItemTaskLine: 'timeBudgetItem' }),
    line('l3', 'tB', 'materialGenus', { sumForContract: 50, sumVATForContract: 10.5 }),
    line('l4', 'tB', 'revenueGenus', { sumForContract: 1000, sumVATForContract: 210, budgetItemTaskLine: 'revenueBudgetItem' }),
  ];

  it('Costs: the sums of Time + Material + Expense lines; cards, by kind, by budget item, by task', () => {
    seedStore();
    mockLines.lines = data;
    (globalThis as any).__pmTestReduxState = { budgetItemReusable: { entityDataFromServer: [{ rowGUID: 'timeBudgetItem', rowJSON: { title: 'Time' } }] }, managementGenusReusable: { entityDataFromServer: [{ rowGUID: 'timeGenus', rowJSON: { title: 'Time' } }, { rowGUID: 'materialGenus', rowJSON: { title: 'Material' } }] } };
    mount();
    expect(textOf('pm-reports-page-title')).toBe('Costs');
    expect(textOf('pm-report-card-lines')).toContain('3');
    expect(textOf('pm-report-card-sum')).toContain('450.00');
    expect(textOf('pm-report-card-equipment')).toContain('300.00');
    expect(textOf('pm-report-card-persons')).toContain('100.00');
    expect(q('pm-report-genus-row-timeGenus')!.textContent).toContain('Time');
    expect(q('pm-report-genus-row-materialGenus')!.textContent).toContain('Material');
    expect(q('pm-report-items-row-timeBudgetItem')!.textContent).toContain('Time');
    expect(q('pm-report-items-row-none')!.textContent).toContain('No budget item');
    expect(q('pm-report-tasks-row-tA')).not.toBeNull();
    expect(q('pm-report-items-row-revenueBudgetItem')).toBeNull(); // a revenue line is not a cost
  });

  it('every table takes 50% of the width with its pie chart (same rows, by Total) in the other 50%; a narrow pane stacks them', () => {
    seedStore();
    mockLines.lines = data;
    mount();
    expect(getComputedStyle(q('pm-report-items')!).width).toBe('50%');
    expect(getComputedStyle(q('pm-report-items-pie')!).width).toBe('50%');
    expect(getComputedStyle(q('pm-report-tasks')!).width).toBe('50%');
    const rows = JSON.parse(q('pm-report-items-chart')!.getAttribute('data-rows')!);
    expect(rows.find((r: any) => r.key === 'timeBudgetItem').value).toBeCloseTo(100 + 21 + 300 + 63);
    cleanupUI();
    renderUI(<PMProjectReportsView projectGUID="p" width={500} height={700} palette={palette} crud={fakeCrud()} />);
    expect(getComputedStyle(q('pm-report-items')!).width).toBe('100%');
    expect(getComputedStyle(q('pm-report-items-pie')!).width).toBe('100%');
  });

  it('Revenues: the Revenue lines only; no split by kind, no Time of persons / equipment', () => {
    seedStore();
    mockLines.lines = data;
    act(() => usePMStore.setState({ reportsSection: 'revenues' } as any));
    mount();
    expect(textOf('pm-reports-page-title')).toBe('Revenues');
    expect(textOf('pm-report-card-sum')).toContain('1 000.00');
    expect(q('pm-report-card-equipment')).toBeNull();
    expect(q('pm-report-genus')).toBeNull();
    expect(q('pm-report-items-row-revenueBudgetItem')).not.toBeNull();
    expect(q('pm-report-items-row-timeBudgetItem')).toBeNull();
  });

  it('no lines: empty tables; lines still loading: the hint', () => {
    seedStore();
    mount();
    expect(q('pm-report-items-empty')).not.toBeNull();
    cleanupUI();
    mockLines.isLoading = true;
    mount();
    expect(q('pm-reports-loading')).not.toBeNull();
  });
});
