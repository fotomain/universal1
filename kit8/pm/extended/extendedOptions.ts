// The OPTIONS of the Gantt "Extended" functions (pure): everything a function needs besides its on / off switch.
//   project_table.rowJSON.ganttExtendedOptions  one object, normalized here (a missing or wrong value = its default, so an old project reads the defaults).
// The switches themselves (xxxxEnabled) are in extendedModel.ts. documentation/MORE_GANTT_INPUT.html
import type { PMRowJSON } from '../model/types';

/** a working calendar: the working week + exceptions (A10 / A11) */
export interface PMGanttCalendarDef {
  id: string;
  name: string;
  /** index = UTC weekday, 0 = Sunday: is the day worked */
  workWeek: boolean[];
  /** from / to = YYYY-MM-DD (both included); working = true makes the days WORKING days (an extra shift), default: a day off */
  exceptions: { from: string; to: string; name?: string; working?: boolean }[];
}

export type PMBarTextField = 'none' | 'start' | 'finish' | 'duration' | 'percent' | 'priority';
export type PMGroupBy = 'none' | 'priority' | 'critical' | 'percent' | 'duration' | 'inactive';
export type PMHighlight = 'none' | 'critical' | 'late' | 'milestones' | 'inProgress' | 'behindBaseline' | 'highPriority';
export type PMTimescaleUnit = 'auto' | 'year' | 'quarter' | 'month' | 'week' | 'day';

export interface PMNamedView {
  name: string;
  treeColumnsOrder?: string[];
  treeColumnsWidths?: Record<string, number>;
  hiddenColumns?: string[];
  groupBy?: PMGroupBy;
  highlight?: PMHighlight;
}

export interface PMExtendedOptions {
  // A2
  calculationManual: boolean;
  // A3
  constraintsAlwaysHonored: boolean;
  // A1
  newTasksManual: boolean;
  // A10 / A11
  calendars: PMGanttCalendarDef[];
  projectCalendarId: string | null;
  // C1 / C2
  baselineNo: number;
  // C5 / C7 / C8
  statusDate: string | null;
  // E1
  timescale: { top: PMTimescaleUnit; bottom: PMTimescaleUnit; labels: 'short' | 'long' };
  // E2
  barStyles: { normal: string | null; summary: string | null; milestone: string | null; critical: string | null; manual: string | null; corner: 'round' | 'square' };
  // E3
  barText: { left: PMBarTextField; right: PMBarTextField };
  // E4
  gridlines: { today: boolean; status: boolean; projectEdges: boolean; weeks: boolean; rows: boolean };
  // E5
  layout: { barHeight: 'small' | 'normal' | 'large'; summaryDetails: boolean };
  // E12
  textStyles: { critical: { bold: boolean; color: string | null }; summary: { bold: boolean; color: string | null }; milestone: { bold: boolean; color: string | null } };
  // F4: the extended columns the user switched on / off (an extended column that is not shown by default is in shownColumns)
  hiddenColumns: string[];
  shownColumns: string[];
  // F6
  wbsMask: string;
  // F8 / F9
  groupBy: PMGroupBy;
  highlight: PMHighlight;
  // F10
  views: PMNamedView[];
  // E9 / E10
  timeline: string[];
  detailsPane: boolean;
}

export const PM_DEFAULT_WORK_WEEK = [false, true, true, true, true, true, false];

export const PM_EXTENDED_OPTIONS_DEFAULT: PMExtendedOptions = {
  calculationManual: false,
  constraintsAlwaysHonored: true,
  newTasksManual: false,
  calendars: [],
  projectCalendarId: null,
  baselineNo: 0,
  statusDate: null,
  timescale: { top: 'auto', bottom: 'auto', labels: 'short' },
  barStyles: { normal: null, summary: null, milestone: null, critical: null, manual: null, corner: 'round' },
  barText: { left: 'none', right: 'none' },
  gridlines: { today: true, status: true, projectEdges: false, weeks: true, rows: true },
  layout: { barHeight: 'normal', summaryDetails: false },
  textStyles: { critical: { bold: false, color: null }, summary: { bold: false, color: null }, milestone: { bold: false, color: null } },
  hiddenColumns: [],
  shownColumns: [],
  wbsMask: '',
  groupBy: 'none',
  highlight: 'none',
  views: [],
  timeline: [],
  detailsPane: false,
};

const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
const colorOf = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const dateText = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

const FIELDS: readonly PMBarTextField[] = ['none', 'start', 'finish', 'duration', 'percent', 'priority'];
const UNITS: readonly PMTimescaleUnit[] = ['auto', 'year', 'quarter', 'month', 'week', 'day'];
const GROUPS: readonly PMGroupBy[] = ['none', 'priority', 'critical', 'percent', 'duration', 'inactive'];
const HIGHLIGHTS: readonly PMHighlight[] = ['none', 'critical', 'late', 'milestones', 'inProgress', 'behindBaseline', 'highPriority'];

