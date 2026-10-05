// Repeating entries: expands a recurrence into the occurrences of a period and names it
// ("Weekly on Wednesday", "Monthly on the first Wednesday", "Annually on October 7" ...).
// Pure functions, local time.

import {
  addDays,
  DAY_MS,
  dayFromKey,
  dayKey,
  eventRange,
  startOfDay,
  UserCalendarEventRow,
  UserCalendarOccurrence,
  UserCalendarRecurrence,
  UserCalendarRepeatUnit,
} from './userCalendarModel';

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'];

/** Safety limit of generated occurrences per entry. */
const MAX_STEPS = 5000;

/** 0-based week of the month the day is in (4 = the last one when there is no later same weekday). */
export function nthWeekdayOf(d: Date): number {
  const n = Math.floor((d.getDate() - 1) / 7);
  const isLast = addDays(d, 7).getMonth() !== d.getMonth();
  return isLast && n >= 3 ? 4 : n;
}

/** The n-th (0-based, 4 = last) `weekday` of a month, or null. */
function nthWeekdayDate(year: number, month: number, weekday: number, n: number): Date | null {
  if (n >= 4) {
    const last = new Date(year, month + 1, 0);
    return addDays(last, -((last.getDay() - weekday + 7) % 7));
  }
  const first = new Date(year, month, 1);
  const d = addDays(first, ((weekday - first.getDay() + 7) % 7) + n * 7);
  return d.getMonth() === month ? d : null;
}

/** Start days (local midnight) of every occurrence, in order, from the first one. Stops after `until`. */
function* occurrenceDays(start: Date, r: UserCalendarRecurrence, until: number): Generator<Date> {
  const interval = Math.max(1, Math.floor(r.interval) || 1);
  const first = startOfDay(start);
  const endDay = r.end.type === 'on' ? dayFromKey(r.end.date).getTime() : Infinity;
  const maxCount = r.end.type === 'after' ? Math.max(1, r.end.count) : Infinity;
  let count = 0;
  const emit = (d: Date) => d.getTime() >= first.getTime() && d.getTime() <= endDay && count < maxCount;

  if (r.freq === 'day') {
    for (let k = 0; k < MAX_STEPS; k++) {
      const d = addDays(first, k * interval);
      if (d.getTime() > until || !emit(d)) return;
      count++;
      yield d;
    }
    return;
  }
  if (r.freq === 'week') {
    const days = (r.weekdays && r.weekdays.length ? [...new Set(r.weekdays)] : [first.getDay()]).sort((a, b) => a - b);
    const weekStart = addDays(first, -first.getDay());
    for (let k = 0; k < MAX_STEPS; k++) {
      const w = addDays(weekStart, k * interval * 7);
      if (w.getTime() > until) return;
      for (const wd of days) {
        const d = addDays(w, wd);
        if (d.getTime() < first.getTime()) continue;
        if (d.getTime() > until || !emit(d)) return;
        count++;
        yield d;
      }
    }
    return;
  }
  if (r.freq === 'month') {
    const nth = nthWeekdayOf(first);
    for (let k = 0; k < MAX_STEPS; k++) {
      const m = first.getMonth() + k * interval;
      const year = first.getFullYear() + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      let d: Date | null;
      if (r.monthlyMode === 'nthWeekday') d = nthWeekdayDate(year, month, first.getDay(), nth);
      else {
        d = new Date(year, month, first.getDate());
        if (d.getMonth() !== month) d = null; // e.g. no 31st in this month
      }
      if (new Date(year, month, 1).getTime() > until) return;
      if (!d) continue;
      if (d.getTime() > until || !emit(d)) return;
      count++;
      yield d;
    }
    return;
  }
  // year
  for (let k = 0; k < MAX_STEPS; k++) {
    const year = first.getFullYear() + k * interval;
    const d = new Date(year, first.getMonth(), first.getDate());
    if (new Date(year, 0, 1).getTime() > until) return;
    if (d.getMonth() !== first.getMonth()) continue; // 29 February
    if (d.getTime() > until || !emit(d)) return;
    count++;
    yield d;
  }
}

/** The occurrences of one entry that touch [fromMs, toMs). */
export function expandEvent(row: UserCalendarEventRow, fromMs: number, toMs: number): UserCalendarOccurrence[] {
  const json = row.rowJSON;
  const { startMs, endMs } = eventRange(json);
  const duration = endMs - startMs;
  const allDay = !!json.allDay;
  if (!json.recurrence) {
    return endMs > fromMs && startMs < toMs ? [{ key: `${row.rowGUID}:${dayKey(startMs)}`, row, startMs, endMs, allDay }] : [];
  }
  const out: UserCalendarOccurrence[] = [];
  const skip = new Set(json.exDates || []);
  const start = new Date(startMs);
  const timeOfDay = startMs - startOfDay(start).getTime();
  for (const day of occurrenceDays(start, json.recurrence, toMs)) {
    const key = dayKey(day);
    if (skip.has(key)) continue;
    // local midnight + time of day (stays right across daylight saving changes)
    const s = new Date(day);
    s.setMilliseconds(timeOfDay);
    const occStart = allDay ? day.getTime() : s.getTime();
    const occEnd = allDay ? addDays(day, Math.round(duration / DAY_MS)).getTime() : occStart + duration;
    if (occEnd > fromMs && occStart < toMs) out.push({ key: `${row.rowGUID}:${key}`, row, startMs: occStart, endMs: occEnd, allDay });
  }
  return out;
}

