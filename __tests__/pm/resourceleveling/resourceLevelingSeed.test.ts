// The run continues from a proposal (Server side computations): seed delays, and the engine that compares with the delays the run STARTED from (baselineDelays) and knows why a task is not placed (failureHints).
import { planLevelingRun } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { levelResources } from '../../../kit8/pm/resourceleveling/resourceLevelingEngine';
import { DAY_MS } from '../../../kit8/pm/model/constants';
import { D0, OPT, day, dayIndex, makeEnv, makeTask, resetSeq, taskInput, timeLine } from './levelingTestKit';

beforeEach(() => resetSeq());

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const capacity = (days = 120) => Array.from({ length: days }, (_, i) => ({ k: 'person', g: 'p1', d: iso(day(i)), h: [0, 6].includes(new Date(day(i)).getUTCDay()) ? 0 : 8 }));

function run() {
  const A = makeTask('A', 3);
  const B = makeTask('B', 3);
  const line = (t: typeof A) => timeLine(t.rowGUID, 'p1', 24);
  const args = {
    tasks: [A, B], deps: [], projectJSON: { resourceLevelingFunctionalityEnabled: true, skipWeekends: true }, projectStartMs: D0,
    linesByTask: { [A.rowGUID]: [line(A)], [B.rowGUID]: [line(B)] } as any,
    capacityRows: capacity(), foreignRows: [], todayMs: D0 - 30 * DAY_MS,
  };
  return { A, B, args };
}

describe('planLevelingRun with a seed', () => {
  it('the right proposal stays as it is: the same plan as without a seed', () => {
    const { B, args } = run();
    const plain = planLevelingRun(args);
    const seeded = planLevelingRun({ ...args, seed: { delays: { [B.rowGUID]: 3 } } });
    expect(seeded.changes.map((c) => [c.task, c.delayBefore, c.delayAfter])).toEqual(plain.changes.map((c) => [c.task, c.delayBefore, c.delayAfter]));
    expect(seeded.conflictsBefore).toBe(plain.conflictsBefore);
    expect(seeded.conflictsAfter).toBe(0);
  });

  it('an empty proposal is completed here: the conflict of the plan is solved', () => {
    const { B, args } = run();
    const plan = planLevelingRun({ ...args, seed: { delays: {} } });
    expect(plan.conflictsBefore).toBe(3); // counted on the plan the run started from, not on the proposal
    expect(plan.conflictsAfter).toBe(0);
    expect(plan.changes.map((c) => [c.task, c.delayAfter])).toEqual([[B.rowGUID, 3]]);
  });

  it('a proposal that is too generous is not trusted blindly either (the delays are those of the checked plan)', () => {
    const { B, args } = run();
    const plan = planLevelingRun({ ...args, seed: { delays: { [B.rowGUID]: 3 } } });
    expect(dayIndex(plan.changes[0].startBeforeMs)).toBe(0); // before = the plan the user has now
    expect(dayIndex(plan.changes[0].startAfterMs)).toBe(3);
  });
});

describe('levelResources: baselineDelays and failureHints', () => {
  const build = () => {
    const A = makeTask('A', 3);
    const B = makeTask('B', 3);
    const inputs = [taskInput(A, [timeLine(A.rowGUID, 'p1', 24)]), taskInput(B, [timeLine(B.rowGUID, 'p1', 24)])];
    return { A, B, inputs, env: makeEnv({ tasks: [A, B] }) };
  };

  it('without baselineDelays the plan the run started from is the one of the start delays (as before)', () => {
    const { B, inputs, env } = build();
    const r = levelResources(inputs, env, OPT);
    expect(r.delays).toEqual({ [B.rowGUID]: 3 });
    expect(r.before.length).toBe(3);
    expect(r.unresolved).toEqual([]);
  });

  it('with baselineDelays the conflicts before are those of THAT plan; a seed that already solves the conflict is kept (the reasons of its moves come from the database)', () => {
    const { B, inputs, env } = build();
    const r = levelResources(inputs, env, { ...OPT, startDelays: { [B.rowGUID]: 3 }, baselineDelays: {} });
    expect(r.before.length).toBe(3); // the plan with no delay
    expect(r.unresolved).toEqual([]);
    expect(r.delays).toEqual({ [B.rowGUID]: 3 });
    expect(r.moves).toEqual([]); // no pass had anything to move
    expect(r.schedule.projectFinishMs).toBeGreaterThan(r.baseline.projectFinishMs);
  });

  it('with baselineDelays and a seed that solves nothing the passes move the task and the move is counted from the baseline', () => {
    const { B, inputs, env } = build();
    const r = levelResources(inputs, env, { ...OPT, startDelays: {}, baselineDelays: {} });
    expect(r.delays).toEqual({ [B.rowGUID]: 3 });
    expect(r.moves.map((m) => [m.task, m.delayBefore, m.delayAfter])).toEqual([[B.rowGUID, 0, 3]]);
  });

  it('without baselineDelays the start delays ARE the plan before: nothing to move when they already solve it', () => {
    const { B, inputs, env } = build();
    const r = levelResources(inputs, env, { ...OPT, startDelays: { [B.rowGUID]: 3 } });
    expect(r.before).toEqual([]);
    expect(r.moves).toEqual([]);
  });
});