export function normalizeCalendar(c: any): PMGanttCalendarDef | null {
  if (!c || typeof c.id !== 'string' || !c.id) return null;
  const week = Array.isArray(c.workWeek) && c.workWeek.length === 7 ? c.workWeek.map((x: unknown) => x === true) : [...PM_DEFAULT_WORK_WEEK];
  const exceptions = (Array.isArray(c.exceptions) ? c.exceptions : [])
    .map((e: any) => ({ from: dateText(e?.from), to: dateText(e?.to) ?? dateText(e?.from), name: typeof e?.name === 'string' ? e.name : undefined, working: e?.working === true }))
    .filter((e: any) => e.from && e.to)
    .map((e: any) => ({ from: e.from as string, to: (e.to as string) < (e.from as string) ? (e.from as string) : (e.to as string), ...(e.name ? { name: e.name } : {}), ...(e.working ? { working: true } : {}) }));
  return { id: c.id, name: typeof c.name === 'string' && c.name.trim() ? c.name : c.id, workWeek: week, exceptions };
}

/** project rowJSON -> every option, normalized */
export function extendedOptionsOf(json: Partial<PMRowJSON> | Record<string, any> | null | undefined): PMExtendedOptions {
  const o: any = (json as any)?.ganttExtendedOptions ?? {};
  const D = PM_EXTENDED_OPTIONS_DEFAULT;
  const bs = o.barStyles ?? {};
  const ts = o.textStyles ?? {};
  const style = (x: any) => ({ bold: x?.bold === true, color: colorOf(x?.color) });
  const calendars = (Array.isArray(o.calendars) ? o.calendars : []).map(normalizeCalendar).filter(Boolean) as PMGanttCalendarDef[];
  const projectCalendarId = typeof o.projectCalendarId === 'string' && calendars.some((c) => c.id === o.projectCalendarId) ? o.projectCalendarId : null;
  return {
    calculationManual: bool(o.calculationManual, D.calculationManual),
    constraintsAlwaysHonored: bool(o.constraintsAlwaysHonored, D.constraintsAlwaysHonored),
    newTasksManual: bool(o.newTasksManual, D.newTasksManual),
    calendars,
    projectCalendarId,
    baselineNo: Number.isInteger(o.baselineNo) && o.baselineNo >= 0 && o.baselineNo <= 10 ? o.baselineNo : 0,
    statusDate: dateText(o.statusDate),
    timescale: { top: oneOf(o.timescale?.top, UNITS, 'auto'), bottom: oneOf(o.timescale?.bottom, UNITS, 'auto'), labels: o.timescale?.labels === 'long' ? 'long' : 'short' },
    barStyles: { normal: colorOf(bs.normal), summary: colorOf(bs.summary), milestone: colorOf(bs.milestone), critical: colorOf(bs.critical), manual: colorOf(bs.manual), corner: bs.corner === 'square' ? 'square' : 'round' },
    barText: { left: oneOf(o.barText?.left, FIELDS, 'none'), right: oneOf(o.barText?.right, FIELDS, 'none') },
    gridlines: {
      today: bool(o.gridlines?.today, D.gridlines.today),
      status: bool(o.gridlines?.status, D.gridlines.status),
      projectEdges: bool(o.gridlines?.projectEdges, D.gridlines.projectEdges),
      weeks: bool(o.gridlines?.weeks, D.gridlines.weeks),
      rows: bool(o.gridlines?.rows, D.gridlines.rows),
    },
    layout: { barHeight: oneOf(o.layout?.barHeight, ['small', 'normal', 'large'] as const, 'normal'), summaryDetails: bool(o.layout?.summaryDetails, false) },
    textStyles: { critical: style(ts.critical), summary: style(ts.summary), milestone: style(ts.milestone) },
    hiddenColumns: strings(o.hiddenColumns),
    shownColumns: strings(o.shownColumns),
    wbsMask: typeof o.wbsMask === 'string' ? o.wbsMask.slice(0, 60) : '',
    groupBy: oneOf(o.groupBy, GROUPS, 'none'),
    highlight: oneOf(o.highlight, HIGHLIGHTS, 'none'),
    views: (Array.isArray(o.views) ? o.views : [])
      .filter((v: any) => v && typeof v.name === 'string' && v.name.trim())
      .map((v: any) => ({
        name: v.name,
        ...(Array.isArray(v.treeColumnsOrder) ? { treeColumnsOrder: strings(v.treeColumnsOrder) } : {}),
        ...(v.treeColumnsWidths && typeof v.treeColumnsWidths === 'object' ? { treeColumnsWidths: v.treeColumnsWidths } : {}),
        ...(Array.isArray(v.hiddenColumns) ? { hiddenColumns: strings(v.hiddenColumns) } : {}),
        ...(v.groupBy ? { groupBy: oneOf(v.groupBy, GROUPS, 'none') } : {}),
        ...(v.highlight ? { highlight: oneOf(v.highlight, HIGHLIGHTS, 'none') } : {}),
      })),
    timeline: strings(o.timeline),
    detailsPane: bool(o.detailsPane, false),
  };
}

/** the rowJSON patch that saves some options (the rest of ganttExtendedOptions stays) */
export function extendedOptionsPatch(json: Partial<PMRowJSON> | Record<string, any> | null | undefined, change: Partial<PMExtendedOptions>): { ganttExtendedOptions: PMExtendedOptions } {
  return { ganttExtendedOptions: { ...extendedOptionsOf(json), ...change } };
}
