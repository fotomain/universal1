/** @jest-environment jsdom */
// The Plan view: the Plan button (after Finances), PMTaskLinePlanView (the bar + the table of the selected task) and PMProjectTaskPlanCRUD
// (all the lines of the task in ONE read-only table, the sums per line against the line). The table itself is a test double that records its props.
import React, { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore, textOf } from '../../../ui/pmUiTestKit';

const mockTable = jest.fn((_props: any) => null);
jest.mock('../../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({
  __esModule: true,
  default: (props: any) => { mockTable(props); return require('react').createElement(require('react-native').Text, { testID: props.testID }, 'table'); },
}));
jest.mock('../../../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({
  useTaskLineCatalogs: () => require('../../../../../kit8/pm/view/task/finances/taskLineCatalogs').emptyTaskLineCatalogs(),
}));
jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: ({ name, testID }: any) => require('react').createElement(require('react-native').Text, { testID }, name) }));

import GanttToggleButtons, { GANTT_VS_NETWORK_VIEW_OPTIONS } from '../../../../../kit8/pm/view/gantt/toolbars/GanttToggleButtons';
import PMTaskLinePlanView from '../../../../../kit8/pm/view/task/plan/PMTaskLinePlanView';
import PMProjectTaskPlanCRUD from '../../../../../kit8/pm/view/task/plan/PMProjectTaskPlanCRUD';
import { buildPlanColumns, planLineLabel, planPeriodText } from '../../../../../kit8/pm/view/task/plan/planColumns';
import { TASK_LINE_PLAN_ENTITY } from '../../../../../kit8/pm/view/task/plan/taskLinePlanModel';
import { TASK_LINE_ENTITY } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { emptyTaskLineCatalogs } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { REUSABLE_TABLE_ALL } from '../../../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { makePMPalette } from '../../../../../kit8/pm/view/theme';
import { pmMainViewOf, uxuiSettingsOf, postButtonColorOf, PM_DEFAULT_POST_BUTTON_COLOR, viewButtonsOrderOf, PM_DEFAULT_VIEW_BUTTONS_ORDER } from '../../../../../kit8/pm/model/types';
import { reorderByDrop } from '../../../../../kit8/pm/view/network/PMSegmentedIconButtons';
import { usePMStore } from '../../../../../kit8/pm/store/store_pm';
import { cellValue } from '../../../../../kit8/ui/components/table/reusable/tableRows';
import { isSortFilterColumn } from '../../../../../kit8/ui/components/table/reusable/tableFilter';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
afterEach(() => { jest.clearAllMocks(); cleanupUI(); (globalThis as any).__pmTestReduxState = undefined; act(() => usePMStore.setState({ selectedGUID: null })); });

