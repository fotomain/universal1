// Management calendar - the two calls the screens and the task plan need that are not a ReusableTable: Fill (one RPC) and the days of a range.
// the Supabase client is loaded when a call is made, so importing this file (a screen, a test) never creates the client
const client = async () => (await import('../../../supabase/supabase')).supabase;
import { MANAGEMENT_CALENDAR_DAYS_TABLE, CalendarFillMode, CalendarLockDay, dayMs } from './managementCalendarModel';

export const rpcFillManagementCalendar = 'fill_management_calendar';
const PAGE = 1000;

export interface FillOptions {
  /** hours of an active day (resource calendars; empty = the hoursPerDay of the calendar) */
  hours?: number | null;
  /** resource calendars: the days the project calendars of the organization flag as holidays become holidays (0 h) */
  followProjectHolidays?: boolean;
}

/** Fill: a whole year of the calendar in one statement (SQL fill_management_calendar). Returns the number of day rows written. A Fill that would put a capacity under posted hours is refused as a whole. */
export async function fillManagementCalendar(calendarGUID: string, year: number, mode: CalendarFillMode, overwriteManual = false, options: FillOptions = {}): Promise<number> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(rpcFillManagementCalendar, {
    p_calendar: calendarGUID, p_year: year, p_mode: mode, p_overwrite_manual: overwriteManual,
    p_hours: options.hours ?? null, p_follow_project_holidays: !!options.followProjectHolidays,
  });
  if (error) throw new Error(error.message || String(error));
  return Number(data) || 0;
}

/** the days of a calendar (between two days) that have posted hours: the capacity of such a day cannot be lowered under min_hours (organization_calendar_lock_info) */
export async function fetchCalendarLockInfo(calendarGUID: string, fromDay: string, toDay: string): Promise<CalendarLockDay[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc('organization_calendar_lock_info', { p_calendar: calendarGUID, p_from: fromDay, p_to: toDay });
  if (error) throw new Error(error.message || String(error));
  return (Array.isArray(data) ? data : []).map((r: any) => ({ day: String(r.day).slice(0, 10), minHours: Number(r.min_hours) || 0, resources: Number(r.resources) || 0, example: String(r.example || '') }));
}

export interface CalendarDifference { day: string; difference: 'projectWorksResourceOff' | 'projectClosedResourceWorks'; projectReason: string; resourceHours: number; isHoliday: boolean }

/** where the project calendars of the organization and a resource calendar disagree in a year (organization_calendar_consistency): the report of the Fill */
export async function fetchCalendarConsistency(calendarGUID: string, year: number): Promise<CalendarDifference[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc('organization_calendar_consistency', { p_calendar: calendarGUID, p_year: year });
  if (error) throw new Error(error.message || String(error));
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    day: String(r.day).slice(0, 10), difference: r.difference, projectReason: String(r.project_reason || ''), resourceHours: Number(r.resource_hours) || 0, isHoliday: !!r.is_holiday,
  }));
}

/** the day rows of ONE calendar between two days (closed range), read page by page (the server returns at most 1000 rows at once) */
export async function fetchCalendarDays(calendarGUID: string, fromDay: string, toDay: string): Promise<{ rowJSON: { day: string; isActive: boolean } }[]> {
  const a = dayMs(fromDay) / 86400000, b = dayMs(toDay) / 86400000;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return [];
  const out: any[] = [];
  const supabase = await client();
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from(MANAGEMENT_CALENDAR_DAYS_TABLE.table)
      .select('rowJSON')
      .eq('rowOwnerGUID', calendarGUID)
      .gte('orderInList', a)
      .lte('orderInList', b)
      .order('orderInList', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(error.message || String(error));
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** "Own calendar": a private copy of a resource calendar (the row and all its days) in a folder (SQL organization_copy_calendar); returns the rowGUID of the copy */
export async function copyManagementCalendar(sourceCalendarGUID: string, title: string | undefined, folderGUID: string): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc('organization_copy_calendar', { p_source: sourceCalendarGUID, p_title: title ?? null, p_folder: folderGUID });
  if (error) throw new Error(error.message || String(error));
  return String(data);
}
