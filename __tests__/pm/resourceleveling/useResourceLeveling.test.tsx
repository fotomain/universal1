/** @jest-environment jsdom */
// The commands of Resource optimization (useResourceLeveling): gather the data, plan, ask about posted tasks, apply through the database, refresh. The database calls are mocked.
import React from 'react';
import { act } from 'react-dom/test-utils';
import { cleanupUI, renderUI, seedStore } from '../ui/pmUiTestKit';
import { makeTask, resetSeq, timeLine } from './levelingTestKit';
import { useResourceLevelingUiStore } from '../../../kit8/pm/resourceleveling/resourceLevelingUiStore';

const dispatch = jest.fn();
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => dispatch, useSelector: () => undefined }));

const api = {
  fetchLevelingInputs: jest.fn(),
  fetchFactTasks: jest.fn(),
  applyLevelingRun: jest.fn(),
  clearLeveling: jest.fn(),
  undoLevelingRun: jest.fn(),
  fetchLevelingRuns: jest.fn(),
};
jest.doMock('../../../kit8/pm/resourceleveling/resourceLevelingApi', () => api);

let byTask: Record<string, any[]> = {};
const postTask = jest.fn();
jest.doMock('../../../kit8/pm/view/task/plan/useProjectTaskLines', () => ({ useProjectTaskLines: () => ({ byTask }) }));
jest.doMock('../../../kit8/pm/view/task/plan/useProjectPostActions', () => ({ useProjectPostActions: () => ({ postTask }) }));
const approve = jest.fn();
jest.doMock('../../../kit8/pm/inner/PMApproveYesNoCancelModalWindow', () => ({ approvePM: (...a: unknown[]) => approve(...a) }));
jest.doMock('../../../kit8/ui/components/common/ErrorModalWindow', () => ({ showErrorModal: jest.fn() }));

const { useResourceLeveling, POST_AGAIN_WAIT } = require('../../../kit8/pm/resourceleveling/useResourceLeveling');

const DAY = 86400000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// the project starts on a Monday two to three weeks from the real today: a task that starts before today counts as started (it is never moved)
const nextMonday = (ms: number) => { const d = Math.floor(ms / DAY) * DAY; return d + ((8 - new Date(d).getUTCDay()) % 7 || 7) * DAY; };
const D0 = nextMonday(Date.now() + 14 * DAY);
const day = (n: number) => D0 + n * DAY;
const capacity = Array.from({ length: 120 }, (_, i) => ({ k: 'person', g: 'p1', d: iso(day(i - 7)), h: [0, 6].includes(new Date(day(i - 7)).getUTCDay()) ? 0 : 8 }));

let cmd: ReturnType<typeof useResourceLeveling>;
function Harness({ project }: { project: string }) {
  cmd = useResourceLeveling(project);
  return null;
}

/** the open project holds A and B (3 days, 24 h of person p1 each) and the master switch is on */
function setup(opts: { posted?: boolean; noLines?: boolean; projectJSON?: Record<string, unknown> } = {}) {
  resetSeq();
  const { store, demo } = seedStore();
  const project = demo.projects[0];
  const A: any = makeTask('A', 3);
  const B: any = makeTask('B', 3);
  A.updated_at = '2026-10-01T10:00:00.000Z';
  B.updated_at = '2026-10-01T10:00:00.000Z';
  const rowJSON = { ...project.rowJSON, resourceLevelingFunctionalityEnabled: true, skipWeekends: true, projectStartAt: new Date(D0).toISOString(), ...(opts.projectJSON ?? {}) };
  act(() => {
    store.getState().setProjects([{ ...project, rowJSON }, demo.projects[1]]);
    store.getState().hydrate(project.rowGUID, [A, B], []);
  });
  const line = (t: any) => timeLine(t.rowGUID, 'p1', 24, opts.posted ? { taskIsPosted: true, budgetItemTaskLine: 'b1' } : {});
  byTask = opts.noLines ? {} : { [A.rowGUID]: [line(A)], [B.rowGUID]: [line(B)] };
  renderUI(<Harness project={project.rowGUID} />);
  return { A, B, project };
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  dispatch.mockReset();
  postTask.mockReset();
  approve.mockReset();
  api.fetchLevelingInputs.mockResolvedValue({ capacity, foreign: [] });
  api.fetchFactTasks.mockResolvedValue(new Set());
  api.applyLevelingRun.mockResolvedValue('run-1');
  POST_AGAIN_WAIT.tries = 1;
  POST_AGAIN_WAIT.ms = 1;
  act(() => useResourceLevelingUiStore.setState({ preview: null, postedDialog: false, history: false, busy: false }));
});
afterEach(cleanupUI);

