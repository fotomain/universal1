// Management calendar - the two calls the screens and the task plan need that are not a ReusableTable: Fill (one RPC) and the days of a range.
// the Supabase client is loaded when a call is made, so importing this file (a screen, a test) never creates the client
const client = async () => (await import('../../../supabase/supabase')).supabase;
import { MANAGEMENT_CALENDAR_DAYS_TABLE, CalendarFillMode, dayMs } from './managementCalendarModel';

export const rpcFillManagementCalendar = 'fill_management_calendar';
const PAGE = 1000;

/** Fill: a whole year of the calendar in one statement (SQL fill_management_calendar). Returns the number of day rows written. */
export async function fillManagementCalendar(calendarGUID: string, year: number, mode: CalendarFillMode, overwriteManual = false): Promise<number> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(rpcFillManagementCalendar, { p_calendar: calendarGUID, p_year: year, p_mode: mode, p_overwrite_manual: overwriteManual });
  if (error) throw new Error(error.message || String(error));
  return Number(data) || 0;
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
