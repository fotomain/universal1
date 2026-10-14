// Management calendar - the working calendars of the business (the abstract entity). Two tables:
//   (documentation/TIME_GENUS_CONTROL_WBS.html: a RESOURCE calendar - rowJSON.kind 'resource', in the folders Person / Equipment / Contract - is the CAPACITY of a person, an equipment
//    or a contract: its day rows carry rowJSON.hours (0..24); SQL: PART 21 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql)
//   managementCalendarTable       folders (level 1) projectCalendarFolder · resourceRoleCalendarFolder · personCalendarFolder · equipmentCalendarFolder · contractCalendarFolder   rowParentGUID 'empty'
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
  equipmentFolder: 'equipmentCalendarFolder',
  contractFolder: 'contractCalendarFolder',
  /** the calendar of every resource that has none: Monday to Friday, 8 hours a day */
  standardWorkWeek: 'standardWorkWeekCalendar',
  /** the default calendar of a project plan: Monday to Friday, no holidays */
  workingDays: 'workingDaysCalendar',
} as const;

/** the calendar a project plans its tasks with when it names none */
export const DEFAULT_CALENDAR_FOR_TASK_PLAN = MANAGEMENT_CALENDAR.workingDays;

/** fill_management_calendar modes */
export type CalendarFillMode = 'workingDays' | 'fiveDays' | 'sixDays' | 'allDays' | 'pattern';
export const CALENDAR_FILL_MODES: { mode: CalendarFillMode; label: string; hint: string }[] = [
  { mode: 'workingDays', label: 'Working days', hint: 'Monday to Friday; the days marked as holidays stay off' },
  { mode: 'fiveDays', label: '5 days a week', hint: 'Monday to Friday' },
  { mode: 'sixDays', label: '6 days a week', hint: 'Monday to Saturday' },
  { mode: 'allDays', label: 'All days', hint: 'every day of the year' },
];

/** the week mode a calendar with a custom week (rowJSON.weekPattern) is filled with: the hours of each weekday come from the pattern */
export const CALENDAR_PATTERN_FILL_MODE = { mode: 'pattern' as CalendarFillMode, label: 'Custom week', hint: 'the hours of each weekday of the calendar (weekPattern)' };

/** reasons of a day row; the exceptions of a resource calendar (vacation, sick leave, training, other) are kept by a Fill unless "Overwrite my manual changes" is on */
export type CalendarDayReason = 'fill' | 'weekend' | 'holiday' | 'manual' | 'vacation' | 'sickLeave' | 'training' | 'other';
export const CALENDAR_DAY_REASONS: { value: CalendarDayReason; label: string; resourceOnly?: boolean }[] = [
  { value: 'fill', label: 'Fill' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'manual', label: 'Manual' },
  { value: 'vacation', label: 'Vacation', resourceOnly: true },
  { value: 'sickLeave', label: 'Sick leave', resourceOnly: true },
  { value: 'training', label: 'Training', resourceOnly: true },
  { value: 'other', label: 'Other', resourceOnly: true },
];
export interface CalendarDayJSON { day: string; isActive: boolean; reason: CalendarDayReason; note?: string | null; /** resource calendars: the capacity of the day in hours (0 = not active) */ hours?: number }

/** a RESOURCE calendar = the capacity of persons / equipment / contracts (rowJSON.kind); a project calendar has no hours */
export const isResourceCalendar = (r: DefRow<any> | null | undefined): boolean => r?.rowJSON?.kind === 'resource';
/** the hours of an active day of a resource calendar (the default of a Fill) */
export const calendarHoursPerDay = (r: DefRow<any> | null | undefined): number => {
  const h = Number(r?.rowJSON?.hoursPerDay);
  return Number.isFinite(h) && h > 0 && h <= 24 ? h : 8;
};
export const hasWeekPattern = (r: DefRow<any> | null | undefined): boolean => !!r?.rowJSON?.weekPattern && typeof r.rowJSON.weekPattern === 'object';

/** the hours of a day row: its own hours, else (an old row) hoursPerDay for an active day and 0 for an excluded one */
export const dayRowHours = (rowJSON: Partial<CalendarDayJSON> | null | undefined, hoursPerDay = 8): number => {
  if (typeof rowJSON?.hours === 'number') return rowJSON.hours;
  return rowJSON?.isActive === false ? 0 : hoursPerDay;
};

/** a day of the calendar that has posted hours (organization_calendar_lock_info): the capacity of the day cannot go under minHours */
export interface CalendarLockDay { day: string; minHours: number; resources: number; example: string }

/**
 * The change of a day row of a resource calendar and the lock: the message that refuses it (null = allowed). The rule of SQL organization_assert_capacity:
 * a LOWERING of the capacity under the posted hours is refused; raising or keeping it is always allowed.
 */
export function calendarLockMessage(lock: CalendarLockDay | undefined, oldHours: number, newHours: number): string | null {
  if (!lock || newHours >= oldHours || newHours >= lock.minHours) return null;
  return `${lock.example || 'A resource'} has ${lock.minHours} h booked on ${lock.day}; the capacity cannot be less than ${lock.minHours} h.`;
}

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
