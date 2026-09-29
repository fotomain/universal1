import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { PMProjectRow, uxuiSettingsOf } from '../../../kit8/pm/model/types';

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

describe('context commands mode (uxuiSettings.projectTreeContextCommandsMode / projectGanttChartContextCommandsMode)', () => {
  it('defaults to onHoverPanelMode; unknown values fall back to it', () => {
    const d = uxuiSettingsOf(undefined);
    expect([d.projectTreeContextCommandsMode, d.projectGanttChartContextCommandsMode]).toEqual(['onHoverPanelMode', 'onHoverPanelMode']);
    const u = uxuiSettingsOf({ rowKind: 'project', name: 'x', uxuiSettings: { projectTreeContextCommandsMode: 'bogus' as any, projectGanttChartContextCommandsMode: 'onRightClickMenuMode' } } as any);
    expect([u.projectTreeContextCommandsMode, u.projectGanttChartContextCommandsMode]).toEqual(['onHoverPanelMode', 'onRightClickMenuMode']);
  });

  it('the store mirrors the selected project and follows project switches / updates', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([
      project('m', { uxuiSettings: { projectTreeContextCommandsMode: 'onRightClickMenuMode', projectGanttChartContextCommandsMode: 'onRightClickMenuMode' } }),
      project('h'),
    ]);
    usePMStore.getState().selectProject('m');
    let st = usePMStore.getState();
    expect([st.projectTreeContextCommandsMode, st.projectGanttChartContextCommandsMode]).toEqual(['onRightClickMenuMode', 'onRightClickMenuMode']);
    usePMStore.getState().selectProject('h');
    st = usePMStore.getState();
    expect([st.projectTreeContextCommandsMode, st.projectGanttChartContextCommandsMode]).toEqual(['onHoverPanelMode', 'onHoverPanelMode']);
    usePMStore.getState().setProjects([project('m'), project('h', { uxuiSettings: { projectGanttChartContextCommandsMode: 'onRightClickMenuMode' } })]);
    expect(usePMStore.getState().projectGanttChartContextCommandsMode).toBe('onRightClickMenuMode');
  });

  it('switching project closes an open row menu', () => {
    const s = usePMStore.getState();
    s.setProjects([project('a'), project('b')]);
    usePMStore.getState().selectProject('a');
    usePMStore.getState().setRowMenu({ guid: 'g', x: 1, y: 2, source: 'tree' });
    usePMStore.getState().selectProject('b');
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
});

describe('per user settings (project_user_settings_table) over the project settings', () => {
  it('uxuiSettingsOf: user row wins over project rowJSON.uxuiSettings and legacy keys', () => {
    const json = { rowKind: 'project', name: 'x', showCriticalPath: false, uxuiSettings: { ganttArrowsForm: 'squareForm', showTaskProgressOnGantt: true } } as any;
    const u = uxuiSettingsOf(json, { showTaskProgressOnGantt: false, taskProgressLineColor: '#4455FF' });
    expect([u.showCriticalPath, u.ganttArrowsForm, u.showTaskProgressOnGantt, u.taskProgressLineColor]).toEqual([false, 'squareForm', false, '#4455FF']);
  });

  it('rows arriving after selectProject are applied; later saves re-apply; Gantt | Network follows the user after a switch', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    usePMStore.setState({ keepWorkspaceMode: false });
    s.setProjects([project('u1'), project('u2')]);
    usePMStore.getState().selectProject('u1');
    expect(usePMStore.getState().linkLineForm).toBe('smoothForm');
    usePMStore.getState().setAllProjectUserSettings({ u1: { ganttArrowsForm: 'squareForm', ganttVsNetworkView: 'showNetworkView' }, u2: { showCriticalPath: false } });
    let st = usePMStore.getState();
    expect([st.linkLineForm, st.ganttVsNetworkView, st.userSettingsTableMissing]).toEqual(['squareForm', 'showNetworkView', false]); // first project: its own mode

    usePMStore.getState().setProjectUserSettings('u1', { ganttArrowsForm: 'smoothForm' });
    expect(usePMStore.getState().linkLineForm).toBe('smoothForm');

    usePMStore.getState().selectProject('u2');
    st = usePMStore.getState();
    expect([st.showCriticalPath, st.ganttVsNetworkView]).toEqual([false, 'showNetworkView']); // u2 settings, the view mode follows the user
    usePMStore.getState().setAllProjectUserSettings({ u2: { showCriticalPath: true, ganttVsNetworkView: 'showGanttChart' } }, true);
    st = usePMStore.getState();
    expect([st.showCriticalPath, st.ganttVsNetworkView, st.userSettingsTableMissing]).toEqual([true, 'showNetworkView', true]);
    usePMStore.getState().setProjectUserSettings('u2', null);
    expect(usePMStore.getState().userSettingsByProject).toEqual({});
  });
});

describe('criticalPathTaskColor (user row -> store -> palette)', () => {
  const { makePMPalette } = require('../../../kit8/pm/view/theme');
  const { criticalPathTaskColorOf } = require('../../../kit8/pm/model/types');
  const tc = { primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' };

  it('only 9 colors + black; others (white, old red, junk) -> default #FF0033', () => {
    expect(criticalPathTaskColorOf('#4455ff')).toBe('#4455FF');
    expect(criticalPathTaskColorOf('#000000')).toBe('#000000');
    expect(criticalPathTaskColorOf('#FFFFFF')).toBe('#FF0033');
    expect(criticalPathTaskColorOf('#ef4444')).toBe('#FF0033');
    expect(criticalPathTaskColorOf(undefined)).toBe('#FF0033');
  });

  it('the store mirrors the user setting; the palette uses it for critical bars', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([project('c1'), project('c2')]);
    usePMStore.getState().selectProject('c1');
    expect(usePMStore.getState().criticalPathTaskColor).toBe('#FF0033');
    usePMStore.getState().setProjectUserSettings('c1', { criticalPathTaskColor: '#9D00FF' });
    expect(usePMStore.getState().criticalPathTaskColor).toBe('#9D00FF');
    const p = makePMPalette(tc, false, usePMStore.getState().criticalPathTaskColor);
    expect(p.critical).toBe('#9D00FF');
    expect(p.criticalProgress).not.toBe('#9D00FF');
    expect(makePMPalette(tc, false).critical).toBe('#FF0033');
    expect(makePMPalette(tc, false, '#000000').criticalProgress).toBe('#64748b');
  });
});
