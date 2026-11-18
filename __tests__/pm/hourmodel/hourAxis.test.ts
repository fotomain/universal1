import { DAY_MS } from '../../../kit8/pm/model/constants';
import { buildHourAxis, normalizeWindows, MINUTE_MS } from '../../../kit8/pm/hourmodel/hourAxis';

const MON = Date.UTC(2026, 9, 5); // Monday 2026-10-05
const at = (dayOffset: number, h: number, m = 0) => MON + dayOffset * DAY_MS + (h * 60 + m) * MINUTE_MS;
const WINDOWS = [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }]; // 8 working hours, a lunch break

describe('hourAxis', () => {
  test('normalizeWindows sorts, merges, clamps and falls back to 08:00-16:00', () => {
    expect(normalizeWindows([{ from: '14:00', to: '18:00' }, { from: '09:00', to: '13:00' }])).toEqual([{ from: 540, to: 780 }, { from: 840, to: 1080 }]);
    expect(normalizeWindows([{ from: '09:00', to: '12:00' }, { from: '11:00', to: '13:00' }])).toEqual([{ from: 540, to: 780 }]);
    expect(normalizeWindows([{ from: '10:00', to: '10:00' }, { from: 'x', to: 'y' }])).toEqual([{ from: 480, to: 960 }]);
    expect(normalizeWindows(undefined)).toEqual([{ from: 480, to: 960 }]);
  });

  const axis = buildHourAxis({ windows: WINDOWS, calendar: { skipWeekends: true }, originMs: MON });

  test('the working minutes of a day and the instants of the axis', () => {
    expect(axis.dayMinutes).toBe(480);
    expect(axis.startInstant(0)).toBe(at(0, 9));
    expect(axis.startInstant(239)).toBe(at(0, 12, 59));
    expect(axis.startInstant(240)).toBe(at(0, 14)); // the break is skipped
    expect(axis.endInstant(240)).toBe(at(0, 13)); // a stretch that ends before wm 240 ends at the end of the window
    expect(axis.endInstant(241)).toBe(at(0, 14, 1));
    expect(axis.startInstant(480)).toBe(at(1, 9)); // the next day
    expect(axis.endInstant(0)).toBe(at(0, 9));
  });

  test('weekends are skipped', () => {
    expect(axis.startInstant(5 * 480)).toBe(at(7, 9)); // Friday has working days 4: next is Monday
    expect(axis.workMinuteAt(at(5, 10))).toBe(5 * 480); // Saturday 10:00 -> the next working minute = Monday 09:00
  });

  test('workMinuteAt is the inverse of startInstant', () => {
    for (const wm of [0, 1, 239, 240, 241, 479, 480, 1234, 2399, 2400, 5000]) expect(axis.workMinuteAt(axis.startInstant(wm))).toBe(wm);
    expect(axis.workMinuteAt(at(0, 13, 30))).toBe(240); // in the break
    expect(axis.workMinuteAt(at(0, 8))).toBe(0); // before the first window
    expect(axis.workMinuteAt(at(0, 19))).toBe(480); // after the last window: the next day's first minute
  });

  test('pieces split a stretch at the break', () => {
    expect(axis.pieces(180, 300)).toEqual([{ startMs: at(0, 12), endMs: at(0, 13) }, { startMs: at(0, 14), endMs: at(0, 15) }]);
    expect(axis.pieces(0, 90)).toEqual([{ startMs: at(0, 9), endMs: at(0, 10, 30) }]);
    expect(axis.pieces(240, 240)).toEqual([]);
  });

  test('days off and extra days follow the calendar', () => {
    const cal = { skipWeekends: true, offDays: new Set([MON + DAY_MS]) as ReadonlySet<number>, extraDays: new Set([MON + 5 * DAY_MS]) as ReadonlySet<number> };
    const a = buildHourAxis({ windows: WINDOWS, calendar: cal, originMs: MON });
    expect(a.startInstant(480)).toBe(at(2, 9)); // Tuesday is off
    expect(a.startInstant(4 * 480)).toBe(at(5, 9)); // Mon, Wed, Thu, Fri = 4 days, then the extra Saturday
  });
});
