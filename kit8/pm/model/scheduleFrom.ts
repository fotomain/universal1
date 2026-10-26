// A4 Schedule from the project START or the project FINISH date (MS Project: Project Information > Schedule From) - pure.
// documentation/MORE_GANTT_ScheduleFromProjectFinishDate_WBS.html
//
//   project_table.rowJSON.projectScheduleFrom   'start' (default, absent) | 'finish'
//   project_table.rowJSON.projectFinishDate     the typed finish, YYYY-MM-DD, the LAST day of the project (inclusive). Read by the scheduler ONLY while projectScheduleFrom = 'finish' AND the Extended switch ganttScheduleFromFinishEnabled is on
//   project_table.rowJSON.projectStartAt        from start: the typed start (input); from finish: the CALCULATED start, written by the schedule write-back
import { parsePlanDate } from './planDateFormats';
import type { PMPlanDateInputFormat } from './planDateFormats';

export type PMScheduleFrom = 'start' | 'finish';

export const scheduleFromOf = (json: { projectScheduleFrom?: unknown } | null | undefined): PMScheduleFrom => (json?.projectScheduleFrom === 'finish' ? 'finish' : 'start');

const parseDay = (v: unknown, format?: PMPlanDateInputFormat): number | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (m) {
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isFinite(ms) ? ms : null;
  }
  const p = parsePlanDate(v, format ?? 'YYYY-MM-DD');
  return p === null || p === undefined || !Number.isFinite(p) ? null : Math.floor(p / 86400000) * 86400000;
};

/** the typed finish day (UTC midnight, last day inclusive) or null */
export const projectFinishDayOf = (json: { projectFinishDate?: unknown } | null | undefined, format?: PMPlanDateInputFormat): number | null => parseDay(json?.projectFinishDate, format);

/** the scheduler is driven by the finish only when the mode is 'finish' AND a valid finish date is typed */
export const scheduleFromEffective = (json: { projectScheduleFrom?: unknown; projectFinishDate?: unknown } | null | undefined, format?: PMPlanDateInputFormat): PMScheduleFrom =>
  scheduleFromOf(json) === 'finish' && projectFinishDayOf(json, format) !== null ? 'finish' : 'start';
