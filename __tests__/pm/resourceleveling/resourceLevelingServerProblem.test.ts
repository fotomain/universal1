// The plan on the screen as the problem of the database (resourceLevelingServerProblem.ts): what is sent, and every reason why a plan is NOT sent.
import { prepareLevelingRun } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { dateRangeOf, serverProblemOf, SERVER_LIMITS } from '../../../kit8/pm/resourceleveling/resourceLevelingServerProblem';
import { DAY_MS } from '../../../kit8/pm/model/constants';
import { D0, day, makeLink, makeTask, resetSeq, timeLine } from './levelingTestKit';

beforeEach(() => resetSeq());

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const capacity = (days = 60) => Array.from({ length: days }, (_, i) => ({ k: 'person', g: 'p1', d: iso(day(i)), h: [0, 6].includes(new Date(day(i)).getUTCDay()) ? 0 : 8 }));

function build(tasks: any[], deps: any[] = [], project: Record<string, unknown> = {}) {
  const linesByTask: Record<string, any[]> = {};
  for (const t of tasks) if (t.rowJSON.rowKind !== 'stage') linesByTask[t.rowGUID] = [timeLine(t.rowGUID, 'p1', 8)];
  const args: any = {
    tasks, deps, projectJSON: { resourceLevelingFunctionalityEnabled: true, skipWeekends: true, ...project }, projectStartMs: D0,
    linesByTask, capacityRows: capacity(), foreignRows: [], todayMs: D0 - 30 * DAY_MS,
  };
  return serverProblemOf(args, prepareLevelingRun(args));
}

describe('serverProblemOf', () => {
  it('a plain plan: the leaves in topological order with their hours, the links with their lag, the range of the capacity rows', () => {
    const A = makeTask('A', 2);
    const B = makeTask('B', 3);
    const r = build([B, A], [makeLink(A, B, 'SS', 2)]);
    expect(r.reasons).toEqual([]);
    const p = r.problem!;
    expect(p).toMatchObject({ v: 1, direction: 'forward', skipWeekends: true, projectStart: '2026-10-05', from: '2026-10-05', to: iso(day(59)), delays: {}, members: {} });
    expect(p.leaves.map((l) => l.g)).toEqual([A.rowGUID, B.rowGUID]); // the predecessor first
    expect(p.leaves[0]).toMatchObject({ d: 2, z: null, p: 500, l: [['person:p1', 8]] });
    expect(p.cons).toEqual([[B.rowGUID, A.rowGUID, 'SS', 2]]);
  });

  it('the row number is the position in the list of the tasks, not in the topological order', () => {
    const A = makeTask('A', 2);
    const B = makeTask('B', 3);
    const p = build([B, A], [makeLink(A, B)]).problem!;
    expect(Object.fromEntries(p.leaves.map((l) => [l.g, l.o]))).toEqual({ [B.rowGUID]: 0, [A.rowGUID]: 1 });
  });

  it('a stage as predecessor: the database gets the leaves under it (members)', () => {
    const S = makeTask('S', 0, {}, 'stage');
    const X = makeTask('X', 2, {}, 'task', S.treePath);
    const Y = makeTask('Y', 1, {}, 'task', S.treePath);
    const Z = makeTask('Z', 1);
    const p = build([S, X, Y, Z], [makeLink(S, Z)]).problem!;
    expect(p.cons).toEqual([[Z.rowGUID, S.rowGUID, 'FS', 0]]);
    expect([...p.members[S.rowGUID]].sort()).toEqual([X.rowGUID, Y.rowGUID].sort());
    expect(p.leaves.map((l) => l.g)).not.toContain(S.rowGUID);
  });

  it('the delays the run starts from (not 0, not on a stage) are part of the problem', () => {
    const A = makeTask('A', 2, { taskLevelingDelayDays: 4 });
    const B = makeTask('B', 2);
    const r = build([A, B], [], { resourceLevelingClearBeforeLeveling: false });
    expect(r.problem!.delays).toEqual({ [A.rowGUID]: 4 });
  });

  it('every day is a working day: skipWeekends false is sent as it is', () => {
    expect(build([makeTask('A', 2)], [], { skipWeekends: false }).problem!.skipWeekends).toBe(false);
  });

  it('a constraint, a subproject task, a loop of links: no problem, the reasons', () => {
    const A = makeTask('A', 2, { manualStartAt: iso(day(7)) });
    expect(build([A, makeTask('B', 1)])).toMatchObject({ problem: null, reasons: ['constraint'] });
    expect(build([makeTask('S', 2, { taskIsSubproject: true })])).toMatchObject({ problem: null, reasons: ['subproject'] });
    const C = makeTask('C', 1);
    const D = makeTask('D', 1);
    const r = build([C, D], [makeLink(C, D), makeLink(D, C)]);
    expect(r.problem).toBeNull();
    expect(r.reasons).toContain('cycle');
  });

  it('all the reasons come together, each once', () => {
    const r = build([makeTask('A', 2, { manualStartAt: iso(day(7)) }), makeTask('B', 2, { manualStartAt: iso(day(8)) }), makeTask('S', 2, { taskIsSubproject: true })]);
    expect([...r.reasons].sort()).toEqual(['constraint', 'subproject']);
  });

  it('the limits are those of the function of the database', () => {
    expect(SERVER_LIMITS).toEqual({ leaves: 3000, cons: 20000 });
  });
});

describe('dateRangeOf', () => {
  it('first and last day of the rows; without rows the day of the fallback', () => {
    expect(dateRangeOf([{ k: 'person', g: 'p', d: '2026-10-07', h: 8 }, { k: 'person', g: 'p', d: '2026-10-05T00:00:00Z', h: 8 }, { k: 'person', g: 'p', d: '2026-12-31', h: 0 }] as any, D0)).toEqual({ from: '2026-10-05', to: '2026-12-31' });
    expect(dateRangeOf([], D0)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });
});
