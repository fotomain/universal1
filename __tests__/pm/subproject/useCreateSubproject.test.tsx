/** @jest-environment jsdom */
// useCreateSubproject: "Create based on this → Subproject" - the project "Subproject of <task>" is created with the settings of the origin project, linked to the task
// (taskIsSubproject + taskSubprojectGUID) and its board is opened (the new window opened inside the click); a failure leaves nothing behind and shows the error.
import React, { act } from 'react';
import { cleanupUI, renderUI, seedStore } from '../ui/pmUiTestKit';

const mockApi = {
  buildProjectRow: jest.fn((owner: string, name: string, _after: number | null, startMs?: number) => ({ rowGUID: 'new-project', treePath: 'new_project', rowOwnerGUID: owner, rowDuration: null, rowProgress: 0, orderInList: 5, rowJSON: { rowKind: 'project', name, projectStartAt: new Date(startMs ?? 0).toISOString() } })),
  createProject: jest.fn(async (r: any) => r),
  updateTask: jest.fn(async (_g: string, _p: any) => ({})),
  deleteProject: jest.fn(async (_g: string) => undefined),
};
const mockInvalidate = jest.fn();
const mockOpenBoard = jest.fn();
const mockTarget = { close: jest.fn() };
jest.mock('../../../kit8/pm/crud/shared/queryShared', () => ({ usePMApi: () => mockApi }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../../kit8/documents/vendor/invoice/vendorInvoiceNavigation', () => ({ openBlankWindow: () => mockTarget }));
jest.mock('../../../kit8/pm/view/project/dashboardDeepLink', () => ({ openProjectBoard: (...a: any[]) => mockOpenBoard(...a) }));

const { useCreateSubproject } = require('../../../kit8/pm/subproject/useCreateSubproject');
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

let create: (task: string, project: string) => Promise<string | null>;
function Probe() { create = useCreateSubproject().create; return null; }

afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.getState().setError(null)); });

function setup(project: Record<string, any> = { subprojectsFunctionalityEnabled: true, currencyForBudget: 'EUR' }, task: Record<string, any> = {}) {
  const { byName } = seedStore();
  const t = byName('Task 111');
  act(() => {
    const s = usePMStore.getState();
    const p = s.projectsById[t.projectGUID];
    usePMStore.setState({
      projectsById: { ...s.projectsById, [t.projectGUID]: { ...p, rowJSON: { ...p.rowJSON, ...project } } },
      tasksById: { ...s.tasksById, [t.rowGUID]: { ...s.tasksById[t.rowGUID], rowJSON: { ...s.tasksById[t.rowGUID].rowJSON, ...task } } },
    });
  });
  renderUI(<Probe />);
  return t;
}

it('creates "Subproject of <task>", links it to the task, refreshes the caches and opens the board in the window opened by the click', async () => {
  const t = setup();
  let answer: string | null = null;
  await act(async () => { answer = await create(t.rowGUID, t.projectGUID); });
  expect(answer).toBe('new-project');
  const row = mockApi.createProject.mock.calls[0][0];
  expect(row.rowJSON.name).toBe('Subproject of Task 111');
  expect(row.rowOwnerGUID).toBe(usePMStore.getState().projectsById[t.projectGUID].rowOwnerGUID);
  expect(row.rowJSON.currencyForBudget).toBe('EUR');                           // the settings of the origin project
  expect(row.rowJSON.subprojectsFunctionalityEnabled).toBe(true);
  expect(mockApi.updateTask).toHaveBeenCalledTimes(1);
  const [guid, patch] = mockApi.updateTask.mock.calls[0];
  expect(guid).toBe(t.rowGUID);
  expect(patch.rowJSON).toMatchObject({ taskDescription: 'Task 111', taskIsSubproject: true, taskSubprojectGUID: 'new-project' });
  expect(mockApi.createProject.mock.invocationCallOrder[0]).toBeLessThan(mockApi.updateTask.mock.invocationCallOrder[0]);   // the project exists before the task points at it
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['pm', 'projects'] });
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['pm', 'projectData', t.projectGUID] });
  expect(mockOpenBoard).toHaveBeenCalledWith('new-project', expect.anything(), mockTarget);
  expect(usePMStore.getState().lastError).toBeFalsy();
});

it('the project switch is off: nothing is created, the user is told', async () => {
  const t = setup({ subprojectsFunctionalityEnabled: false });
  await act(async () => { await create(t.rowGUID, t.projectGUID); });
  expect(mockApi.createProject).not.toHaveBeenCalled();
  expect(mockOpenBoard).not.toHaveBeenCalled();
  expect(usePMStore.getState().lastError).toContain('Subprojects');
});

it('a task that already stands for a subproject gets no second one', async () => {
  const t = setup(undefined, { taskIsSubproject: true, taskSubprojectGUID: 'old' });
  await act(async () => { await create(t.rowGUID, t.projectGUID); });
  expect(mockApi.createProject).not.toHaveBeenCalled();
  expect(usePMStore.getState().lastError).toContain('already');
});

it('the link is refused by the database (a cycle ...): the new window is closed, the new project deleted, the error shown', async () => {
  const t = setup();
  mockApi.updateTask.mockRejectedValueOnce(new Error('SUBPROJECT_CYCLE: A -> B -> A'));
  let answer: string | null = 'x';
  await act(async () => { answer = await create(t.rowGUID, t.projectGUID); });
  expect(answer).toBeNull();
  expect(mockTarget.close).toHaveBeenCalled();
  expect(mockApi.deleteProject).toHaveBeenCalledWith('new-project');
  expect(mockOpenBoard).not.toHaveBeenCalled();
  expect(usePMStore.getState().lastError).toContain('itself');
});

it('the project cannot be created: no task update, nothing to delete', async () => {
  const t = setup();
  mockApi.createProject.mockRejectedValueOnce(new Error('permission denied'));
  await act(async () => { await create(t.rowGUID, t.projectGUID); });
  expect(mockApi.updateTask).not.toHaveBeenCalled();
  expect(mockApi.deleteProject).not.toHaveBeenCalled();
  expect(mockTarget.close).toHaveBeenCalled();
  expect(usePMStore.getState().lastError).toContain('permission denied');
});
