// One run of Resource optimization from the data of a project to the plan the user previews (resourceLevelingRun.ts, resourceLevelingEnv.ts).
import { applyPayloadOf, needsPostedDecision, planLevelingRun, planWithoutPosted, resourcesOfLines } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { buildLevelingEnv } from '../../../kit8/pm/resourceleveling/resourceLevelingEnv';
import { DAY_MS } from '../../../kit8/pm/model/constants';
import { D0, day, dayIndex, makeLink, makeTask, resetSeq, timeLine } from './levelingTestKit';

beforeEach(() => resetSeq());

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Monday to Friday 8 h, weekend 0 h, for 120 days from D0, of one person */
const capacity = (g = 'p1', days = 120) => Array.from({ length: days }, (_, i) => ({ k: 'person', g, d: iso(day(i)), h: [0, 6].includes(new Date(day(i)).getUTCDay()) ? 0 : 8 }));
const PROJECT = { resourceLevelingFunctionalityEnabled: true, skipWeekends: true };

function fixture(opts: { posted?: boolean; delayA?: number; project?: Record<string, unknown>; extraA?: Record<string, unknown> } = {}) {
  const A = makeTask('A', 3, { ...(opts.delayA ? { taskLevelingDelayDays: opts.delayA } : {}), ...(opts.extraA ?? {}) });
  const B = makeTask('B', 3);
  const line = (t: typeof A) => timeLine(t.rowGUID, 'p1', 24, opts.posted ? { taskIsPosted: true, budgetItemTaskLine: 'budgetItem1' } : {});
  return {
    A, B,
    args: {
      tasks: [A, B], deps: [], projectJSON: { ...PROJECT, ...(opts.project ?? {}) }, projectStartMs: D0,
      linesByTask: { [A.rowGUID]: [line(A)], [B.rowGUID]: [line(B)] } as any,
      capacityRows: capacity(), foreignRows: [], todayMs: D0 - 30 * DAY_MS,
    },
  };
}

describe('planLevelingRun', () => {
  it('two equal tasks: the second is delayed, the preview has its dates before and after', () => {
    const { B, args } = fixture();
    const plan = planLevelingRun(args);
    expect(plan.direction).toBe('forward');
    expect(plan.conflictsBefore).toBe(3);
    expect(plan.conflictsAfter).toBe(0);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ task: B.rowGUID, name: 'B', delayBefore: 0, delayAfter: 3, posted: false, reason: 'idYield' });
    expect(dayIndex(plan.changes[0].startBeforeMs)).toBe(0);
    expect(dayIndex(plan.changes[0].startAfterMs)).toBe(3);
    expect(plan.after.projectFinishMs).toBeGreaterThan(plan.current.projectFinishMs);
    expect(plan.unresolved).toEqual([]);
    expect(needsPostedDecision(plan)).toBe(false);
  });

  it('starts from a clean plan: a delay stored earlier is cleared when the run does not need it', () => {
    const { A, B, args } = fixture({ delayA: 5 });
    const plan = planLevelingRun(args);
    const byTask = Object.fromEntries(plan.changes.map((c) => [c.task, c]));
    expect(byTask[A.rowGUID]).toMatchObject({ delayBefore: 5, delayAfter: 0 });
    expect(byTask[B.rowGUID]).toMatchObject({ delayBefore: 0, delayAfter: 3 });
    expect(plan.conflictsBefore).toBe(0); // with its stored delay A did not collide with B
  });

  it('does not clear the old delays when resourceLevelingClearBeforeLeveling is off (Manual)', () => {
    const { A, args } = fixture({ delayA: 5, project: { resourceLevelingClearBeforeLeveling: false } });
    const plan = planLevelingRun(args);
    expect(plan.changes.find((c) => c.task === A.rowGUID)).toBeUndefined();
    expect(plan.changes).toHaveLength(0);
  });

  it('Automatic always clears first', () => {
    const { A, args } = fixture({ delayA: 5, project: { resourceLevelingMode: 'automatic', resourceLevelingClearBeforeLeveling: false } });
    expect(planLevelingRun(args).changes.find((c) => c.task === A.rowGUID)).toMatchObject({ delayAfter: 0 });
  });

  it('Smoothing: the finish stays, so a conflict that needs more than the slack is reported', () => {
    const { args } = fixture({ project: { resourceLevelingWithinSlackOnly: true } });
    const plan = planLevelingRun(args);
    expect(plan.effective.method).toBe('smoothing');
    expect(plan.changes).toHaveLength(0);
    expect(plan.unresolved.length).toBeGreaterThan(0);
    expect(plan.unresolved[0].code).toBe('slackLimit');
    expect(plan.unresolved[0].taskNames.sort()).toEqual(['A', 'B']);
  });

  it('the foreign load of the other projects counts', () => {
    const { A, args } = fixture();
    const only = { ...args, tasks: [A], linesByTask: { [A.rowGUID]: args.linesByTask[A.rowGUID] }, foreignRows: [0, 1, 2].map((i) => ({ k: 'person', g: 'p1', d: iso(day(i)), h: 8 })) };
    const plan = planLevelingRun(only);
    expect(plan.changes[0]).toMatchObject({ task: A.rowGUID, delayAfter: 3, reason: 'foreignYield' });
  });

  it('successors move with the delayed task (the scheduler)', () => {
    const { A, B, args } = fixture({ extraA: { taskPriority: 900 } });
    const C = makeTask('C', 2);
    const plan = planLevelingRun({ ...args, tasks: [A, B, C], deps: [makeLink(B, C)], projectJSON: { ...PROJECT, ganttExtendedFunctionalityEnabled: true, ganttTaskPriorityEnabled: true, resourceLevelingOrder: 'priorityStandard' } });
    expect(plan.changes.map((c) => c.name)).toEqual(['B']);
    expect(plan.result.schedule.rows[C.rowGUID].startMs).toBe(plan.result.schedule.rows[B.rowGUID].finishMs);
  });
});

