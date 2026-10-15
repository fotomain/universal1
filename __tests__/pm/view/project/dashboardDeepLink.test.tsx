/** @jest-environment jsdom */
// dashboardDeepLink: a click on a transaction of a source window opens its task line - the link (pure), the dashboard that applies it (hook),
// the Finances view that starts at the place of the link, and the click on a row of the source window.
import { act } from 'react';
import { Platform } from 'react-native';
import { cleanupUI, press, q, renderUI, seedStore, fakeCrud } from '../../ui/pmUiTestKit';

const mockParams: Record<string, any> = {};
// pmUiTestKit mocks expo-router itself: override with doMock + require AFTER the kit
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useGlobalSearchParams: () => mockParams }));
const mockLines = jest.fn((_p: any) => null);
jest.mock('../../../../kit8/pm/view/task/finances/PMProjectTaskFinancesCRUD', () => ({ __esModule: true, default: (props: any) => { mockLines(props); return null; } }));

import React from 'react';
import { DASHBOARD_ROUTE, dashboardLinkPath, openDashboardLink, parseDashboardLink } from '../../../../kit8/pm/view/project/dashboardDeepLink';
import PMProjectFinancesView from '../../../../kit8/pm/view/task/finances/PMProjectFinancesView';
import SumExplorerListReusable from '../../../../kit8/ui/components/common/SumExplorerListReusable';
import { buildMonitor01Sources } from '../../../../kit8/pm/reports/monitor01/monitor01SumSources';
import { makePMPalette } from '../../../../kit8/pm/view/theme';
import { usePMStore } from '../../../../kit8/pm/store/store_pm';

const { useDashboardDeepLink } = require('../../../../kit8/pm/view/project/useDashboardDeepLink');
const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const P = '11111111-1111-4111-8111-111111111111';
const T = '22222222-2222-4222-8222-222222222222';
afterEach(() => { jest.clearAllMocks(); cleanupUI(); for (const k of Object.keys(mockParams)) delete mockParams[k]; act(() => usePMStore.setState({ selectedGUID: null, placeRequest: null })); });

