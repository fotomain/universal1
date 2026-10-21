// timesheetApi - the calls of the time sheet. Every function takes the Supabase client (useSupabase().supabase), so a test passes a fake one.
// The three tables are READ with select (RLS: the organization of the user); they are WRITTEN only by these RPCs (SQL PART 36).
import {
  RPC_TS_ADD_LINE, RPC_TS_INSERT_LINE, RPC_TS_MOVE_LINE, RPC_TS_BUDGET_ITEMS, RPC_TS_BUSINESS_UNITS, RPC_TS_CREATE, RPC_TS_CREATE_MY_WORK_CENTER, RPC_TS_DELETE, RPC_TS_DELETE_LINE, RPC_TS_FROM_TASK, RPC_TS_LIST, RPC_TS_MY_WORK_CENTER, RPC_TS_POST, RPC_TS_ROLES,
  RPC_TS_SET_HEADER, RPC_TS_SET_HOURS, RPC_TS_SET_LINE, RPC_TS_UNPOST, TIMESHEET_ENTERED_TABLE, TIMESHEET_HEADER_TABLE, TIMESHEET_LINES_TABLE,
  MyWorkCenterAnswer, TimesheetMove, TimesheetCreateAnswer, TimesheetEntered, TimesheetHeader, TimesheetLine, TimesheetListFilter, TimesheetListRow, TimesheetPostAnswer,
  enteredOfRow, headerOfRow, lineOfRow, parseCreateAnswer, parseListAnswer, parseMyWorkCenterAnswer, parsePostAnswer, timesheetFilterToRpc,
} from './timesheetModel';

type Client = any;
const fail = (error: any): never => { throw new Error(error?.message || String(error)); };
const PAGE = 1000;

/** a new draft: the work center (null = my own Person work center) and the period (null = the current month); returns the GUID */
export async function createTimesheet(client: Client, p: { workCenter?: string | null; startDate?: string | null; finishDate?: string | null } = {}): Promise<string> {
  const { data, error } = await client.rpc(RPC_TS_CREATE, { p_work_center: p.workCenter ?? null, p_start: p.startDate ?? null, p_finish: p.finishDate ?? null });
  if (error) fail(error);
  return String(data);
}

/** the work center and / or the period of a DRAFT (a key that is present is written) */
export async function setTimesheetHeader(client: Client, guid: string, patch: { timesheetWorkCenter?: string | null; startDate?: string; finishDate?: string }): Promise<void> {
  const { error } = await client.rpc(RPC_TS_SET_HEADER, { p_header: guid, p_patch: patch });
  if (error) fail(error);
}

