// Resource optimization: the engine (leveling and smoothing) on small plans with the REAL scheduler. documentation/RESOURCE_LEVELING_WBS.html sections 7.3, 13.
import { levelResources } from '../../../kit8/pm/resourceleveling/resourceLevelingEngine';
import { detectConflicts } from '../../../kit8/pm/resourceleveling/resourceLevelingDetect';
import type { LevelingTaskInput } from '../../../kit8/pm/resourceleveling/resourceLevelingModel';
import { D0, OPT, day, dayIndex, makeEnv, makeLink, makeTask, resetSeq, taskInput, timeLine } from './levelingTestKit';

beforeEach(() => resetSeq());

/** two tasks of 3 working days that both need person p1 for 8 h a day: Monday to Wednesday */
function twoTasks(extraA: Record<string, unknown> = {}, extraB: Record<string, unknown> = {}) {
  const A = makeTask('A', 3, extraA);
  const B = makeTask('B', 3, extraB);
  const inputs: LevelingTaskInput[] = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 24)])];
  return { A, B, inputs };
}

describe('leveling (the finish may move)', () => {
  it('delays the second of two equal tasks until the person is free; the first keeps its dates', () => {
    const { A, B, inputs } = twoTasks();
    const env = makeEnv({ tasks: [A, B] });
    const r = levelResources(inputs, env, OPT);
    expect(r.delays).toEqual({ [B.rowGUID]: 3 });
    expect(dayIndex(r.schedule.rows[A.rowGUID].startMs)).toBe(0);
    expect(dayIndex(r.schedule.rows[B.rowGUID].startMs)).toBe(3); // Thursday; Thu, Fri, Mon
    expect(dayIndex(r.schedule.rows[B.rowGUID].finishMs)).toBe(8);
    expect(r.before.length).toBe(3); // Mon, Tue, Wed
    expect(r.unresolved).toEqual([]);
    expect(r.moves).toHaveLength(1);
    expect(r.moves[0]).toMatchObject({ task: B.rowGUID, delayBefore: 0, delayAfter: 3, reason: 'idYield' });
  });

  it('the busy check finds nothing after the run', () => {
    const { A, B, inputs } = twoTasks();
    const env = makeEnv({ tasks: [A, B] });
    const r = levelResources(inputs, env, OPT);
    expect(detectConflicts(env, inputs, r.schedule.rows)).toEqual([]);
  });

  it('the successors of a delayed task move with it (the scheduler does it)', () => {
    const { A, B, inputs } = twoTasks({ taskPriority: 900 }, { taskPriority: 100 });
    const C = makeTask('C', 2);
    const env = makeEnv({ tasks: [A, B, C], deps: [makeLink(B, C)] });
    const r = levelResources(inputs, env, { ...OPT, order: 'priorityStandard' });
    expect(r.delays[B.rowGUID]).toBe(3);
    expect(dayIndex(r.schedule.rows[C.rowGUID].startMs)).toBe(8);
    expect(r.schedule.projectFinishMs).toBeGreaterThan(r.baseline.projectFinishMs);
  });

  it('the lower priority yields with priorityStandard', () => {
    const { A, B, inputs } = twoTasks({ taskPriority: 300 }, { taskPriority: 900 });
    const env = makeEnv({ tasks: [A, B] });
    const r = levelResources(inputs, env, { ...OPT, order: 'priorityStandard' });
    expect(r.delays).toEqual({ [A.rowGUID]: 3 });
    expect(r.moves[0].reason).toBe('priorityYield');
  });

  it('idOnly: the task with the higher row number yields whatever its slack', () => {
    const A = makeTask('A', 3);
    const B = makeTask('B', 3);
    const L = makeTask('L', 10);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 24)])];
    const env = makeEnv({ tasks: [A, B, L] });
    const r = levelResources(inputs, env, { ...OPT, order: 'idOnly' });
    expect(Object.keys(r.delays)).toEqual([B.rowGUID]);
    expect(r.moves[0].reason).toBe('idYield');
  });

  it('standard: the task with MORE slack yields first', () => {
    const A = makeTask('A', 3);
    const B = makeTask('B', 3);
    const L = makeTask('L', 3);
    const X = makeTask('X', 2);
    // B is followed by a long chain (critical, no slack); A has slack: A must yield although it comes first
    const Z = makeTask('Z', 8);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 24)])];
    const env = makeEnv({ tasks: [A, B, L, X, Z], deps: [makeLink(B, Z)] });
    const r = levelResources(inputs, env, OPT);
    expect(Object.keys(r.delays)).toEqual([A.rowGUID]);
    expect(r.moves[0].reason).toBe('slackYield');
  });

  it('a task never moves when its priority is 1000; both 1000 = unresolved', () => {
    const { A, B, inputs } = twoTasks();
    inputs[0].frozen = 'priority1000';
    const env = makeEnv({ tasks: [A, B] });
    expect(levelResources(inputs, env, OPT).delays).toEqual({ [B.rowGUID]: 3 });
    inputs[1].frozen = 'priority1000';
    const r = levelResources(inputs, env, OPT);
    expect(r.delays).toEqual({});
    expect(r.unresolved).toHaveLength(3);
    expect(r.unresolved.every((c) => c.code === 'priority1000')).toBe(true);
  });

  it('a frozen (posted) task stays and is reported; the other one yields', () => {
    const { A, B, inputs } = twoTasks();
    inputs[1].frozen = 'frozenPosted';
    const env = makeEnv({ tasks: [A, B] });
    const r = levelResources(inputs, env, OPT);
    expect(r.delays).toEqual({ [A.rowGUID]: 3 });
    inputs[0].frozen = 'frozenPosted';
    expect(levelResources(inputs, env, OPT).unresolved[0].code).toBe('frozenPosted');
  });

  it('respects the posted hours of the other projects (foreign load)', () => {
    const A = makeTask('A', 3);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)])];
    const env = makeEnv({ tasks: [A], foreign: (_r, d) => (d >= day(0) && d <= day(2) ? 8 : 0) });
    const r = levelResources(inputs, env, OPT);
    expect(r.delays).toEqual({ [A.rowGUID]: 3 });
    expect(r.moves[0].reason).toBe('foreignYield');
  });

  it('a day whose calendar has no row is never guessed: unresolved capacityUnknown', () => {
    const { A, B, inputs } = twoTasks();
    const weekday = (d: number) => new Date(d).getUTCDay() >= 1 && new Date(d).getUTCDay() <= 5;
    const env = makeEnv({ tasks: [A, B], capacity: (_r, d) => (d >= day(7) ? null : weekday(d) ? 8 : 0), lastDay: 25 });
    const r = levelResources(inputs, env, OPT);
    expect(r.unresolved.length).toBeGreaterThan(0);
    expect(r.unresolved.some((c) => c.code === 'capacityUnknown')).toBe(true);
  });

  it('a task that alone needs more than the resource has cannot be solved by moving', () => {
    const A = makeTask('A', 1);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 12)])];
    const env = makeEnv({ tasks: [A], lastDay: 40 });
    const r = levelResources(inputs, env, OPT);
    expect(r.delays).toEqual({});
    expect(r.unresolved[0].code).toBe('taskExceedsCapacity');
  });

  it('week period: 12 h on one day is fine against 40 h a week, a conflict against 8 h a day', () => {
    const A = makeTask('A', 1);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 12)])];
    const env = makeEnv({ tasks: [A], lastDay: 40 });
    expect(levelResources(inputs, env, { ...OPT, period: 'week' }).before).toEqual([]);
    expect(levelResources(inputs, env, OPT).before).toHaveLength(1);
  });

  it('week period: two tasks of 40 h in the same week are moved one week apart', () => {
    const A = makeTask('A', 5);
    const B = makeTask('B', 5);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 40)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 40)])];
    const env = makeEnv({ tasks: [A, B] });
    const r = levelResources(inputs, env, { ...OPT, period: 'week' });
    expect(r.delays).toEqual({ [B.rowGUID]: 5 });
    expect(dayIndex(r.schedule.rows[B.rowGUID].startMs)).toBe(7);
  });

  it('is idempotent: a second run on its own result changes nothing', () => {
    const { A, B, inputs } = twoTasks();
    const env = makeEnv({ tasks: [A, B] });
    const first = levelResources(inputs, env, OPT);
    const second = levelResources(inputs, env, { ...OPT, startDelays: first.delays });
    expect(second.moves).toEqual([]);
    expect(second.delays).toEqual(first.delays);
  });
});

