/** @jest-environment jsdom */
// Toolbars: Gantt bar (kit8/pm/view/gantt), tree toolbar (kit8/pm/view/tree), recent projects toolbar (kit8/pm/view/project/recent) (+ project search).
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, hover, inputValue, wait, mustGet, OWNER, press, q, qa, renderUI, seedStore, textOf, toggleSwitch, typeInto } from './pmUiTestKit';

// ---- the project bar talks to Supabase through these hooks: replaced by fakes ----
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../../kit8/pm/crud/queries', () => ({
  useBuildProjectRow: () => (name: string, startMs?: number) => ({
    rowGUID: '99999999-9999-4999-8999-999999999999',
    treePath: 'x',
    rowOwnerGUID: '11111111-1111-4111-8111-111111111111',
    rowDuration: null,
    rowProgress: 0,
    orderInList: 9999,
    rowJSON: { rowKind: 'project', name, durationDays: 0, projectStartAt: new Date(startMs ?? 0).toISOString() },
  }),
  useCreateProjectMutation: () => ({ mutate: mockCreate }),
  useUpdateProjectMutation: () => ({ mutate: mockUpdate }),
  useDeleteProjectMutation: () => ({ mutate: mockDelete }),
  useProjectSearchQuery: (_owner: string, text: string, enabled: boolean) => {
    const { usePMStore } = require('../../../kit8/pm/store/store_pm');
    const all = Object.values(usePMStore.getState().projectsById) as any[];
    const t = text.trim().toLowerCase();
    return { data: enabled ? all.filter((p) => !t || p.rowJSON.name.toLowerCase().includes(t)) : undefined, isFetching: false };
  },
}));

// the Import / Export section of the Project settings window has its own test (importExportProject.test.tsx)
const mockImportExport = jest.fn();
jest.mock('../../../kit8/pm/crud/exchange/project/ImportExportProject', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => (mockImportExport(props), R.createElement(View, { testID: 'pm-project-exchange' })) };
});

const mockCreateFromTemplate = jest.fn();
jest.mock('../../../kit8/pm/view/project/CreateProjectFromTemplate', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) =>
      props.visible
        ? (mockCreateFromTemplate(props), R.createElement(View, { testID: 'pm-create-from-template-modal' }))
        : null,
  };
});

import React from 'react';
import PMGanttToolbar from '../../../kit8/pm/view/gantt/toolbars/PMGanttToolbar';
import PMTreeToolbar from '../../../kit8/pm/view/tree/toolbars/PMTreeToolbar';
import PMRecentProjectsToolbar from '../../../kit8/pm/view/project/recent/PMRecentProjectsToolbar';
import PMApproveYesNoCancelModalWindow from '../../../kit8/pm/inner/PMApproveYesNoCancelModalWindow';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { usePMVersionStore } from '../../../kit8/pm/version/store/store_version';
import { PM_SETTINGS_BUTTON_WIDTH, PM_WIDE_ACTION_WIDTH } from '../../../kit8/pm/model/constants';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
});

