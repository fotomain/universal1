/** @jest-environment jsdom */
// PMTaskEditWindow (/pm/project/task/edit): 1st level tabs TabTaskEditMain (the task form of PMTaskEditModal, embedded) and TabTaskEditPlan (PMTaskEditView);
// taskEditWindowLink: the link a double click on the Gantt chart opens in a new browser window.
import './pmUiTestKit';
import React, { act } from 'react';
const hidden = (id: string) => window.getComputedStyle(q(id) as HTMLElement).display === 'none';
import { cleanupUI, fakeCrud, inputValue, press, q, renderUI, seedStore, typeInto } from './pmUiTestKit';
import { DEFAULT_TASK_EDIT_WINDOW_TAB, TASK_EDIT_ROUTE, openTaskEditWindow, parseTaskEditWindowParams, taskEditWindowParams, taskEditWindowPath } from '../../../kit8/pm/view/task/edit/taskEditWindowLink';

let mockCrud: any = {};
const mockNavigate = jest.fn();
jest.mock('../../../kit8/pm/crud/queries', () => ({
  usePMOwnerGUID: () => 'u1',
  useProjectRealtime: () => undefined,
  useReadProjectDataQuery: () => ({ isLoading: false, isFetched: true }),
  useReadProjectsQuery: () => ({}),
  useReadProjectUserSettingsQuery: () => ({}),
  useReadTaskQuery: () => ({ isLoading: false, data: null }),
}));
jest.mock('../../../kit8/pm/crud/usePMCrud', () => ({ usePMCrud: () => mockCrud }));
jest.mock('../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({ useKanbanCommands: () => ({ setTaskKanbanProgress: jest.fn(), setTasksKanbanProgress: jest.fn() }) }));
jest.mock('../../../kit8/pm/view/undo/PMUndoProvider', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../../../kit8/pm/view/task/finances/PMTaskEditView', () => ({ __esModule: true, default: (p: any) => <div data-testid="stub-plan-view" data-project={p.projectGUID} data-width={p.width} /> }));
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: mockNavigate, replace: jest.fn(), back: jest.fn() }), useNavigation: () => ({ setOptions: jest.fn() }) }));

const PMTaskEditWindow = require('../../../kit8/pm/view/task/edit/PMTaskEditWindow').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

