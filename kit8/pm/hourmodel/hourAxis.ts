// hourAxis - the WORKING-MINUTE AXIS of the time-of-day model (documentation/RESOURCE_LEVELING_HOURS_WBS.html section 4.3). Pure: no React / Supabase.
//
// A calendar = the days that are worked (PMCalendar: weekend rule, work week, days off, extra days) x the daily windows ([{ from, to }] in minutes of the day, wall-clock of the project).
// The axis numbers every WORKING minute from the origin day: working minute 0 = the first minute of the first window of the first working day, and so on, every non-working stretch removed.
// A task of 90 working minutes is the interval [wm, wm + 90) of the axis; the instant of a working minute is found with startInstant / endInstant.
// Instants are "floating" wall-clock ms like the rest of the app's dates (a day is a UTC midnight, minute 540 of it is 09:00); the project time zone is applied only where a real timestamptz is written (Post).
import { DAY_MS } from '../model/constants';
import { isWorkDay, utcMidnight } from '../view/project/scheduling';
import type { PMCalendar } from '../view/project/scheduling';
import { DAY_MINUTES, parseClock } from './minutes';

export const MINUTE_MS = 60_000;
/** the windows of a day when nothing is stored (the Standard work week: 08:00-16:00) */
export const DEFAULT_WINDOWS: readonly HourWindow[] = [{ from: 480, to: 960 }];
const MAX_SCAN_DAYS = 36600;

export interface HourWindow { from: number; to: number }

/** stored windows ([{from:'09:00',to:'13:00'}] or minutes) -> sorted, merged, inside one day; none valid -> the default */
export function normalizeWindows(raw: unknown): HourWindow[] {
  const list: HourWindow[] = [];
  if (Array.isArray(raw)) {
    for (const w of raw) {
      const from = typeof w?.from === 'number' ? w.from : parseClock(w?.from);
      const to = typeof w?.to === 'number' ? w.to : parseClock(w?.to);
      if (from === null || to === null || !Number.isFinite(from) || !Number.isFinite(to)) continue;
      const a = Math.max(0, Math.min(DAY_MINUTES, Math.round(from)));
      const b = Math.max(0, Math.min(DAY_MINUTES, Math.round(to)));
      if (b > a) list.push({ from: a, to: b });
    }
  }
  list.sort((x, y) => x.from - y.from);
  const out: HourWindow[] = [];
  for (const w of list) {
    const last = out[out.length - 1];
    if (last && w.from <= last.to) last.to = Math.max(last.to, w.to);
    else out.push({ ...w });
  }
  return out.length ? out : DEFAULT_WINDOWS.map((w) => ({ ...w }));
}

export const windowMinutes = (windows: readonly HourWindow[]): number => windows.reduce((s, w) => s + (w.to - w.from), 0);

/** the working minutes of the windows that lie before minute `m` of the day */
export function workedBefore(windows: readonly HourWindow[], m: number): number {
  let n = 0;
  for (const w of windows) n += Math.max(0, Math.min(m, w.to) - w.from);
  return n;
}

/** the instant interval [startMs, endMs) of a stretch of the axis (a break between two windows splits it) */
export interface AxisPiece { startMs: number; endMs: number }

export interface HourAxis {
  readonly windows: readonly HourWindow[];
  /** working minutes of one working day */
  readonly dayMinutes: number;
  /** UTC midnight of the first day of the axis */
  readonly originMs: number;
  readonly calendar: PMCalendar;
  /** the position on the axis of an instant: the working minutes BEFORE it (an instant in a break / on a day off = the next working minute) */
  workMinuteAt: (ms: number) => number;
  /** the instant at which working minute `wm` begins (a task that starts at `wm` starts at this instant) */
  startInstant: (wm: number) => number;
  /** the exclusive end instant of a stretch that ends before working minute `wm` (the finish of a task of [a, wm)); wm = 0 gives the start of the axis */
  endInstant: (wm: number) => number;
  /** the real pieces of the stretch [fromWm, toWm) */
  pieces: (fromWm: number, toWm: number) => AxisPiece[];
  /** the working day (UTC midnight) number j of the axis, j = 0, 1, ... */
  workingDay: (j: number) => number;
}