export interface TimesheetLinePatch {
  timesheetLineProject?: string | null;
  timesheetLineTask?: string | null;
  timesheetLineRole?: string | null;
  timesheetLineBudgetItem?: string | null;
  timesheetLineBusinessUnit?: string | null;
}
export async function addTimesheetLine(client: Client, headerGUID: string, patch: TimesheetLinePatch = {}): Promise<string> {
  const { data, error } = await client.rpc(RPC_TS_ADD_LINE, { p_header: headerGUID, p_patch: patch });
  if (error) fail(error);
  return String(data);
}
/** a line ABOVE / BELOW another (the context menu); the patch is as addTimesheetLine */
export async function insertTimesheetLine(client: Client, headerGUID: string, refLineGUID: string, before: boolean, patch: TimesheetLinePatch = {}): Promise<string> {
  const { data, error } = await client.rpc(RPC_TS_INSERT_LINE, { p_header: headerGUID, p_ref: refLineGUID, p_before: before, p_patch: patch });
  if (error) fail(error);
  return String(data);
}
export async function moveTimesheetLine(client: Client, lineGUID: string, where: TimesheetMove): Promise<void> {
  const { error } = await client.rpc(RPC_TS_MOVE_LINE, { p_line: lineGUID, p_where: where });
  if (error) fail(error);
}
/** a line of a draft; what depends on a changed value is cleared by the database (project -> task -> role -> budget item) */
export async function setTimesheetLine(client: Client, lineGUID: string, patch: TimesheetLinePatch): Promise<void> {
  const { error } = await client.rpc(RPC_TS_SET_LINE, { p_line: lineGUID, p_patch: patch });
  if (error) fail(error);
}
export async function deleteTimesheetLine(client: Client, lineGUID: string): Promise<void> {
  const { error } = await client.rpc(RPC_TS_DELETE_LINE, { p_line: lineGUID });
  if (error) fail(error);
}
export async function deleteTimesheet(client: Client, guid: string): Promise<void> {
  const { error } = await client.rpc(RPC_TS_DELETE, { p_header: guid });
  if (error) fail(error);
}
/** ONE cell: hours above 0 are saved, null / 0 removes the entered row */
export async function setTimesheetHours(client: Client, lineGUID: string, day: string, hours: number | null): Promise<void> {
  const { error } = await client.rpc(RPC_TS_SET_HOURS, { p_line: lineGUID, p_day: day, p_hours: hours });
  if (error) fail(error);
}
export async function postTimesheet(client: Client, guid: string): Promise<TimesheetPostAnswer> {
  const { data, error } = await client.rpc(RPC_TS_POST, { p_header: guid });
  if (error) fail(error);
  return parsePostAnswer(data);
}
export async function unpostTimesheet(client: Client, guid: string): Promise<TimesheetPostAnswer> {
  const { data, error } = await client.rpc(RPC_TS_UNPOST, { p_header: guid });
  if (error) fail(error);
  return parsePostAnswer(data);
}
export async function fetchTimesheetList(client: Client, filter: TimesheetListFilter, extra: Record<string, any> = {}): Promise<TimesheetListRow[]> {
  const { data, error } = await client.rpc(RPC_TS_LIST, { p_filter: timesheetFilterToRpc(filter, extra) });
  if (error) fail(error);
  return parseListAnswer(data);
}
/** "Create based on → Time sheet": ALWAYS a new draft of the user's work center for the current month, with a line for the task */
export async function createTimesheetFromTask(client: Client, taskGUID: string, taskLineGUID?: string | null): Promise<TimesheetCreateAnswer> {
  const { data, error } = await client.rpc(RPC_TS_FROM_TASK, { p_task: taskGUID, p_task_line: taskLineGUID ?? null });
  if (error) fail(error);
  return parseCreateAnswer(data);
}
/** the work center of kind Person of the signed-in user ('' = none) */
export async function fetchMyWorkCenter(client: Client): Promise<string> {
  const { data, error } = await client.rpc(RPC_TS_MY_WORK_CENTER);
  if (error) fail(error);
  return data ? String(data) : '';
}
/** "Create work center": the work center of the Person of the user */
export async function createMyWorkCenter(client: Client, businessUnit?: string | null): Promise<MyWorkCenterAnswer> {
  const { data, error } = await client.rpc(RPC_TS_CREATE_MY_WORK_CENTER, { p_business_unit: businessUnit ?? null });
  if (error) fail(error);
  return parseMyWorkCenterAnswer(data);
}

