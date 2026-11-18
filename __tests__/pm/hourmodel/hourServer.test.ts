// Server side computations of the time-of-day model: the problem v = 2 on the virtual axis of the steps, and the run that continues from the proposal of the database
// (the SQL is tested by Docker: kit8/docker/tests/101_time_of_day.sql).
import { DAY_MS } from '../../../kit8/pm/model/constants';
import { buildHourAxis } from '../../../kit8/pm/hourmodel/hourAxis';
import { serverProblemHoursOf } from '../../../kit8/pm/hourmodel/hourServerProblem';
import { calculateLevelingPlan } from '../../../kit8/pm/resourceleveling/resourceLevelingBackend';
import { planLevelingRun, prepareLevelingRun } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { D0, makeLink, makeTask, resetSeq, timeLine, WEEKDAYS } from '../resourceleveling/levelingTestKit';

beforeEach(() => resetSeq());

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const WINDOWS = [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }];
const capacityRows = (days = 40) => Array.from({ length: days }, (_, i) => {
  const dow = new Date(D0 + i * DAY_MS).getUTCDay();
  return { k: 'person', g: 'p1', d: iso(D0 + i * DAY_MS), w: (dow === 0 || dow === 6 ? [] : [[540, 780], [840, 1080]]) as [number, number][] };
});
const PROJECT = { resourceLevelingFunctionalityEnabled: true, resourceOptimizationMode: 'hourByHourModel', skipWeekends: true, resourceLevelingComputationSide: 'resourceLevelingServerSideComputations' };

function args(tasks: any[], lines: Record<string, any[]>, deps: any[] = [], project: Record<string, unknown> = {}) {
  return {
    tasks, deps, projectJSON: { ...PROJECT, ...project }, projectStartMs: D0, linesByTask: lines, capacityRows: [], foreignRows: [], todayMs: D0 - 30 * DAY_MS,
    hour: { axis: buildHourAxis({ windows: WINDOWS, calendar: WEEKDAYS, originMs: D0 }), step: 15, capacityRows: capacityRows(), foreignRows: [] },
  } as any;
}
function twoTasks() {
  const A = makeTask('A', 1, { taskDurationMinutes: 240 });
  const B = makeTask('B', 1, { taskDurationMinutes: 240 });
  return { A, B, lines: { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] } };
}

describe('serverProblemHoursOf', () => {
  it('the plan on the virtual axis: durations in steps, capacity in runs, the first step is 2000-01-01', () => {
    const { A, B, lines } = twoTasks();
    const a = args([A, B], lines, [makeLink(A, B, 'FS', 1)]);
    const r = serverProblemHoursOf(a, prepareLevelingRun(a));
    expect(r.reasons).toEqual([]);
    const p = r.problem!;
    expect(p).toMatchObject({ v: 2, period: 'day', direction: 'forward', skipWeekends: false, projectStart: '2000-01-01' });
    expect(p.leaves.map((l) => [l.g, l.d])).toEqual([[A.rowGUID, 16], [B.rowGUID, 16]]);
    expect(p.leaves[0].l).toEqual([['person:p1', 4]]);
    // a lag of one working day = 480 working minutes = 32 steps
    expect(p.cons).toEqual([[B.rowGUID, A.rowGUID, 'FS', 32]]);
    // the person has 0.25 h in every step that the task calendar works: ONE run from step 0 to the last known step
    expect(p.cap).toHaveLength(1);
    expect(p.cap[0].slice(0, 2)).toEqual(['person:p1', 0]);
    expect(p.cap[0][3]).toBeCloseTo(0.25, 9);
    expect(p.cap[0][2]).toBe(p.lastSlot);
    expect(p.for).toEqual([]);
    expect(p.maxSearch).toBeGreaterThanOrEqual(800);
  });

  it('the posted hours of the other projects are runs of the foreign load', () => {
    const { A, lines } = twoTasks();
    const a = args([A], lines);
    a.hour.foreignRows = [{ k: 'person', g: 'p1', s: new Date(D0 + 9 * 3600e3).toISOString(), e: new Date(D0 + 13 * 3600e3).toISOString(), h: 4 }];
    const p = serverProblemHoursOf(a, prepareLevelingRun(a)).problem!;
    expect(p.for).toEqual([['person:p1', 0, 15, 0.25]]);
  });

  it('what the database does not calculate is SAID: a start time, a manual start, a cycle, other distributions', () => {
    const { A, B, lines } = twoTasks();
    const pinned = makeTask('P', 1, { taskDurationMinutes: 60, taskStartMinute: 600 });
    expect(serverProblemHoursOf(args([A, B, pinned], lines), prepareLevelingRun(args([A, B, pinned], lines))).reasons).toEqual(['constraint']);
    const snet = makeTask('S', 1, { taskDurationMinutes: 60, manualStartAt: new Date(D0 + DAY_MS).toISOString() });
    expect(serverProblemHoursOf(args([snet], {}), prepareLevelingRun(args([snet], {}))).reasons).toEqual(['constraint']);
    const cyc = args([A, B], lines, [makeLink(A, B), makeLink(B, A)]);
    expect(serverProblemHoursOf(cyc, prepareLevelingRun(cyc)).reasons).toContain('cycle');
    const front = args([A, B], { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4, { distributionForBudgetTaskLine: 'frontDistribution' })], [B.rowGUID]: lines[B.rowGUID] });
    const fr = serverProblemHoursOf(front, prepareLevelingRun(front));
    // a front-loaded line is not uniform: the database does not know it (when the dictionary has that distribution)
    expect(fr.reasons.length === 0 || fr.reasons.includes('distribution')).toBe(true);
  });
});

