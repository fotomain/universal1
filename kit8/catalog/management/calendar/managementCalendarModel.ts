// Management calendar - the working calendars of the business (the abstract entity). Two tables:
//   managementCalendarTable       folders (level 1) projectCalendarFolder · resourceRoleCalendarFolder · personCalendarFolder   rowParentGUID 'empty'
//                                 calendars (level 2) workingDaysCalendar ...                                               rowParentGUID = folder
//                                 rowOwnerGUID 'managementCalendarCatalog' (the business; no business table exists yet) · rowJSON { title, description }
//   managementCalendarDaysTable   one row per DAY of a calendar: rowGUID '<calendar>:<YYYY-MM-DD>' · rowOwnerGUID = the calendar · rowParentGUID = the year ('2026')
//                                 rowJSON { day, isActive, reason: 'fill' | 'weekend' | 'holiday' | 'manual', note } · orderInList = days since 1970-01-01
//   isActive = false: the day is EXCLUDED - a task plan (kit8/pm/view/task/plan) gets no row and no money for it.
//   SQL: kit8/sql/init/create_management_calendar_tables.sql (+ RPC fill_management_calendar) · Screen: ManagementCalendarCRUD · route MANAGEMENT_CALENDAR_ROUTES.list
import type { FolderTreeNode } from '../../../ui/components/tree/folderTreeModel';
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const MANAGEMENT_CALENDAR_ROUTES = { list: '/catalog/management/calendar/list' } as const;

export const MANAGEMENT_CALENDAR_TABLE: ProductTableDef = {
  table: 'managementCalendarTable',
  entity: 'managementCalendarReusable',
  itemLabel: 'Calendar',
  catalogOwner: 'managementCalendarCatalog',
  purpose: 'The working calendars of the business, in folders for projects, resource roles and persons. A day switched off is excluded from the task plans.',
  emptyRowJSON: () => ({ title: null, description: null }),
};

export const MANAGEMENT_CALENDAR_DAYS_TABLE: ProductTableDef = {
  table: 'managementCalendarDaysTable',
  entity: 'managementCalendarDaysReusable',
  itemLabel: 'Day',
  catalogOwner: 'managementCalendarCatalog',
  purpose: 'One row per calendar day; isActive false = excluded.',
  emptyRowJSON: () => ({ day: null, isActive: true, reason: 'manual', note: null }),
};

/** rowGUIDs of the seed rows */
export const MANAGEMENT_CALENDAR = {
  projectFolder: 'projectCalendarFolder',
  resourceRoleFolder: 'resourceRoleCalendarFolder',
  personFolder: 'personCalendarFolder',
  /** the default calendar of a project plan: Monday to Friday, no holidays */
  workingDays: 'workingDaysCalendar',
} as const;

/** the calendar a project plans its tasks with when it names none */
export const DEFAULT_CALENDAR_FOR_TASK_PLAN = MANAGEMENT_CALENDAR.workingDays;

/** fill_management_calendar modes */
export type CalendarFillMode = 'workingDays' | 'fiveDays' | 'sixDays' | 'allDays';
export const CALENDAR_FILL_MODES: { mode: CalendarFillMode; label: string; hint: string }[] = [
  { mode: 'workingDays', label: 'Working days', hint: 'Monday to Friday; the days marked as holidays stay off' },
  { mode: 'fiveDays', label: '5 days a week', hint: 'Monday to Friday' },
  { mode: 'sixDays', label: '6 days a week', hint: 'Monday to Saturday' },
  { mode: 'allDays', label: 'All days', hint: 'every day of the year' },
];

export type CalendarDayReason = 'fill' | 'weekend' | 'holiday' | 'manual';
export interface CalendarDayJSON { day: string; isActive: boolean; reason: CalendarDayReason; note?: string | null }

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** a folder = a top level row (level 1); everything below is a calendar */
export const isCalendarFolder = (r: DefRow<any>) => !isSet(r.rowParentGUID);
export const calendarFolders = (rows: DefRow<any>[]) => (rows || []).filter(isCalendarFolder);
export const calendarsOf = (rows: DefRow<any>[]) => (rows || []).filter((r) => !isCalendarFolder(r));

