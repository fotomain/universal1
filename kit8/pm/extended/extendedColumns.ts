// Extended tree columns (pure): the fields of the Extended functions as READ-ONLY / editable tree columns, and the formula columns of F5.
// They are "virtual custom columns": the tree draws them like the custom columns of the project (kit8/pm/view/tree/columns/customColumns.ts), with the keys cc_ext_<field>;
// they are in the store's customColumns while their function is on (and shown), never in project_table.rowJSON.customColumns, and are never deleted from there.
//   shown = the function is on AND (the column is shown by default OR the user ticked it in the column picker (F4)) AND the user did not hide it
import type { PMCustomColumnDef, PMCustomColumnType, PMCustomColumnValue } from '../view/tree/columns/customColumns';
import type { PMScheduledRow, PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../model/types';
import type { PMExtendedOptions } from './extendedOptions';
import { baselineOf, baselineVariance } from './tracking';
import { constraintOf, PM_CONSTRAINT_LABELS } from '../model/taskConstraint';
import { PM_TASK_TYPES, triangleOf } from './taskTypes';
import { formatPredecessors, PMPredecessorItem } from './predecessorsText';
import { evalFormula, PMFormulaValue } from './formula';
import { taskCustomValuesOf } from '../view/tree/columns/customColumns';

export const EXT_COLUMN_PREFIX = 'cc_ext_';
export const isExtColumnKey = (k: unknown): k is `cc_ext_${string}` => typeof k === 'string' && k.startsWith(EXT_COLUMN_PREFIX);

export type PMExtField =
  | 'priority' | 'deadline' | 'predecessors' | 'mode' | 'constraintType' | 'constraintDate' | 'baselineStart' | 'baselineFinish' | 'startVariance' | 'finishVariance'
  | 'actualStart' | 'actualFinish' | 'work' | 'units' | 'taskType' | 'calendar';

export interface PMExtColumn {
  field: PMExtField;
  key: string;
  title: string;
  type: PMCustomColumnType;
  /** the Extended switch (xxxxEnabled) that brings the column */
  feature: string;
  defaultShown: boolean;
}

const col = (field: PMExtField, title: string, type: PMCustomColumnType, feature: string, defaultShown: boolean): PMExtColumn => ({ field, key: EXT_COLUMN_PREFIX + field, title, type, feature, defaultShown });

export const PM_EXT_COLUMNS: PMExtColumn[] = [
  col('predecessors', 'Predecessors', 'text', 'ganttPredecessorsColumnEnabled', true),
  col('priority', 'Priority', 'integer', 'ganttTaskPriorityEnabled', true),
  col('deadline', 'Deadline', 'date', 'ganttDeadlineEnabled', true),
  col('mode', 'Mode', 'text', 'ganttManualSchedulingEnabled', false),
  col('constraintType', 'Constraint', 'text', 'ganttConstraintsEnabled', false),
  col('constraintDate', 'Constraint date', 'date', 'ganttConstraintsEnabled', false),
  col('baselineStart', 'Baseline start', 'date', 'ganttBaselinesEnabled', false),
  col('baselineFinish', 'Baseline finish', 'date', 'ganttBaselinesEnabled', false),
  col('startVariance', 'Start variance (d)', 'integer', 'ganttBaselinesEnabled', true),
  col('finishVariance', 'Finish variance (d)', 'integer', 'ganttBaselinesEnabled', true),
  col('actualStart', 'Actual start', 'date', 'ganttActualDatesEnabled', false),
  col('actualFinish', 'Actual finish', 'date', 'ganttActualDatesEnabled', false),
  col('work', 'Work (h)', 'float', 'ganttTaskTypesEnabled', false),
  col('units', 'Units (%)', 'float', 'ganttTaskTypesEnabled', false),
  col('taskType', 'Task type', 'text', 'ganttTaskTypesEnabled', false),
  col('calendar', 'Calendar', 'text', 'ganttTaskCalendarEnabled', false),
];

/** the columns of the functions that are on (shown or not), for the column picker */
export const extColumnsAvailable = (flags: Record<string, boolean>): PMExtColumn[] => PM_EXT_COLUMNS.filter((c) => flags[c.feature] === true);

const isShown = (c: PMExtColumn, o: Pick<PMExtendedOptions, 'shownColumns' | 'hiddenColumns'>): boolean => (o.shownColumns.includes(c.key) || c.defaultShown) && !o.hiddenColumns.includes(c.key);

/** the virtual column definitions to add to the store's custom columns */
export function extColumnDefsOf(flags: Record<string, boolean>, o: Pick<PMExtendedOptions, 'shownColumns' | 'hiddenColumns'>): PMCustomColumnDef[] {
  return extColumnsAvailable(flags).filter((c) => isShown(c, o)).map((c) => ({ key: c.key as `cc_${string}`, name: c.title, type: c.type }));
}

export interface PMExtColumnContext {
  baselineNo: number;
  deps: readonly PMTaskDependencyRow[];
  wbsById: Record<string, string>;
  tasksById: Record<string, PMTaskRow | undefined>;
  calendarNames: Record<string, string>;
  /** the real custom columns of the project (their formulas) */
  customDefs: readonly (PMCustomColumnDef & { formula?: string })[];
}

const day = (ms: number | null | undefined): string | null => (ms === null || ms === undefined || !Number.isFinite(ms) ? null : new Date(ms).toISOString().slice(0, 10));
const dayOfIso = (iso: string | null | undefined): string | null => (iso ? day(Date.parse(iso)) : null);

/** the value of an Extended column for one row (the same kinds as the custom values: text, 'YYYY-MM-DD', number) */
export function extColumnValue(field: PMExtField, t: PMTaskRow | undefined, r: PMScheduledRow | undefined, ctx: PMExtColumnContext): PMCustomColumnValue {
  const j = (t?.rowJSON ?? {}) as PMTaskJSON;
  const summary = !!r?.isSummary;
  switch (field) {
    case 'priority': return summary ? null : j.taskPriority ?? 500;
    case 'deadline': return dayOfIso(j.taskDeadline);
    case 'mode': return summary ? null : r?.isManual ? 'Manual' : j.taskInactive ? 'Inactive' : 'Auto';
    case 'constraintType': { if (summary) return null; const c = constraintOf(j, true); return c.implicit ? '' : PM_CONSTRAINT_LABELS[c.type]; }
    case 'constraintDate': { if (summary) return null; const c = constraintOf(j, true); return day(c.dateMs); }
    case 'baselineStart': return day(baselineOf(j, ctx.baselineNo)?.startMs);
    case 'baselineFinish': { const b = baselineOf(j, ctx.baselineNo); return day(b ? b.finishMs - 86400000 : null); }
    case 'startVariance': { const v = r ? baselineVariance(r, baselineOf(j, ctx.baselineNo)) : null; return v ? v.startDays : null; }
    case 'finishVariance': { const v = r ? baselineVariance(r, baselineOf(j, ctx.baselineNo)) : null; return v ? v.finishDays : null; }
    case 'actualStart': return dayOfIso(j.actualStartAt);
    case 'actualFinish': return dayOfIso(j.actualFinishAt);
    case 'work': return summary ? null : triangleOf(j).workHours;
    case 'units': return summary ? null : triangleOf(j).units;
    case 'taskType': return summary ? null : PM_TASK_TYPES.find((x) => x.value === triangleOf(j).type)?.label ?? '';
    case 'calendar': return j.taskCalendarId ? ctx.calendarNames[j.taskCalendarId] ?? '' : '';
    case 'predecessors': {
      if (!t) return '';
      const items: PMPredecessorItem[] = ctx.deps
        .filter((d) => d.rowGUID === t.rowGUID)
        .map((d) => ({ wbs: ctx.wbsById[d.rowDependsOnGUID] ?? '?', type: d.linkType || 'FS', lagDays: Number(d.lagDays) || 0, lagPercent: typeof (d.rowJSON as any)?.lagPercent === 'number' ? (d.rowJSON as any).lagPercent : null }));
      return formatPredecessors(items);
    }
  }
}

const dayNumber = (ms: number | null | undefined): number | null => (ms === null || ms === undefined ? null : Math.floor(ms / 86400000));

/** a field of the row as a formula sees it ([Name] [WBS] [Duration] [% Complete] [Start] [Finish] [Priority] [Work] [Units] [Slack] or another custom column by its name) */
export function formulaFieldOf(name: string, t: PMTaskRow | undefined, r: PMScheduledRow | undefined, ctx: PMExtColumnContext, depth = 0): PMFormulaValue {
  const j = (t?.rowJSON ?? {}) as PMTaskJSON;
  switch (name.toLowerCase()) {
    case 'name': return j.taskDescription ?? '';
    case 'wbs': return t ? ctx.wbsById[t.rowGUID] ?? '' : '';
    case 'duration': return r ? r.durationDays : j.durationDays ?? null;
    case '% complete': case 'percent': case 'progress': return r ? Math.round(r.progress) : t ? Math.round(t.rowProgress || 0) : null;
    case 'start': return dayNumber(r?.startMs);
    case 'finish': return dayNumber(r ? r.finishMs - 86400000 : null);
    case 'priority': return j.taskPriority ?? 500;
    case 'work': return triangleOf(j).workHours;
    case 'units': return triangleOf(j).units;
    case 'slack': return r?.slackDays ?? r?.totalFloatDays ?? null;
  }
  const def = ctx.customDefs.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!def) return null;
  const v = customCellValue(def.key, t, r, ctx, depth + 1);
  return v as PMFormulaValue;
}

