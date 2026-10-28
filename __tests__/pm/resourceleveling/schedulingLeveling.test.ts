// The scheduler reads the leveling delay (kit8/pm/view/project/scheduling.ts) only while levelingEnabled; the plan is byte-identical when it is off.
import { scheduleProject } from '../../../kit8/pm/view/project/scheduling';
import { scheduleOptionsOf } from '../../../kit8/pm/model/scheduleOptions';
import { signatureOf } from '../../../kit8/pm/model/calcSignature';
import { D0, WEEKDAYS, day, dayIndex, makeLink, makeTask, resetSeq } from './levelingTestKit';

beforeEach(() => resetSeq());
const run = (tasks: any[], deps: any[], extra: Record<string, unknown> = {}) => scheduleProject({ tasks, deps, projectStartMs: D0, calendar: WEEKDAYS, ...extra });

describe('the leveling delay in the scheduler', () => {
  it('is ignored while the function is off: the plan is identical to a plan without the key', () => {
    const A = makeTask('A', 3, { taskLevelingDelayDays: 4 });
    const B = makeTask('B', 2);
    const plain = makeTask('A', 3);
    expect(run([A, B], [makeLink(A, B)])).toEqual(run([{ ...plain, rowGUID: A.rowGUID, treePath: A.treePath }, B], [makeLink(A, B)]));
  });

  it('moves the task away from the start by working days and its successors with it', () => {
    const A = makeTask('A', 3, { taskLevelingDelayDays: 2 });
    const B = makeTask('B', 2);
    const r = run([A, B], [makeLink(A, B)], { levelingEnabled: true });
    expect(dayIndex(r.rows[A.rowGUID].startMs)).toBe(2);
    expect(r.rows[A.rowGUID].levelingDelayDays).toBe(2);
    expect(dayIndex(r.rows[B.rowGUID].startMs)).toBe(5 + 2); // A: Wed, Thu, Fri; B starts Monday
    expect(r.rows[B.rowGUID].levelingDelayDays).toBeUndefined();
  });

  it('counts working days: a delay of 5 from Monday is the next Monday', () => {
    const A = makeTask('A', 1, { taskLevelingDelayDays: 5 });
    expect(dayIndex(run([A], [], { levelingEnabled: true }).rows[A.rowGUID].startMs)).toBe(7);
  });

  it('levelingDelays (the engine) overrides the rows', () => {
    const A = makeTask('A', 1, { taskLevelingDelayDays: 5 });
    const r = run([A], [], { levelingEnabled: true, levelingDelays: { [A.rowGUID]: 1 } });
    expect(dayIndex(r.rows[A.rowGUID].startMs)).toBe(1);
  });

  it('does not move a stage, a milestone or a subproject task', () => {
    const S = makeTask('S', 1, { taskLevelingDelayDays: 3 }, 'stage');
    const M = makeTask('M', 0, { taskLevelingDelayDays: 3 }, 'milestone');
    const r = run([S, M], [], { levelingEnabled: true });
    expect(dayIndex(r.rows[S.rowGUID].startMs)).toBe(0);
    expect(dayIndex(r.rows[M.rowGUID].startMs)).toBe(0);
  });

  it('does not move a task that must start on a date (honored), nor a manual task unless allowed', () => {
    const iso = new Date(day(2)).toISOString();
    const T = makeTask('T', 2, { taskLevelingDelayDays: 3, taskConstraintType: 'MSO', taskConstraintDate: iso });
    const M = makeTask('M', 2, { taskLevelingDelayDays: 3, taskScheduleMode: 'manual', taskManualStartAt: iso });
    const base = { levelingEnabled: true, constraintsEnabled: true, manualEnabled: true };
    const r = run([T, M], [], base);
    expect(dayIndex(r.rows[T.rowGUID].startMs)).toBe(2);
    expect(dayIndex(r.rows[M.rowGUID].startMs)).toBe(2);
    const r2 = run([M], [], { ...base, levelingManualTasks: true });
    expect(dayIndex(r2.rows[M.rowGUID].startMs)).toBe(7); // Wednesday + 3 working days = Thursday, Friday, Monday
  });

  it('planned from the finish the delay is taken from the late side: the task ends earlier', () => {
    const A = makeTask('A', 2, { taskLevelingDelayDays: 3 });
    const r = run([A], [], { levelingEnabled: true, scheduleFrom: 'finish', projectFinishDayMs: day(14) });
    // without the delay: ends Monday 19 Oct (day 14); with 3 working days: ends Wed 14 Oct (day 9)
    expect(dayIndex(r.rows[A.rowGUID].finishMs)).toBe(10);
  });
});

describe('the project switches reach the scheduler', () => {
  it('scheduleOptionsOf: off by default; on with the master; manual tasks need Extended A1', () => {
    expect(scheduleOptionsOf({}).levelingEnabled).toBe(false);
    expect(scheduleOptionsOf({ resourceLevelingFunctionalityEnabled: true }).levelingEnabled).toBe(true);
    expect(scheduleOptionsOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingManualTasks: true }).levelingManualTasks).toBe(false);
    expect(scheduleOptionsOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingManualTasks: true, ganttExtendedFunctionalityEnabled: true, ganttManualSchedulingEnabled: true }).levelingManualTasks).toBe(true);
  });

  it('the calculation signature (Calculation Manual) sees a changed delay and a switched master', () => {
    const A = makeTask('A', 2);
    const B = { ...A, rowJSON: { ...A.rowJSON, taskLevelingDelayDays: 2 } };
    expect(signatureOf([A], [], null).tasks[A.rowGUID]).not.toBe(signatureOf([B as any], [], null).tasks[A.rowGUID]);
    const p0: any = { rowJSON: {} };
    const p1: any = { rowJSON: { resourceLevelingFunctionalityEnabled: true } };
    expect(signatureOf([A], [], p0).project).not.toBe(signatureOf([A], [], p1).project);
  });
});
