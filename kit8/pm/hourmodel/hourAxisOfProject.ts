// hourAxisOfProject - the working-minute axis of a project that plans by the clock, or null (the day model: nothing of the time-of-day model is used).
// The axis is cached by what it is made of (windows, calendar, start day), so a re-calculation of the plan does not build it again.
import type { PMCalendar } from '../view/project/scheduling';
import { buildHourAxis } from './hourAxis';
import type { HourAxis } from './hourAxis';
import { hourModelOf } from './hourModelSettings';

let cacheKey = '';
let cached: HourAxis | null = null;

const setKey = (s: ReadonlySet<number> | undefined): string => (s && s.size ? [...s].sort((a, b) => a - b).join(',') : '');

export function hourAxisOfProject(projectJSON: Record<string, any> | null | undefined, projectStartMs: number, calendar: PMCalendar): HourAxis | null {
  const m = hourModelOf(projectJSON);
  if (!m.active) return null;
  const startDay = Math.floor(projectStartMs / 86400000) * 86400000;
  const key = [JSON.stringify(m.windows), startDay, calendar.skipWeekends ? 1 : 0, calendar.workWeek ? calendar.workWeek.join('') : '', setKey(calendar.offDays), setKey(calendar.extraDays)].join('|');
  if (key === cacheKey && cached) return cached;
  cached = buildHourAxis({ windows: m.windows, calendar, originMs: startDay });
  cacheKey = key;
  return cached;
}
