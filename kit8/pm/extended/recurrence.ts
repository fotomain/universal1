// A13 Recurring tasks (pure): the dates of the occurrences of a pattern (MS Project: Insert > Recurring Task).
//   daily    every `interval` days (workingDaysOnly: only Mon-Fri, a Saturday / Sunday moves to the next Monday)
//   weekly   every `interval` weeks on the chosen weekdays (0 = Sunday)
//   monthly  every `interval` months on `dayOfMonth` (a short month: its last day)
//   yearly   every `interval` years on the month and day of `from`
// Ends at `until` (inclusive) or after `count` occurrences; at most PM_RECURRENCE_MAX.
export type PMRecurrenceKind = 'daily' | 'weekly' | 'monthly' | 'yearly';
export const PM_RECURRENCE_MAX = 200;

export interface PMRecurrence {
  kind: PMRecurrenceKind;
  interval: number;
  /** UTC midnight of the first day */
  from: number;
  /** UTC midnight of the last day (inclusive) */
  until?: number | null;
  count?: number | null;
  weekdays?: number[];
  dayOfMonth?: number;
  workingDaysOnly?: boolean;
}

const DAY = 86400000;
const dow = (ms: number) => new Date(ms).getUTCDay();
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const nextMonday = (ms: number) => (dow(ms) === 6 ? ms + 2 * DAY : dow(ms) === 0 ? ms + DAY : ms);

export function recurringDates(p: PMRecurrence): number[] {
  const interval = Math.max(1, Math.round(p.interval) || 1);
  const limit = Math.min(PM_RECURRENCE_MAX, p.count && p.count > 0 ? Math.round(p.count) : PM_RECURRENCE_MAX);
  const until = p.until ?? null;
  if (until === null && !(p.count && p.count > 0)) return [];
  const out: number[] = [];
  const push = (ms: number): boolean => {
    if (ms < p.from) return true;
    if (until !== null && ms > until) return false;
    out.push(ms);
    return out.length < limit;
  };
  const start = new Date(p.from);
  if (p.kind === 'daily') {
    for (let i = 0; i < 20000; i++) {
      const ms = p.from + i * interval * DAY;
      if (!push(p.workingDaysOnly ? nextMonday(ms) : ms)) break;
    }
  } else if (p.kind === 'weekly') {
    const days = (p.weekdays && p.weekdays.length ? [...new Set(p.weekdays)] : [dow(p.from)]).sort((a, b) => a - b);
    const weekStart = p.from - dow(p.from) * DAY; // the Sunday of the first week
    outer: for (let w = 0; w < 5000; w++) {
      for (const d of days) {
        const ms = weekStart + (w * interval * 7 + d) * DAY;
        if (ms < p.from) continue;
        if (!push(ms)) break outer;
      }
    }
  } else if (p.kind === 'monthly') {
    const day = Math.min(31, Math.max(1, Math.round(p.dayOfMonth ?? start.getUTCDate())));
    for (let i = 0; i < 2400; i++) {
      const mi = start.getUTCMonth() + i * interval;
      const y = start.getUTCFullYear() + Math.floor(mi / 12);
      const m = ((mi % 12) + 12) % 12;
      if (!push(Date.UTC(y, m, Math.min(day, lastDayOfMonth(y, m))))) break;
    }
  } else {
    for (let i = 0; i < 400; i++) {
      const y = start.getUTCFullYear() + i * interval;
      if (!push(Date.UTC(y, start.getUTCMonth(), Math.min(start.getUTCDate(), lastDayOfMonth(y, start.getUTCMonth()))))) break;
    }
  }
  return out;
}
