/** @jest-environment jsdom */
// Post -> the cost totals: after a successful Post of ONE task (useTaskPost) and after Post unposted / Repost all (useProjectPostActions) the app calls
// update_project_cost_total ONCE (debounced: COST_REFRESH_DEBOUNCE_MS after the last Post), only while a cost budget is on, and a refused / failed Post does not call it.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../ui/pmUiTestKit';

const mockRpc = jest.fn();
const mockDispatch = jest.fn();
const mockRunTaskPost = jest.fn();
const mockState: any = {};
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch, useSelector: (fn: any) => fn(mockState) }));
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: { rpc: (...a: any[]) => mockRpc(...a) } }) }));
jest.doMock('../../../kit8/pm/view/task/plan/runTaskPost', () => ({ runTaskPost: (...a: any[]) => mockRunTaskPost(...a), taskDaysOf: () => [] }));
jest.doMock('../../../kit8/pm/view/task/plan/useBusinessUnitPostCheck', () => ({ useBusinessUnitPostCheck: () => ({}) }));
jest.doMock('../../../kit8/pm/view/task/plan/BusyConflictsWindow', () => ({ showBusyConflicts: jest.fn() }));
jest.doMock('../../../kit8/pm/view/task/plan/useProjectTaskLines', () => ({
  projectTaskLinesKey: (g: string) => ['lines', g],
  tasksToPost: () => ['t1', 't2', 't3'],
  useProjectTaskLines: () => ({ byTask: { t1: [], t2: [], t3: [] }, indicators: {} }),
}));
jest.doMock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: {} }));
jest.doMock('../../../kit8/pm/inner/PMApproveYesNoCancelModalWindow', () => ({ approvePM: () => Promise.resolve(true) }));
jest.doMock('../../../kit8/ui/components/common/ErrorModalWindow', () => ({ showErrorModal: jest.fn() }));

const { usePMStore } = require('../../../kit8/pm/store/store_pm');
const { DISTRIBUTION_TABLE } = require('../../../kit8/catalog/distribution/distributionModel');
const { MANAGEMENT_CALENDAR_TABLE } = require('../../../kit8/catalog/management/calendar/managementCalendarModel');
const { useTaskPost } = require('../../../kit8/pm/view/task/plan/useTaskPost');
const { useProjectPostActions } = require('../../../kit8/pm/view/task/plan/useProjectPostActions');
const { COST_REFRESH_DEBOUNCE_MS, resetCostRefreshScheduler } = require('../../../kit8/pm/cost/costRefreshScheduler');

