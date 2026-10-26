// The Extended registry, options and the pure helpers of the functions (kit8/pm/extended, kit8/pm/model).
import { extendedCountOf, extendedMasterOf, extendedOf, extendedPatch, isExtended, PM_EXTENDED_FEATURES, PM_EXTENDED_GROUPS, PM_EXTENDED_KEYS } from '../../../kit8/pm/extended/extendedModel';
import { extendedOptionsOf, PM_EXTENDED_OPTIONS_DEFAULT } from '../../../kit8/pm/extended/extendedOptions';
import { PM_HOURS_PER_DAY, recalcTriangle, triangleOf } from '../../../kit8/pm/extended/taskTypes';
import { formatDurationText, parseDurationText } from '../../../kit8/pm/extended/durationText';
import { recurringDates } from '../../../kit8/pm/extended/recurrence';
import { formatPredecessors, parsePredecessors } from '../../../kit8/pm/extended/predecessorsText';
import { actualBarOf, actualPatchOnProgress, baselineOf, baselineVariance, expectedPercent, markCompletePatches, progressLineX, rescheduleUncompletedPatches, setBaselinePatches } from '../../../kit8/pm/extended/tracking';
import { evmOf, projectEvm } from '../../../kit8/pm/extended/evm';
import { scheduleOptionsOf, calculationManualOf } from '../../../kit8/pm/model/scheduleOptions';
import { constraintHasDate, constraintIsFinish, constraintOf, constraintPatch, constraintReadOnlyReason, MSP_CONSTRAINT_TYPE, PM_CONSTRAINT_TYPES } from '../../../kit8/pm/model/taskConstraint';
import { manualStartOf, patchForMode, patchManualStart, taskModeOf, taskModeReadOnlyReason } from '../../../kit8/pm/model/taskScheduleMode';
import { projectFinishDayOf, scheduleFromEffective, scheduleFromOf } from '../../../kit8/pm/model/scheduleFrom';
import { calendarOfDef } from '../../../kit8/pm/view/project/ganttCalendar';
import { addWorkDays, isWorkDay } from '../../../kit8/pm/view/project/scheduling';
import type { PMScheduledRow, PMTaskJSON, PMTaskRow } from '../../../kit8/pm/model/types';

const DAY = 86400000;
const D0 = Date.UTC(2026, 9, 5);
const iso = (n: number) => new Date(D0 + n * DAY).toISOString();
const json = (extra: Record<string, unknown> = {}) => ({ rowKind: 'task', taskDescription: 'T', durationDays: 3, ...extra }) as unknown as PMTaskJSON;
const row = (extra: Partial<PMScheduledRow> = {}): PMScheduledRow => ({ startAt: '', finishAt: '', startMs: D0, finishMs: D0 + 10 * DAY, durationDays: 10, isSummary: false, isMilestone: false, progress: 0, totalFloatDays: 0, isCritical: false, inCycle: false, ...extra });