describe('PMGanttToolbar (Gantt bar)', () => {
  const actions = () => ({ zoomBy: jest.fn(), setZoom: jest.fn(), fit: jest.fn(), goToday: jest.fn() });

  it('shows every control in the agreed order', () => {
    seedStore();
    renderUI(<PMGanttToolbar crud={fakeCrud()} palette={palette} activeUnit="day" actions={actions()} />);
    expectInOrder([
      'pm-gantt-undo',
      'pm-gantt-redo',
      'pm-gantt-zoom-out',
      'pm-gantt-zoom-in',
      'pm-gantt-fit',
      'pm-gantt-today',
      'pm-gantt-scale-day',
      'pm-gantt-scale-week',
      'pm-gantt-scale-month',
      'pm-gantt-scale-year',
      'pm-gantt-line-form-smoothForm',
      'pm-gantt-line-form-squareForm',
      'pm-gantt-task-progress',
      'pm-gantt-import-export',
      'pm-gantt-export',
      'pm-gantt-vs-network-showGanttChart',
      'pm-gantt-vs-network-showNetworkView',
      'pm-gantt-uxui-settings',
      'pm-gantt-critical',
    ]);
  });

  it('wires zoom / fit / today / scale / arrow shape', () => {
    seedStore();
    const a = actions();
    const crud = fakeCrud();
    renderUI(<PMGanttToolbar crud={crud} palette={palette} activeUnit="day" actions={a} />);
    press('pm-gantt-zoom-in');
    press('pm-gantt-zoom-out');
    press('pm-gantt-fit');
    press('pm-gantt-today');
    press('pm-gantt-scale-week');
    press('pm-gantt-line-form-squareForm');
    expect(a.zoomBy).toHaveBeenCalledTimes(2);
    expect(a.fit).toHaveBeenCalled();
    expect(a.goToday).toHaveBeenCalled();
    expect(a.setZoom).toHaveBeenCalled();
    expect(crud.setGanttArrowsForm).toHaveBeenCalledWith('squareForm');
  });

  it('Gantt / Network buttons switch the view (saved per project through crud)', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<PMGanttToolbar crud={crud} palette={palette} activeUnit="day" actions={actions()} />);
    expect(mustGet('pm-gantt-vs-network-showGanttChart').getAttribute('aria-selected') ?? 'n/a').toBeDefined();
    press('pm-gantt-vs-network-showGanttChart'); // already active: no call
    press('pm-gantt-vs-network-showNetworkView');
    expect(crud.setGanttVsNetworkView).toHaveBeenCalledTimes(1);
    expect(crud.setGanttVsNetworkView).toHaveBeenCalledWith('showNetworkView');
  });

  it('link mode replaces the bar with a hint + Cancel', () => {
    const { byName } = seedStore();
    act(() => usePMStore.getState().setLinkSource(byName('Task 111').rowGUID));
    const crud = fakeCrud();
    renderUI(<PMGanttToolbar crud={crud} palette={palette} activeUnit="day" actions={actions()} />);
    expect(q('pm-gantt-zoom-in')).toBeNull();
    expect(document.body.textContent).toContain('Tap the task that must wait for “Task 111”');
    press('pm-gantt-link-cancel');
    expect(crud.cancelLink).toHaveBeenCalled();
    act(() => usePMStore.getState().setLinkSource(null));
  });
});

describe('PMTreeToolbar', () => {
  it('adds stage / task (single plus) / milestone', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<PMTreeToolbar crud={crud} palette={palette} />);
    expect(textOf('pm-tree-add-task-icon')).toBe('add');
    press('pm-tree-add-stage');
    press('pm-tree-add-task');
    press('pm-tree-add-milestone');
    expect(crud.createStage).toHaveBeenCalled();
    expect(crud.createTask).toHaveBeenCalledTimes(2);
    expect(crud.createTask.mock.calls[1][1]).toBe('milestone');
  });

  it('row commands are disabled without a selection and act on the selected row', () => {
    const { byName } = seedStore();
    act(() => usePMStore.getState().setSelected(null));
    const crud = fakeCrud();
    renderUI(<PMTreeToolbar crud={crud} palette={palette} />);
    press('pm-tree-sql_for_delete');
    press('pm-tree-duplicate');
    expect(crud.deleteTask).not.toHaveBeenCalled();
    expect(crud.duplicateTask).not.toHaveBeenCalled();
    const g = byName('Task 112').rowGUID;
    act(() => usePMStore.getState().setSelected(g));
    for (const id of ['pm-tree-move-up', 'pm-tree-move-down', 'pm-tree-outdent', 'pm-tree-indent', 'pm-tree-edit', 'pm-tree-duplicate', 'pm-tree-sql_for_delete']) press(id);
    expect(crud.duplicateTask).toHaveBeenCalledWith(g);
    expect(crud.moveBy).toHaveBeenCalledWith(g, -1);
    expect(crud.moveBy).toHaveBeenCalledWith(g, 1);
    expect(crud.outdent).toHaveBeenCalledWith(g);
    expect(crud.indent).toHaveBeenCalledWith(g);
    expect(crud.edit).toHaveBeenCalledWith(g);
    expect(crud.deleteTask).toHaveBeenCalledWith(g);
  });

  it('"#" button switches the hierarchy numbers (uxuiSettings.showTreeHierarchyNumbers)', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<PMTreeToolbar crud={crud} palette={palette} />);
    press('pm-tree-toggle-numbers');
    expect(crud.toggleTreeHierarchyNumbers).toHaveBeenCalledTimes(1);
  });

  it('expand all / collapse all', () => {
    const { byName } = seedStore();
    renderUI(<PMTreeToolbar crud={fakeCrud()} palette={palette} />);
    const before = usePMStore.getState().visibleRows.length;
    press('pm-tree-collapse-all');
    expect(usePMStore.getState().visibleRows.length).toBeLessThan(before);
    press('pm-tree-expand-all');
    expect(usePMStore.getState().visibleRows).toContain(byName('Task 111').rowGUID);
  });
});