describe('smoothing (only the slack is used; the finish never moves)', () => {
  const smooth = { ...OPT, method: 'smoothing' as const };

  it('moves a task inside its slack and leaves the finish', () => {
    const A = makeTask('A', 3);
    const B = makeTask('B', 3);
    const L = makeTask('L', 10);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 24)])];
    const env = makeEnv({ tasks: [A, B, L] });
    const r = levelResources(inputs, env, smooth);
    expect(r.delays).toEqual({ [B.rowGUID]: 3 });
    expect(r.schedule.projectFinishMs).toBe(r.baseline.projectFinishMs);
    expect(r.unresolved).toEqual([]);
  });

  it('leaves the conflict when the slack is not enough, and reports slackLimit', () => {
    const A = makeTask('A', 3);
    const B = makeTask('B', 3);
    const L = makeTask('L', 4);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 24)])];
    const env = makeEnv({ tasks: [A, B, L] });
    const r = levelResources(inputs, env, smooth);
    expect(r.delays).toEqual({});
    expect(r.schedule.projectFinishMs).toBe(r.baseline.projectFinishMs);
    expect(r.unresolved.length).toBeGreaterThan(0);
    expect(r.unresolved.every((c) => c.code === 'slackLimit')).toBe(true);
  });

  it('a chain that would move the finish is refused even when each task has slack on its own', () => {
    // A and B both conflict with C; B follows A; the finish is set by L: moving both would exceed the common slack
    const A = makeTask('A', 2);
    const B = makeTask('B', 2);
    const C = makeTask('C', 2);
    const L = makeTask('L', 6);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 16)]), taskInput(C, [timeLine(C.rowGUID, 'p1', 16)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 16)])];
    const env = makeEnv({ tasks: [A, B, C, L], deps: [makeLink(A, B)] });
    const r = levelResources(inputs, env, smooth);
    expect(r.schedule.projectFinishMs).toBeLessThanOrEqual(r.baseline.projectFinishMs);
  });
});

