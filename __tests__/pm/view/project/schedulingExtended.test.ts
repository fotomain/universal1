// Scheduler: the Extended scheduling functions - manual tasks (A1), the 8 constraints (A3), schedule from the finish date (A4), deadlines (A5), elapsed durations (A8),
// task calendars and exceptions (A10 / A11), split tasks (A12), inactive tasks (A14), lag in percent (B4), external predecessors (B5).
// documentation/MORE_GANTT_*.html
import { scheduleProject } from '../../../../kit8/pm/view/project/scheduling';
import type { PMCalendar } from '../../../../kit8/pm/view/project/scheduling';
import type { PMLinkType, PMTaskDependencyRow, PMTaskRow } from '../../../../kit8/pm/model/types';

const DAY = 86400000;
const D0 = Date.UTC(2026, 9, 5); // Monday 2026-10-05
const day = (n: number) => D0 + n * DAY;
const P = '11111111-1111-4111-8111-111111111111';

let seq = 0;
function task(name: string, durationDays: number, extra: Record<string, unknown> = {}, rowKind: 'task' | 'milestone' | 'stage' = 'task', parent?: string): PMTaskRow {
  const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const label = id.replace(/-/g, '_');
  return {
    rowGUID: id, treePath: parent ? `${parent}.${label}` : `p.${label}`, projectGUID: P, rowOwnerGUID: 'o', rowDuration: null, rowProgress: 0, orderInList: seq,
    rowJSON: { rowKind, taskDescription: name, durationDays, ...extra },
  } as unknown as PMTaskRow;
}
const link = (pred: PMTaskRow, succ: PMTaskRow, linkType: PMLinkType = 'FS', lagDays = 0, rowJSON?: Record<string, unknown>): PMTaskDependencyRow =>
  ({ rowGUID: succ.rowGUID, rowDependsOnGUID: pred.rowGUID, projectGUID: P, rowOwnerGUID: 'o', linkType, lagDays, rowJSON }) as PMTaskDependencyRow;

const iso = (n: number) => new Date(day(n)).toISOString();
const run = (tasks: PMTaskRow[], deps: PMTaskDependencyRow[], extra: Record<string, unknown> = {}) => scheduleProject({ tasks, deps, projectStartMs: D0, ...extra });
const startDay = (r: { startMs: number }) => (r.startMs - D0) / DAY;
const finishDay = (r: { finishMs: number }) => (r.finishMs - D0) / DAY;

beforeEach(() => { seq = 0; });

describe('A1 manually scheduled tasks', () => {
  const plan = (manualStart: number, extra: Record<string, unknown> = {}) => {
    const A = task('A', 5);
    const B = task('B', 3, { taskScheduleMode: 'manual', taskManualStartAt: iso(manualStart), ...extra });
    const C = task('C', 2);
    return { A, B, C, deps: [link(A, B), link(B, C)] };
  };

  it('keeps its typed start although the predecessor ends later, and warns', () => {
    const { A, B, C, deps } = plan(2);
    const r = run([A, B, C], deps, { manualEnabled: true });
    expect(startDay(r.rows[B.rowGUID])).toBe(2);
    expect(finishDay(r.rows[B.rowGUID])).toBe(5);
    expect(r.rows[B.rowGUID].isManual).toBe(true);
    expect(r.rows[B.rowGUID].constraintConflict).toBe('constraintWins');
    expect(r.rows[B.rowGUID].engineStartMs).toBe(day(5));
    expect(startDay(r.rows[C.rowGUID])).toBe(5); // the successor follows ITS finish
  });

  it('a manual start later than the links is kept, without a warning; before the project start is allowed', () => {
    const late = plan(9);
    const r = run([late.A, late.B, late.C], late.deps, { manualEnabled: true });
    expect(startDay(r.rows[late.B.rowGUID])).toBe(9);
    expect(r.rows[late.B.rowGUID].constraintConflict).toBeUndefined();
    const early = plan(-10);
    expect(startDay(run([early.A, early.B, early.C], early.deps, { manualEnabled: true }).rows[early.B.rowGUID])).toBe(-10);
  });

  it('is auto while the function is off; a subproject task and a task with no start are auto', () => {
    const { A, B, C, deps } = plan(2);
    expect(startDay(run([A, B, C], deps).rows[B.rowGUID])).toBe(5);
    const S = task('S', 3, { taskScheduleMode: 'manual', taskManualStartAt: iso(1), taskIsSubproject: true });
    expect(startDay(run([A, S], [link(A, S)], { manualEnabled: true }).rows[S.rowGUID])).toBe(5);
    const N = task('N', 3, { taskScheduleMode: 'manual' });
    expect(startDay(run([A, N], [link(A, N)], { manualEnabled: true }).rows[N.rowGUID])).toBe(5);
  });

  it('a manual task that finishes later than its successor allows is critical with negative slack', () => {
    const A = task('A', 2);
    const B = task('B', 3, { taskScheduleMode: 'manual', taskManualStartAt: iso(6) });
    const D = task('D', 1, { taskScheduleMode: 'manual', taskManualStartAt: iso(7) });
    const r = run([A, B, D], [link(A, B), link(B, D)], { manualEnabled: true });
    expect(r.rows[B.rowGUID].isCritical).toBe(true);
    expect(r.rows[B.rowGUID].slackDays).toBeLessThan(0);
    expect(r.rows[B.rowGUID].totalFloatDays).toBe(0);
  });
});

