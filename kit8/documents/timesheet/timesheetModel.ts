// timesheetModel - the TIME SHEET (documentation/TIME_SHEET_WBS.html), pure TypeScript (unit-tested): constants, the row shapes, the days of a period, the rules of the period and of the work center that the database
// also checks (SQL PART 36 is the truth), the settings per Person (Person -> Organization -> built-in default), hours, totals, states, the answers of the RPCs and the texts of the problems.
//   sheet   project_timesheet_header           organization · timesheetWorkCenter · startDate · finishDate · rowJSON.documentHeader { documentNumber, documentStatus draft | posted ... }
//   line    project_timesheet_lines            timesheetLineProject · timesheetLineTask · timesheetLineRole · timesheetLineBudgetItem · timesheetLineBusinessUnit + the cost of one hour
//   cell    project_timesheet_lines_data_entered   ONE ROW PER ENTERED CELL (line x day); an empty cell has no row - this table is the base of Post
export const TIMESHEET_HEADER_TABLE = 'project_timesheet_header';
export const TIMESHEET_LINES_TABLE = 'project_timesheet_lines';
export const TIMESHEET_ENTERED_TABLE = 'project_timesheet_lines_data_entered';
/** the redux entity of the LIST (realtime rows of the header table) */
export const TIMESHEET_HEADER_ENTITY = 'projectTimesheetHeader';

export const TIMESHEET_ROUTE = '/pm/timesheet/form';
export const TIMESHEET_LIST_ROUTE = '/pm/timesheet/list';

export const RPC_TS_CREATE = 'timesheet_create';
export const RPC_TS_SET_HEADER = 'timesheet_set_header';
export const RPC_TS_ADD_LINE = 'timesheet_add_line';
export const RPC_TS_SET_LINE = 'timesheet_set_line';
export const RPC_TS_DELETE_LINE = 'timesheet_delete_line';
export const RPC_TS_INSERT_LINE = 'timesheet_insert_line';
export const RPC_TS_MOVE_LINE = 'timesheet_move_line';
export const RPC_TS_DELETE = 'timesheet_delete';
export const RPC_TS_SET_HOURS = 'timesheet_set_hours';
export const RPC_TS_POST = 'post_timesheet';
export const RPC_TS_UNPOST = 'unpost_timesheet';
export const RPC_TS_LIST = 'timesheet_list';
export const RPC_TS_FROM_TASK = 'create_timesheet_from_task';
export const RPC_TS_MY_WORK_CENTER = 'timesheet_my_work_center';
export const RPC_TS_CREATE_MY_WORK_CENTER = 'timesheet_create_my_work_center';
export const RPC_TS_ROLES = 'timesheet_possible_roles';
export const RPC_TS_BUDGET_ITEMS = 'timesheet_possible_budget_items';
export const RPC_TS_BUSINESS_UNITS = 'timesheet_possible_business_units';
export const RPC_TS_ALL_WORK_CENTERS = 'timesheet_all_work_centers';
export const RPC_TS_ONLY_CURRENT_MONTH = 'timesheet_only_current_month';

/** a period is at most this many days when the month switch is off */
export const TIMESHEET_MAX_DAYS = 62;
/** hours in one cell / one day */
export const TIMESHEET_MAX_HOURS_A_DAY = 24;

export type TimesheetStatus = 'draft' | 'posted';

// ---- settings (tab TabTimesheet): the Person's value, else the Organization's, else the built-in default ----
export const TIMESHEET_ALL_WORK_CENTERS_KEY = 'timesheetAllWorkCenterInputAvailable';
export const TIMESHEET_ONLY_CURRENT_MONTH_KEY = 'timesheetOnlyCurrentMonthInputEnabled';
export type TimesheetSettingKey = typeof TIMESHEET_ALL_WORK_CENTERS_KEY | typeof TIMESHEET_ONLY_CURRENT_MONTH_KEY;
/** the built-in defaults - opposite on purpose (false unless stored true / true unless stored false) */
export const TIMESHEET_SETTING_DEFAULTS: Record<TimesheetSettingKey, boolean> = { [TIMESHEET_ALL_WORK_CENTERS_KEY]: false, [TIMESHEET_ONLY_CURRENT_MONTH_KEY]: true };
export interface TimesheetSettings { timesheetAllWorkCenterInputAvailable: boolean; timesheetOnlyCurrentMonthInputEnabled: boolean }

