// Hour leveling (documentation/RESOURCE_LEVELING_HOURS_WBS.html 4.6): the real engine on the virtual step axis, through planLevelingRun with `hour`.
import { DAY_MS } from '../../../kit8/pm/model/constants';
import { buildHourAxis, MINUTE_MS } from '../../../kit8/pm/hourmodel/hourAxis';
import { applyPayloadOf, planLevelingRun } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { D0, makeLink, makeTask, resetSeq, timeLine, WEEKDAYS } from '../resourceleveling/levelingTestKit';

beforeEach(() => resetSeq());

const WINDOWS = [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }];
const at = (dayOffset: number, h: number, m = 0) => D0 + dayOffset * DAY_MS + (h * 60 + m) * MINUTE_MS;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const axis = () => buildHourAxis({ windows: WINDOWS, calendar: WEEKDAYS, originMs: D0 });
const PROJECT = { resourceLevelingFunctionalityEnabled: true, resourceOptimizationMode: 'hourByHourModel', skipWeekends: true };
/** the person works 09-13 and 14-18 on weekdays, 40 days; the day after is unknown (no row) */
const capacityRows = (g = 'p1', days = 40) => Array.from({ length: days }, (_, i) => {
  const dow = new Date(D0 + i * DAY_MS).getUTCDay();
  return { k: 'person', g, d: iso(D0 + i * DAY_MS), w: (dow === 0 || dow === 6 ? [] : [[540, 780], [840, 1080]]) as [number, number][] };
});

function args(tasks: any[], lines: Record<string, any[]>, step = 15, extra: Record<string, unknown> = {}, foreignRows: any[] = []) {
  return {
    tasks, deps: [], projectJSON: { ...PROJECT, ...extra }, projectStartMs: D0, linesByTask: lines, capacityRows: [], foreignRows: [], todayMs: D0 - 30 * DAY_MS,
    hour: { axis: axis(), step, capacityRows: capacityRows(), foreignRows },
  } as any;
}