export function buildHourAxis(args: { windows?: unknown; calendar?: PMCalendar; originMs: number }): HourAxis {
  const windows = normalizeWindows(args.windows);
  const W = windowMinutes(windows);
  const calendar: PMCalendar = args.calendar ?? { skipWeekends: true };
  const originMs = utcMidnight(args.originMs);
  /** the working days found so far (UTC midnights), ascending */
  const days: number[] = [];
  const daySet = new Set<number>();
  let scanned = originMs - DAY_MS;
  const extendTo = (dayMs: number) => {
    let guard = 0;
    while (scanned < dayMs && guard++ < MAX_SCAN_DAYS) {
      scanned += DAY_MS;
      if (isWorkDay(scanned, calendar)) { days.push(scanned); daySet.add(scanned); }
    }
  };
  const extendCount = (n: number) => {
    let guard = 0;
    while (days.length < n && guard++ < MAX_SCAN_DAYS) {
      scanned += DAY_MS;
      if (isWorkDay(scanned, calendar)) { days.push(scanned); daySet.add(scanned); }
    }
  };
  const workingDay = (j: number): number => { extendCount(j + 1); return days[Math.min(j, days.length - 1)]; };
  /** the number of working days strictly before `dayMs` */
  const daysBefore = (dayMs: number): number => {
    extendTo(dayMs);
    let lo = 0;
    let hi = days.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (days[mid] < dayMs) lo = mid + 1; else hi = mid; }
    return lo;
  };
  const worksOn = (dayMs: number): boolean => { extendTo(dayMs); return daySet.has(dayMs); };

  const workMinuteAt = (ms: number): number => {
    if (ms <= originMs) return 0;
    const day = utcMidnight(ms);
    const before = daysBefore(day) * W;
    if (!worksOn(day)) return before;
    return before + workedBefore(windows, Math.floor((ms - day) / MINUTE_MS));
  };
  const instantAt = (wm: number, atEnd: boolean): number => {
    // atEnd: the instant AFTER the last minute of the stretch that ends at wm = the end of working minute wm - 1
    const k = atEnd ? Math.max(0, wm - 1) : Math.max(0, wm);
    const j = Math.floor(k / W);
    let r = k - j * W;
    const day = workingDay(j);
    for (const w of windows) {
      const len = w.to - w.from;
      if (r < len) return day + (w.from + r + (atEnd && wm > 0 ? 1 : 0)) * MINUTE_MS;
      r -= len;
    }
    return day + DAY_MS;
  };
  const pieces = (fromWm: number, toWm: number): AxisPiece[] => {
    const out: AxisPiece[] = [];
    let a = Math.max(0, fromWm);
    const b = Math.max(a, toWm);
    while (a < b) {
      const j = Math.floor(a / W);
      const r = a - j * W;
      const day = workingDay(j);
      let acc = 0;
      for (const w of windows) {
        const len = w.to - w.from;
        if (r < acc + len) {
          const inWin = r - acc;
          const take = Math.min(len - inWin, b - a);
          out.push({ startMs: day + (w.from + inWin) * MINUTE_MS, endMs: day + (w.from + inWin + take) * MINUTE_MS });
          a += take;
          break;
        }
        acc += len;
      }
    }
    // neighbours that touch (a stretch that ends at the end of a window and the next starts at the beginning of the next window is NOT touching: a break lies between)
    const merged: AxisPiece[] = [];
    for (const p of out) {
      const last = merged[merged.length - 1];
      if (last && last.endMs === p.startMs) last.endMs = p.endMs; else merged.push({ ...p });
    }
    return merged;
  };
  return { windows, dayMinutes: W, originMs, calendar, workMinuteAt, startInstant: (wm) => instantAt(wm, false), endInstant: (wm) => instantAt(wm, true), pieces, workingDay };
}
