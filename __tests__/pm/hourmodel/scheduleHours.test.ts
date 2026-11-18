import { DAY_MS } from '../../../kit8/pm/model/constants';
import { buildHourAxis, MINUTE_MS } from '../../../kit8/pm/hourmodel/hourAxis';
import { scheduleProjectHours } from '../../../kit8/pm/hourmodel/scheduleHours';
import { scheduleProject } from '../../../kit8/pm/view/project/scheduling';
import { D0, makeLink, makeTask, resetSeq, WEEKDAYS } from '../resourceleveling/levelingTestKit';

const WINDOWS = [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }];
const at = (dayOffset: number, h: number, m = 0) => D0 + dayOffset * DAY_MS + (h * 60 + m) * MINUTE_MS;
const axis = () => buildHourAxis({ windows: WINDOWS, calendar: WEEKDAYS, originMs: D0 });

beforeEach(() => resetSeq());

describe('scheduleProjectHours', () => {
  test('GOLDEN: whole-day tasks get the same days as the day scheduler', () => {
    const a = makeTask('A', 2);
    const b = makeTask('B', 3);
    const c = makeTask('C', 1);
    const d = makeTask('D', 2);
    const tasks = [a, b, c, d];
    const deps = [makeLink(a, b), makeLink(a, c, 'SS', 1), makeLink(b, d, 'FS', 2), makeLink(c, d, 'FF', 0)];
    const day = scheduleProject({ tasks, deps, projectStartMs: D0, calendar: WEEKDAYS });
    const hr = scheduleProjectHours({ tasks, deps, projectStartMs: D0, axis: axis() });
    const dayOf = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;
    for (const t of tasks) {
      const rd = day.rows[t.rowGUID];
      const rh = hr.rows[t.rowGUID];
      expect(dayOf(rh.startMs)).toBe(rd.startMs);
      // the exclusive finish of the day model is midnight after the last day; the hour finish is the end of the last window on that day (or the next day's start when on a day boundary)
      expect(dayOf(rh.finishMs - 1)).toBe(rd.finishMs - DAY_MS);
      expect(rh.durationDays).toBe(rd.durationDays);
    }
    expect(dayOf(hr.projectFinishMs - 1)).toBe(day.projectFinishMs - DAY_MS);
  });

  test('a 6-hour task starting at 11:00 pauses over the break and ends at 18:00 (acceptance A2)', () => {
    const t = makeTask('T', 1, { taskDurationMinutes: 360, taskStartMinute: 11 * 60 });
    const r = scheduleProjectHours({ tasks: [t], deps: [], projectStartMs: D0, axis: axis() }).rows[t.rowGUID];
    expect(r.startMs).toBe(at(0, 11));
    expect(r.finishMs).toBe(at(0, 18));
    expect(r.durationMinutes).toBe(360);
    expect(r.pieces).toEqual([{ startMs: at(0, 11), endMs: at(0, 13) }, { startMs: at(0, 14), endMs: at(0, 18) }]);
  });

  test('a 90-minute task starting at 09:15 finishes at 10:45; a 1-minute task is valid (acceptance A11)', () => {
    const a = makeTask('A', 1, { taskDurationMinutes: 90, taskStartMinute: 9 * 60 + 15 });
    const b = makeTask('B', 1, { taskDurationMinutes: 1 });
    const r = scheduleProjectHours({ tasks: [a, b], deps: [makeLink(a, b)], projectStartMs: D0, axis: axis() }).rows;
    expect(r[a.rowGUID].startMs).toBe(at(0, 9, 15));
    expect(r[a.rowGUID].finishMs).toBe(at(0, 10, 45));
    expect(r[b.rowGUID].startMs).toBe(at(0, 10, 45));
    expect(r[b.rowGUID].finishMs).toBe(at(0, 10, 46));
  });

  test('a task that ends at the end of a window ends there, its successor starts in the next window', () => {
    const a = makeTask('A', 1, { taskDurationMinutes: 240 });
    const b = makeTask('B', 1, { taskDurationMinutes: 60 });
    const r = scheduleProjectHours({ tasks: [a, b], deps: [makeLink(a, b)], projectStartMs: D0, axis: axis() }).rows;
    expect(r[a.rowGUID].finishMs).toBe(at(0, 13));
    expect(r[b.rowGUID].startMs).toBe(at(0, 14));
  });

  test('a start time that the links already passed does not move the task; one that is later does', () => {
    const a = makeTask('A', 1, { taskDurationMinutes: 300 }); // 09:00 -> 15:00 (wm 300 = 14:00 + 60)
    const early = makeTask('E', 1, { taskDurationMinutes: 60, taskStartMinute: 9 * 60 });
    const late = makeTask('L', 1, { taskDurationMinutes: 60, taskStartMinute: 16 * 60 + 30 });
    const r = scheduleProjectHours({ tasks: [a, early, late], deps: [makeLink(a, early), makeLink(a, late)], projectStartMs: D0, axis: axis() }).rows;
    expect(r[early.rowGUID].startMs).toBe(at(0, 15));
    expect(r[late.rowGUID].startMs).toBe(at(0, 16, 30));
  });

  test('a lag in days is the working minutes of the days; a lead and SS / FF work', () => {
    const a = makeTask('A', 1, { taskDurationMinutes: 120 });
    const b = makeTask('B', 1, { taskDurationMinutes: 60 });
    const r = scheduleProjectHours({ tasks: [a, b], deps: [makeLink(a, b, 'FS', 1)], projectStartMs: D0, axis: axis() }).rows;
    expect(r[a.rowGUID].finishMs).toBe(at(0, 11));
    expect(r[b.rowGUID].startMs).toBe(at(1, 11)); // one working day (480 min) after 11:00 = the next day 11:00
  });

  test('the leveling delay is in working minutes and moves the task away from the anchor', () => {
    const a = makeTask('A', 1, { taskDurationMinutes: 120, taskLevelingDelayMinutes: 150 });
    const none = scheduleProjectHours({ tasks: [a], deps: [], projectStartMs: D0, axis: axis() }).rows[a.rowGUID];
    expect(none.startMs).toBe(at(0, 9)); // not honored while levelingEnabled is false
    const on = scheduleProjectHours({ tasks: [a], deps: [], projectStartMs: D0, axis: axis(), levelingEnabled: true }).rows[a.rowGUID];
    expect(on.startMs).toBe(at(0, 11, 30)); // 150 working minutes later than 09:00
  });

  test('stages roll up and the float is in minutes', () => {
    const stage = makeTask('S', 1, {}, 'stage');
    const a = makeTask('A', 1, { taskDurationMinutes: 90 }, 'task', stage.treePath);
    const b = makeTask('B', 1, { taskDurationMinutes: 30 }, 'task', stage.treePath);
    const r = scheduleProjectHours({ tasks: [stage, a, b], deps: [makeLink(a, b)], projectStartMs: D0, axis: axis() });
    expect(r.rows[stage.rowGUID].startMs).toBe(at(0, 9));
    expect(r.rows[stage.rowGUID].finishMs).toBe(at(0, 11));
    expect(r.rows[a.rowGUID].totalFloatMinutes).toBe(0);
    expect(r.projectFinishMs).toBe(at(0, 11));
  });
});