describe('the link (pure)', () => {
  it('path: project, task, the Finances view, tab and line - encoded, only what is given', () => {
    expect(dashboardLinkPath({ projectGUID: P, taskGUID: T, genus: 'timeGenus', lineGUID: 'l 1' })).toBe(`${DASHBOARD_ROUTE}?projectGUID=${P}&taskGUID=${T}&view=finances&genus=timeGenus&lineGUID=l%201`);
    expect(dashboardLinkPath({ projectGUID: P, taskGUID: T })).toBe(`${DASHBOARD_ROUTE}?projectGUID=${P}&taskGUID=${T}&view=finances`);
  });
  it('parse: the params of the route -> a link; a plain visit or a half link is not one', () => {
    expect(parseDashboardLink({ projectGUID: P, taskGUID: T, genus: 'timeGenus', lineGUID: 'l1' })).toMatchObject({ projectGUID: P, taskGUID: T, genus: 'timeGenus', lineGUID: 'l1' });
    expect(parseDashboardLink({ projectGUID: [P], taskGUID: T })).toMatchObject({ projectGUID: P });
    expect(parseDashboardLink({})).toBeNull();
    expect(parseDashboardLink({ projectGUID: P })).toBeNull();
    expect(parseDashboardLink({ projectGUID: P, taskGUID: '' })).toBeNull();
    expect(parseDashboardLink({ projectGUID: P, taskGUID: T })!.key).toBe(parseDashboardLink({ projectGUID: P, taskGUID: T })!.key);
  });
  it('web: a NEW browser tab; the same window when the browser blocks it; native: the router', () => {
    const link = { projectGUID: P, taskGUID: T, genus: 'timeGenus', lineGUID: 'l1' };
    const router = { push: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue({} as any);
    openDashboardLink(link, router);
    expect(open).toHaveBeenCalledWith(dashboardLinkPath(link), '_blank');
    expect(router.push).not.toHaveBeenCalled();
    open.mockReturnValue(null);
    openDashboardLink(link, router);
    expect(router.push).toHaveBeenCalledWith({ pathname: DASHBOARD_ROUTE, params: { projectGUID: P, taskGUID: T, view: 'finances', genus: 'timeGenus', lineGUID: 'l1' } });
    open.mockRestore();
    const os = Platform.OS;
    (Platform as any).OS = 'ios';
    const o2 = jest.spyOn(window, 'open');
    router.push.mockClear();
    openDashboardLink(link, router);
    expect(o2).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledTimes(1);
    (Platform as any).OS = os;
    o2.mockRestore();
  });
});

function Probe() { useDashboardDeepLink('u1', true); return null; }

describe('useDashboardDeepLink (the dashboard applies the link once)', () => {
  it('selects the project, then (rows + settings in) the Finances view, the place and the focus on the task', () => {
    const { byName, demo } = seedStore();
    const projectGUID: string = demo.projects[0].rowGUID;
    const task = byName('Task 111');
    Object.assign(mockParams, { projectGUID, taskGUID: task.rowGUID, genus: 'timeGenus', lineGUID: 'line-9' });
    act(() => usePMStore.setState({ selectedProjectGUID: null, loadedProjectGUID: null, keepWorkspaceMode: false, userSettingsTableMissing: false, ganttVsNetworkView: 'showGanttChart', focusRequest: null, placeRequest: null } as any));
    renderUI(<Probe />);
    expect(usePMStore.getState().selectedProjectGUID).toBe(projectGUID);
    expect(usePMStore.getState().ganttVsNetworkView).toBe('showGanttChart');     // the rows are not in yet
    act(() => usePMStore.setState({ loadedProjectGUID: projectGUID } as any));
    expect(usePMStore.getState().ganttVsNetworkView).toBe('showGanttChart');     // the saved view settings are not in yet: they would win over ours
    act(() => usePMStore.setState({ keepWorkspaceMode: true } as any));
    const s = usePMStore.getState();
    expect(s.ganttVsNetworkView).toBe('showFinancesView');
    expect(s.placeRequest).toMatchObject({ taskGUID: task.rowGUID, genus: 'timeGenus', lineGUID: 'line-9' });
    expect(s.focusRequest?.guid).toBe(task.rowGUID);
  });
  it('a plain visit changes nothing', () => {
    seedStore();
    act(() => usePMStore.setState({ ganttVsNetworkView: 'showGanttChart', placeRequest: null } as any));
    renderUI(<Probe />);
    expect(usePMStore.getState().ganttVsNetworkView).toBe('showGanttChart');
    expect(usePMStore.getState().placeRequest).toBeNull();
  });
});

describe('the Finances view starts at the place of the link', () => {
  const view = () => <PMProjectFinancesView projectGUID="p" width={800} height={600} palette={palette} crud={fakeCrud()} />;
  it('the tab and the line of the link win over the remembered place; another task ends the request', () => {
    const { byName } = seedStore();
    const a = byName('Task 111');
    const b = byName('Task 112');
    act(() => usePMStore.setState({ selectedGUID: a.rowGUID }));
    act(() => usePMStore.getState().setPlaceRequest({ taskGUID: a.rowGUID, genus: 'materialGenus', lineGUID: 'l5' }));
    const { rerender } = renderUI(view());
    expect(mockLines.mock.calls.at(-1)![0].initialPlace).toMatchObject({ surface: 'financesView', section: 'finances', genus: 'materialGenus', lineGUID: 'l5' });
    act(() => usePMStore.setState({ selectedGUID: b.rowGUID }));
    rerender(view());
    expect(usePMStore.getState().placeRequest).toBeNull();
    expect(mockLines.mock.calls.at(-1)![0].taskGUID).toBe(b.rowGUID);
    expect(mockLines.mock.calls.at(-1)![0].initialPlace).toBeNull();
  });
});

describe('a click on a row of the source window', () => {
  const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
  it('opens the task line of the transaction (project, task, genus tab, line); the Plan button keeps its own job', async () => {
    const row = { rowGUID: 'm1', sourceName: 'x', day: '2026-10-13', taskGUID: T, taskName: 'Task 111', projectGUID: P, lineGUID: 'line-1', genusGUID: 'timeGenus', roleGUID: 'r', roleName: 'BA', unit: 'hour', qty: 2 };
    const client = { rpc: jest.fn(async () => ({ data: { measure: 'planned', totalCount: 1, sum: 2, rows: [row] }, error: null })) };
    const openTaskLine = jest.fn();
    const openPlan = jest.fn();
    const sources = buildMonitor01Sources(client, 'planned', {}, { openPlan, openTaskLine });
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={2} sources={sources} resetKey="a" />);
    await flush();
    press('sum-explorer-row-m1');
    expect(openTaskLine).toHaveBeenCalledWith(expect.objectContaining({ taskGUID: T, projectGUID: P, lineGUID: 'line-1', genusGUID: 'timeGenus' }));
    expect(openPlan).not.toHaveBeenCalled();
    press('sum-explorer-open-m1');
    expect(openPlan).toHaveBeenCalledWith(T);
    expect(q('sum-explorer')).not.toBeNull();
  });
  it('without the handler the row is not a button', async () => {
    const row = { rowGUID: 'm1', sourceName: 'x', day: '2026-10-13', taskGUID: T, projectGUID: P, genusGUID: 'timeGenus', roleGUID: '', unit: 'hour', qty: 2 };
    const client = { rpc: jest.fn(async () => ({ data: { measure: 'planned', totalCount: 1, sum: 2, rows: [row] }, error: null })) };
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={2} sources={buildMonitor01Sources(client, 'planned', {})} resetKey="b" />);
    await flush();
    expect(q('sum-explorer-row-m1')!.getAttribute('role')).not.toBe('link');
  });
});