const COST_ON = { projectExpenseBudgetNeeded: true };
const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
// the quiet time after the last Post passes
const quiet = () => act(async () => { jest.advanceTimersByTime(COST_REFRESH_DEBOUNCE_MS + 10); for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
const setProject = (rowJSON: any) => usePMStore.setState({ projectsById: { p1: { rowGUID: 'p1', rowJSON } } as any, tasksById: {} as any, schedule: {} as any });
const posted = (over: any = {}) => ({ status: 'posted', lines: 2, rows: 6, problems: [], busy: [], mode: 'capacityModeWarn', ...over });

let task: any;
let project: any;
function TaskProbe() { task = useTaskPost({ projectGUID: 'p1', taskGUID: 't1', lines: [], distributions: [] }); return null; }
function ProjectProbe() { project = useProjectPostActions('p1'); return null; }

beforeEach(() => {
  jest.useFakeTimers();
  mockState[DISTRIBUTION_TABLE.entity] = { entityDataFromServer: [{ rowGUID: 'd1' }] };
  mockState[MANAGEMENT_CALENDAR_TABLE.entity] = { entityDataFromServer: [] };
  mockRpc.mockResolvedValue({ data: { tasks: 3, rows: 1, projectTotal: 1, changedRows: 0, ms: 1, flushed: 1 }, error: null });
});
afterEach(() => { cleanupUI(); resetCostRefreshScheduler(); jest.useRealTimers(); jest.clearAllMocks(); });

describe('Post of ONE task (useTaskPost)', () => {
  it('calls update_project_cost_total once after a successful Post while a cost budget is on', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<TaskProbe />);
    await act(async () => { await task.post(); });
    await flush();
    expect(mockRpc).not.toHaveBeenCalled();                      // the quiet time has not passed
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_project_cost_total', { p_project: 'p1' });
  });
  it('a Post with some lines not posted is still a Post: the call is made', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted({ problems: ['a line has no dates'] }));
    renderUI(<TaskProbe />);
    await act(async () => { await task.post(); });
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('no call without a cost budget (the master off, or Time + Material + Expense all off)', async () => {
    mockRunTaskPost.mockResolvedValue(posted());
    for (const json of [{}, { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }]) {
      setProject(json);
      renderUI(<TaskProbe />);
      await act(async () => { await task.post(); });
      await quiet();
      cleanupUI();
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('no call when nothing was posted or the Post failed', async () => {
    setProject(COST_ON);
    renderUI(<TaskProbe />);
    mockRunTaskPost.mockResolvedValueOnce({ status: 'error', message: 'boom' });
    await act(async () => { await task.post(); });
    mockRunTaskPost.mockResolvedValueOnce({ status: 'nothing', problems: [], noBudget: true });
    await act(async () => { await task.post(); });
    await quiet();
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('a failing update does not disturb the Post: the user still gets the message', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not enabled' } });
    renderUI(<TaskProbe />);
    await act(async () => { await task.post(); });
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not enabled'));
    const snack = mockDispatch.mock.calls.map((c) => c[0]).find((a) => a?.payload?.message);
    expect(snack.payload.isError).toBe(false);
    expect(snack.payload.message).toContain('Posted 2 line(s)');
    warn.mockRestore();
  });
});

describe('the debounce: many Posts close together = ONE calculation after the last one', () => {
  it('five Posts of tasks, 100 ms apart, make ONE call', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<TaskProbe />);
    for (let i = 0; i < 5; i += 1) {
      await act(async () => { await task.post(); });
      await act(async () => { jest.advanceTimersByTime(100); });
    }
    expect(mockRpc).not.toHaveBeenCalled();
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('a Post of one task and then Post unposted (another component) are one call', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<><TaskProbe /><ProjectProbe /></>);
    await act(async () => { await task.post(); });
    await act(async () => { jest.advanceTimersByTime(200); });
    await act(async () => { await project.postUnposted(); });
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('the Post button may be closed right after Post: the call still happens', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<TaskProbe />);
    await act(async () => { await task.post(); });
    cleanupUI();                                                       // the task page is gone
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('a Post while the calculation runs does not start a second one in parallel; one more follows when it has finished', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    let release: any;
    mockRpc.mockImplementation(() => new Promise((r) => { release = r; }));
    renderUI(<TaskProbe />);
    await act(async () => { await task.post(); });
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);                          // running
    await act(async () => { await task.post(); });                     // "another Post within the 2 seconds"
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);                          // still one at a time
    await act(async () => { release({ data: {}, error: null }); for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
    expect(mockRpc).toHaveBeenCalledTimes(2);                          // exactly one more
    await act(async () => { release({ data: {}, error: null }); for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe('Post unposted / Repost all (useProjectPostActions)', () => {
  it('ONE call for the whole run (3 tasks posted), not one per task', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<ProjectProbe />);
    await act(async () => { await project.postUnposted(); });
    await quiet();
    expect(mockRunTaskPost).toHaveBeenCalledTimes(3);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_project_cost_total', { p_project: 'p1' });
  });
  it('Repost all (after the question) calls it once too', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<ProjectProbe />);
    await act(async () => { await project.repostAll(); });
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('no call when no task could be posted', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue({ status: 'error', message: 'boom' });
    renderUI(<ProjectProbe />);
    await act(async () => { await project.postUnposted(); });
    await quiet();
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('no call without a cost budget', async () => {
    setProject({});
    mockRunTaskPost.mockResolvedValue(posted());
    renderUI(<ProjectProbe />);
    await act(async () => { await project.postUnposted(); });
    await quiet();
    expect(mockRunTaskPost).toHaveBeenCalledTimes(3);
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('the call comes AFTER the message of the run (the user does not wait for it)', async () => {
    setProject(COST_ON);
    mockRunTaskPost.mockResolvedValue(posted());
    let release: any;
    mockRpc.mockReturnValue(new Promise((r) => { release = r; }));
    renderUI(<ProjectProbe />);
    await act(async () => { await project.postUnposted(); });
    const snack = mockDispatch.mock.calls.map((c) => c[0]).find((a) => a?.payload?.message);
    expect(snack.payload.message).toContain('Posted 3 task(s)');
    expect(project.busy).toBe(false);                                 // the run is over; the update has not even started (quiet time)
    expect(mockRpc).not.toHaveBeenCalled();
    await quiet();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    release({ data: {}, error: null });
    await flush();
  });
});