describe('registry', () => {
  it('has one xxxxEnabled key per function, unique, all ending in Enabled, each with a short and a full description', () => {
    expect(new Set(PM_EXTENDED_KEYS).size).toBe(PM_EXTENDED_KEYS.length);
    expect(new Set(PM_EXTENDED_FEATURES.map((f) => f.id)).size).toBe(PM_EXTENDED_FEATURES.length);
    for (const f of PM_EXTENDED_FEATURES) {
      expect(f.key).toMatch(/^gantt[A-Za-z]+Enabled$/);
      expect(f.short.length).toBeGreaterThan(10);
      expect(f.short.length).toBeLessThan(80);
      expect(f.more.length).toBeGreaterThan(f.short.length);
      expect(PM_EXTENDED_GROUPS.some((g) => g.id === f.group)).toBe(true);
    }
    // the tasks of the request: A1-A6, A8-A15, B1-B7, C1 C2 C3 C5 C7 C8, E1-E13, F1-F11, G1 G2 G4, H1
    const ids = PM_EXTENDED_FEATURES.map((f) => f.id);
    for (const id of ['A1', 'A6', 'A8', 'A15', 'B1', 'B7', 'C1', 'C2', 'C3', 'C5', 'C7', 'C8', 'E1', 'E13', 'F1', 'F11', 'G1', 'G2', 'G4', 'H1']) expect(ids).toContain(id);
    for (const id of ['A7', 'A16', 'A17', 'C4', 'C6', 'C9', 'G3']) expect(ids).not.toContain(id);
  });

  it('everything is OFF without the master, with the master only the chosen functions are on, and a required function must be on too', () => {
    const switches = { ganttManualSchedulingEnabled: true, ganttTrackingBarsEnabled: true };
    expect(extendedCountOf(switches)).toBe(0);
    expect(extendedMasterOf({})).toBe(false);
    const withMaster = { ganttExtendedFunctionalityEnabled: true, ...switches };
    expect(isExtended(withMaster, 'ganttManualSchedulingEnabled')).toBe(true);
    expect(isExtended(withMaster, 'ganttTrackingBarsEnabled')).toBe(false); // needs baselines
    expect(isExtended({ ...withMaster, ganttBaselinesEnabled: true }, 'ganttTrackingBarsEnabled')).toBe(true);
    expect(extendedCountOf({ ...withMaster, ganttBaselinesEnabled: true })).toBe(3);
    expect(extendedPatch({ ganttManualSchedulingEnabled: false, bogus: true } as any)).toEqual({ ganttManualSchedulingEnabled: false });
    expect(Object.values(extendedOf({ ganttExtendedFunctionalityEnabled: true })).some(Boolean)).toBe(false);
  });

  it('options: defaults for an old project, wrong values are repaired', () => {
    expect(extendedOptionsOf(undefined)).toEqual(PM_EXTENDED_OPTIONS_DEFAULT);
    const o = extendedOptionsOf({ ganttExtendedOptions: { baselineNo: 99, statusDate: 'x', constraintsAlwaysHonored: false, timescale: { top: 'year', bottom: 'zzz' }, barStyles: { critical: '#ff0000', normal: 'red' }, projectCalendarId: 'nope', calendars: [{ id: 'a', name: 'A', workWeek: [true], exceptions: [{ from: '2026-12-24', to: '2026-12-20' }, { from: 'bad' }] }] } });
    expect(o.baselineNo).toBe(0);
    expect(o.statusDate).toBeNull();
    expect(o.constraintsAlwaysHonored).toBe(false);
    expect([o.timescale.top, o.timescale.bottom]).toEqual(['year', 'auto']);
    expect([o.barStyles.critical, o.barStyles.normal]).toEqual(['#ff0000', null]);
    expect(o.projectCalendarId).toBeNull();
    expect(o.calendars[0].workWeek).toHaveLength(7);
    expect(o.calendars[0].exceptions).toEqual([{ from: '2026-12-24', to: '2026-12-24' }]);
  });

  it('the scheduler options follow the switches', () => {
    expect(scheduleOptionsOf(undefined)).toMatchObject({ manualEnabled: false, constraintsEnabled: false, scheduleFrom: 'start', projectFinishDayMs: null, splitEnabled: false, calendars: {}, projectCalendar: null });
    const j = { ganttExtendedFunctionalityEnabled: true, ganttManualSchedulingEnabled: true, ganttScheduleFromFinishEnabled: true, projectScheduleFrom: 'finish', projectFinishDate: '2026-12-31', ganttCalculationModeEnabled: true, ganttExtendedOptions: { calculationManual: true } };
    expect(scheduleOptionsOf(j)).toMatchObject({ manualEnabled: true, scheduleFrom: 'finish', projectFinishDayMs: Date.UTC(2026, 11, 31) });
    expect(calculationManualOf(j)).toBe(true);
    expect(calculationManualOf({ ...j, ganttExtendedFunctionalityEnabled: false })).toBe(false);
    // a finish mode without its switch is plain "from start"
    expect(scheduleOptionsOf({ ...j, ganttScheduleFromFinishEnabled: false }).scheduleFrom).toBe('start');
  });
});