/**
 * The value of ANY custom / extended cell: an Extended column, a formula column, or the value saved in the row.
 * A formula column calls other columns by name; a loop is cut after 5 levels.
 */
export function customCellValue(key: string, t: PMTaskRow | undefined, r: PMScheduledRow | undefined, ctx: PMExtColumnContext, depth = 0): PMCustomColumnValue {
  if (isExtColumnKey(key)) return extColumnValue(key.slice(EXT_COLUMN_PREFIX.length) as PMExtField, t, r, ctx);
  const def = ctx.customDefs.find((c) => c.key === key);
  if (def?.formula) {
    if (depth > 5) return null;
    const v = evalFormula(def.formula, (n) => formulaFieldOf(n, t, r, ctx, depth));
    if (v === null) return null;
    if (def.type === 'integer') return typeof v === 'number' ? Math.round(v) : null;
    if (def.type === 'float') return typeof v === 'number' ? v : null;
    if (def.type === 'boolean') return typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : null;
    return typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : v;
  }
  const v = taskCustomValuesOf(t?.rowJSON as any)[key];
  return v === undefined ? null : v;
}

/** which extended columns the user can edit in the cell (a stage has none): the others are read-only */
const EDITABLE: PMExtField[] = ['priority', 'deadline', 'predecessors', 'actualStart', 'actualFinish', 'work', 'units'];
export function extColumnEditable(key: string, summaryRow: boolean): boolean {
  if (!isExtColumnKey(key)) return true; // a plain custom column
  if (summaryRow) return false;
  return EDITABLE.includes(key.slice(EXT_COLUMN_PREFIX.length) as PMExtField);
}