describe('hour leveling', () => {
  it('two 4-hour tasks that book one person at once: the second moves to the afternoon window (acceptance A5 / A6)', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240 });
    const B = makeTask('B', 1, { taskDurationMinutes: 240 });
    const plan = planLevelingRun(args([A, B], { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] }));
    expect(plan.delayUnit).toBe('minutes');
    expect(plan.stepMinutes).toBe(15);
    expect(plan.conflictsBefore).toBeGreaterThan(0);
    expect(plan.conflictsAfter).toBe(0);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ task: B.rowGUID, delayBefore: 0, delayAfter: 240 }); // minutes: the afternoon window starts 240 working minutes later
    expect(plan.changes[0].startBeforeMs).toBe(at(0, 9));
    expect(plan.changes[0].startAfterMs).toBe(at(0, 14));
    expect(plan.changes[0].finishAfterMs).toBe(at(0, 18));
  });

  it('a second run on the result changes nothing (idempotent)', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240 });
    const B = makeTask('B', 1, { taskDurationMinutes: 240 });
    const lines = { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] };
    const first = planLevelingRun(args([A, B], lines));
    const B2 = { ...B, rowJSON: { ...B.rowJSON, taskLevelingDelayMinutes: first.changes[0].delayAfter } };
    const again = planLevelingRun(args([A, B2], lines, 15, { resourceLevelingClearBeforeLeveling: false }));
    expect(again.changes).toEqual([]);
    expect(again.conflictsBefore).toBe(0);
  });

  it('overlapping by a few minutes is a conflict, touching is not; the move is by whole steps of the step setting', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 45, taskStartMinute: 10 * 60 });          // 10:00-10:45
    const B = makeTask('B', 1, { taskDurationMinutes: 45, taskStartMinute: 10 * 60 + 30 });     // 10:30-11:15: overlap 10:30-10:45
    const C = makeTask('C', 1, { taskDurationMinutes: 45, taskStartMinute: 10 * 60 + 45 });     // 10:45-11:30 touches A
    const lines = (t: any) => ({ [t.rowGUID]: [timeLine(t.rowGUID, 'p1', 0.75)] });
    const touching = planLevelingRun(args([A, C], { ...lines(A), ...lines(C) }, 15));
    expect(touching.conflictsBefore).toBe(0);
    const overlap = planLevelingRun(args([A, B], { ...lines(A), ...lines(B) }, 15));
    expect(overlap.conflictsBefore).toBeGreaterThan(0);
    expect(overlap.conflictsAfter).toBe(0);
    expect(overlap.changes).toHaveLength(1);
    expect(overlap.changes[0].delayAfter % 15).toBe(0);
    expect(overlap.changes[0].startAfterMs).toBeGreaterThanOrEqual(at(0, 10, 45));
  });

  it('a break is not capacity: a task that would run into the lunch break pauses, the load is on the working slots only', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 120, taskStartMinute: 12 * 60 });  // 12:00-13:00 + 14:00-15:00
    const B = makeTask('B', 1, { taskDurationMinutes: 60, taskStartMinute: 13 * 60 });    // 13:00 is the break: starts 14:00 -> overlaps A at 14:00-15:00
    const plan = planLevelingRun(args([A, B], { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 2)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 1)] }));
    expect(plan.conflictsBefore).toBeGreaterThan(0);
    expect(plan.conflictsAfter).toBe(0);
    expect(plan.changes[0].startAfterMs).toBeGreaterThanOrEqual(at(0, 15));
  });

  it('the other projects hold the afternoon: the task goes to the next free slot', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240 });
    const foreign = [{ k: 'person', g: 'p1', s: new Date(at(0, 9)).toISOString(), e: new Date(at(0, 13)).toISOString(), h: 4 }];
    const plan = planLevelingRun(args([A], { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)] }, 15, {}, foreign));
    expect(plan.conflictsBefore).toBeGreaterThan(0);
    expect(plan.changes[0].startAfterMs).toBe(at(0, 14));
  });

  it('Smoothing never moves the project finish; Leveling does', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240 });
    const B = makeTask('B', 1, { taskDurationMinutes: 240 });
    const L = { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] };
    const smooth = planLevelingRun(args([A, B], L, 15, { resourceLevelingWithinSlackOnly: true }));
    expect(smooth.after.projectFinishMs).toBeLessThanOrEqual(smooth.current.projectFinishMs);
    const level = planLevelingRun(args([A, B], L));
    expect(level.after.projectFinishMs).toBeGreaterThan(level.current.projectFinishMs);
  });

  it('the payload carries the delays in minutes and the step', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240 });
    const B = makeTask('B', 1, { taskDurationMinutes: 240 });
    const plan = planLevelingRun(args([A, B], { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] }));
    const payload: any = applyPayloadOf(plan, { mode: 'manual' });
    expect(payload.options).toMatchObject({ delayUnit: 'minutes', stepMinutes: 15 });
    expect(payload.tasks[0]).toMatchObject({ task: B.rowGUID, delayAfter: 240 });
    expect(payload.tasks[0].startAfter).toBe(new Date(at(0, 14)).toISOString());
  });

  it('with a link: the successor of the moved task follows it', () => {
    const A = makeTask('A', 1, { taskDurationMinutes: 240 });
    const B = makeTask('B', 1, { taskDurationMinutes: 240 });
    const C = makeTask('C', 1, { taskDurationMinutes: 60 });
    const input = { ...args([A, B, C], { [A.rowGUID]: [timeLine(A.rowGUID, 'p1', 4)], [B.rowGUID]: [timeLine(B.rowGUID, 'p1', 4)] }), deps: [makeLink(B, C)] };
    const plan = planLevelingRun(input);
    expect(plan.conflictsAfter).toBe(0);
    const cAfter = plan.result.schedule; // virtual rows: C starts where B ends
    expect(cAfter.rows[C.rowGUID].startMs).toBe(cAfter.rows[B.rowGUID].finishMs);
  });
});