const asBool = (v: unknown): boolean | null => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);

/** where a value comes from: 'person' | 'organization' | 'default' */
export type TimesheetSettingSource = 'person' | 'organization' | 'default';

/** one setting for a Person: the Person's rowJSON, else the Organization's rowJSON, else the built-in default (twin of the SQL function timesheet_setting) */
export function timesheetSettingOf(key: TimesheetSettingKey, personJSON?: Record<string, any> | null, organizationJSON?: Record<string, any> | null): { value: boolean; source: TimesheetSettingSource } {
  const p = asBool(personJSON?.[key]);
  if (p !== null) return { value: p, source: 'person' };
  const o = asBool(organizationJSON?.[key]);
  if (o !== null) return { value: o, source: 'organization' };
  return { value: TIMESHEET_SETTING_DEFAULTS[key], source: 'default' };
}
export function timesheetSettingsOf(personJSON?: Record<string, any> | null, organizationJSON?: Record<string, any> | null): TimesheetSettings {
  return {
    timesheetAllWorkCenterInputAvailable: timesheetSettingOf(TIMESHEET_ALL_WORK_CENTERS_KEY, personJSON, organizationJSON).value,
    timesheetOnlyCurrentMonthInputEnabled: timesheetSettingOf(TIMESHEET_ONLY_CURRENT_MONTH_KEY, personJSON, organizationJSON).value,
  };
}