beforeEach(() => { mockCrud = fakeCrud(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('taskEditWindowLink', () => {
  it('path: the Main tab is the default and is not written', () => {
    expect(taskEditWindowPath({ taskGUID: 't1', projectGUID: 'p1' })).toBe(`${TASK_EDIT_ROUTE}?taskGUID=t1&projectGUID=p1`);
    expect(taskEditWindowPath({ taskGUID: 't1', tab: 'TabTaskEditPlan' })).toBe(`${TASK_EDIT_ROUTE}?taskGUID=t1&tab=TabTaskEditPlan`);
    expect(taskEditWindowParams({ taskGUID: 't1', tab: DEFAULT_TASK_EDIT_WINDOW_TAB })).toEqual({ taskGUID: 't1' });
  });
  it('parse: only known tabs, an array param takes its first value, no task = empty GUID', () => {
    expect(parseTaskEditWindowParams({ taskGUID: 't1', projectGUID: 'p1', tab: 'TabTaskEditPlan' })).toEqual({ taskGUID: 't1', projectGUID: 'p1', tab: 'TabTaskEditPlan' });
    expect(parseTaskEditWindowParams({ taskGUID: ['t1', 't2'], tab: 'nonsense' })).toEqual({ taskGUID: 't1', tab: 'TabTaskEditMain' });
    expect(parseTaskEditWindowParams({})).toEqual({ taskGUID: '', tab: 'TabTaskEditMain' });
    expect(parseTaskEditWindowParams(undefined).taskGUID).toBe('');
  });
  it('web: a NEW browser window; a blocked pop-up uses the router of this window', () => {
    const router = { push: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue({} as any);
    openTaskEditWindow({ taskGUID: 't1', projectGUID: 'p1' }, router);
    expect(open).toHaveBeenCalledWith(`${TASK_EDIT_ROUTE}?taskGUID=t1&projectGUID=p1`, '_blank');
    expect(router.push).not.toHaveBeenCalled();
    open.mockReturnValue(null);
    openTaskEditWindow({ taskGUID: 't1' }, router);
    expect(router.push).toHaveBeenCalledWith({ pathname: TASK_EDIT_ROUTE, params: { taskGUID: 't1' } });
    open.mockRestore();
  });
});

describe('PMTaskEditWindow', () => {
  const openWindow = (name = 'Task 111', props: Record<string, any> = {}) => {
    const { byName } = seedStore();
    const t = byName(name);
    renderUI(<PMTaskEditWindow taskGUID={t.rowGUID} projectGUID={t.projectGUID} {...props} />);
    return t;
  };

  it('two 1st level tabs: Main (the task form) is shown, Plan (PMTaskEditView) is hidden but mounted', () => {
    openWindow();
    expect(q('pm-task-edit-window-TabTaskEditMain')).not.toBeNull();
    expect(q('pm-task-edit-window-TabTaskEditPlan')).not.toBeNull();
    // the form of PMTaskEditModal, embedded: its own 2nd level tabs, fields and buttons
    for (const id of ['pm-task-edit-toptabs', 'pm-edit-name', 'pm-edit-days', 'pm-edit-save', 'pm-edit-cancel', 'pm-edit-delete', 'pm-edit-open', 'pm-edit-google-calendar']) expect(q(id)).not.toBeNull();
    expect(q('pm-task-edit-page')).not.toBeNull();
    expect(hidden('pm-task-edit-window-plan')).toBe(true);
    expect(hidden('pm-task-edit-window-main')).toBe(false);
  });

  it('the form is filled with the task; Save writes it and the window stays open', () => {
    const t = openWindow('Task 111');
    expect(inputValue('pm-edit-name')).toBe('Task 111');
    typeInto('pm-edit-name', 'Renamed in the window');
    press('pm-edit-save');
    expect(mockCrud.updateTask).toHaveBeenCalledTimes(1);
    const [guid, patch] = mockCrud.updateTask.mock.calls[0];
    expect(guid).toBe(t.rowGUID);
    expect(patch.rowJSON.taskDescription).toBe('Renamed in the window');
    expect(q('pm-edit-name')).not.toBeNull(); // not closed
    expect(usePMStore.getState().editingGUID).toBeNull(); // the Modal's store flag is not used
  });

  it('TabTaskEditPlan shows PMTaskEditView of the project with this task selected', () => {
    const t = openWindow('Task 112');
    press('pm-task-edit-window-TabTaskEditPlan');
    expect(usePMStore.getState().selectedGUID).toBe(t.rowGUID);
    expect(hidden('pm-task-edit-window-plan')).toBe(false);
    expect(hidden('pm-task-edit-window-main')).toBe(true);
  });

  it('an unsaved form survives a visit of the other tab', () => {
    openWindow('Task 111');
    typeInto('pm-edit-name', 'Draft');
    press('pm-task-edit-window-TabTaskEditPlan');
    press('pm-task-edit-window-TabTaskEditMain');
    expect(inputValue('pm-edit-name')).toBe('Draft');
  });

  it('?tab=TabTaskEditPlan opens on the Plan tab', () => {
    openWindow('Task 111', { tab: 'TabTaskEditPlan' });
    expect(hidden('pm-task-edit-window-plan')).toBe(false);
  });

  it('Delete asks crud (the window is not closed first); Details goes to the task page', () => {
    const t = openWindow('Task 111');
    press('pm-edit-delete');
    expect(mockCrud.deleteTask).toHaveBeenCalledWith(t.rowGUID);
    press('pm-edit-open');
    expect(mockCrud.openInfo).toHaveBeenCalledWith(t.rowGUID);
    expect(q('pm-edit-name')).not.toBeNull();
  });

  it('Cancel / X close the window: a window the script did not open goes to the dashboard', () => {
    openWindow('Task 111');
    const close = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    press('pm-edit-cancel');
    expect(close).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled(); // window.closed stays false in jsdom
    close.mockRestore();
  });

  it('no task in the link / an unknown task say so', () => {
    seedStore();
    renderUI(<PMTaskEditWindow taskGUID="" />);
    expect(q('pm-task-edit-window-nolink')).not.toBeNull();
    cleanupUI();
    renderUI(<PMTaskEditWindow taskGUID="does-not-exist" />);
    expect(q('pm-task-edit-window-missing')).not.toBeNull();
  });
});
