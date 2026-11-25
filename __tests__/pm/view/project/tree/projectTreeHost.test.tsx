/** @jest-environment jsdom */
// PMProjectTreeHost: the reusable task tree of the Project dashboard (selects the project, reads it, shows the tree with the caller's pane, windows, FAB, keyboard).
import { cleanupUI, press, q, renderUI } from '../../../ui/pmUiTestKit';

let mockOwner: string | null = 'u1';
let mockRows = 3;
let mockLoaded: string | null = 'p1';
let mockFetching = false;
const mockSelectProject = jest.fn();
const mockCreateStage = jest.fn();
const mockFab = jest.fn();
const mockKeys = jest.fn();
const mockSurface = jest.fn();

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { background: '#fff', text: '#000', error: '#f00', primary: '#00f', border: '#ccc' }, isDark: false }) }));
jest.mock('../../../../../kit8/ui/components/activityindicator/ActivityIndicatorCircleApp', () => ({ __esModule: true, default: (p: any) => require('react').createElement(require('react-native').View, { testID: p.testID }) }));
jest.mock('../../../../../kit8/pm/crud/queries', () => ({
  usePMOwnerGUID: () => mockOwner, useReadProjectsQuery: jest.fn(), useReadProjectUserSettingsQuery: jest.fn(), useProjectRealtime: jest.fn(), useScheduleWriteBack: jest.fn(),
  useReadProjectDataQuery: () => ({ isFetching: mockFetching, error: null }),
}));
jest.mock('../../../../../kit8/pm/crud/usePMCrud', () => ({ usePMCrud: () => ({ createStage: mockCreateStage }) }));
jest.mock('../../../../../kit8/pm/crud/kanban/useKanbanCommands', () => ({ useKanbanCommands: () => ({}) }));
jest.mock('../../../../../kit8/pm/crud/kanban/kanbanQueries', () => ({ useReadProjectKanbanQuery: jest.fn() }));
jest.mock('../../../../../kit8/pm/crud/kanban/useKanbanRealtime', () => ({ useKanbanRealtime: jest.fn() }));
jest.mock('../../../../../kit8/pm/subproject/useProjectSubprojectMarks', () => ({ useProjectSubprojectMarks: jest.fn() }));
jest.mock('../../../../../kit8/pm/view/task/plan/useProjectTaskLines', () => ({ useProjectTaskLinesRealtime: jest.fn() }));
jest.mock('../../../../../kit8/pm/view/undo/PMUndoProvider', () => ({ __esModule: true, default: (p: any) => p.children }));
jest.mock('../../../../../kit8/pm/view/gantt/PMGanttSurfaceLoader', () => ({ __esModule: true, default: (p: any) => { mockSurface(p); return require('react').createElement(require('react-native').View, { testID: 'surface-stub' }, p.renderRight?.({ width: 10, height: 10, palette: {} })); } }));
jest.mock('../../../../../kit8/pm/view/project/tree/PMTreeWindows', () => ({ __esModule: true, default: (p: any) => require('react').createElement(require('react-native').View, { testID: `windows-${p.projectGUID}` }) }));
jest.mock('../../../../../kit8/pm/view/project/tree/useTreeFabActions', () => ({ useTreeFabActions: (...a: any[]) => mockFab(...a) }));
const mockScope = jest.fn();
jest.mock('../../../../../kit8/pm/view/project/tree/useTreeScopeSelection', () => ({ useTreeScopeSelection: (...a: any[]) => mockScope(...a) }));
jest.mock('../../../../../kit8/pm/view/project/tree/useTreeKeyboardShortcuts', () => ({ useTreeKeyboardShortcuts: (...a: any[]) => mockKeys(...a) }));
jest.mock('../../../../../kit8/pm/store/store_pm', () => ({
  usePMStore: Object.assign((sel: any) => sel({ selectedProjectGUID: null, loadedProjectGUID: mockLoaded, visibleRows: new Array(mockRows), tasks: new Array(mockRows) }), { getState: () => ({ selectProject: mockSelectProject }) }),
}));

import React from 'react';
import { Text } from 'react-native';
import PMProjectTreeHost from '../../../../../kit8/pm/view/project/tree/PMProjectTreeHost';

beforeEach(() => { mockOwner = 'u1'; mockRows = 3; mockLoaded = 'p1'; mockFetching = false; jest.clearAllMocks(); });
afterEach(cleanupUI);

describe('PMProjectTreeHost', () => {
  it('hands the project to the selection scope and shows the tree with the pane of the caller', () => {
    renderUI(<PMProjectTreeHost projectGUID="p1" renderRight={() => <Text testID="right-pane">estimate</Text>} />);
    expect(mockScope).toHaveBeenCalledWith('pm-project-tree', { forcedProjectGUID: 'p1' });
    expect(q('surface-stub')).toBeTruthy();
    expect(q('right-pane')).toBeTruthy();
    expect(mockSurface.mock.calls[0][0]).toMatchObject({ projectGUID: 'p1', ownerGUID: 'u1', rightPane: 'custom' });
    expect(q('windows-p1')).toBeTruthy();
  });
  it('without a pane of the caller it is the Gantt chart; another pane can be named', () => {
    renderUI(<PMProjectTreeHost projectGUID="p1" />);
    expect(mockSurface.mock.calls[0][0].rightPane).toBe('gantt');
    cleanupUI();
    renderUI(<PMProjectTreeHost projectGUID="p1" rightPane="finances" />);
    expect(mockSurface.mock.calls[1][0].rightPane).toBe('finances');
  });
  it('registers the keyboard and the main FAB under the id of the screen', () => {
    renderUI(<PMProjectTreeHost projectGUID="p1" fabId="estimation-tree" />);
    expect(mockFab).toHaveBeenCalledWith('estimation-tree', expect.objectContaining({ projectGUID: 'p1', enabled: true }));
    expect(mockKeys).toHaveBeenCalledWith(expect.anything(), true);
  });
  it('a read only project has no keyboard / FAB commands and no first stage button', () => {
    mockRows = 0;
    renderUI(<PMProjectTreeHost projectGUID="p1" readOnly />);
    expect(mockFab).toHaveBeenCalledWith('pm-project-tree', expect.objectContaining({ enabled: false }));
    expect(mockKeys).toHaveBeenCalledWith(expect.anything(), false);
    press('pm-project-tree-add-stage');
    expect(mockCreateStage).not.toHaveBeenCalled();
  });
  it('an empty project asks for the first stage', () => {
    mockRows = 0;
    renderUI(<PMProjectTreeHost projectGUID="p1" emptyText="no tasks" />);
    expect(q('pm-project-tree-empty')).toBeTruthy();
    expect(q('surface-stub')).toBeNull();
    press('pm-project-tree-add-stage');
    expect(mockCreateStage).toHaveBeenCalled();
  });
  it('shows a loader until the project is read and asks a guest to sign in', () => {
    mockLoaded = null;
    renderUI(<PMProjectTreeHost projectGUID="p1" />);
    expect(q('pm-project-tree-loading')).toBeTruthy();
    cleanupUI();
    mockOwner = null;
    renderUI(<PMProjectTreeHost projectGUID="p1" />);
    expect(q('pm-project-tree-loading')).toBeNull();
  });
});