describe('posted tasks (documentation 7.7): the user is asked before they are moved', () => {
  it('both posted: the plan lists the posted task that must move and asks (action ask)', () => {
    const { B, args } = fixture({ posted: true });
    const plan = planLevelingRun(args);
    expect(plan.postedChanges.map((c) => c.task)).toEqual([B.rowGUID]);
    expect(needsPostedDecision(plan)).toBe(true);
  });

  it('"Keep their dates": the same run with the posted tasks frozen moves nothing and reports frozenPosted', () => {
    const { args } = fixture({ posted: true });
    const plan = planWithoutPosted(args);
    expect(plan.changes).toEqual([]);
    expect(plan.unresolved.every((c) => c.code === 'frozenPosted')).toBe(true);
  });

  it('movement switched off: posted tasks are frozen from the start and nothing is asked', () => {
    const { args } = fixture({ posted: true, project: { resourceLevelingPostedTasksMovementEnabled: false } });
    const plan = planLevelingRun(args);
    expect(plan.changes).toEqual([]);
    expect(needsPostedDecision(plan)).toBe(false);
  });

  it('a remembered action is not asked again', () => {
    const { args } = fixture({ posted: true, project: { resourceLevelingPostedTasksAction: 'moveAndPostAgain' } });
    const plan = planLevelingRun(args);
    expect(plan.postedChanges).toHaveLength(1);
    expect(needsPostedDecision(plan)).toBe(false);
  });

  it('a task with a posted fact input is never moved, and a started task neither', () => {
    const { A, B, args } = fixture();
    const plan = planLevelingRun({ ...args, factTasks: new Set([B.rowGUID]) });
    expect(plan.changes.map((c) => c.task)).toEqual([A.rowGUID]); // B is fixed: A yields
    (B as any).rowProgress = 10;
    const started = planLevelingRun({ ...args, tasks: [A, B] });
    expect(started.changes.map((c) => c.task)).toEqual([A.rowGUID]);
  });
});

describe('the payload of project_resource_leveling_apply', () => {
  it('carries the tasks with their dates, the counts, the options and the stamps', () => {
    const { B, args } = fixture();
    const plan = planLevelingRun(args);
    const p: any = applyPayloadOf(plan, { mode: 'manual', updatedAt: { [B.rowGUID]: '2026-10-01T00:00:00.000Z' } });
    expect(p).toMatchObject({ kind: 'level', mode: 'manual', method: 'leveling', keepHistory: true, conflictsBefore: 3, conflictsAfter: 0, unresolved: 0, tasksUnposted: 0 });
    expect(p.tasks).toHaveLength(1);
    expect(p.tasks[0]).toMatchObject({ task: B.rowGUID, delayBefore: 0, delayAfter: 3, wasPosted: false, reason: 'idYield', resourceKind: 'person', resourceGUID: 'p1', conflictDay: iso(day(0)), updatedAt: '2026-10-01T00:00:00.000Z' });
    expect(p.tasks[0].startAfter).toBe(new Date(day(3)).toISOString());
    expect(p.options).toMatchObject({ order: 'standard', grainUnit: 'hour', clearBefore: true, direction: 'forward' });
  });

  it('names the number of tasks that lose their posting when the user chose to unpost them', () => {
    const { args } = fixture({ posted: true });
    const plan = planLevelingRun(args);
    expect((applyPayloadOf(plan, { mode: 'manual', postedChoice: 'unpostAndMove' }) as any).tasksUnposted).toBe(1);
    expect((applyPayloadOf(plan, { mode: 'manual', postedChoice: 'moveAndPostAgain' }) as any).tasksUnposted).toBe(0);
  });
});

describe('the inputs of the database', () => {
  it('resourcesOfLines lists each resource of the Time lines once; other genus and lines without a resource are not in it', () => {
    const t = makeTask('A', 1);
    const lines = {
      [t.rowGUID]: [timeLine(t.rowGUID, 'p1', 8), timeLine(t.rowGUID, 'p1', 4), timeLine(t.rowGUID, 'w1', 4, { taskResourceKind: 'workCenter' }), { ...timeLine(t.rowGUID, 'm1', 1), rowParentGUID: 'materialGenus' }, timeLine(t.rowGUID, '', 3, { taskResourceItem: null })],
    } as any;
    expect(resourcesOfLines(lines)).toEqual([{ k: 'person', g: 'p1' }, { k: 'workCenter', g: 'w1' }]);
  });

  it('the horizon is the days the capacity is known for; a day without a row is unknown', () => {
    const { args } = fixture();
    const env = buildLevelingEnv({ tasks: args.tasks, deps: [], projectJSON: args.projectJSON, projectStartMs: D0, capacityRows: capacity('p1', 10), foreignRows: [] });
    expect(env.horizon).toEqual({ firstDayMs: day(0), lastDayMs: day(9) });
    expect(env.capacity('person:p1', day(0))).toBe(8);
    expect(env.capacity('person:p1', day(5))).toBe(0);
    expect(env.capacity('person:p1', day(40))).toBeUndefined();
    expect(env.capacity('person:other', day(0))).toBeUndefined();
  });
});
