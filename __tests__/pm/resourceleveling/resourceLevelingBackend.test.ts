// Where a run is calculated (resourceLevelingBackend.ts): Client side computations = this device; Server side computations = the database proposes, this device checks, and a plan the database
// cannot calculate (or a database without PART 42) is calculated here AND the outcome says so. The call to the database is injected, so no database is needed.
import { calculateLevelingPlan } from '../../../kit8/pm/resourceleveling/resourceLevelingBackend';
import { ServerPlanError, type ServerPlanAnswer } from '../../../kit8/pm/resourceleveling/resourceLevelingApi';
import type { ServerProblem } from '../../../kit8/pm/resourceleveling/resourceLevelingServerProblem';
import { planLevelingRun } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { outcomeText } from '../../../kit8/pm/resourceleveling/resourceLevelingComputation';
import { DAY_MS } from '../../../kit8/pm/model/constants';
import { D0, day, makeLink, makeTask, resetSeq, timeLine } from './levelingTestKit';

beforeEach(() => resetSeq());

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const capacity = (g = 'p1', days = 120) => Array.from({ length: days }, (_, i) => ({ k: 'person', g, d: iso(day(i)), h: [0, 6].includes(new Date(day(i)).getUTCDay()) ? 0 : 8 }));
const SERVER = 'resourceLevelingServerSideComputations';
const CLIENT = 'resourceLevelingClientSideComputations';

function fixture(project: Record<string, unknown> = {}, extraA: Record<string, unknown> = {}) {
  const A = makeTask('A', 3, extraA);
  const B = makeTask('B', 3);
  const line = (t: typeof A) => timeLine(t.rowGUID, 'p1', 24);
  return {
    A, B,
    args: {
      tasks: [A, B], deps: [], projectJSON: { resourceLevelingFunctionalityEnabled: true, skipWeekends: true, resourceLevelingComputationSide: SERVER, ...project }, projectStartMs: D0,
      linesByTask: { [A.rowGUID]: [line(A)], [B.rowGUID]: [line(B)] } as any,
      capacityRows: capacity(), foreignRows: [], todayMs: D0 - 30 * DAY_MS,
    },
  };
}

const answer = (delays: Record<string, number>): ServerPlanAnswer => ({ supported: true, delays, moves: [], unresolved: [], passes: 1, conflictsBefore: 3, conflictsAfter: 0, finish: '2026-10-13' });