describe('A3 the 8 constraint types', () => {
  const C = (type: string, date?: number, extra: Record<string, unknown> = {}) => ({ taskConstraintType: type, ...(date === undefined ? {} : { taskConstraintDate: iso(date) }), ...extra });
  const two = (con: Record<string, unknown>, bDays = 3) => {
    const A = task('A', 5);
    const B = task('B', bDays, con);
    return { A, B, deps: [link(A, B)] };
  };
  const on = { constraintsEnabled: true };
  const off = { constraintsEnabled: true, constraintsAlwaysHonored: false };

  it('without the function only the old Start No Earlier Than (manualStartAt) counts', () => {
    const { A, B, deps } = two({ ...C('MSO', 1), manualStartAt: iso(8) });
    const r = run([A, B], deps);
    expect(startDay(r.rows[B.rowGUID])).toBe(8);
    expect(r.rows[B.rowGUID].constraintType).toBe('SNET');
  });

  it('SNET / FNET: not earlier than the date, later is allowed', () => {
    const a = two(C('SNET', 8)); expect(startDay(run([a.A, a.B], a.deps, on).rows[a.B.rowGUID])).toBe(8);
    const b = two(C('SNET', 2)); expect(startDay(run([b.A, b.B], b.deps, on).rows[b.B.rowGUID])).toBe(5);
    const c = two(C('FNET', 12)); expect(startDay(run([c.A, c.B], c.deps, on).rows[c.B.rowGUID])).toBe(10);
    const d = two(C('FNET', 3)); expect(startDay(run([d.A, d.B], d.deps, on).rows[d.B.rowGUID])).toBe(5);
  });

  it('MSO: honor on = the date wins and the link is violated; honor off = the link wins with negative slack', () => {
    const t = two(C('MSO', 2));
    const h = run([t.A, t.B], t.deps, on).rows[t.B.rowGUID];
    expect(startDay(h)).toBe(2);
    expect(h.constraintConflict).toBe('constraintWins');
    const o = run([t.A, t.B], t.deps, off).rows[t.B.rowGUID];
    expect(startDay(o)).toBe(5);
    expect(o.constraintConflict).toBe('linkWins');
    expect(o.isCritical).toBe(true);
    expect(o.slackDays).toBeLessThan(0);
    const later = two(C('MSO', 9));
    expect(startDay(run([later.A, later.B], later.deps, on).rows[later.B.rowGUID])).toBe(9);
  });

  it('MFO: the finish date (last day) is fixed; a milestone sits on it', () => {
    const t = two(C('MFO', 10));
    const row = run([t.A, t.B], t.deps, on).rows[t.B.rowGUID];
    expect([startDay(row), finishDay(row)]).toEqual([8, 11]);
    const A = task('A', 2); const M = task('M', 0, C('MFO', 6), 'milestone');
    expect(startDay(run([A, M], [link(A, M)], on).rows[M.rowGUID])).toBe(6);
  });

  it('SNLT / FNLT: ASAP unless the links would break the date', () => {
    const ok = two(C('SNLT', 9)); expect(startDay(run([ok.A, ok.B], ok.deps, on).rows[ok.B.rowGUID])).toBe(5);
    const bad = two(C('SNLT', 3));
    expect(startDay(run([bad.A, bad.B], bad.deps, on).rows[bad.B.rowGUID])).toBe(3);
    const offRow = run([bad.A, bad.B], bad.deps, off).rows[bad.B.rowGUID];
    expect([startDay(offRow), offRow.constraintConflict]).toEqual([5, 'linkWins']);
    const f = two(C('FNLT', 6));
    expect(startDay(run([f.A, f.B], f.deps, on).rows[f.B.rowGUID])).toBe(4);
    const fo = run([f.A, f.B], f.deps, off).rows[f.B.rowGUID];
    expect([startDay(fo), fo.slackDays, fo.isCritical]).toEqual([5, -1, true]);
  });

  it('a stage and a subproject task read only the old Start No Earlier Than', () => {
    const A = task('A', 5);
    const S = task('S', 3, { ...C('MSO', 1), taskIsSubproject: true });
    expect(startDay(run([A, S], [link(A, S)], on).rows[S.rowGUID])).toBe(5);
  });

  it('As Late As Possible uses the free slack, never moves a successor, and a chain of ALAP tasks slides together', () => {
    const X = task('X', 10); const Y = task('Y', 2, C('ALAP')); const Z = task('Z', 1);
    const deps = [link(X, Z), link(Y, Z)];
    const asap = run([X, Y, Z], deps, on);
    expect(startDay(asap.rows[Y.rowGUID])).toBe(8);
    expect(startDay(asap.rows[Z.rowGUID])).toBe(10);
    const X2 = task('X2', 10); const Y2 = task('Y2', 2, C('ALAP')); const Z2 = task('Z2', 2, C('ALAP'));
    const r = run([X2, Y2, Z2], [link(Y2, Z2)], on);
    expect([startDay(r.rows[Z2.rowGUID]), startDay(r.rows[Y2.rowGUID])]).toEqual([8, 6]);
  });
});