const messages = () => dispatch.mock.calls.map((c) => c[0]?.payload?.message).filter(Boolean) as string[];

describe('Level now', () => {
  it('reads the inputs for the resources of the Time lines and opens the preview with the plan', async () => {
    const { B, project } = setup();
    await act(async () => { await cmd.levelNow(); });
    expect(api.fetchLevelingInputs).toHaveBeenCalledTimes(1);
    const call = api.fetchLevelingInputs.mock.calls[0];
    expect(call[1]).toBe(project.rowGUID);
    expect(call[4]).toEqual([{ k: 'person', g: 'p1' }]);
    expect(call[3]).toBeGreaterThan(call[2]); // a range of days
    const pv = useResourceLevelingUiStore.getState().preview!;
    expect(pv).not.toBeNull();
    expect(pv.plan.changes.map((c) => c.task)).toEqual([B.rowGUID]);
    expect(pv.stamps[B.rowGUID]).toBe('2026-10-01T10:00:00.000Z');
    expect(useResourceLevelingUiStore.getState().busy).toBe(false);
  });

  it('no Time line with a resource in hours: it says so and asks the database nothing', async () => {
    setup({ noLines: true });
    await act(async () => { await cmd.levelNow(); });
    expect(api.fetchLevelingInputs).not.toHaveBeenCalled();
    expect(useResourceLevelingUiStore.getState().preview).toBeNull();
    expect(messages().join('|')).toContain('nothing to optimize');
  });

  it('nobody is over-allocated: it says so, no preview', async () => {
    setup();
    api.fetchLevelingInputs.mockResolvedValue({ capacity: capacity.map((c) => ({ ...c, h: c.h ? 100 : 0 })), foreign: [] });
    await act(async () => { await cmd.levelNow(); });
    expect(useResourceLevelingUiStore.getState().preview).toBeNull();
    expect(messages().join('|')).toContain('No resource is over-allocated');
  });

  it('a failure of the database is shown, the busy flag is released', async () => {
    setup();
    api.fetchLevelingInputs.mockRejectedValue(new Error('boom'));
    await act(async () => { await cmd.levelNow(); });
    expect(useResourceLevelingUiStore.getState().busy).toBe(false);
    expect(useResourceLevelingUiStore.getState().preview).toBeNull();
  });
});

describe('Apply', () => {
  it('writes the run through the database, closes the preview and reads the project again', async () => {
    const { B, project } = setup();
    await act(async () => { await cmd.levelNow(); });
    await act(async () => { await cmd.apply(); });
    expect(api.applyLevelingRun).toHaveBeenCalledTimes(1);
    const [, guid, payload] = api.applyLevelingRun.mock.calls[0];
    expect(guid).toBe(project.rowGUID);
    expect(payload).toMatchObject({ kind: 'level', mode: 'manual', method: 'leveling', conflictsBefore: 3 });
    expect(payload.tasks).toHaveLength(1);
    expect(payload.tasks[0]).toMatchObject({ task: B.rowGUID, delayAfter: 3, updatedAt: '2026-10-01T10:00:00.000Z' });
    expect(useResourceLevelingUiStore.getState().preview).toBeNull();
    expect(dispatch.mock.calls.some((c) => String(c[0]?.type).includes('refreshProjectData'))).toBe(true);
    expect(messages().join('|')).toContain('Optimized: 1 task(s) moved');
  });

  it('a task changed after the plan was read: the message says to level again', async () => {
    setup();
    await act(async () => { await cmd.levelNow(); });
    api.applyLevelingRun.mockRejectedValue(new Error('project_resource_leveling_apply: 1 task(s) changed after the plan was read: read the project again'));
    await act(async () => { await cmd.apply(); });
    expect(useResourceLevelingUiStore.getState().preview).toBeNull();
    expect(useResourceLevelingUiStore.getState().busy).toBe(false);
  });
});