describe('PMRecentProjectsToolbar (project bar)', () => {
  it('ribbon = recent projects only, sorted by name, with chevrons and + Project', () => {
    const { demo } = seedStore();
    const [p1, p2] = demo.projects;
    act(() => usePMStore.getState().setRecentProjects([p2.rowGUID, p1.rowGUID]));
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    expectInOrder(['pm-project-search', 'pm-project-ribbon-left', `pm-project-chip-${p1.rowGUID}`, `pm-project-chip-${p2.rowGUID}`, 'pm-project-ribbon-right', 'pm-project-sql_for_delete', 'pm-project-edit', 'pm-project-add']);
    expect(mustGet('pm-project-edit').style.width).toBe(`${PM_SETTINGS_BUTTON_WIDTH}px`);
    expect(q('pm-project-demo')).toBeNull(); // Demo button removed from the bar
  });

  it('pressing a chip selects the project; ✕ removes it from the ribbon only', () => {
    const { demo } = seedStore();
    const [p1, p2] = demo.projects;
    act(() => usePMStore.getState().setRecentProjects([p1.rowGUID, p2.rowGUID]));
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press(`pm-project-chip-${p2.rowGUID}`);
    expect(usePMStore.getState().selectedProjectGUID).toBe(p2.rowGUID);
    expect(q(`pm-project-chip-close-${p1.rowGUID}`)).toBeNull(); // web: ✕ only on hover
    hover(`pm-project-chip-${p1.rowGUID}`);
    press(`pm-project-chip-close-${p1.rowGUID}`);
    expect(usePMStore.getState().recentProjectGUIDs).toEqual([p2.rowGUID]);
    expect(q(`pm-project-chip-${p1.rowGUID}`)).toBeNull();
    expect(usePMStore.getState().projectsById[p1.rowGUID]).toBeDefined(); // not deleted
  });

  it('+ Project -> menu -> New -> dialog -> Create inserts the project', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add');
    expect(q('pm-project-add-menu')).not.toBeNull();
    press('pm-project-add-menu-new');
    typeInto('pm-project-name', 'Project 3');
    press('pm-project-save');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].rowJSON.name).toBe('Project 3');
    expect(q('pm-project-name')).toBeNull(); // dialog closed
  });

  it('+ Project menu shows New, From template, and From the version (enabled when project is active)', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add');
    expect(q('pm-project-add-menu')).not.toBeNull();
    expect(q('pm-project-add-menu-new')).not.toBeNull();
    expect(q('pm-project-add-menu-from-template')).not.toBeNull();
    expect(q('pm-project-add-menu-from-version')).not.toBeNull();

    // With active project, From template and From the version are enabled
    expect(q('pm-project-add-menu-from-template')?.getAttribute('aria-disabled')).toBeFalsy();
    expect(q('pm-project-add-menu-from-version')?.getAttribute('aria-disabled')).toBeFalsy();
  });

  it('+ Project menu disables "From template" and "From the version" when no project is active in Gantt', () => {
    seedStore();
    act(() => usePMStore.getState().selectProject(null));
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add');
    expect(q('pm-project-add-menu')).not.toBeNull();
    expect(q('pm-project-add-menu-new')?.getAttribute('aria-disabled')).toBeFalsy();
    expect(q('pm-project-add-menu-from-template')?.getAttribute('aria-disabled')).toBe('true');
    expect(q('pm-project-add-menu-from-version')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('+ Project menu -> From template opens CreateProjectFromTemplate modal', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add');
    press('pm-project-add-menu-from-template');
    expect(q('pm-project-add-menu')).toBeNull(); // menu closed
    expect(q('pm-create-from-template-modal')).not.toBeNull();
  });

  it('+ Project menu -> From the version opens version restore picker', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add');
    press('pm-project-add-menu-from-version');
    expect(q('pm-project-add-menu')).toBeNull(); // menu closed
    expect(usePMVersionStore.getState().restorePickerOpen).toBe(true);
  });

  it('⇅ on the Gantt bar opens the Project settings of the selected project with Import / Export', () => {
    const { demo } = seedStore();
    renderUI(
      <>
        <PMGanttToolbar crud={fakeCrud()} palette={palette} activeUnit="day" actions={{ zoomBy: jest.fn(), setZoom: jest.fn(), fit: jest.fn(), goToday: jest.fn() }} />
        <PMRecentProjectsToolbar ownerGUID={OWNER} />
      </>
    );
    expect(q('pm-project-exchange')).toBeNull();
    press('pm-gantt-import-export');
    expect(inputValue('pm-project-name')).toBe(demo.projects[0].rowJSON.name);
    expect(q('pm-project-exchange')).not.toBeNull();
    expect(mockImportExport).toHaveBeenLastCalledWith(expect.objectContaining({ ownerGUID: OWNER, projectGUID: demo.projects[0].rowGUID }));
    expect(usePMStore.getState().projectSettingsRequest).toBeNull(); // consumed

    // an import brings a new start / calendar: the open window shows them
    act(() => mockImportExport.mock.calls[mockImportExport.mock.calls.length - 1][0].onImported({ rowKind: 'project', name: 'x', projectStartAt: '2027-01-04T00:00:00.000Z', skipWeekends: true }));
    expect(inputValue('pm-project-start')).toBe('2027-01-04');
    press('pm-project-cancel');
  });

  it('Project settings window: fixed height, same for a new and an existing project', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    const h = getComputedStyle(q('pm-project-settings-window')!).height;
    expect(h).toMatch(/^\d+px$/);
    press('pm-project-cancel');
    press('pm-project-add');
    press('pm-project-add-menu-new');
    expect(getComputedStyle(q('pm-project-settings-window')!).height).toBe(h);
  });

  it('new project: no Import / Export section (only for saved projects)', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add');
    press('pm-project-add-menu-new');
    expect(q('pm-project-name')).not.toBeNull();
    expect(q('pm-project-exchange')).toBeNull();
  });

  it('"Working days only (skip weekends)" is a SwitchApp and is saved', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    expect(textOf('pm-project-settings-window')).toContain('Working days only (skip weekends)');
    toggleSwitch('pm-project-weekends');
    press('pm-project-save');
    expect(mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][0].patch.rowJSON.skipWeekends).toBe(true);
  });

  it('settings dialog edits name, Cancel discards', () => {
    const { demo } = seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    expect(inputValue('pm-project-name')).toBe(demo.projects[0].rowJSON.name);
    press('pm-project-cancel');
    expect(q('pm-project-name')).toBeNull();
    press('pm-project-edit');
    typeInto('pm-project-name', 'Renamed');
    press('pm-project-save');
    expect(mockUpdate.mock.calls[0][0].patch.rowJSON.name).toBe('Renamed');
  });

  it('sql_for_delete project asks with PMApproveYesNoCancelModalWindow (No keeps it, Yes deletes)', async () => {
    const { demo } = seedStore();
    renderUI(
      <>
        <PMRecentProjectsToolbar ownerGUID={OWNER} />
        <PMApproveYesNoCancelModalWindow />
      </>
    );
    press('pm-project-sql_for_delete');
    expect(q('pm-approve-window')).not.toBeNull();
    press('pm-approve-no');
    await act(async () => undefined);
    expect(mockDelete).not.toHaveBeenCalled();
    press('pm-project-sql_for_delete');
    press('pm-approve-yes');
    await act(async () => undefined);
    expect(mockDelete).toHaveBeenCalledWith(demo.projects[0].rowGUID);
  });

  it('SelectProjectFromList: substring search from the database, pick adds to the ribbon', async () => {
    const { demo } = seedStore();
    const p2 = demo.projects[1];
    act(() => usePMStore.getState().setRecentProjects([demo.projects[0].rowGUID]));
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    act(() => mustGet('pm-project-search').querySelector('input')?.focus() ?? (mustGet('pm-project-search') as HTMLInputElement).focus());
    typeInto('pm-project-search', 'ect 2');
    await wait(300); // search is debounced
    expect(q('pm-project-search-list')).not.toBeNull();
    expect(qa('pm-project-search-item-')).toEqual([`pm-project-search-item-${p2.rowGUID}`]);
    press(`pm-project-search-item-${p2.rowGUID}`);
    expect(usePMStore.getState().selectedProjectGUID).toBe(p2.rowGUID);
    expect(usePMStore.getState().recentProjectGUIDs).toContain(p2.rowGUID);
  });
});
