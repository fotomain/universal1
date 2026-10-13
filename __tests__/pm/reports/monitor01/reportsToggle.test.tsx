/** @jest-environment jsdom */
// Monitor01 inside the project board: the Reports toggle Costs | Revenues | Monitor01 | Network, and the page that shows the dashboard (mode "project").
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore } from '../../ui/pmUiTestKit';

jest.mock('../../../../kit8/pm/view/task/plan/useProjectTaskLines', () => ({ useProjectTaskLines: () => ({ lines: [], isLoading: false, byTask: {}, indicators: {}, refetch: jest.fn() }) }));
jest.mock('../../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: (p: any) => ({ type: 'read', p }) } }) }) }));
jest.mock('../../../../kit8/bi/chart/pie', () => ({ PieChartReusable: () => null }));
const mockDashboard = jest.fn();
jest.mock('../../../../kit8/pm/reports/monitor01/Monitor01Dashboard', () => ({ __esModule: true, default: (props: any) => { mockDashboard(props); return require('react').createElement('div', { 'data-testid': props.testID }); } }));

import PMProjectReportsView from '../../../../kit8/pm/view/reports/PMProjectReportsView';
import PMReportsSectionButtons from '../../../../kit8/pm/view/reports/PMReportsSectionButtons';
import { makePMPalette } from '../../../../kit8/pm/view/theme';
import { usePMStore } from '../../../../kit8/pm/store/store_pm';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.setState({ reportsSection: 'costs', ganttVsNetworkView: 'showGanttChart' } as any)); });

describe('the toggle', () => {
  it('Costs | Revenues | Monitor01 | Network, in this order', () => {
    seedStore();
    renderUI(<PMReportsSectionButtons palette={palette} setView={jest.fn()} />);
    expectInOrder(['pm-reports-sections-costs', 'pm-reports-sections-revenues', 'pm-reports-sections-monitor01', 'pm-reports-sections-network']);
  });
  it('Monitor01 is a page of the Reports view: the store remembers it and the main view stays Reports', () => {
    seedStore();
    const setView = jest.fn();
    renderUI(<PMReportsSectionButtons palette={palette} setView={setView} />);
    press('pm-reports-sections-monitor01');
    expect(usePMStore.getState().reportsSection).toBe('monitor01');
    expect(setView).toHaveBeenLastCalledWith('showReportsView');
    expect(q('pm-reports-sections-monitor01')!.getAttribute('aria-selected')).toBe('true');
  });
  it('the store accepts the page and still falls back to Costs for anything else', () => {
    act(() => usePMStore.getState().setReportsSection('monitor01'));
    expect(usePMStore.getState().reportsSection).toBe('monitor01');
    act(() => usePMStore.getState().setReportsSection('nonsense' as any));
    expect(usePMStore.getState().reportsSection).toBe('costs');
  });
});

describe('the page', () => {
  it('shows the dashboard of THIS project, with the same toolbar (the toggle stays)', () => {
    seedStore();
    act(() => usePMStore.setState({ reportsSection: 'monitor01' } as any));
    renderUI(<PMProjectReportsView projectGUID="p-1" width={900} height={700} palette={palette} crud={fakeCrud()} />);
    expect(q('pm-monitor01')).not.toBeNull();
    expect(mockDashboard).toHaveBeenCalledWith(expect.objectContaining({ mode: 'project', projectGUID: 'p-1' }));
    expect(q('pm-reports-sections-monitor01')).not.toBeNull();
    expect(q('pm-reports-card-tasks')).toBeNull();                       // the project summary cards belong to Costs / Revenues
  });
  it('Costs still shows the summary', () => {
    seedStore();
    renderUI(<PMProjectReportsView projectGUID="p-1" width={900} height={700} palette={palette} crud={fakeCrud()} />);
    expect(q('pm-monitor01')).toBeNull();
    expect(q('pm-reports-card-tasks')).not.toBeNull();
  });
});