describe('the Plan button', () => {
  it('Budgets is the LAST button, after Reports; Network is not a button of the switch; both are main views that can be remembered', () => {
    seedStore();
    const onChange = jest.fn();
    renderUI(<GanttToggleButtons palette={palette} onChange={onChange} />);
    expect(GANTT_VS_NETWORK_VIEW_OPTIONS.map((o) => o.value)).toEqual(['showGanttChart', 'showFinancesView', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showReportsView', 'showPlanView']);
    expect(GANTT_VS_NETWORK_VIEW_OPTIONS.at(-1)!.label).toBe('Budgets');
    expect(GANTT_VS_NETWORK_VIEW_OPTIONS.at(-2)!.label).toBe('Reports');
    expect(document.querySelector('[data-testid="pm-gantt-vs-network-showNetworkView"]')).toBeNull();
    press('pm-gantt-vs-network-showPlanView');
    expect(onChange).toHaveBeenCalledWith('showPlanView');
    press('pm-gantt-vs-network-showReportsView');
    expect(onChange).toHaveBeenCalledWith('showReportsView');
    expect(pmMainViewOf('showPlanView')).toBe('showPlanView');
    expect(pmMainViewOf('showReportsView')).toBe('showReportsView');
    expect(uxuiSettingsOf(null, { ganttVsNetworkView: 'showPlanView' }).ganttVsNetworkView).toBe('showPlanView');
  });

  it('the saved button order is normalized (unknown / duplicate dropped, missing appended) and reordering by drop works', () => {
    expect(viewButtonsOrderOf(undefined)).toEqual(PM_DEFAULT_VIEW_BUTTONS_ORDER);
    // Budgets (showPlanView) is always the LAST, wherever it was saved
    expect(viewButtonsOrderOf(['showPlanView', 'x', 'showPlanView', 'showGanttChart'])).toEqual(['showGanttChart', 'showFinancesView', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showReportsView', 'showPlanView']);
    expect(viewButtonsOrderOf(['showGanttChart', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showFinancesView', 'showPlanView', 'showReportsView']).at(-1)).toBe('showPlanView');
    expect(uxuiSettingsOf(null, { viewButtonsOrder: ['showReportsView'] }).viewButtonsOrder[0]).toBe('showReportsView');
    expect(uxuiSettingsOf(null, { viewButtonsOrder: ['showReportsView'] }).viewButtonsOrder.at(-1)).toBe('showPlanView');
    const layouts = { a: { x: 0, w: 40 }, b: { x: 40, w: 40 }, c: { x: 80, w: 40 } };
    // 'a' dropped with its center over 'c' -> last
    expect(reorderByDrop(['a', 'b', 'c'], 'a', 110, layouts)).toEqual(['b', 'c', 'a']);
    // 'c' dropped far to the left -> first
    expect(reorderByDrop(['a', 'b', 'c'], 'c', 5, layouts)).toEqual(['c', 'a', 'b']);
    // not moved enough -> same order
    expect(reorderByDrop(['a', 'b', 'c'], 'b', 60, layouts)).toEqual(['a', 'b', 'c']);
  });

  it('the store order decides the order of the buttons on screen', () => {
    seedStore();
    act(() => usePMStore.setState({ viewButtonsOrder: ['showReportsView', 'showGanttChart', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showFinancesView', 'showPlanView'] }));
    renderUI(<GanttToggleButtons palette={palette} onChange={jest.fn()} />);
    // the saved order wins - except Budgets, which stays last
    expectInOrder(['pm-gantt-vs-network-showReportsView', 'pm-gantt-vs-network-showGanttChart', 'pm-gantt-vs-network-showPlanView']);
    const ids = Array.from(document.querySelectorAll('[data-testid^="pm-gantt-vs-network-show"]')).map((e) => e.getAttribute('data-testid')!).filter((id) => !id.endsWith('-icon'));
    expect(ids.at(-1)).toBe('pm-gantt-vs-network-showPlanView');
    act(() => usePMStore.setState({ viewButtonsOrder: [...PM_DEFAULT_VIEW_BUTTONS_ORDER] }));
  });
});

describe('the Post button colour setting', () => {
  it('uxuiSettings.postButtonBackgroundColor: light fuchsia by default, any #RRGGBB, bad values fall back', () => {
    expect(PM_DEFAULT_POST_BUTTON_COLOR).toBe('#F0ABFC');
    expect(uxuiSettingsOf(undefined).postButtonBackgroundColor).toBe('#F0ABFC');
    expect(uxuiSettingsOf(null, { postButtonBackgroundColor: '#00ff66' }).postButtonBackgroundColor).toBe('#00FF66');
    expect(postButtonColorOf('#abc')).toBe('#AABBCC');
    expect(postButtonColorOf('#11223344')).toBe('#112233');
    expect(postButtonColorOf('red')).toBe('#F0ABFC');
    expect(postButtonColorOf(null)).toBe('#F0ABFC');
    expect(usePMStore.getState().postButtonBackgroundColor).toBe('#F0ABFC');
  });
});

describe('PMTaskLinePlanView', () => {
  jest.mock('../../../../../kit8/pm/view/task/plan/PMProjectTaskPlanCRUD', () => ({
    __esModule: true,
    default: (props: any) => require('react').createElement(require('react-native').Text, { testID: `plan-of-${props.taskGUID}` }, 'plan'),
  }));
  const view = (crud = fakeCrud()) => <PMTaskLinePlanView projectGUID="p" width={800} height={600} palette={palette} crud={crud} />;

  it('no task selected: asks to select one; the bar has no view switch (it is in the app bar)', () => {
    seedStore();
    renderUI(view());
    expect(q('pm-plan-empty')).not.toBeNull();
    expect(document.querySelector('[data-testid^="pm-gantt-vs-network-show"]')).toBeNull();
  });

  it('the bar has no view buttons: the one main switch is in the app bar', () => {
    seedStore();
    renderUI(view());
    expect(document.querySelector('[data-testid^="pm-gantt-vs-network-show"]')).toBeNull();
  });

  it('a selected task: titled with its name', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    act(() => usePMStore.setState({ selectedGUID: task.rowGUID }));
    renderUI(view());
    expect(textOf('pm-plan-title')).toBe('Task 111');
  });
});

describe('PMProjectTaskPlanCRUD', () => {
  const planRow = (id: string, line: string, i: number, c: number, q: number, b: number, k: number | null) =>
    ({ rowGUID: id, rowOwnerGUID: 't1', rowParentGUID: line, orderInList: i, rowPeriodDatetime: `2026-10-${12 + i}T00:00:00+00:00`, rowCoefficient: c, qtyTaskLine: q, sumForBudget: b, sumForContract: k, rowJSON: { budgetItemTaskLine: 'timeBudgetItem', taskManagementGenusLine: 'timeGenus' } });
  const lineRow = (guid: string, genus: string, json: Record<string, any>) => ({ rowGUID: guid, rowOwnerGUID: 't1', rowParentGUID: genus, orderInList: 1, rowJSON: { budgetItemTaskLine: 'timeBudgetItem', taskIsPosted: true, baseOfDistribution: 1, qtyTaskLine: 10, sumForBudget: 100, sumForContract: 100, ...json } });
  function mount(opts: { stage?: boolean; lines?: any[]; plan?: any[] } = {}) {
    const { byName } = seedStore();
    const task = byName('Task 111');
    // the test kit's useSelector reads this
    (globalThis as any).__pmTestReduxState = {
      [TASK_LINE_ENTITY]: { entityDataFromServer: opts.lines ?? [] },
      [TASK_LINE_PLAN_ENTITY]: { entityDataFromServer: opts.plan ?? [] },
    };
    act(() => usePMStore.setState((s: any) => ({ tasksById: { ...s.tasksById, t1: { rowGUID: 't1', rowJSON: { rowKind: opts.stage ? 'stage' : 'task', name: 'T' } } }, schedule: { ...s.schedule, t1: { isSummary: !!opts.stage } }, tree: { ...s.tree, childrenById: { ...s.tree.childrenById, t1: opts.stage ? ['c'] : [] } } })));
    void task;
    return renderUI(<PMProjectTaskPlanCRUD projectGUID="p" taskGUID="t1" testID="tp" />);
  }

  it('ONE read-only table for all the lines of the task: no CRUD panel, no row menu, no check boxes, no reorder', () => {
    mount();
    const p = mockTable.mock.calls.at(-1)![0];
    expect(p.entityName).toBe(TASK_LINE_PLAN_ENTITY);
    expect(p.listOwnerGUID).toBe('t1');
    expect(p.listParentGUID).toBe(REUSABLE_TABLE_ALL); // every line, not one genus
    expect(p).toMatchObject({ crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false, reorderEnabled: false });
    expect(p.postDataNeeded).toBeUndefined(); // Post is on the Finances tab
    expect(p.rowFilter({})).toBe(true);
  });

  it('a stage has no lines: a note instead of the table', () => {
    mount({ stage: true });
    expect(q('tp-stage')).not.toBeNull();
    expect(mockTable).not.toHaveBeenCalled();
  });

  it('the columns: # · Budget item · Genus · Line · Period · Coefficient · Qty · Sum for budget · Sum for contract; none is editable', () => {
    mount();
    const cols = mockTable.mock.calls.at(-1)![0].visualColumns;
    expect(cols.map((c: any) => c.key)).toEqual(['n', 'budgetItem', 'genus', 'line', 'period', 'rowCoefficient', 'qtyTaskLine', 'sumForBudget', 'sumForContract']);
    expect(cols.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });

  it('the amounts are the root columns of the row (the footer adds them up); the coefficient has no total', () => {
    mount();
    const cols = mockTable.mock.calls.at(-1)![0].visualColumns;
    const row = planRow('r1', 'l1', 1, 0.5, 5, 50.5, null) as any;
    const by = (k: string) => cols.find((c: any) => c.key === k);
    expect(cellValue(row, by('sumForBudget'))).toBe(50.5);
    expect(cellValue(row, by('qtyTaskLine'))).toBe(5);
    expect(by('rowCoefficient').total).toBe(false);
    expect(by('sumForBudget').type).toBe('number');
  });

  it('under the table: one line per posted line - its days and sums against the line; ✓ when they are equal (Correct033)', () => {
    mount({
      lines: [lineRow('l1', 'timeGenus', {}), lineRow('l2', 'timeGenus', { sumForBudget: 100.01 })],
      plan: [planRow('a', 'l1', 1, 0.5, 5, 50, 50), planRow('b', 'l1', 2, 0.5, 5, 50, 50), planRow('c', 'l2', 1, 1, 10, 100, 100)],
    });
    expect(q('tp-summary')!.textContent).toContain('2 days');
    expect(q('tp-summary-l1')!.textContent).toContain('check_circle');
    // the second line says 100.01 but 100.00 was posted
    expect(q('tp-summary-l2')!.textContent).toContain('error');
  });

  it('a line changed after posting is marked: press Post on the Finances tab', () => {
    mount({ lines: [lineRow('l1', 'timeGenus', { taskIsPosted: false })], plan: [planRow('a', 'l1', 1, 1, 10, 100, 100)] });
    expect(q('tp-summary-l1')!.textContent).toContain('changed after posting');
  });

  it('no rows, no summary', () => {
    mount({ lines: [lineRow('l1', 'timeGenus', {})] });
    expect(q('tp-summary')).toBeNull();
  });

  it('renders the budget tabs (TabPlanTime, TabPlanMaterial, TabPlanExpencies, TabPlanAll) and switches tabs', () => {
    mount({
      lines: [
        lineRow('l1', 'timeGenus', {}),
        lineRow('l2', 'materialGenus', {}),
        lineRow('l3', 'expenseGenus', {}),
      ],
      plan: [
        planRow('a', 'l1', 1, 1, 10, 100, 100),
        planRow('b', 'l2', 1, 1, 5, 50, 50),
        planRow('c', 'l3', 1, 1, 2, 20, 20),
      ],
    });
    expect(q('tp-tab-TabPlanTime')).not.toBeNull();
    expect(q('tp-tab-TabPlanMaterial')).not.toBeNull();
    expect(q('tp-tab-TabPlanExpencies')).not.toBeNull();
    expect(q('tp-tab-TabPlanAll')).not.toBeNull();

    // Default tab is TabPlanAll: all summaries shown
    expect(q('tp-summary-l1')).not.toBeNull();
    expect(q('tp-summary-l2')).not.toBeNull();
    expect(q('tp-summary-l3')).not.toBeNull();

    // Switch to TabPlanTime: only time line l1 shown
    press('tp-tab-TabPlanTime');
    expect(q('tp-summary-l1')).not.toBeNull();
    expect(q('tp-summary-l2')).toBeNull();
    expect(q('tp-summary-l3')).toBeNull();

    // Switch to TabPlanMaterial: only material line l2 shown
    press('tp-tab-TabPlanMaterial');
    expect(q('tp-summary-l1')).toBeNull();
    expect(q('tp-summary-l2')).not.toBeNull();
    expect(q('tp-summary-l3')).toBeNull();
  });
});

describe('plan columns - titles come from the catalogs', () => {
  const data = emptyTaskLineCatalogs();
  data.resourceRole = [{ rowGUID: 'role1', rowOwnerGUID: 'type', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Data analyst' } }] as any;
  data.person = [{ rowGUID: 'p1', rowOwnerGUID: 'c', rowParentGUID: 'empty', orderInList: 1, rowJSON: { personFirstName: 'Anna', personLastName: 'Berg' } }] as any;
  data.product = [{ rowGUID: 'prod1', rowOwnerGUID: 'c', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Laptop' } }] as any;
  data.equipment = [{ rowGUID: 'eq1', rowOwnerGUID: 'equipmentCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { equipmentTitle: 'Excavator CAT 320' } }] as any;
  it('the line label of an EQUIPMENT line shows the equipment (not an empty product)', () => {
    expect(planLineLabel(data, { rowJSON: { taskResourceKind: 'equipment', resourceRoleItem: 'role1', taskResourceItem: 'eq1' } } as any)).toBe('Data analyst · Excavator CAT 320');
    expect(planLineLabel(data, { rowJSON: { taskResourceItem: 'eq1' } } as any)).toBe('Excavator CAT 320');
  });
  it('the line label = role · person | product', () => {
    expect(planLineLabel(data, { rowJSON: { resourceRoleItem: 'role1', taskResourceItem: 'p1' } } as any)).toBe('Data analyst · Anna Berg');
    expect(planLineLabel(data, { rowJSON: { taskResourceItem: 'prod1' } } as any)).toBe('Laptop');
    expect(planLineLabel(data, undefined)).toBe('');
  });
  it('the period is the start of the day', () => {
    expect(planPeriodText('2026-10-12T00:00:00+00:00')).toBe('2026-10-12 00:00:00');
    expect(planPeriodText('nonsense')).toBe('');
    expect(buildPlanColumns({ data, linesById: new Map(), textColor: '#000', mutedColor: '#999' })).toHaveLength(9);
  });
  it('every column of the Plan table can be sorted and filtered (the text columns by what they show), except the row number', () => {
    const cols = buildPlanColumns({ data, linesById: new Map(), textColor: '#000', mutedColor: '#999' });
    expect(cols.filter((c) => !isSortFilterColumn(c)).map((c) => c.key)).toEqual(['n']);
    expect(cols.filter((c) => c.type === 'custom').map((c) => c.key)).toEqual(['budgetItem', 'genus', 'line', 'period']);
  });
});