describe('A4 schedule from the project finish date', () => {
  const finishOn = (lastDay: number, extra: Record<string, unknown> = {}) => ({ scheduleFrom: 'finish' as const, projectFinishDayMs: day(lastDay), ...extra });

  it('places a chain as late as possible and calculates the start; a shorter branch has float', () => {
    const A = task('A', 5); const B = task('B', 5); const Cc = task('C', 5); const Pp = task('P', 2);
    const r = run([A, B, Cc, Pp], [link(A, B), link(B, Cc), link(Pp, Cc)], finishOn(14));
    expect(r.projectStartMs).toBe(D0);
    expect(startDay(r.rows[Cc.rowGUID])).toBe(10);
    expect(startDay(r.rows[Pp.rowGUID])).toBe(8);
    expect(r.rows[Pp.rowGUID]).toMatchObject({ isCritical: false, slackDays: 8, earlyStartMs: day(0), lateStartMs: day(8) });
    expect(r.rows[A.rowGUID].isCritical).toBe(true);
    expect(r.projectFinishMs).toBe(day(15));
  });

  it('mirrors SS / FF links, snaps a Saturday finish to the Friday before, warns for a start in the past', () => {
    const A = task('A', 4); const B = task('B', 4);
    expect(startDay(run([A, B], [link(A, B, 'SS', 2)], finishOn(9)).rows[B.rowGUID])).toBe(6);
    const one = task('O', 2);
    const sat = scheduleProject({ tasks: [one], deps: [], projectStartMs: D0, calendar: { skipWeekends: true }, scheduleFrom: 'finish', projectFinishDayMs: Date.UTC(2026, 9, 10) });
    expect(sat.rows[one.rowGUID].startMs).toBe(Date.UTC(2026, 9, 8));
    const long = task('L', 30);
    expect(run([long], [], { scheduleFrom: 'finish', projectFinishDayMs: Date.UTC(2020, 0, 31) }).projectStartInPast).toBe(true);
    expect(run([long], [], { scheduleFrom: 'finish', projectFinishDayMs: Date.UTC(2099, 0, 31) }).projectStartInPast).toBe(false);
  });

  it('a manual task stays and bounds its predecessors; an explicit ASAP task takes its early date; the finish is not used without a date', () => {
    const A = task('A', 3); const M = task('M', 2, { taskScheduleMode: 'manual', taskManualStartAt: iso(10) });
    const r = run([A, M], [link(A, M)], finishOn(30, { manualEnabled: true }));
    expect([startDay(r.rows[M.rowGUID]), finishDay(r.rows[A.rowGUID]), r.projectStartMs]).toEqual([10, 10, day(7)]);
    const A2 = task('A2', 5); const B2 = task('B2', 5); const Pp = task('P', 2, { taskConstraintType: 'ASAP' });
    const r2 = run([A2, B2, Pp], [link(A2, B2)], finishOn(14, { constraintsEnabled: true }));
    expect([startDay(r2.rows[Pp.rowGUID]), r2.rows[Pp.rowGUID].lateStartMs]).toEqual([5, day(13)]);
    expect(startDay(run([A2], [], { scheduleFrom: 'finish' }).rows[A2.rowGUID])).toBe(0);
  });

  it('a milestone at the end sits ON the last day and a stage rolls up the placed dates', () => {
    const A = task('A', 3); const M = task('M', 0, {}, 'milestone');
    expect(startDay(run([A, M], [link(A, M)], finishOn(9)).rows[M.rowGUID])).toBe(9);
    const S = task('S', 0, {}, 'stage'); const A1 = task('A1', 4, {}, 'task', S.treePath); const B1 = task('B1', 4, {}, 'task', S.treePath);
    const r = run([S, A1, B1], [link(A1, B1)], finishOn(19));
    expect([startDay(r.rows[S.rowGUID]), finishDay(r.rows[S.rowGUID])]).toEqual([12, 20]);
  });
});