/** the FOLDERS as tree nodes (title, order); the calendars are the rows of the table */
export function calendarNodes(rows: DefRow<any>[]): FolderTreeNode[] {
  return calendarFolders(rows).map((r) => ({
    id: r.rowGUID,
    parentId: null,
    title: String(r.rowJSON?.title ?? '').trim() || '(no title)',
    order: Number(r.orderInList) || 0,
  }));
}

/** 'Project › Working days' */
export function calendarPath(rows: DefRow<any>[], guid: string | null | undefined): string {
  const byId = new Map((rows || []).map((r) => [r.rowGUID, r]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let g = guid;
  while (isSet(g) && !seen.has(g)) {
    seen.add(g);
    const r = byId.get(g);
    if (!r) { parts.unshift(g); break; }
    parts.unshift(String(r.rowJSON?.title ?? '').trim() || r.rowGUID);
    g = r.rowParentGUID;
  }
  return parts.join(' › ');
}

// ---- days (pure, UTC: a calendar day is a date, never a moment) -------------------------------------------------------------------

export const DAY_MS = 86400000;
/** 'YYYY-MM-DD' of a UTC midnight */
export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
/** the UTC midnight of 'YYYY-MM-DD' (NaN when it is not a date) */
export const dayMs = (iso: string): number => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN);
/** the rowGUID of a day row */
export const calendarDayGUID = (calendarGUID: string, day: string) => `${calendarGUID}:${day}`;

/** the days of the closed range [fromDay, toDay] as 'YYYY-MM-DD' ([] when either is not a date or from > to) */
export function daysBetween(fromDay: string, toDay: string): string[] {
  const a = dayMs(fromDay), b = dayMs(toDay);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return [];
  const out: string[] = [];
  for (let t = a; t <= b; t += DAY_MS) out.push(isoDay(t));
  return out;
}

/** the years (as numbers) the closed range touches */
export const yearsBetween = (fromDay: string, toDay: string): number[] => {
  const a = Number(fromDay.slice(0, 4)), b = Number(toDay.slice(0, 4));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
};

export interface CalendarResolution {
  /** the active days of the range, ascending */
  active: string[];
  /** the days of the range that have NO row in the calendar (a year nobody filled) */
  missing: string[];
  /** the days of the range the calendar excludes */
  excluded: string[];
}

/**
 * The days of [fromDay, toDay] as the calendar sees them. A day without a row is `missing` (not guessed): the caller says "calendar not filled for 2027".
 * `dayRows` = the rows of managementCalendarDaysTable (rowJSON.day / rowJSON.isActive) of ONE calendar.
 */
export function resolveCalendarDays(dayRows: { rowJSON?: Partial<CalendarDayJSON> | null }[], fromDay: string, toDay: string): CalendarResolution {
  const state = new Map<string, boolean>();
  for (const r of dayRows || []) {
    const d = r?.rowJSON?.day;
    if (typeof d === 'string') state.set(d, r.rowJSON?.isActive !== false);
  }
  const out: CalendarResolution = { active: [], missing: [], excluded: [] };
  for (const d of daysBetween(fromDay, toDay)) {
    const s = state.get(d);
    if (s === undefined) out.missing.push(d);
    else if (s) out.active.push(d);
    else out.excluded.push(d);
  }
  return out;
}

/** the missing days as "2027" / "2026, 2027" (the years to fill) */
export const missingYears = (missing: string[]): string => Array.from(new Set(missing.map((d) => d.slice(0, 4)))).join(', ');

/** the active days cut into runs of consecutive days: an excluded day ends a run (the segments a task timeline is divided into) */
export function activeSegments(active: string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const d of active) {
    if (cur.length && dayMs(d) - dayMs(cur[cur.length - 1]) !== DAY_MS) { out.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) out.push(cur);
  return out;
}