describe('calculateLevelingPlan in the time-of-day model with Server side computations', () => {
  it('a right proposal stays as it is (adjusted 0) and the problem that was sent is v = 2', async () => {
    const { A, B, lines } = twoTasks();
    const a = args([A, B], lines);
    const client = planLevelingRun(a, prepareLevelingRun(a));
    let sent: any = null;
    const out = await calculateLevelingPlan(a, async (problem) => {
      sent = problem;
      return { supported: true, delays: client.result.delays, moves: [], unresolved: [], passes: 1, conflictsBefore: 16, conflictsAfter: 0, finish: '2000-02-02' };
    });
    expect(sent.v).toBe(2);
    expect(out.outcome).toMatchObject({ used: 'server', adjusted: 0 });
    expect(out.plan.conflictsAfter).toBe(0);
    expect(out.plan.changes.map((c) => c.delayAfter)).toEqual([240]);
    expect(out.plan.delayUnit).toBe('minutes');
  });

  it('a wrong proposal is corrected by the device: the screen decides', async () => {
    const { A, B, lines } = twoTasks();
    const a = args([A, B], lines);
    const out = await calculateLevelingPlan(a, async () => ({ supported: true, delays: {}, moves: [], unresolved: [], passes: 1, conflictsBefore: 16, conflictsAfter: 16, finish: '2000-01-17' }));
    expect(out.outcome.used).toBe('server');
    expect(out.outcome).toMatchObject({ adjusted: 1 });
    expect(out.plan.conflictsAfter).toBe(0);
  });

  it('a plan the database does not calculate falls back to the device and says why', async () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240, taskStartMinute: 600 });
    const B = makeTask('B', 1, { taskDurationMinutes: 240 });
    const lines = { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] };
    const fetchPlan = jest.fn();
    const out = await calculateLevelingPlan(args([A, B], lines), fetchPlan);
    expect(fetchPlan).not.toHaveBeenCalled();
    expect(out.outcome).toMatchObject({ used: 'client', fallback: 'planNotSupported', reasons: ['constraint'] });
  });

  it('a bucket of the answer (a virtual date) is read back as a step', async () => {
    const { A, B, lines } = twoTasks();
    const a = args([A, B], lines);
    const client = planLevelingRun(a, prepareLevelingRun(a));
    const out = await calculateLevelingPlan(a, async () => ({
      supported: true, delays: client.result.delays, passes: 1, conflictsBefore: 16, conflictsAfter: 0, finish: '2000-02-02', unresolved: [],
      moves: [{ task: B.rowGUID, delayBefore: 0, delayAfter: 16, reason: 'idYield', resource: 'person:p1', bucket: '2000-01-01' }],
    }));
    // step 0 = the start of the plan: the real instant of the bucket is the start of the first window
    expect(out.plan.changes[0].reason).toBe('idYield');
    expect(out.plan.changes[0].bucket).toBe(D0 + 9 * 3600e3);
  });
});