describe('calculateLevelingPlan', () => {
  it('Client side computations: the plan of this device, the database is not called', async () => {
    const { B, args } = fixture({ resourceLevelingComputationSide: CLIENT });
    const fetchPlan = jest.fn();
    const { plan, outcome } = await calculateLevelingPlan(args, fetchPlan);
    expect(fetchPlan).not.toHaveBeenCalled();
    expect(outcome).toEqual({ asked: CLIENT, used: 'client' });
    expect(plan.changes.map((c) => [c.task, c.delayAfter])).toEqual([[B.rowGUID, 3]]);
  });

  it('Server side computations: the database gets the problem, its proposal is checked and shown; nothing had to be adjusted', async () => {
    const { A, B, args } = fixture();
    const fetchPlan = jest.fn(async (_p: ServerProblem) => answer({ [B.rowGUID]: 3 }));
    const { plan, outcome } = await calculateLevelingPlan(args, fetchPlan);
    expect(fetchPlan).toHaveBeenCalledTimes(1);
    const problem = fetchPlan.mock.calls[0][0];
    expect(problem).toMatchObject({ v: 1, method: 'leveling', order: 'standard', period: 'day', direction: 'forward', skipWeekends: true, delays: {}, cons: [] });
    expect(problem.leaves.map((l) => [l.g, l.d, l.l])).toEqual([[A.rowGUID, 3, [['person:p1', 24]]], [B.rowGUID, 3, [['person:p1', 24]]]]);
    expect(outcome).toEqual({ asked: SERVER, used: 'server', adjusted: 0 });
    // the same plan as the one of this device
    const client = planLevelingRun({ ...args, projectJSON: { ...args.projectJSON, resourceLevelingComputationSide: CLIENT } });
    expect(plan.changes.map((c) => [c.task, c.delayBefore, c.delayAfter])).toEqual(client.changes.map((c) => [c.task, c.delayBefore, c.delayAfter]));
    expect(plan.conflictsAfter).toBe(0);
  });

  it('a wrong proposal of the database is not trusted: this device continues from it and counts what it changed', async () => {
    const { B, args } = fixture();
    const { plan, outcome } = await calculateLevelingPlan(args, async () => answer({}));
    expect(outcome).toMatchObject({ used: 'server', adjusted: 1 });
    expect(plan.conflictsAfter).toBe(0);
    expect(plan.changes.find((c) => c.task === B.rowGUID)?.delayAfter).toBe(3);
    expect(outcomeText(outcome)).toContain('1');
  });

  it('a plan the database does not calculate is calculated here and the outcome says why (no call)', async () => {
    const { B, args } = fixture({}, { manualStartAt: iso(day(10)) }); // a constraint (Start No Earlier Than)
    const fetchPlan = jest.fn();
    const { plan, outcome } = await calculateLevelingPlan(args, fetchPlan);
    expect(fetchPlan).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ asked: SERVER, used: 'client', fallback: 'planNotSupported', reasons: ['constraint'] });
    expect(outcomeText(outcome)).toMatch(/constraint/);
    expect(plan.conflictsAfter).toBe(0);
    expect(plan.changes.some((c) => c.task === B.rowGUID)).toBe(false); // A starts on day 10 now, B has the free days
  });

  it('the database says it does not take the plan: calculated here, with its reasons', async () => {
    const { args } = fixture();
    const { outcome, plan } = await calculateLevelingPlan(args, async () => ({ supported: false, reasons: ['timeout'] }));
    expect(outcome).toEqual({ asked: SERVER, used: 'client', fallback: 'planNotSupported', reasons: ['timeout'] });
    expect(outcomeText(outcome)).toMatch(/time/);
    expect(plan.conflictsAfter).toBe(0);
  });

  it('a database without PART 42 (function not found): calculated here, the outcome says to run the SQL', async () => {
    const { args } = fixture();
    const { outcome, plan } = await calculateLevelingPlan(args, async () => { throw new ServerPlanError('x', 'PGRST202'); });
    expect(outcome).toEqual({ asked: SERVER, used: 'client', fallback: 'serverUnavailable' });
    expect(outcomeText(outcome)).toContain('start2_sql_code.sql');
    expect(plan.conflictsAfter).toBe(0);
  });

  it('any other failure of the call: calculated here, serverError', async () => {
    const { args } = fixture();
    const { outcome } = await calculateLevelingPlan(args, async () => { throw new ServerPlanError('boom', '57014'); });
    expect(outcome).toEqual({ asked: SERVER, used: 'client', fallback: 'serverError' });
  });

  it('a loop of links is not sent to the database (the plan of the screen reports it)', async () => {
    const { A, B, args } = fixture();
    const fetchPlan = jest.fn();
    const { outcome } = await calculateLevelingPlan({ ...args, deps: [makeLink(A, B), makeLink(B, A)] }, fetchPlan);
    expect(fetchPlan).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ used: 'client', fallback: 'planNotSupported' });
    expect(outcome.reasons).toContain('cycle');
  });

  it('the master switch off: nothing is asked of the database even when the side is set', async () => {
    const { args } = fixture({ resourceLevelingFunctionalityEnabled: false });
    const fetchPlan = jest.fn();
    const { outcome } = await calculateLevelingPlan(args, fetchPlan);
    expect(fetchPlan).not.toHaveBeenCalled();
    expect(outcome).toEqual({ asked: CLIENT, used: 'client' });
  });
});
