/** @jest-environment jsdom */
// The Finances main view: the button of the view switch, the view (tree + the lines of the selected task) and the places it reports.
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';

const mockLines = jest.fn((_props: any) => null);
jest.mock('../../../kit8/pm/view/task/finances/PMProjectTaskFinancesCRUD', () => ({
  __esModule: true,
  default: (props: any) => {
    mockLines(props);
    return require('react').createElement(require('react-native').Text, { testID: `lines-of-${props.taskGUID}` }, 'lines');
  },
}));

import React from 'react';
import GanttToNetworkViewToggleButtons, { GANTT_VS_NETWORK_VIEW_OPTIONS } from '../../../kit8/pm/view/gantt/toolbars/GanttToNetworkViewToggleButtons';
import PMProjectFinancesView from '../../../kit8/pm/view/task/finances/PMProjectFinancesView';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { pmMainViewOf, uxuiSettingsOf } from '../../../kit8/pm/model/types';
import { makeLastEditPlace } from '../../../kit8/pm/model/lastEditPlace';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);

afterEach(() => { jest.clearAllMocks(); cleanupUI(); act(() => usePMStore.setState({ selectedGUID: null })); });

describe('the view switch', () => {
  it('Finances is the last button, and a saved main view', () => {
    seedStore();
    const onChange = jest.fn();
    renderUI(<GanttToNetworkViewToggleButtons palette={palette} onChange={onChange} />);
    expectInOrder(['pm-gantt-vs-network-showGanttChart', 'pm-gantt-vs-network-showKanbanView', 'pm-gantt-vs-network-showNetworkView', 'pm-gantt-vs-network-showVersionsView', 'pm-gantt-vs-network-showFinancesView']);
    expect(GANTT_VS_NETWORK_VIEW_OPTIONS.map((o) => o.value).at(-1)).toBe('showFinancesView');
    press('pm-gantt-vs-network-showFinancesView');
    expect(onChange).toHaveBeenCalledWith('showFinancesView');
    expect(pmMainViewOf('showFinancesView')).toBe('showFinancesView');
    expect(pmMainViewOf('somethingOld')).toBe('showGanttChart');
    expect(uxuiSettingsOf(null, { ganttVsNetworkView: 'showFinancesView' }).ganttVsNetworkView).toBe('showFinancesView');
  });
});

describe('PMProjectFinancesView', () => {
  const view = (crud = fakeCrud()) => <PMProjectFinancesView projectGUID="p" width={800} height={600} palette={palette} crud={crud} />;

  it('no task selected: asks to select one; the switch is on the bar', () => {
    seedStore();
    renderUI(view());
    expect(q('pm-finances-empty')).not.toBeNull();
    expect(mockLines).not.toHaveBeenCalled();
    expect(q('pm-gantt-vs-network-showFinancesView')).not.toBeNull();
  });

  it('a selected task: its lines, titled with its name, started from its remembered place', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    const place = makeLastEditPlace({ surface: 'financesView', section: 'finances', genus: 'materialGenus', lineGUID: 'l9' }, 'u1')!;
    act(() => usePMStore.setState((s: any) => ({ tasksById: { ...s.tasksById, [task.rowGUID]: { ...s.tasksById[task.rowGUID], rowJSON: { ...s.tasksById[task.rowGUID].rowJSON, lastEditPlace: place } } }, selectedGUID: task.rowGUID })));
    renderUI(view());
    expect(q(`lines-of-${task.rowGUID}`)).not.toBeNull();
    expect(textOf('pm-finances-title')).toBe('Task 111');
    expect(mockLines.mock.calls[0][0]).toMatchObject({ projectGUID: 'p', taskGUID: task.rowGUID, initialPlace: place });
  });

  it('the lines are re-created for another task (each task opens at its own place)', () => {
    const { byName } = seedStore();
    const a = byName('Task 111');
    const b = byName('Task 112');
    act(() => usePMStore.setState({ selectedGUID: a.rowGUID }));
    const { rerender } = renderUI(view());
    expect(q(`lines-of-${a.rowGUID}`)).not.toBeNull();
    act(() => usePMStore.setState({ selectedGUID: b.rowGUID }));
    rerender(view());
    expect(q(`lines-of-${a.rowGUID}`)).toBeNull();
    expect(q(`lines-of-${b.rowGUID}`)).not.toBeNull();
  });

  it('an edit in the lines is remembered by the selected task with the surface "financesView"', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    act(() => usePMStore.setState({ selectedGUID: task.rowGUID }));
    const crud = fakeCrud();
    renderUI(view(crud));
    mockLines.mock.calls[0][0].onEditPlace({ genus: 'timeGenus', lineGUID: 'l1' });
    expect(crud.recordEditPlace).toHaveBeenCalledWith(task.rowGUID, { surface: 'financesView', section: 'finances', genus: 'timeGenus', lineGUID: 'l1' });
  });

  it('the view buttons of the bar switch the view through the crud', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(view(crud));
    act(() => usePMStore.setState({ ganttVsNetworkView: 'showFinancesView' }));
    press('pm-gantt-vs-network-showKanbanView');
    expect(crud.setGanttVsNetworkView).toHaveBeenCalledWith('showKanbanView');
  });
});
