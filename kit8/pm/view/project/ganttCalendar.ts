// A10 / A11 Gantt calendars (pure): a named calendar of ganttExtendedOptions.calendars -> the PMCalendar the scheduler uses.
//   workWeek     which weekdays are worked (index = UTC weekday, 0 = Sunday)
//   exceptions   holidays / days off (default) or extra WORKING days, a range of days each
// A calendar that works no day at all is read as the default Mon-Fri week (the scheduler would never finish a task).
import type { PMGanttCalendarDef } from '../../extended/extendedOptions';
import { PM_DEFAULT_WORK_WEEK } from '../../extended/extendedOptions';
import type { PMCalendar } from './scheduling';

const DAY = 86400000;
const MAX_RANGE_DAYS = 3660;

function days(from: string, to: string): number[] {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
  const out: number[] = [];
  for (let d = a; d <= b && out.length < MAX_RANGE_DAYS; d += DAY) out.push(d);
  return out;
}

export function calendarOfDef(def: PMGanttCalendarDef, withExceptions: boolean): PMCalendar {
  const week = def.workWeek.some(Boolean) ? def.workWeek : PM_DEFAULT_WORK_WEEK;
  const offDays = new Set<number>();
  const extraDays = new Set<number>();
  if (withExceptions) {
    for (const e of def.exceptions) for (const d of days(e.from, e.to)) (e.working ? extraDays : offDays).add(d);
  }
  return { skipWeekends: week.some((w) => !w), workWeek: week, offDays, extraDays };
}

/** id -> calendar for every defined calendar */
export function calendarsOf(defs: PMGanttCalendarDef[], withExceptions: boolean): Record<string, PMCalendar> {
  const out: Record<string, PMCalendar> = {};
  for (const d of defs) out[d.id] = calendarOfDef(d, withExceptions);
  return out;
}