// ---- reads ----
/** one sheet (null = not found / not in my organization) */
export async function fetchTimesheetHeader(client: Client, guid: string): Promise<TimesheetHeader | null> {
  const { data, error } = await client.from(TIMESHEET_HEADER_TABLE).select('*').eq('rowGUID', guid).maybeSingle();
  if (error) fail(error);
  return data ? headerOfRow(data) : null;
}
export async function fetchTimesheetLines(client: Client, headerGUID: string): Promise<TimesheetLine[]> {
  const { data, error } = await client.from(TIMESHEET_LINES_TABLE).select('*').eq('rowHeaderGUID', headerGUID).order('orderInList', { ascending: true });
  if (error) fail(error);
  return (data || []).map(lineOfRow);
}
/** the entered cells of a sheet (paged: a sheet can hold more than 1000 cells) */
export async function fetchTimesheetEntered(client: Client, headerGUID: string): Promise<TimesheetEntered[]> {
  const out: TimesheetEntered[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(TIMESHEET_ENTERED_TABLE).select('rowLineGUID,timesheetDay,timesheetHours').eq('rowHeaderGUID', headerGUID).order('timesheetDay').range(from, from + PAGE - 1);
    if (error) fail(error);
    out.push(...(data || []).map(enteredOfRow));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// ---- what a task offers a work center (ids; the titles are read by fetchTitles) ----
async function idsOf(client: Client, fn: string, args: Record<string, any>): Promise<string[]> {
  const { data, error } = await client.rpc(fn, args);
  if (error) fail(error);
  return Array.isArray(data) ? data.map(String) : [];
}
export const fetchPossibleRoles = (client: Client, taskGUID: string, workCenter: string) => idsOf(client, RPC_TS_ROLES, { p_task: taskGUID, p_wc: workCenter });
export const fetchPossibleBudgetItems = (client: Client, taskGUID: string, role: string) => idsOf(client, RPC_TS_BUDGET_ITEMS, { p_task: taskGUID, p_role: role });
export const fetchPossibleBusinessUnits = (client: Client, taskGUID: string, workCenter: string) => idsOf(client, RPC_TS_BUSINESS_UNITS, { p_task: taskGUID, p_wc: workCenter });

export interface TitledRow { rowGUID: string; rowJSON: Record<string, any> }
/** the rows of a table by their GUIDs (a select list shows their titles) */
export async function fetchRowsByGuid(client: Client, table: string, guids: string[]): Promise<TitledRow[]> {
  if (!guids.length) return [];
  const { data, error } = await client.from(table).select('rowGUID,rowJSON').in('rowGUID', guids);
  if (error) fail(error);
  return data || [];
}
/** the projects of the user's organization (RLS lists what he may see) */
export async function fetchTimesheetProjects(client: Client): Promise<TitledRow[]> {
  const { data, error } = await client.from('project_table').select('rowGUID,rowJSON').order('created_at', { ascending: false }).limit(500);
  if (error) fail(error);
  return data || [];
}
/** the NORMAL tasks (not stages, not milestones) of a project */
export async function fetchProjectTasks(client: Client, projectGUID: string): Promise<TitledRow[]> {
  const { data, error } = await client.from('project_task_table').select('rowGUID,rowJSON,orderInList').eq('projectGUID', projectGUID).order('orderInList', { ascending: true }).limit(2000);
  if (error) fail(error);
  return (data || []).filter((r: any) => (r?.rowJSON?.rowKind ?? 'task') === 'task');
}
/** the work centers that can be selected: the user's own Person work center, or every one when `all` */
export async function fetchSelectableWorkCenters(client: Client, all: boolean): Promise<TitledRow[]> {
  if (!all) {
    const own = await fetchMyWorkCenter(client);
    return own ? fetchRowsByGuid(client, 'workCenterTable', [own]) : [];
  }
  const { data, error } = await client.from('workCenterTable').select('rowGUID,rowJSON').order('orderInList', { ascending: true }).limit(1000);
  if (error) fail(error);
  return (data || []).filter((r: any) => r?.rowJSON?.isActive !== false);
}
/** the switches of the signed-in user (his Person, else the Organization, else the built-in default) */
export async function fetchTimesheetSwitches(client: Client): Promise<{ allWorkCenters: boolean; onlyCurrentMonth: boolean }> {
  const [a, b] = await Promise.all([client.rpc('timesheet_all_work_centers'), client.rpc('timesheet_only_current_month')]);
  if (a.error) fail(a.error);
  if (b.error) fail(b.error);
  return { allWorkCenters: a.data === true, onlyCurrentMonth: b.data !== false };
}