describe('constraints, manual mode, schedule from', () => {
  it('constraint types 0..7 for MS Project, dated / finish types, legacy SNET, patches', () => {
    expect(PM_CONSTRAINT_TYPES.map((t) => MSP_CONSTRAINT_TYPE[t])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(PM_CONSTRAINT_TYPES.filter(constraintHasDate)).toHaveLength(6);
    expect(PM_CONSTRAINT_TYPES.filter(constraintIsFinish)).toEqual(['MFO', 'FNET', 'FNLT']);
    expect(constraintOf(json({ manualStartAt: iso(2) }), false)).toMatchObject({ type: 'SNET', implicit: false });
    expect(constraintOf(json({ taskConstraintType: 'MSO', taskConstraintDate: iso(4), manualStartAt: iso(2) }), false).type).toBe('SNET');
    expect(constraintOf(json({ taskConstraintType: 'MSO', taskConstraintDate: iso(4) }), true)).toMatchObject({ type: 'MSO', dateMs: D0 + 4 * DAY });
    expect(constraintOf(json({ taskConstraintType: 'MFO' }), true).type).toBe('ASAP');
    const snet = constraintPatch(json(), 'SNET', D0 + DAY);
    expect(snet.manualStartAt).toBe(iso(1));
    expect(constraintPatch(snet, 'FNLT', D0 + 5 * DAY).manualStartAt).toBeNull();
    expect(constraintReadOnlyReason(json(), true, false)).toMatch(/stage/i);
    expect(constraintReadOnlyReason(json({ taskIsSubproject: true }), false, false)).toMatch(/subproject/i);
    expect(constraintReadOnlyReason(json(), false, true)).toMatch(/manually/i);
  });

  it('manual mode: needs the function, a start, a plain task; patches', () => {
    const m = json({ taskScheduleMode: 'manual', taskManualStartAt: iso(2) });
    expect(taskModeOf(m, true)).toBe('manual');
    expect(taskModeOf(m, false)).toBe('auto');
    expect(taskModeOf(json({ taskScheduleMode: 'manual' }), true)).toBe('auto');
    expect(taskModeOf({ ...m, taskIsSubproject: true } as PMTaskJSON, true)).toBe('auto');
    expect(taskModeReadOnlyReason(json(), true)).toMatch(/stage/i);
    expect(manualStartOf(m)).toBe(D0 + 2 * DAY);
    const manual = patchForMode(json({ manualStartAt: iso(1) }), 'manual', D0 + 3 * DAY);
    expect(manual.taskManualStartAt).toBe(iso(3));
    const auto = patchForMode(manual, 'auto', D0);
    expect([auto.taskScheduleMode, auto.taskManualStartAt, auto.manualStartAt]).toEqual([undefined, undefined, null]);
    expect(patchManualStart(json(), D0).taskScheduleMode).toBe('manual');
  });

  it('schedule from: finish needs the mode AND a valid date', () => {
    expect(scheduleFromOf({})).toBe('start');
    expect(projectFinishDayOf({ projectFinishDate: '2026-12-31' })).toBe(Date.UTC(2026, 11, 31));
    expect(projectFinishDayOf({ projectFinishDate: 'x' })).toBeNull();
    expect(scheduleFromEffective({ projectScheduleFrom: 'finish' })).toBe('start');
    expect(scheduleFromEffective({ projectScheduleFrom: 'finish', projectFinishDate: '2026-12-31' })).toBe('finish');
    expect(scheduleFromEffective({ projectFinishDate: '2026-12-31' })).toBe('start');
  });

  it('a calendar: custom week, holidays, extra days; one that works no day is the default week', () => {
    const cal = calendarOfDef({ id: 'c', name: 'C', workWeek: [false, true, true, true, true, false, false], exceptions: [{ from: '2026-10-06', to: '2026-10-06' }, { from: '2026-10-10', to: '2026-10-10', working: true }] }, true);
    expect(isWorkDay(D0 + DAY, cal)).toBe(false); // the holiday
    expect(isWorkDay(D0 + 5 * DAY, cal)).toBe(true); // Saturday made a working day
    expect(isWorkDay(D0 + 4 * DAY, cal)).toBe(false); // Friday: not in this week
    expect(addWorkDays(D0, 3, cal)).toBe(D0 + 4 * DAY); // Mon, (Tue off), Wed, Thu
    const none = calendarOfDef({ id: 'n', name: 'N', workWeek: [false, false, false, false, false, false, false], exceptions: [] }, false);
    expect(isWorkDay(D0, none)).toBe(true); // Monday of the default week
    expect(calendarOfDef({ id: 'c', name: 'C', workWeek: [true, true, true, true, true, true, true], exceptions: [{ from: '2026-10-06', to: '2026-10-06' }] }, false).offDays?.size).toBe(0); // exceptions are ignored while A11 is off
  });
});

describe('A6 task types', () => {
  const base = { type: 'fixedUnits' as const, effortDriven: false, durationDays: 5, workHours: 40, units: 100 };
  it('fixed units: duration <-> work; effort driven keeps the work when units change', () => {
    expect(recalcTriangle({ ...base, durationDays: 10 }, 'duration').workHours).toBe(80);
    expect(recalcTriangle({ ...base, workHours: 20 }, 'work').durationDays).toBe(3); // 2.5 -> 3
    expect(recalcTriangle({ ...base, units: 200, effortDriven: true }, 'units')).toMatchObject({ durationDays: 3, workHours: 40 });
    expect(recalcTriangle({ ...base, units: 200 }, 'units')).toMatchObject({ durationDays: 5, workHours: 80 });
  });
  it('fixed duration: work edit -> units; fixed work: duration edit -> units, units edit -> duration', () => {
    expect(recalcTriangle({ ...base, type: 'fixedDuration', workHours: 20 }, 'work').units).toBe(50);
    expect(recalcTriangle({ ...base, type: 'fixedDuration', units: 50 }, 'units').workHours).toBe(20);
    expect(recalcTriangle({ ...base, type: 'fixedWork', durationDays: 10 }, 'duration').units).toBe(50);
    expect(recalcTriangle({ ...base, type: 'fixedWork', units: 50 }, 'units').durationDays).toBe(10);
  });
  it('triangleOf fills what is missing', () => {
    expect(triangleOf({ durationDays: 4 })).toEqual({ type: 'fixedUnits', effortDriven: false, durationDays: 4, workHours: 4 * PM_HOURS_PER_DAY, units: 100 });
    expect(triangleOf({ durationDays: 4, taskUnits: 50 }).workHours).toBe(16);
  });
});

describe('A8 / A9 duration text, A13 recurrence, B1 predecessors text', () => {
  it('parses units, elapsed units and the estimate mark', () => {
    expect(parseDurationText('3d')).toEqual({ days: 3, elapsed: false, estimated: false });
    expect(parseDurationText('2w')).toEqual({ days: 10, elapsed: false, estimated: false });
    expect(parseDurationText('1mo')).toEqual({ days: 20, elapsed: false, estimated: false });
    expect(parseDurationText('4ed?')).toEqual({ days: 4, elapsed: true, estimated: true });
    expect(parseDurationText('2ew')).toEqual({ days: 14, elapsed: true, estimated: false });
    expect(parseDurationText('9h')).toEqual({ days: 2, elapsed: false, estimated: false });
    expect(parseDurationText('7')).toEqual({ days: 7, elapsed: false, estimated: false });
    expect(parseDurationText('abc')).toBeNull();
    expect(formatDurationText(14, { elapsed: true })).toBe('2ew');
    expect(formatDurationText(5, { estimated: true })).toBe('5d?');
  });

  it('recurring dates: daily, weekly on weekdays, monthly with a short month, yearly, count and until', () => {
    expect(recurringDates({ kind: 'daily', interval: 2, from: D0, count: 3 })).toEqual([D0, D0 + 2 * DAY, D0 + 4 * DAY]);
    expect(recurringDates({ kind: 'weekly', interval: 1, from: D0, until: D0 + 14 * DAY, weekdays: [1, 3] })).toEqual([D0, D0 + 2 * DAY, D0 + 7 * DAY, D0 + 9 * DAY, D0 + 14 * DAY]);
    expect(recurringDates({ kind: 'monthly', interval: 1, from: Date.UTC(2026, 0, 31), count: 3, dayOfMonth: 31 })).toEqual([Date.UTC(2026, 0, 31), Date.UTC(2026, 1, 28), Date.UTC(2026, 2, 31)]);
    expect(recurringDates({ kind: 'yearly', interval: 1, from: Date.UTC(2026, 1, 28), count: 2 })).toEqual([Date.UTC(2026, 1, 28), Date.UTC(2027, 1, 28)]);
    expect(recurringDates({ kind: 'daily', interval: 1, from: D0 })).toEqual([]); // no end: nothing
    expect(recurringDates({ kind: 'daily', interval: 1, from: D0, count: 5000 })).toHaveLength(200);
    expect(recurringDates({ kind: 'daily', interval: 1, from: D0 + 5 * DAY, count: 2, workingDaysOnly: true })[0]).toBe(D0 + 7 * DAY); // Saturday -> Monday
  });

  it('parses and formats predecessors', () => {
    const r = parsePredecessors('3, 5SS-1d, 7fs+2w, 1.2FF+50%, x, 3');
    expect(r.items).toEqual([
      { wbs: '3', type: 'FS', lagDays: 0, lagPercent: null },
      { wbs: '5', type: 'SS', lagDays: -1, lagPercent: null },
      { wbs: '7', type: 'FS', lagDays: 10, lagPercent: null },
      { wbs: '1.2', type: 'FF', lagDays: 0, lagPercent: 50 },
    ]);
    expect(r.errors).toHaveLength(2);
    expect(formatPredecessors(r.items)).toBe('3, 5SS-1d, 7+10d, 1.2FF+50%');
    expect(parsePredecessors('4FS+10%', false).errors).toHaveLength(1);
  });
});

describe('C tracking: baselines, actuals, status date, progress line, EVM', () => {
  it('set baseline writes baseline n of the chosen rows; variance in days', () => {
    const t = { rowGUID: 'a', rowJSON: json(), rowProgress: 0 } as unknown as PMTaskRow;
    const p = setBaselinePatches([t, { ...t, rowGUID: 'b' } as PMTaskRow], { a: row(), b: row() }, 2, new Set(['a']));
    expect(p).toHaveLength(1);
    const b = baselineOf(p[0].rowJSON, 2)!;
    expect([b.startMs, b.finishMs, b.durationDays]).toEqual([D0, D0 + 10 * DAY, 10]);
    expect(baselineOf(p[0].rowJSON, 0)).toBeNull();
    expect(baselineVariance(row({ startMs: D0 + 2 * DAY, finishMs: D0 + 13 * DAY }), b)).toEqual({ startDays: 2, finishDays: 3 });
  });

  it('actual dates: the first % sets the start, 100 % the finish, back to 0 clears; the actual bar', () => {
    const r = row();
    const a = actualPatchOnProgress(json(), 0, 30, r, D0 + 20 * DAY);
    expect([a.actualStartAt, a.actualFinishAt]).toEqual([iso(0), null]);
    const done = actualPatchOnProgress({ ...json(), ...a } as PMTaskJSON, 30, 100, r, D0 + 20 * DAY);
    expect(done.actualFinishAt).toBe(iso(9));
    expect(actualPatchOnProgress({ ...json(), ...done } as PMTaskJSON, 100, 0, r, D0)).toEqual({ actualStartAt: null, actualFinishAt: null });
    expect(actualBarOf(json({ actualStartAt: iso(1), actualFinishAt: iso(4) }), r, 100, D0)).toEqual({ startMs: D0 + DAY, finishMs: D0 + 5 * DAY });
    expect(actualBarOf(json({ actualStartAt: iso(1) }), r, 50, D0)).toEqual({ startMs: D0 + DAY, finishMs: D0 + 6 * DAY });
    expect(actualBarOf(json(), r, 50, D0)).toBeNull();
  });

  it('status date: expected %, mark complete, reschedule uncompleted, progress line', () => {
    expect(expectedPercent(row(), D0 + 5 * DAY)).toBe(50);
    expect(expectedPercent(row(), D0 - DAY)).toBe(0);
    expect(expectedPercent(row(), D0 + 99 * DAY)).toBe(100);
    const tasks = [{ rowGUID: 'a', rowProgress: 10 }, { rowGUID: 'b', rowProgress: 0 }, { rowGUID: 'c', rowProgress: 80 }] as unknown as PMTaskRow[];
    const sched = { a: row(), b: row({ startMs: D0 + 20 * DAY, finishMs: D0 + 25 * DAY }), c: row() };
    expect(markCompletePatches(tasks, sched, D0 + 5 * DAY)).toEqual([{ rowGUID: 'a', progress: 50 }]);
    expect(rescheduleUncompletedPatches(tasks, sched, D0 + 22 * DAY)).toEqual([{ rowGUID: 'b', manualStartAt: new Date(D0 + 22 * DAY).toISOString() }]);
    const st = D0 + 5 * DAY;
    expect(progressLineX(row(), 20, st)).toBe(D0 + 2 * DAY); // behind: left of the status date
    expect(progressLineX(row(), 80, st)).toBe(D0 + 8 * DAY); // ahead: right of it
    expect(progressLineX(row({ startMs: D0 + 8 * DAY, finishMs: D0 + 12 * DAY }), 0, st)).toBe(st); // not due yet: on the line
    expect(progressLineX(row({ isSummary: true }), 10, st)).toBeNull();
  });

  it('earned value: PV, EV, AC and the indices', () => {
    const e = evmOf(1000, 500, 400, 600);
    expect(e).toMatchObject({ bac: 1000, pv: 500, ev: 400, ac: 600, sv: -100, cv: -200, spi: 0.8, cpi: 0.667, eac: 1500, etc: 900, vac: -500 });
    expect(e.tcpi).toBe(1.5);
    expect(evmOf(0, 0, 0, 0).cpi).toBeNull();
    const p = projectEvm({ rows: { a: row(), b: row() }, budgetByTask: { a: 100, b: 300 }, actualByTask: { a: 60, z: 10 }, progressByTask: { a: 50, b: 0 }, statusMs: D0 + 5 * DAY });
    expect(p.total).toMatchObject({ bac: 400, pv: 200, ev: 50, ac: 70 });
    expect(p.byTask.z.ac).toBe(10);
  });
});
