import { usePMStore } from '../../kit8/pm/store';
import { PMProjectRow } from '../../kit8/pm/types';

const project = (guid: string, json: Partial<PMProjectRow['rowJSON']> = {}): PMProjectRow => ({
  rowGUID: guid,
  treePath: guid,
  rowOwnerGUID: 'u',
  rowDuration: null,
  rowProgress: 0,
  orderInList: 1024,
  rowJSON: { rowKind: 'project', name: guid, durationDays: 0, ...json },
});

describe('Gantt view settings from project_table.rowJSON', () => {
  it('mirrors showCriticalPath / ganttArrowsForm / showTaskProgressOnGantt of the selected project', () => {
    const s = usePMStore.getState();
    s.setProjects([project('a'), project('b', { showCriticalPath: false, ganttArrowsForm: 'squareForm', showTaskProgressOnGantt: true })]);
    usePMStore.getState().selectProject('b');
    let st = usePMStore.getState();
    expect([st.showCriticalPath, st.linkLineForm, st.showTaskProgressOnGantt]).toEqual([false, 'squareForm', true]);
    usePMStore.getState().selectProject('a'); // defaults
    st = usePMStore.getState();
    expect([st.showCriticalPath, st.linkLineForm, st.showTaskProgressOnGantt]).toEqual([true, 'smoothForm', false]);
    // an optimistic project update (toggle) reaches the store through setProjects
    usePMStore.getState().setProjects([project('a', { showTaskProgressOnGantt: true }), project('b')]);
    expect(usePMStore.getState().showTaskProgressOnGantt).toBe(true);
  });

  it('keeps PMNetworkView (and its mode) when the user switches from Project 1 to Project N', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([project('p1', { uxuiSettings: { ganttVsNetworkView: 'showNetworkView', networkViewMode: 'networkSchedule' } }), project('pN')]);
    usePMStore.getState().selectProject('p1'); // first project: its saved setting
    expect(usePMStore.getState().ganttVsNetworkView).toBe('showNetworkView');
    usePMStore.getState().selectProject('pN'); // saved as Gantt, but the user is working in the network view
    let st = usePMStore.getState();
    expect([st.ganttVsNetworkView, st.networkViewMode]).toEqual(['showNetworkView', 'networkSchedule']);
    // a projects refetch / optimistic update of Project N does not flip it back to the Gantt chart
    usePMStore.getState().setProjects([project('p1'), project('pN', { showCriticalPath: false })]);
    st = usePMStore.getState();
    expect([st.ganttVsNetworkView, st.showCriticalPath]).toEqual(['showNetworkView', false]);
    // and back to the Gantt chart: switching projects keeps the Gantt chart
    usePMStore.getState().setNetworkViewSettings({ ganttVsNetworkView: 'showGanttChart' });
    usePMStore.getState().selectProject('p1');
    expect(usePMStore.getState().ganttVsNetworkView).toBe('showGanttChart');
  });

  it('mirrors the tree column settings (showTreeHierarchyNumbers / treeColumnsOrder) of the selected project', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([project('t1', { uxuiSettings: { showTreeHierarchyNumbers: false, treeColumnsOrder: ['name', 'wbs', 'start', 'days', 'progress'] } }), project('t2')]);
    usePMStore.getState().selectProject('t1');
    let st = usePMStore.getState();
    expect(st.showTreeHierarchyNumbers).toBe(false);
    expect(st.treeColumnsOrder).toEqual(['name', 'wbs', 'start', 'days', 'progress']);
    usePMStore.getState().selectProject('t2'); // defaults: "#" shown and first
    st = usePMStore.getState();
    expect(st.showTreeHierarchyNumbers).toBe(true);
    expect(st.treeColumnsOrder).toEqual(['wbs', 'name', 'start', 'days', 'progress']);
    usePMStore.getState().setTreeColumnsSettings({ treeColumnsOrder: ['progress', 'wbs', 'name', 'start', 'days'] });
    expect(usePMStore.getState().treeColumnsOrder[0]).toBe('progress');
  });
});