// ---- days ----
const pad = (n: number) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' is a real calendar day */
export function isDay(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const toUTC = (s: string) => new Date(`${s}T00:00:00Z`);
const fromUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
/** a day + n days */
export function addDays(day: string, n: number): string {
  const d = toUTC(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}
/** the number of days from start to finish, BOTH included (0 when a date is not a day or finish < start) */
export function dayCount(start: string, finish: string): number {
  if (!isDay(start) || !isDay(finish)) return 0;
  const n = Math.round((toUTC(finish).getTime() - toUTC(start).getTime()) / 86_400_000) + 1;
  return n > 0 ? n : 0;
}
/** every day from start to finish, BOTH included ('YYYY-MM-DD'); one day column each */
export function daysBetween(start: string, finish: string): string[] {
  const n = dayCount(start, finish);
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}
export const todayDay = (now: Date = new Date()): string => fromUTC(now);
export const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;
export function monthEnd(day: string): string {
  const d = toUTC(`${day.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fromUTC(d);
}
/** the current month of today: [first day, last day] */
export const currentMonthPeriod = (now: Date = new Date()): { startDate: string; finishDate: string } => ({ startDate: monthStart(todayDay(now)), finishDate: monthEnd(todayDay(now)) });
/** 0 = Sunday .. 6 = Saturday */
export const weekdayOf = (day: string): number => toUTC(day).getUTCDay();
export const isWeekend = (day: string): boolean => weekdayOf(day) === 0 || weekdayOf(day) === 6;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** the title of a day column: "Mon 05" (the weekday and the day of the month) */
export const dayColumnTitle = (day: string): string => `${WEEKDAYS[weekdayOf(day)]} ${day.slice(8, 10)}`;

// ---- the period rules (the database checks them again) ----
export type TimesheetPeriodProblem = 'dateMissing' | 'finishBeforeStart' | 'outsideCurrentMonth' | 'tooLong';
/**
 * null = the period is allowed. onlyCurrentMonth (timesheetOnlyCurrentMonthInputEnabled): both dates in ONE month, and it is today's month (one day of tolerance for the time zone, as the database);
 * else at most 62 days.
 */
export function timesheetPeriodProblem(start: string, finish: string, onlyCurrentMonth: boolean, now: Date = new Date()): TimesheetPeriodProblem | null {
  if (!isDay(start) || !isDay(finish)) return 'dateMissing';
  if (finish < start) return 'finishBeforeStart';
  if (onlyCurrentMonth) {
    const today = todayDay(now);
    const months = new Set([addDays(today, -1), today, addDays(today, 1)].map((d) => d.slice(0, 7)));
    return start.slice(0, 7) === finish.slice(0, 7) && months.has(start.slice(0, 7)) ? null : 'outsideCurrentMonth';
  }
  return dayCount(start, finish) > TIMESHEET_MAX_DAYS ? 'tooLong' : null;
}
export function timesheetPeriodProblemText(p: TimesheetPeriodProblem): string {
  switch (p) {
    case 'dateMissing': return 'Enter the start date and the finish date.';
    case 'finishBeforeStart': return 'The finish date is before the start date.';
    case 'outsideCurrentMonth': return 'The period must lie inside the current month.';
    case 'tooLong': return 'A period is at most 62 days.';
  }
}

// ---- rows ----
export interface TimesheetHeader {
  rowGUID: string;
  organization: string;
  /** workCenterTable.rowGUID ('' = none yet) */
  workCenter: string;
  startDate: string;
  finishDate: string;
  documentNumber: string;
  status: TimesheetStatus;
}
export interface TimesheetLine {
  rowGUID: string;
  project: string;
  task: string;
  role: string;
  budgetItem: string;
  businessUnit: string;
  orderInList: number;
  /** the total of the entered hours (kept by the database) */
  hours: number;
  /** the cost of one hour in the budget money from the task's Time line (source taskLine); null = none */
  unitSumForBudget: number | null;
  /** where the price of an hour comes from: taskLine (the Time line of the task) | contract | role | '' = none (Post names what is missing) */
  rateSource: TimesheetRateSource;
  /** the price of ONE hour of contract / role, as of the START date of the sheet (Post prices every cell with the price and the exchange rate of ITS day) */
  unitPrice: number | null;
  unitPriceCurrency: string;
}
export type TimesheetRateSource = '' | 'taskLine' | 'contract' | 'role';

export interface TimesheetEntered { lineGUID: string; day: string; hours: number }

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** a header row of project_timesheet_header (as the database returns it) */
export function headerOfRow(r: any): TimesheetHeader {
  const dh = r?.rowJSON?.documentHeader ?? {};
  return {
    rowGUID: str(r?.rowGUID),
    organization: str(r?.rowOrganizationGUID),
    workCenter: str(r?.timesheetWorkCenter),
    startDate: str(r?.startDate).slice(0, 10),
    finishDate: str(r?.finishDate).slice(0, 10),
    documentNumber: str(dh.documentNumber),
    status: dh.documentStatus === 'posted' ? 'posted' : 'draft',
  };
}
export function lineOfRow(r: any): TimesheetLine {
  return {
    rowGUID: str(r?.rowGUID),
    project: str(r?.timesheetLineProject),
    task: str(r?.timesheetLineTask),
    role: str(r?.timesheetLineRole),
    budgetItem: str(r?.timesheetLineBudgetItem),
    businessUnit: str(r?.timesheetLineBusinessUnit),
    orderInList: num(r?.orderInList),
    hours: num(r?.timesheetLineHours),
    unitSumForBudget: r?.unitSumForBudget == null ? null : num(r.unitSumForBudget),
    rateSource: r?.rateSource === 'taskLine' || r?.rateSource === 'contract' || r?.rateSource === 'role' ? r.rateSource : '',
    unitPrice: r?.unitPrice == null ? null : num(r.unitPrice),
    unitPriceCurrency: str(r?.unitPriceCurrency),
  };
}
export const enteredOfRow = (r: any): TimesheetEntered => ({ lineGUID: str(r?.rowLineGUID), day: str(r?.timesheetDay).slice(0, 10), hours: num(r?.timesheetHours) });

/** a row of the list RPC (timesheet_list) */
export interface TimesheetListRow {
  documentGUID: string;
  documentNumber: string;
  documentStatus: TimesheetStatus;
  workCenter: string;
  workCenterTitle: string;
  startDate: string;
  finishDate: string;
  lineCount: number;
  hours: number;
  /** when the sheet was posted (ISO timestamp), '' = not posted */
  postedAt: string;
}
export function listRowOf(r: any): TimesheetListRow {
  return {
    documentGUID: str(r?.rowGUID),
    documentNumber: str(r?.documentNumber),
    documentStatus: r?.documentStatus === 'posted' ? 'posted' : 'draft',
    workCenter: str(r?.timesheetWorkCenter),
    workCenterTitle: str(r?.workCenterTitle),
    startDate: str(r?.startDate).slice(0, 10),
    finishDate: str(r?.finishDate).slice(0, 10),
    lineCount: num(r?.lines),
    hours: num(r?.hours),
    postedAt: str(r?.postedAt),
  };
}
/** an ISO timestamp as 'YYYY-MM-DD HH:MM' in the time zone of the user ('' for none / not a date) */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export const parseListAnswer = (data: unknown): TimesheetListRow[] => (Array.isArray(data) ? data.map(listRowOf) : []);

// ---- hours ----
/** { 'lineGUID|YYYY-MM-DD': hours } */
export const cellKey = (lineGUID: string, day: string): string => `${lineGUID}|${day}`;
export function enteredMap(rows: TimesheetEntered[]): Map<string, number> {
  return new Map(rows.map((e) => [cellKey(e.lineGUID, e.day), e.hours]));
}
export const roundHours = (n: number): number => Math.round(n * 100) / 100;
/** the hours of one line (the sum of its entered cells) */
export const hoursOfLine = (rows: TimesheetEntered[], lineGUID: string): number => roundHours(rows.filter((e) => e.lineGUID === lineGUID).reduce((s, e) => s + e.hours, 0));
/** the hours of one day over all the lines of the sheet */
export const hoursOfDay = (rows: TimesheetEntered[], day: string): number => roundHours(rows.filter((e) => e.day === day).reduce((s, e) => s + e.hours, 0));
export const hoursOfSheet = (rows: TimesheetEntered[]): number => roundHours(rows.reduce((s, e) => s + e.hours, 0));
/** the hours the sheet holds on a day OUTSIDE the line `exceptLineGUID` - what a cell of that line may still take is 24 minus this */
export const hoursOfDayExcept = (rows: TimesheetEntered[], day: string, exceptLineGUID: string): number =>
  roundHours(rows.filter((e) => e.day === day && e.lineGUID !== exceptLineGUID).reduce((s, e) => s + e.hours, 0));

export type TimesheetHoursProblem = 'notNumber' | 'tooMany' | 'dayOver24' | 'outsidePeriod';
/**
 * Is `hours` (null / 0 = empty = fine) allowed in this cell? The day total of the sheet may not pass 24. null = fine.
 */
export function timesheetHoursProblem(rows: TimesheetEntered[], lineGUID: string, day: string, hours: number | null, header: Pick<TimesheetHeader, 'startDate' | 'finishDate'>): TimesheetHoursProblem | null {
  if (hours === null || hours === 0) return null;
  if (!Number.isFinite(hours) || hours < 0) return 'notNumber';
  if (day < header.startDate || day > header.finishDate) return 'outsidePeriod';
  if (hours > TIMESHEET_MAX_HOURS_A_DAY) return 'tooMany';
  return hoursOfDayExcept(rows, day, lineGUID) + hours > TIMESHEET_MAX_HOURS_A_DAY ? 'dayOver24' : null;
}
export function timesheetHoursProblemText(p: TimesheetHoursProblem): string {
  switch (p) {
    case 'notNumber': return 'Type the hours as a number above 0.';
    case 'tooMany': return 'A cell takes at most 24 hours.';
    case 'dayOver24': return 'The hours of one day are at most 24.';
    case 'outsidePeriod': return 'This day is outside the period of the sheet.';
  }
}
/** the entered hours that a new period would drop (days outside it) - the screen asks before it moves a date */
export const enteredOutside = (rows: TimesheetEntered[], startDate: string, finishDate: string): TimesheetEntered[] => rows.filter((e) => e.day < startDate || e.day > finishDate);

// ---- states and commands ----
export const canEditTimesheet = (h: Pick<TimesheetHeader, 'status'>): boolean => h.status === 'draft';
export const canDeleteTimesheet = (h: Pick<TimesheetHeader, 'status'>): boolean => h.status === 'draft';
export const canUnpostTimesheet = (h: Pick<TimesheetHeader, 'status'>): boolean => h.status === 'posted';
/** Post needs a draft with at least one entered hour */
export const canPostTimesheet = (h: Pick<TimesheetHeader, 'status'>, enteredCount: number): boolean => h.status === 'draft' && enteredCount > 0;

/** the commands of the context menu of a line (right click / long press / the ⋮ button) */
export type TimesheetMove = 'up' | 'down' | 'first' | 'last';
export interface TimesheetLineMenuState { canEdit: boolean; index: number; count: number }
/** which commands of the menu are available: a posted sheet only copies the GUID; the ends of the list cannot move further */
export function lineMenuAvailability(m: TimesheetLineMenuState): { add: boolean; duplicate: boolean; moveUp: boolean; moveDown: boolean; delete: boolean } {
  return { add: m.canEdit, duplicate: m.canEdit, moveUp: m.canEdit && m.index > 0, moveDown: m.canEdit && m.index < m.count - 1, delete: m.canEdit };
}

/** the text of the "Hour cost" cell of a line: the price and its currency (contract / role), the budget money of the Time line, or "" when the role is not chosen / "no rate" */
export function hourCostText(line: Pick<TimesheetLine, 'role' | 'rateSource' | 'unitPrice' | 'unitPriceCurrency' | 'unitSumForBudget'>): { text: string; missing: boolean } {
  const round2 = (n: number) => String(Math.round(n * 100) / 100);
  if (line.rateSource === 'taskLine' && line.unitSumForBudget !== null) return { text: round2(line.unitSumForBudget), missing: false };
  if ((line.rateSource === 'contract' || line.rateSource === 'role') && line.unitPrice !== null) return { text: `${round2(line.unitPrice)}${line.unitPriceCurrency ? ` ${line.unitPriceCurrency}` : ''}`, missing: false };
  return { text: line.role ? 'no rate' : '', missing: !!line.role };
}

/** the order in which a line is filled: Project -> Task -> Role -> Budget item -> Business unit -> hours; what is enabled now */
export interface TimesheetLineEnabled { project: boolean; task: boolean; role: boolean; budgetItem: boolean; businessUnit: boolean; hours: boolean }
export function lineEnabled(line: Pick<TimesheetLine, 'project' | 'task' | 'role'>, header: Pick<TimesheetHeader, 'status' | 'workCenter'>, businessUnitOptions: number): TimesheetLineEnabled {
  const edit = header.status === 'draft';
  const task = edit && !!line.project;
  const role = task && !!line.task && !!header.workCenter;
  return { project: edit, task, role, budgetItem: role && !!line.role, businessUnit: role && businessUnitOptions > 0, hours: edit && role && !!line.role };
}

// ---- answers of the RPCs ----
export interface TimesheetPostProblem { lineGUID: string | null; problem: string; day?: string; hours?: number; otherSheet?: string; detail?: string }
export interface TimesheetPostAnswer { status: 'posted' | 'draft' | 'refused'; lines: number; problems: TimesheetPostProblem[] }
export function parsePostAnswer(data: any): TimesheetPostAnswer {
  const status = data?.status === 'posted' ? 'posted' : data?.status === 'draft' ? 'draft' : 'refused';
  const problems: TimesheetPostProblem[] = Array.isArray(data?.problems)
    ? data.problems.map((p: any) => ({ lineGUID: p?.lineGUID ?? null, problem: str(p?.problem), day: p?.day ? str(p.day).slice(0, 10) : undefined, hours: p?.hours == null ? undefined : num(p.hours), otherSheet: p?.otherSheet ? str(p.otherSheet) : undefined, detail: p?.detail ? str(p.detail) : undefined }))
    : [];
  return { status, lines: num(data?.lines), problems };
}
/** the answer of "Create based on → Time sheet" */
export interface TimesheetCreateAnswer { status: 'created' | 'skipped'; documentGUID: string; skipped: { reason: string }[] }
export function parseCreateAnswer(data: any): TimesheetCreateAnswer {
  return {
    status: data?.status === 'created' ? 'created' : 'skipped',
    documentGUID: str(data?.documentGUID),
    skipped: Array.isArray(data?.skipped) ? data.skipped.map((s: any) => ({ reason: str(s?.reason) })) : [],
  };
}
export function createSkippedText(reason: string): string {
  switch (reason) {
    case 'taskNotNormal': return 'A stage or a milestone has no time sheet: choose a normal task.';
    case 'taskNotFound': return 'The task was not found in your organization.';
    default: return 'The time sheet was not made.';
  }
}
/** the answer of "Create work center" */
export interface MyWorkCenterAnswer { status: 'created' | 'exists' | 'noPerson' | 'needsBusinessUnit'; workCenter: string }
export function parseMyWorkCenterAnswer(data: any): MyWorkCenterAnswer {
  const s = data?.status;
  return { status: s === 'created' || s === 'exists' || s === 'noPerson' ? s : 'needsBusinessUnit', workCenter: str(data?.workCenter) };
}

/** the text of a problem of Post (English, through pmT in the screen) */
export function timesheetProblemText(problem: string): string {
  switch (problem) {
    case 'documentIsPosted': return 'The time sheet is already posted.';
    case 'documentIsNotPosted': return 'The time sheet is not posted.';
    case 'workCenterMissing': return 'Choose the work center.';
    case 'workCenterNotAllowed': return 'This work center is not allowed for you.';
    case 'noHoursEntered': return 'No hours are entered.';
    case 'projectOrTaskMissing': return 'A line with hours needs its project and task.';
    case 'taskNotNormal': return 'Only a normal task can be posted (not a stage, not a milestone).';
    case 'roleMissing': return 'A line with hours needs its role.';
    case 'budgetItemMissing': return 'A line with hours needs its budget item.';
    case 'noRate': return 'There is no rate for the hour.';
    case 'noContractRate': return 'There is no rate for the hour: no contract of the person is in force on this day and the role has no rate.';
    case 'noRoleRate': return 'There is no rate for the hour: the role has no rate on this day.';
    case 'noExchangeRate': return 'The price cannot be converted: an exchange rate is missing.';
    case 'dateInTheFuture': return 'A day after tomorrow cannot be posted.';
    case 'dayOver24': return 'The work center would have more than 24 hours on this day.';
    case 'lineNoLongerValid': return 'A line is no longer valid (the task lines changed).';
    default: return problem;
  }
}
/** "<text> · 2026-10-14 · TS-00002" for one problem */
export function timesheetProblemLine(p: TimesheetPostProblem, t: (s: string) => string = (s) => s): string {
  return [t(timesheetProblemText(p.problem)), p.day, p.hours != null ? `${p.hours} h` : '', p.otherSheet, p.problem === 'noExchangeRate' ? p.detail : ''].filter(Boolean).join(' · ');
}

/** the form route params */
export const timesheetRouteParams = (documentGUID: string): Record<string, string> => ({ documentGUID });
export const timesheetPath = (documentGUID: string): string => `${TIMESHEET_ROUTE}?documentGUID=${encodeURIComponent(documentGUID)}`;
export const timesheetListPath = (taskGUID?: string): string => (taskGUID ? `${TIMESHEET_LIST_ROUTE}?taskGUID=${encodeURIComponent(taskGUID)}` : TIMESHEET_LIST_ROUTE);

/** the list filter (the quick filters of the list) -> the keys of timesheet_list */
export interface TimesheetListFilter { workCenter: string; status: string; startFrom: string; finishTo: string }
export const EMPTY_TIMESHEET_FILTER: TimesheetListFilter = { workCenter: '', status: '', startFrom: '', finishTo: '' };
export const timesheetFilterActive = (f: TimesheetListFilter): boolean => !!(f.workCenter || f.status || f.startFrom || f.finishTo);
export function timesheetFilterToRpc(f: TimesheetListFilter, extra: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = { ...extra };
  if (f.workCenter) out.timesheetWorkCenter = f.workCenter;
  if (f.status) out.status = f.status;
  if (isDay(f.startFrom)) out.startFrom = f.startFrom;
  if (isDay(f.finishTo)) out.finishTo = f.finishTo;
  return out;
}

/** the title of a catalog row for a select (rowJSON.title / name / taskDescription ...), else its GUID */
export function rowTitleOf(r: { rowGUID?: string; rowJSON?: Record<string, any> } | null | undefined): string {
  const j = r?.rowJSON ?? {};
  return str(j.title || j.name || j.taskDescription || j.workCenterTitle || j.roleTitle || r?.rowGUID);
}