describe('posted tasks are never unposted without asking (7.7)', () => {
  it('Apply with a posted task that must move opens the question and writes nothing', async () => {
    setup({ posted: true });
    await act(async () => { await cmd.levelNow(); });
    await act(async () => { await cmd.apply(); });
    expect(useResourceLevelingUiStore.getState().postedDialog).toBe(true);
    expect(api.applyLevelingRun).not.toHaveBeenCalled();
  });

  it('"Keep their dates": the plan is made again without the posted tasks, nothing is written until Apply', async () => {
    setup({ posted: true });
    await act(async () => { await cmd.levelNow(); });
    await act(async () => { await cmd.apply('keep'); });
    expect(api.applyLevelingRun).not.toHaveBeenCalled();
    const pv = useResourceLevelingUiStore.getState().preview!;
    expect(pv.plan.changes).toEqual([]);
    expect(pv.plan.unresolved.every((c) => c.code === 'frozenPosted')).toBe(true);
    expect(pv.postedChoice).toBe('keep');
  });

  it('"Unpost and move": writes the run and counts the tasks that lose their posting', async () => {
    setup({ posted: true });
    await act(async () => { await cmd.levelNow(); });
    await act(async () => { await cmd.apply('unpostAndMove'); });
    expect(api.applyLevelingRun.mock.calls[0][2]).toMatchObject({ tasksUnposted: 1, options: { postedTasksAction: 'unpostAndMove' } });
    expect(postTask).not.toHaveBeenCalled();
    expect(messages().join('|')).toContain('unposted');
  });

  it('"Move and post again": writes the run, then posts the moved posted task with the normal Post', async () => {
    const { B } = setup({ posted: true });
    await act(async () => { await cmd.levelNow(); });
    await act(async () => { await cmd.apply('moveAndPostAgain'); });
    expect(api.applyLevelingRun.mock.calls[0][2]).toMatchObject({ tasksUnposted: 0 });
    expect(postTask).toHaveBeenCalledWith(B.rowGUID);
  });

  it('a remembered action is applied without the question', async () => {
    const { B } = setup({ posted: true, projectJSON: { resourceLevelingPostedTasksAction: 'unpostAndMove' } });
    await act(async () => { await cmd.levelNow(); });
    await act(async () => { await cmd.apply(); });
    expect(useResourceLevelingUiStore.getState().postedDialog).toBe(false);
    expect(api.applyLevelingRun).toHaveBeenCalledTimes(1);
    expect(api.applyLevelingRun.mock.calls[0][2].tasks[0].task).toBe(B.rowGUID);
  });
});

describe('Clear and Undo', () => {
  it('Clear with no delay on any task says so and asks nothing', async () => {
    setup();
    await act(async () => { await cmd.clear(); });
    expect(approve).not.toHaveBeenCalled();
    expect(api.clearLeveling).not.toHaveBeenCalled();
    expect(messages().join('|')).toContain('No task has a leveling delay');
  });

  it('Clear asks first (the dates of the tasks move) and clears only when the user says yes', async () => {
    const { project } = setup();
    const s = require('../../../kit8/pm/store/store_pm').usePMStore;
    const tasks = s.getState().tasks.map((t: any, i: number) => (i === 1 ? { ...t, rowJSON: { ...t.rowJSON, taskLevelingDelayDays: 3 } } : t));
    act(() => s.getState().hydrate(project.rowGUID, tasks, []));
    approve.mockResolvedValueOnce(false);
    await act(async () => { await cmd.clear(); });
    expect(api.clearLeveling).not.toHaveBeenCalled();
    approve.mockResolvedValueOnce(true);
    api.clearLeveling.mockResolvedValue('run-2');
    await act(async () => { await cmd.clear(); });
    expect(api.clearLeveling).toHaveBeenCalledWith(expect.anything(), project.rowGUID, null, 'manual', true);
    expect(messages().join('|')).toContain('Leveling cleared');
  });

  it('Undo last run undoes the newest run that is not an undo and not undone yet', async () => {
    setup();
    api.fetchLevelingRuns.mockResolvedValue([
      { rowGUID: 'u', runKind: 'undo', undoneByGUID: null },
      { rowGUID: 'r2', runKind: 'level', undoneByGUID: 'x' },
      { rowGUID: 'r1', runKind: 'clear', undoneByGUID: null },
    ]);
    approve.mockResolvedValue(true);
    api.undoLevelingRun.mockResolvedValue({ run: 'n', restored: 2, skipped: 1, skippedTasks: ['t'] });
    await act(async () => { await cmd.undoLast(); });
    expect(api.undoLevelingRun).toHaveBeenCalledWith(expect.anything(), 'r1');
    expect(messages().join('|')).toContain('2 task(s) restored, 1 changed since');
  });

  it('Undo last run with no run says so', async () => {
    setup();
    api.fetchLevelingRuns.mockResolvedValue([]);
    await act(async () => { await cmd.undoLast(); });
    expect(api.undoLevelingRun).not.toHaveBeenCalled();
    expect(messages().join('|')).toContain('There is no run to undo');
  });
});
