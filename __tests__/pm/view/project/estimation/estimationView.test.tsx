/** @jest-environment jsdom */
// The Estimation view of the dashboard (button of the view switch + right pane PMProjectEstimationView) and the tip of the screenshot button of the Project settings window.
import { cleanupUI, q, renderUI, textOf } from '../../../ui/pmUiTestKit';

let mockSummaryState: any = { data: null, isLoading: false, error: null };
jest.mock('../../../../../kit8/pm/view/project/estimation/useProjectEstimation', () => ({
  useEstimationSummary: (...a: any[]) => { (global as any).__summaryArgs = a; return mockSummaryState; },
  useEstimationRate: () => ({ data: null }),
}));
jest.mock('../../../../../kit8/pm/view/project/estimation/ProjectEstimationTable', () => ({
  __esModule: true,
  default: (p: any) => require('react').createElement(require('react-native').Text, { testID: 'table-stub' }, JSON.stringify({ hasSummary: !!p.summary, targetCurrency: p.targetCurrency ?? null })),
}));

import React from 'react';
import { PM_DEFAULT_VIEW_BUTTONS_ORDER, pmMainViewOf, viewButtonsOrderOf } from '../../../../../kit8/pm/model/types';
import { GANTT_VS_NETWORK_VIEW_OPTIONS } from '../../../../../kit8/pm/view/gantt/toolbars/GanttToggleButtons';
import PMProjectEstimationView from '../../../../../kit8/pm/view/project/estimation/PMProjectEstimationView';
import { parseEstimationSummary } from '../../../../../kit8/pm/view/project/estimation/estimationModel';
import { usePMStore } from '../../../../../kit8/pm/store/store_pm';

const P1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const P2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const palette: any = { background: '#fff', surface: '#fff', border: '#ccc', text: '#000', textMuted: '#666', primary: '#00f' };
const side = (extra: any = {}) => ({ projectGUID: P2, name: 'Estimate of Hall 12', currencyForBudget: 'EUR', currencyForAccounting: 'EUR', tasks: 2, links: 1, lines: 3, linesWithoutItem: 0, linesWithoutSum: 0, items: [], ...extra });
const setProject = (json: any) => usePMStore.setState({ projectsById: { [P1]: { rowGUID: P1, rowJSON: { rowKind: 'project', name: 'Hall 12', currencyForBudget: 'EUR', ...json } } } as any });

afterEach(() => cleanupUI());

describe('order of the view switch', () => {
  it('Estimation stands right before Reports (default order, BIM stays last)', () => {
    const o = viewButtonsOrderOf(null);
    expect(o.indexOf('showEstimationView')).toBe(o.indexOf('showReportsView') - 1);
    expect(o[o.length - 1]).toBe('showBimView');
    expect(PM_DEFAULT_VIEW_BUTTONS_ORDER).toContain('showEstimationView');
  });
  it('an order saved before the button existed gets it before Reports; a saved place is kept', () => {
    const old = ['showGanttChart', 'showFinancesView', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showReportsView', 'showPlanView', 'showBimView'];
    const o = viewButtonsOrderOf(old);
    expect(o.indexOf('showEstimationView')).toBe(o.indexOf('showReportsView') - 1);
    const mine = viewButtonsOrderOf(['showEstimationView', 'showGanttChart']);
    expect(mine[0]).toBe('showEstimationView');
    expect(new Set(mine).size).toBe(mine.length);
  });
  it('the saved view is understood and the button is in the options', () => {
    expect(pmMainViewOf('showEstimationView')).toBe('showEstimationView');
    const o = GANTT_VS_NETWORK_VIEW_OPTIONS.find((x) => x.value === 'showEstimationView')!;
    expect(o.label).toBe('Estimation');
    expect(o.icon).toBe('calculate');
  });
});

describe('PMProjectEstimationView', () => {
  beforeEach(() => { mockSummaryState = { data: null, isLoading: false, error: null }; });

  it('no estimation project: the hint, no table', () => {
    setProject({});
    renderUI(<PMProjectEstimationView projectGUID={P1} width={600} height={400} palette={palette} />);
    expect(q('pm-estimation-view')).toBeTruthy();
    expect(textOf('pm-estimation-none')).toContain('No estimation project is set');
    expect(q('table-stub')).toBeFalsy();
  });

  it('with the link: the table gets the summary of THIS project and its estimation, the title names the estimation', () => {
    setProject({ projectEstimationGUID: P2 });
    mockSummaryState = { data: parseEstimationSummary({ source: side(), target: side({ projectGUID: P1, name: 'Hall 12', tasks: 1, postedTasks: 0, documents: 0, readonly: false, canCreate: true, roots: [] }) }), isLoading: false, error: null };
    renderUI(<PMProjectEstimationView projectGUID={P1} width={600} height={400} palette={palette} />);
    expect((global as any).__summaryArgs.slice(0, 2)).toEqual([P1, P2]);
    expect(q('pm-estimation-none')).toBeFalsy();
    expect(JSON.parse(textOf('table-stub'))).toEqual({ hasSummary: true, targetCurrency: 'EUR' });
    expect(textOf('pm-estimation-title')).toContain('Estimate of Hall 12');
  });
});