/** All occurrences of the rows inside [fromMs, toMs), sorted: all-day first, then by start. */
export function expandEvents(rows: UserCalendarEventRow[], fromMs: number, toMs: number): UserCalendarOccurrence[] {
  const out: UserCalendarOccurrence[] = [];
  for (const row of rows) out.push(...expandEvent(row, fromMs, toMs));
  return out.sort((a, b) => a.startMs - b.startMs || Number(b.allDay) - Number(a.allDay) || a.row.rowJSON.title.localeCompare(b.row.rowJSON.title));
}

/** The presets of the "repeat" menu for an entry starting on `start`. */
export function recurrencePresets(start: Date): { id: string; label: string; recurrence: UserCalendarRecurrence | null }[] {
  const wd = start.getDay();
  const nth = nthWeekdayOf(start);
  const never = { type: 'never' } as const;
  return [
    { id: 'none', label: 'Does not repeat', recurrence: null },
    { id: 'daily', label: 'Daily', recurrence: { freq: 'day', interval: 1, end: never } },
    { id: 'weekly', label: `Weekly on ${WEEKDAY_NAMES[wd]}`, recurrence: { freq: 'week', interval: 1, weekdays: [wd], end: never } },
    { id: 'monthly', label: `Monthly on the ${ORDINALS[nth]} ${WEEKDAY_NAMES[wd]}`, recurrence: { freq: 'month', interval: 1, monthlyMode: 'nthWeekday', end: never } },
    { id: 'yearly', label: `Annually on ${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`, recurrence: { freq: 'year', interval: 1, end: never } },
    { id: 'weekdays', label: 'Every weekday (Monday to Friday)', recurrence: { freq: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5], end: never } },
  ];
}

const sameSet = (a: number[] = [], b: number[] = []) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Human text of a recurrence ("Does not repeat", "Weekly on Wednesday", "Every 2 weeks on Mon, Wed, until 6 Jan 2027"). */
export function recurrenceLabel(r: UserCalendarRecurrence | null | undefined, start: Date): string {
  if (!r) return 'Does not repeat';
  const n = Math.max(1, r.interval || 1);
  const wd = start.getDay();
  let text: string;
  if (r.freq === 'day') text = n === 1 ? 'Daily' : `Every ${n} days`;
  else if (r.freq === 'week') {
    const days = r.weekdays && r.weekdays.length ? r.weekdays : [wd];
    if (n === 1 && sameSet(days, [1, 2, 3, 4, 5])) text = 'Every weekday (Monday to Friday)';
    else {
      const names = days.length === 1 ? WEEKDAY_NAMES[days[0]] : [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ');
      text = `${n === 1 ? 'Weekly' : `Every ${n} weeks`} on ${names}`;
    }
  } else if (r.freq === 'month') {
    const on = r.monthlyMode === 'nthWeekday' ? `the ${ORDINALS[nthWeekdayOf(start)]} ${WEEKDAY_NAMES[wd]}` : `day ${start.getDate()}`;
    text = `${n === 1 ? 'Monthly' : `Every ${n} months`} on ${on}`;
  } else text = `${n === 1 ? 'Annually' : `Every ${n} years`} on ${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`;
  if (r.end.type === 'on') {
    const d = dayFromKey(r.end.date);
    text += `, until ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  } else if (r.end.type === 'after') text += `, ${r.end.count} time${r.end.count === 1 ? '' : 's'}`;
  return text;
}

/** Recurrence -> iCalendar RRULE (Google Calendar, .ics invitations). */
export function recurrenceToRRule(r: UserCalendarRecurrence, start: Date): string {
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const parts = [`FREQ=${{ day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }[r.freq]}`];
  if (r.interval > 1) parts.push(`INTERVAL=${Math.floor(r.interval)}`);
  if (r.freq === 'week') parts.push(`BYDAY=${(r.weekdays && r.weekdays.length ? r.weekdays : [start.getDay()]).map((d) => BY[d]).join(',')}`);
  if (r.freq === 'month' && r.monthlyMode === 'nthWeekday') {
    const nth = nthWeekdayOf(start);
    parts.push(`BYDAY=${nth >= 4 ? -1 : nth + 1}${BY[start.getDay()]}`);
  }
  if (r.end.type === 'after') parts.push(`COUNT=${Math.max(1, r.end.count)}`);
  if (r.end.type === 'on') parts.push(`UNTIL=${r.end.date.replace(/-/g, '')}T235959Z`);
  return `RRULE:${parts.join(';')}`;
}

/** iCalendar RRULE -> recurrence (the parts this app supports; null = not a rule we can show). */
export function rruleToRecurrence(rule: string): UserCalendarRecurrence | null {
  const body = rule.replace(/^RRULE:/i, '');
  const map: Record<string, string> = {};
  body.split(';').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v) map[k.toUpperCase()] = v;
  });
  const freq = ({ DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' } as Record<string, UserCalendarRepeatUnit | undefined>)[map.FREQ];
  if (!freq) return null;
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const r: UserCalendarRecurrence = { freq, interval: Math.max(1, Number(map.INTERVAL) || 1), end: { type: 'never' } };
  if (freq === 'week' && map.BYDAY) r.weekdays = map.BYDAY.split(',').map((d) => BY.indexOf(d.slice(-2))).filter((d) => d >= 0);
  if (freq === 'month' && map.BYDAY) r.monthlyMode = 'nthWeekday';
  if (map.COUNT) r.end = { type: 'after', count: Math.max(1, Number(map.COUNT) || 1) };
  else if (map.UNTIL) r.end = { type: 'on', date: `${map.UNTIL.slice(0, 4)}-${map.UNTIL.slice(4, 6)}-${map.UNTIL.slice(6, 8)}` };
  return r;
}