describe('planned from the finish date (Q5): a yielding task moves EARLIER', () => {
  it('moves earlier, keeps the finish, and the project start moves earlier', () => {
    const { A, B, inputs } = twoTasks();
    const env = makeEnv({ tasks: [A, B], scheduleFromFinishDay: 14 });
    const r = levelResources(inputs, env, { ...OPT, direction: 'backward' });
    expect(r.baseline.projectFinishMs).toBe(day(15));
    expect(r.schedule.projectFinishMs).toBe(day(15));
    expect(dayIndex(r.baseline.projectStartMs)).toBe(10);
    expect(r.delays).toEqual({ [B.rowGUID]: 3 });
    expect(dayIndex(r.schedule.rows[B.rowGUID].startMs)).toBe(7);
    expect(dayIndex(r.schedule.projectStartMs)).toBe(7);
    expect(r.unresolved).toEqual([]);
  });

  it('Smoothing: the project start may not move', () => {
    const { A, B, inputs } = twoTasks();
    const env = makeEnv({ tasks: [A, B], scheduleFromFinishDay: 14 });
    const r = levelResources(inputs, env, { ...OPT, direction: 'backward', method: 'smoothing' });
    expect(r.schedule.projectStartMs).toBe(r.baseline.projectStartMs);
    expect(r.unresolved.length).toBeGreaterThan(0);
  });
});

describe('properties on generated plans', () => {
  // mulberry32: a small seeded generator, so the plans are the same on every run
  const prng = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const generate = (seed: number) => {
    resetSeq();
    const rnd = prng(seed);
    const n = 6 + Math.floor(rnd() * 8);
    const tasks = Array.from({ length: n }, (_, i) => makeTask('T' + i, 1 + Math.floor(rnd() * 5), { taskPriority: Math.floor(rnd() * 900) }));
    const deps = [] as ReturnType<typeof makeLink>[];
    for (let j = 1; j < n; j++) if (rnd() < 0.4) deps.push(makeLink(tasks[Math.floor(rnd() * j)], tasks[j]));
    const inputs = tasks.map((t) => {
      const perDay = 2 + Math.floor(rnd() * 7); // 2..8 h a day: one task never exceeds the person alone
      return taskInput(t, [timeLine(t.rowGUID, rnd() < 0.5 ? 'p1' : 'p2', perDay * (t.rowJSON as any).durationDays)]);
    });
    return { tasks, deps, inputs };
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])('seed %i: no conflict is left, links hold, delays are not negative, the run is deterministic and idempotent', (seed) => {
    const { tasks, deps, inputs } = generate(seed);
    const env = makeEnv({ tasks, deps });
    const order = seed % 2 ? 'standard' : 'priorityStandard';
    const r = levelResources(inputs, env, { ...OPT, order });
    expect(r.unresolved).toEqual([]);
    expect(detectConflicts(env, inputs, r.schedule.rows)).toEqual([]);
    for (const v of Object.values(r.delays)) expect(v).toBeGreaterThan(0);
    for (const d of deps) expect(r.schedule.rows[d.rowGUID].startMs).toBeGreaterThanOrEqual(r.schedule.rows[d.rowDependsOnGUID].finishMs);
    const again = levelResources(inputs, env, { ...OPT, order });
    expect(again.delays).toEqual(r.delays);
    const idem = levelResources(inputs, env, { ...OPT, order, startDelays: r.delays });
    expect(idem.moves).toEqual([]);
  });

  it.each([21, 22, 23, 24, 25, 26])('seed %i: smoothing never moves the finish', (seed) => {
    const { tasks, deps, inputs } = generate(seed);
    const env = makeEnv({ tasks, deps });
    const r = levelResources(inputs, env, { ...OPT, method: 'smoothing' });
    expect(r.schedule.projectFinishMs).toBeLessThanOrEqual(r.baseline.projectFinishMs);
  });
});

describe('the baseline day', () => {
  it('the test calendar starts on a Monday', () => {
    expect(new Date(D0).getUTCDay()).toBe(1);
  });
});