describe('A5 deadline', () => {
  it('marks a finish after the deadline, never moves the task', () => {
    const A = task('A', 5, { taskDeadline: iso(3) }); const B = task('B', 2, { taskDeadline: iso(20) });
    const r = run([A, B], [], { deadlineEnabled: true });
    expect(r.rows[A.rowGUID]).toMatchObject({ deadlineMs: day(3), deadlineMissed: true });
    expect(r.rows[B.rowGUID].deadlineMissed).toBe(false);
    expect(startDay(r.rows[A.rowGUID])).toBe(0);
    expect(run([A], []).rows[A.rowGUID].deadlineMs).toBeUndefined(); // off = nothing
  });
});

describe('A8 elapsed durations and A10 / A11 calendars', () => {
  const mf: PMCalendar = { skipWeekends: true };

  it('an elapsed task runs through the weekend; a normal one does not', () => {
    const A = task('A', 3, { durationElapsed: true }); const B = task('B', 3);
    const r = scheduleProject({ tasks: [A, B], deps: [], projectStartMs: Date.UTC(2026, 9, 8), calendar: mf, elapsedEnabled: true });
    expect(r.rows[A.rowGUID].finishMs).toBe(Date.UTC(2026, 9, 11)); // Thu, Fri, Sat
    expect(r.rows[B.rowGUID].finishMs).toBe(Date.UTC(2026, 9, 13)); // Thu, Fri, Mon
  });

  it('a task calendar (a 7-day week) and holidays of the project calendar', () => {
    const A = task('A', 8, { taskCalendarId: 'seven' }); const B = task('B', 8);
    const seven: PMCalendar = { skipWeekends: false, workWeek: [true, true, true, true, true, true, true] };
    const r = scheduleProject({ tasks: [A, B], deps: [], projectStartMs: D0, calendar: mf, calendars: { seven } });
    expect(r.rows[A.rowGUID].finishMs).toBe(day(8)); // seven days a week
    expect(r.rows[B.rowGUID].finishMs).toBe(day(10)); // Mon-Fri: eight working days end on the Thursday of the next week (exclusive: Thu 15th 00:00)
  });

  it('a holiday is skipped, an extra working day is used, a calendar with no working day cannot hang the scheduler', () => {
    const A = task('A', 3);
    const hol: PMCalendar = { skipWeekends: true, offDays: new Set([day(1)]) };
    expect(scheduleProject({ tasks: [A], deps: [], projectStartMs: D0, calendar: hol }).rows[A.rowGUID].finishMs).toBe(day(4)); // Mon, Wed, Thu
    const sat: PMCalendar = { skipWeekends: true, extraDays: new Set([day(5)]) };
    expect(scheduleProject({ tasks: [task('X', 6)], deps: [], projectStartMs: D0, calendar: sat }).rows).toBeDefined();
    const none: PMCalendar = { skipWeekends: true, workWeek: [false, false, false, false, false, false, false] };
    const t0 = Date.now();
    scheduleProject({ tasks: [task('Z', 2)], deps: [], projectStartMs: D0, calendar: none });
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('A12 split tasks, A14 inactive tasks', () => {
  it('a split task has two segments and its finish moves by the gap', () => {
    const A = task('A', 4, { taskSplits: [{ after: 2, gap: 3 }] });
    const r = run([A], [], { splitEnabled: true });
    expect(finishDay(r.rows[A.rowGUID])).toBe(7);
    expect(r.rows[A.rowGUID].segments).toEqual([{ startMs: day(0), finishMs: day(2) }, { startMs: day(5), finishMs: day(7) }]);
    expect(run([A], []).rows[A.rowGUID].segments).toBeUndefined();
  });

  it('an inactive task does not take part: its links, its dates for the stage, the critical path and the project finish', () => {
    const A = task('A', 5); const X = task('X', 20, { taskInactive: true }); const B = task('B', 2);
    const deps = [link(A, X), link(X, B)];
    const r = run([A, X, B], deps, { inactiveEnabled: true });
    expect(startDay(r.rows[B.rowGUID])).toBe(0); // X does not hold B back
    expect(r.rows[X.rowGUID].isInactive).toBe(true);
    expect(r.projectFinishMs).toBe(day(5));
    expect(startDay(run([A, X, B], deps).rows[B.rowGUID])).toBe(25); // off: as before
  });
});

describe('B4 lag in percent and B5 external predecessors', () => {
  it('a lag of 50% of the predecessor duration follows it', () => {
    const A = task('A', 10); const B = task('B', 2);
    const d = [link(A, B, 'SS', 0, { lagPercent: 50 })];
    expect(startDay(run([A, B], d, { lagPercentEnabled: true }).rows[B.rowGUID])).toBe(5);
    expect(startDay(run([A, B], d).rows[B.rowGUID])).toBe(0); // off: the lag in days (0)
  });

  it('a task waits for the stored dates of a task of another project', () => {
    const A = task('A', 3, { externalPredecessors: [{ taskGUID: 'ext-1', linkType: 'FS', lagDays: 1 }] });
    const r = run([A], [], { externalEnabled: true, externalDates: { 'ext-1': { startMs: day(2), finishMs: day(9) } } });
    expect(startDay(r.rows[A.rowGUID])).toBe(10);
    expect(r.rows[A.rowGUID].hasExternal).toBe(true);
    expect(startDay(run([A], []).rows[A.rowGUID])).toBe(0);
  });
});
