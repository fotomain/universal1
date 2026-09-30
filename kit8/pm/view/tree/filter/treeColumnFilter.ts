// Filter & sort of the task tree columns. Pure (no React / Skia / Supabase, no imports from
// model/types -> safe to use from there) - used by the store (visible rows), the Skia header
// (icons), the "Filter & sort" popup and the unit tests (__tests__/pm/view/tree/filter).
//
// Saved per project AND user in project_user_settings_table.rowJSON.uxuiSettings:
//   treeColumnsFilters     { [columnKey]: { filterVariantForColumn, value?, value2? } }   (all filters AND-ed)
//   treeColumnSort         { key, direction: 'asc' | 'desc' } | null                     (one column at a time)
//   columnFilterIconColor  '#RRGGBB' - filter icon of a filtered column header (default light vibrant red)
//
// Tree semantics (DHTMLX / MS Project "show related summary rows"):
//   * a row is shown when it matches every filter, or when one of its descendants does - those
//     ancestors are "context" rows (drawn muted) so the hierarchy stays readable;
//   * sorting orders the siblings of every parent (children stay inside their stage);
//     empty values are always last; ties keep the tree order.
//
// filterVariantForColumn:
//   isExactly · isNot · isOneOf (comma separated) · contains · doesNotContain · beginsWith ·
//   after (greater than) · before (less than) · lessThanOrEqual · greaterThanOrEqual · between (A and B) ·
//   matches (old AX / D365 query syntax, see compileMatches) · isEmpty · isNotEmpty (custom columns only)

import type { PMScheduledRow, PMTaskRow } from '../../../model/types';
import type { PMProjectKanbanStageRow, PMTaskKanbanStateRow } from '../../../model/kanbanTypes';
import type { PMTreeIndex } from '../../project/scheduling';
import type { PMTreeColumnKey } from '../columns/treeColumns';
import { isCustomColumnKey, PMCustomColumnDef, taskCustomValuesOf } from '../columns/customColumns';

/** = scheduling.ROOT_KEY (not imported: keeps this file free of import cycles) */
const ROOT_KEY = '__root__';
const DAY_MS = 86_400_000;
const todayUTC = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// =====================================================================================
// types
// =====================================================================================

export type PMTreeColumnDataType = 'text' | 'number' | 'date' | 'boolean';

export type PMFilterVariantForColumn =
  | 'isExactly'
  | 'isNot'
  | 'isOneOf'
  | 'contains'
  | 'doesNotContain'
  | 'beginsWith'
  | 'after'
  | 'before'
  | 'lessThanOrEqual'
  | 'greaterThanOrEqual'
  | 'between'
  | 'matches'
  | 'isEmpty'
  | 'isNotEmpty';

export const PM_FILTER_VARIANTS: readonly PMFilterVariantForColumn[] = [
  'isExactly',
  'isNot',
  'isOneOf',
  'contains',
  'doesNotContain',
  'beginsWith',
  'after',
  'before',
  'lessThanOrEqual',
  'greaterThanOrEqual',
  'between',
  'matches',
  'isEmpty',
  'isNotEmpty',
];

/** One column filter = uxuiSettings.treeColumnsFilters[columnKey]. */
export interface PMTreeColumnFilter {
  filterVariantForColumn: PMFilterVariantForColumn;
  /** operand (between: A; isOneOf: "a, b, c"; matches: the expression) */
  value?: string;
  /** between: B */
  value2?: string;
}

export type PMTreeColumnsFilters = Record<string, PMTreeColumnFilter>;

export type PMSortDirection = 'asc' | 'desc';

/** uxuiSettings.treeColumnSort */
export interface PMTreeColumnSort {
  key: PMTreeColumnKey;
  direction: PMSortDirection;
}

/** Default color of the filter icon on a filtered column header (light vibrant red). */
export const PM_DEFAULT_COLUMN_FILTER_ICON_COLOR = '#FF4D6D';
/** Quick swatches of the settings window (any '#RRGGBB' is allowed - Custom). */
export const PM_COLUMN_FILTER_ICON_COLORS = ['#FF4D6D', '#FF3B30', '#FF5E3A', '#FF2D95', '#FF9F0A', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF', '#BF5AF2'];

/** A saved color -> upper-case '#RRGGBB'; invalid / missing -> the default. */
export function columnFilterIconColorOf(value: unknown): string {
  if (typeof value !== 'string') return PM_DEFAULT_COLUMN_FILTER_ICON_COLOR;
  let v = value.trim().toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9A-F]{8}$/.test(v)) v = v.slice(0, 7);
  return /^#[0-9A-F]{6}$/.test(v) ? v : PM_DEFAULT_COLUMN_FILTER_ICON_COLOR;
}

// =====================================================================================
// columns: data type, variants, labels
// =====================================================================================

/** Data type of a tree column (null = unknown column, e.g. a deleted custom column). */
export function treeColumnDataType(key: string, customColumns: readonly PMCustomColumnDef[] = []): PMTreeColumnDataType | null {
  switch (key) {
    case 'wbs':
    case 'name':
    case 'kanban':
      return 'text';
    case 'taskStartDate':
    case 'start':
    case 'taskFinishDate':
      return 'date';
    case 'taskDuration':
    case 'days':
    case 'progress':
    case 'kanbanStageProgressPercent':
    case 'startHourStart':
    case 'startHourFinish':
    case 'planMinuteStart':
    case 'planMinuteFinish':
    case 'planSecondStart':
    case 'planSecondFinish':
      return 'number';
  }
  if (!isCustomColumnKey(key)) return null;
  const def = customColumns.find((c) => c.key === key);
  if (!def) return null;
  return def.type === 'integer' || def.type === 'float' ? 'number' : def.type;
}

/** Custom cells can be empty (built-in cells always have a value). */
export const treeColumnCanBeEmpty = (key: string) => isCustomColumnKey(key);

const COMPARE_VARIANTS: PMFilterVariantForColumn[] = ['after', 'before', 'lessThanOrEqual', 'greaterThanOrEqual', 'between'];

/** filterVariantForColumn offered for a column type, in menu order. */
export function filterVariantsForColumn(type: PMTreeColumnDataType, canBeEmpty = false): PMFilterVariantForColumn[] {
  const empty: PMFilterVariantForColumn[] = canBeEmpty ? ['isEmpty', 'isNotEmpty'] : [];
  switch (type) {
    case 'text':
      return ['isExactly', 'isNot', 'isOneOf', 'contains', 'doesNotContain', 'beginsWith', ...COMPARE_VARIANTS, 'matches', ...empty];
    case 'number':
    case 'date':
      return ['isExactly', 'isNot', 'isOneOf', ...COMPARE_VARIANTS, 'matches', ...empty];
    case 'boolean':
      return ['isExactly', 'isNot', ...empty];
  }
}

/** Variant preselected when a column has no filter yet (D365: "begins with" for text). */
export function defaultFilterVariant(type: PMTreeColumnDataType): PMFilterVariantForColumn {
  return type === 'text' ? 'beginsWith' : 'isExactly';
}

/** Label of a variant for a column type ("Is exactly" text, "Is equal to" number, "Is on" date ...). */
export function filterVariantLabel(v: PMFilterVariantForColumn, type: PMTreeColumnDataType): string {
  const num = type === 'number';
  const date = type === 'date';
  switch (v) {
    case 'isExactly':
      return num ? 'Is equal to' : date ? 'Is on' : type === 'boolean' ? 'Is' : 'Is exactly';
    case 'isNot':
      return num ? 'Is not equal to' : date ? 'Is not on' : 'Is not';
    case 'isOneOf':
      return 'Is one of';
    case 'contains':
      return 'Contains';
    case 'doesNotContain':
      return 'Does not contain';
    case 'beginsWith':
      return 'Begins with';
    case 'after':
      return num ? 'Greater than' : 'After';
    case 'before':
      return num ? 'Less than' : 'Before';
    case 'lessThanOrEqual':
      return num ? 'Less than or equal' : date ? 'On or before' : 'Before or equal';
    case 'greaterThanOrEqual':
      return num ? 'Greater than or equal' : date ? 'On or after' : 'After or equal';
    case 'between':
      return 'Between';
    case 'matches':
      return 'Matches';
    case 'isEmpty':
      return 'Is empty';
    case 'isNotEmpty':
      return 'Is not empty';
  }
}

/** Short hint under a variant in the list. */
export function filterVariantDescription(v: PMFilterVariantForColumn, type: PMTreeColumnDataType): string | undefined {
  switch (v) {
    case 'isOneOf':
      return 'Values separated by commas';
    case 'between':
      return 'From A to B (both included)';
    case 'matches':
      return type === 'text' ? 'D365 syntax  *  ?  !  ..  ,  <  >  ""' : 'D365 syntax  !  ..  ,  <  >  ""';
    default:
      return undefined;
  }
}

/** Inputs the variant needs: 0 (empty / not empty), 1, or 2 (between). */
export function filterVariantInputs(v: PMFilterVariantForColumn): 0 | 1 | 2 {
  return v === 'isEmpty' || v === 'isNotEmpty' ? 0 : v === 'between' ? 2 : 1;
}

/** Sort command labels per type. */
export function sortLabels(type: PMTreeColumnDataType): { asc: string; desc: string } {
  switch (type) {
    case 'date':
      return { asc: 'Sort oldest to newest', desc: 'Sort newest to oldest' };
    case 'number':
      return { asc: 'Sort smallest to largest', desc: 'Sort largest to smallest' };
    case 'boolean':
      return { asc: 'Sort No to Yes', desc: 'Sort Yes to No' };
    default:
      return { asc: 'Sort A to Z', desc: 'Sort Z to A' };
  }
}

/** Input placeholder per type / variant. */
export function filterInputPlaceholder(type: PMTreeColumnDataType, v: PMFilterVariantForColumn): string {
  if (v === 'isOneOf') return type === 'date' ? '2026-01-05, 2026-02-01' : type === 'number' ? '1, 5, 10' : 'Design, Build';
  if (v === 'matches') return type === 'text' ? 'G*V, !Gustav' : type === 'date' ? '2026-01-01..2026-03-31' : '10..20, !15';
  if (type === 'date') return 'YYYY-MM-DD · t = today';
  if (type === 'number') return 'Number';
  if (type === 'boolean') return 'Yes / No';
  return 'Text';
}

// =====================================================================================
// values
// =====================================================================================

export type PMCellFilterValue = string | number | boolean | null;
type Value = Exclude<PMCellFilterValue, null>;

export interface PMTreeFilterContext {
  tasksById: Record<string, PMTaskRow | undefined>;
  schedule: Record<string, PMScheduledRow | undefined>;
  tree: Pick<PMTreeIndex, 'wbsById' | 'childrenById'>;
  customColumns: readonly PMCustomColumnDef[];
  kanbanStages?: readonly PMProjectKanbanStageRow[];
  kanbanStates?: Record<string, PMTaskKanbanStateRow | undefined>;
}

/**
 * Value of a tree cell as the filter / sort sees it: text = string, number = number,
 * date = UTC-midnight ms, boolean = true / false; empty = null.
 */
export function treeCellFilterValue(key: string, guid: string, ctx: PMTreeFilterContext): PMCellFilterValue {
  const t = ctx.tasksById[guid];
  const r = ctx.schedule[guid];
  switch (key) {
    case 'wbs':
      return ctx.tree.wbsById[guid] ?? '';
    case 'name':
      return t?.rowJSON?.name ?? '';
    case 'taskStartDate':
    case 'start':
      return r ? r.startMs : null;
    case 'taskFinishDate':
      return r ? (r.finishMs > r.startMs ? r.finishMs - 1 : r.startMs) : null;
    case 'taskDuration':
    case 'days':
      return r ? r.durationDays : typeof t?.rowJSON?.durationDays === 'number' ? t.rowJSON.durationDays : null;
    case 'progress':
      return r ? Math.round(r.progress) : null; // as shown in the cell
    case 'kanban': {
      const stages = ctx.kanbanStages;
      if (!stages || !stages.length) return '';
      const saved = ctx.kanbanStates?.[guid]?.rowJSON?.stageGUID;
      const stage = (saved && stages.find((s) => s.rowGUID === saved)) || stages[0];
      return stage?.rowJSON?.stageName ?? '';
    }
    case 'kanbanStageProgressPercent': {
      const state = ctx.kanbanStates?.[guid];
      return Math.round(state?.rowJSON?.kanbanStageProgressPercent ?? 0);
    }
    case 'startHourStart':
      return typeof t?.rowJSON?.startHourStart === 'number' ? t.rowJSON.startHourStart : (r ? new Date(r.startMs).getUTCHours() : null);
    case 'startHourFinish':
      return typeof t?.rowJSON?.startHourFinish === 'number' ? t.rowJSON.startHourFinish : (r ? new Date(r.finishMs > r.startMs ? r.finishMs - 1 : r.startMs).getUTCHours() : null);
    case 'planMinuteStart':
      return typeof t?.rowJSON?.planMinuteStart === 'number' ? t.rowJSON.planMinuteStart : (r ? new Date(r.startMs).getUTCMinutes() : null);
    case 'planMinuteFinish':
      return typeof t?.rowJSON?.planMinuteFinish === 'number' ? t.rowJSON.planMinuteFinish : (r ? new Date(r.finishMs > r.startMs ? r.finishMs - 1 : r.startMs).getUTCMinutes() : null);
    case 'planSecondStart':
      return typeof t?.rowJSON?.planSecondStart === 'number' ? t.rowJSON.planSecondStart : (r ? new Date(r.startMs).getUTCSeconds() : null);
    case 'planSecondFinish':
      return typeof t?.rowJSON?.planSecondFinish === 'number' ? t.rowJSON.planSecondFinish : (r ? new Date(r.finishMs > r.startMs ? r.finishMs - 1 : r.startMs).getUTCSeconds() : null);
  }
  const type = treeColumnDataType(key, ctx.customColumns);
  if (!type) return null;
  const v = taskCustomValuesOf(t?.rowJSON)[key];
  if (v === null || v === undefined || v === '') return null;
  switch (type) {
    case 'boolean':
      return v === true || v === false ? v : null;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    case 'date':
      return typeof v === 'string' ? parseFilterDate(v) : null;
    default:
      return String(v);
  }
}

/** Text of a value (wildcards of "matches" on numbers / dates match this text). */
export function filterValueText(v: PMCellFilterValue, type: PMTreeColumnDataType): string {
  if (v === null) return '';
  if (type === 'date' && typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  if (type === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : null;

/** Natural, case-insensitive text order ("1.9" < "1.10", "a" = "A"). */
export function compareText(a: string, b: string): number {
  if (collator) return collator.compare(a, b);
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Compares two non-empty values of the same column type. */
export function compareFilterValues(a: Value, b: Value, type: PMTreeColumnDataType): number {
  if (type === 'text') return compareText(String(a), String(b));
  if (type === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  return (a as number) - (b as number);
}

/**
 * Date operand: YYYY-MM-DD · D.M.YYYY · M/D/YYYY · t / today · (day(n)) = today + n days (D365).
 * Returns UTC-midnight ms or null.
 */
export function parseFilterDate(text: string, today: number = todayUTC()): number | null {
  const s = (text ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 't' || s === 'today') return today;
  let m = /^\(\s*day\(\s*([-+]?\d+)\s*\)\s*\)$/.exec(s);
  if (m) return today + Number(m[1]) * DAY_MS;
  let y: number;
  let mo: number;
  let d: number;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) [mo, d, y] = [+m[1], +m[2], +m[3]];
  else return null;
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? ms : null;
}

/** Operand text -> value of the column type, or { error }. */
export function parseFilterOperand(type: PMTreeColumnDataType, text: string, today: number = todayUTC()): { value: Value } | { error: string } {
  const t = (text ?? '').trim();
  if (!t) return { error: 'Enter a value' };
  switch (type) {
    case 'text':
      return { value: t };
    case 'number': {
      const s = t.replace(/\s|%/g, '').replace(',', '.');
      if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { error: `"${t}" is not a number` };
      return { value: Number(s) };
    }
    case 'date': {
      const ms = parseFilterDate(t, today);
      return ms === null ? { error: `"${t}" is not a date (YYYY-MM-DD)` } : { value: ms };
    }
    case 'boolean': {
      const l = t.toLowerCase();
      if (['yes', 'y', 'true', '1', '+', '✓', 'x'].includes(l)) return { value: true };
      if (['no', 'n', 'false', '0', '-'].includes(l)) return { value: false };
      return { error: 'Yes or No' };
    }
  }
}

// =====================================================================================
// compile + evaluate
// =====================================================================================

export type PMCellPredicate = (v: PMCellFilterValue) => boolean;
type Compiled = { test: PMCellPredicate } | { error: string };

const isEmptyValue = (x: PMCellFilterValue) => x === null || x === '';
const escapeRe = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

/** D365 wildcards: * = any characters, ? = one character (case-insensitive, whole value). */
export function wildcardRegExp(pattern: string): RegExp {
  return new RegExp(`^${escapeRe(pattern).replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
}

/** Splits "a, b, c" - a quoted part may contain commas: "a, b". */
export function splitFilterList(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of text ?? '') {
    if (ch === '"') quoted = !quoted;
    if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

const unquote = (s: string) => (s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s);

/**
 * "Matches" = the old AX / D365 query range syntax
 * (https://www.d365fandom.com/2021/01/using-old-ax-filtering-techniques-d365fo.html):
 *   value     equal (text: case-insensitive)             !value    not equal
 *   a..b      from a to b (included)                     ..b / a.. up to b / from a
 *   >value    greater than   <value less than            (>= and <= are accepted too)
 *   * ?       wildcards: any characters / one character  (on numbers and dates: their text)
 *   ""        empty                                      !""       not empty
 *   a, b, !c  list: (a OR b) AND NOT c    - "G*V, !Gustav" = starts with G, ends with V, but not Gustav
 *   dates:    t = today · (day(-1)) = yesterday · (day(7)) = in a week
 */
export function compileMatches(expr: string, type: PMTreeColumnDataType, today: number = todayUTC()): Compiled {
  const terms = splitFilterList(expr);
  if (!terms.length) return { error: `Enter an expression, e.g. ${filterInputPlaceholder(type, 'matches')}` };
  const pos: PMCellPredicate[] = [];
  const neg: PMCellPredicate[] = [];
  const operand = (s: string) => parseFilterOperand(type, unquote(s), today);
  for (const term of terms) {
    const isNeg = term.startsWith('!');
    const body = (isNeg ? term.slice(1) : term).trim();
    let pred: PMCellPredicate;
    if (!body) return { error: `"${term}": nothing after "!"` };
    if (body === '""') {
      pred = isEmptyValue;
    } else if (body.includes('..')) {
      const at = body.indexOf('..');
      const a = body.slice(0, at).trim();
      const b = body.slice(at + 2).trim();
      if (!a && !b) return { error: `"${term}": a range needs a start and / or an end` };
      const lo = a ? operand(a) : null;
      const hi = b ? operand(b) : null;
      if (lo && 'error' in lo) return lo;
      if (hi && 'error' in hi) return hi;
      const loV = lo ? lo.value : null;
      const hiV = hi ? hi.value : null;
      pred = (v) => !isEmptyValue(v) && (loV === null || compareFilterValues(v!, loV, type) >= 0) && (hiV === null || compareFilterValues(v!, hiV, type) <= 0);
    } else if (/^[<>]/.test(body)) {
      const op = /^[<>]=?/.exec(body)![0];
      const o = operand(body.slice(op.length));
      if ('error' in o) return o;
      pred = (v) => {
        if (isEmptyValue(v)) return false;
        const c = compareFilterValues(v!, o.value, type);
        return op === '>' ? c > 0 : op === '>=' ? c >= 0 : op === '<' ? c < 0 : c <= 0;
      };
    } else if (/[*?]/.test(body)) {
      const re = wildcardRegExp(unquote(body));
      pred = (v) => !isEmptyValue(v) && re.test(filterValueText(v, type));
    } else {
      const o = operand(body);
      if ('error' in o) return o;
      pred = (v) => !isEmptyValue(v) && compareFilterValues(v!, o.value, type) === 0;
    }
    (isNeg ? neg : pos).push(pred);
  }
  return { test: (v) => (pos.length === 0 || pos.some((p) => p(v))) && neg.every((p) => !p(v)) };
}

/** A saved filter -> cell predicate, or { error } (shown in the popup; the tree ignores invalid filters). */
export function compileTreeColumnFilter(filter: PMTreeColumnFilter, type: PMTreeColumnDataType, today: number = todayUTC()): Compiled {
  const v = filter?.filterVariantForColumn;
  if (!filterVariantsForColumn(type, true).includes(v)) return { error: 'This filter does not fit the column' };
  switch (v) {
    case 'isEmpty':
      return { test: isEmptyValue };
    case 'isNotEmpty':
      return { test: (x) => !isEmptyValue(x) };
    case 'matches':
      return compileMatches(filter.value ?? '', type, today);
    case 'isOneOf': {
      const parts = splitFilterList(filter.value ?? '');
      if (!parts.length) return { error: 'Enter values separated by commas' };
      const values: Value[] = [];
      for (const p of parts) {
        const o = parseFilterOperand(type, unquote(p), today);
        if ('error' in o) return o;
        values.push(o.value);
      }
      return { test: (x) => !isEmptyValue(x) && values.some((y) => compareFilterValues(x!, y, type) === 0) };
    }
    case 'between': {
      const a = parseFilterOperand(type, filter.value ?? '', today);
      if ('error' in a) return { error: `A: ${a.error}` };
      const b = parseFilterOperand(type, filter.value2 ?? '', today);
      if ('error' in b) return { error: `B: ${b.error}` };
      // A and B in any order
      const [lo, hi] = compareFilterValues(a.value, b.value, type) <= 0 ? [a.value, b.value] : [b.value, a.value];
      return { test: (x) => !isEmptyValue(x) && compareFilterValues(x!, lo, type) >= 0 && compareFilterValues(x!, hi, type) <= 0 };
    }
    case 'contains':
    case 'doesNotContain':
    case 'beginsWith': {
      const needle = (filter.value ?? '').trim().toLowerCase();
      if (!needle) return { error: 'Enter a value' };
      if (v === 'contains') return { test: (x) => !isEmptyValue(x) && String(x).toLowerCase().includes(needle) };
      if (v === 'doesNotContain') return { test: (x) => isEmptyValue(x) || !String(x).toLowerCase().includes(needle) };
      return { test: (x) => !isEmptyValue(x) && String(x).toLowerCase().startsWith(needle) };
    }
  }
  const o = parseFilterOperand(type, filter.value ?? '', today);
  if ('error' in o) return o;
  const y = o.value;
  const cmp = (x: PMCellFilterValue) => compareFilterValues(x!, y, type);
  switch (v) {
    case 'isExactly':
      return { test: (x) => !isEmptyValue(x) && cmp(x) === 0 };
    case 'isNot':
      return { test: (x) => isEmptyValue(x) || cmp(x) !== 0 };
    case 'after':
      return { test: (x) => !isEmptyValue(x) && cmp(x) > 0 };
    case 'before':
      return { test: (x) => !isEmptyValue(x) && cmp(x) < 0 };
    case 'lessThanOrEqual':
      return { test: (x) => !isEmptyValue(x) && cmp(x) <= 0 };
    case 'greaterThanOrEqual':
      return { test: (x) => !isEmptyValue(x) && cmp(x) >= 0 };
  }
  return { error: 'Unknown filter' };
}

/** Human summary: 'begins with "Des"', 'between 1 and 5', 'is empty'. */
export function describeTreeColumnFilter(filter: PMTreeColumnFilter, type: PMTreeColumnDataType): string {
  const variant = filter.filterVariantForColumn;
  const label = filterVariantLabel(variant, type).toLowerCase();
  const quote = type === 'text' && variant !== 'matches' && variant !== 'isOneOf';
  const q = (s?: string) => (quote ? `"${s ?? ''}"` : s ?? '');
  const n = filterVariantInputs(variant);
  if (n === 0) return label;
  if (n === 2) return `${label} ${q(filter.value)} and ${q(filter.value2)}`;
  return `${label} ${q(filter.value)}`;
}

// =====================================================================================
// saved settings
// =====================================================================================

/** Valid saved filters only (known variant, string operands); unknown columns dropped when `knownKeys` is given. */
export function normalizeTreeColumnsFilters(value: unknown, knownKeys?: readonly string[]): PMTreeColumnsFilters {
  const out: PMTreeColumnsFilters = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [k, f] of Object.entries(value as Record<string, any>)) {
    if (knownKeys && !knownKeys.includes(k)) continue;
    if (!f || typeof f !== 'object' || !(PM_FILTER_VARIANTS as readonly string[]).includes(f.filterVariantForColumn)) continue;
    const item: PMTreeColumnFilter = { filterVariantForColumn: f.filterVariantForColumn };
    if (typeof f.value === 'string') item.value = f.value;
    if (typeof f.value2 === 'string') item.value2 = f.value2;
    out[k] = item;
  }
  return out;
}

export function normalizeTreeColumnSort(value: unknown, knownKeys?: readonly string[]): PMTreeColumnSort | null {
  const v = value as PMTreeColumnSort | null | undefined;
  if (!v || typeof v !== 'object' || typeof v.key !== 'string') return null;
  if (v.direction !== 'asc' && v.direction !== 'desc') return null;
  if (knownKeys && !knownKeys.includes(v.key)) return null;
  return { key: v.key, direction: v.direction };
}

/** Filter of a column that the tree really applies (valid, known column). */
export function isTreeColumnFilterActive(key: string, filter: PMTreeColumnFilter | undefined, customColumns: readonly PMCustomColumnDef[]): boolean {
  if (!filter) return false;
  const type = treeColumnDataType(key, customColumns);
  return !!type && 'test' in compileTreeColumnFilter(filter, type);
}

// =====================================================================================
// visible rows
// =====================================================================================

export interface PMFilteredTreeRows {
  visibleRows: string[];
  /** rows shown only because a descendant matches (drawn muted); null = no filter */
  contextGUIDs: Record<string, true> | null;
  /** rows that match every filter (null = no filter) */
  matchCount: number | null;
  /** columns whose filter was applied */
  appliedFilterKeys: string[];
}

/**
 * Visible row order of the tree with the column filters and the sort applied.
 * No filter and no sort = exactly flattenVisible(tree, expanded).
 */
export function filterAndSortTreeRows(
  tree: Pick<PMTreeIndex, 'wbsById' | 'childrenById'>,
  expanded: Record<string, boolean>,
  ctx: PMTreeFilterContext,
  filters: PMTreeColumnsFilters | null | undefined,
  sort: PMTreeColumnSort | null | undefined,
  today: number = todayUTC()
): PMFilteredTreeRows {
  const compiled: { key: string; test: PMCellPredicate }[] = [];
  for (const [key, f] of Object.entries(filters ?? {})) {
    const type = treeColumnDataType(key, ctx.customColumns);
    if (!type) continue;
    const c = compileTreeColumnFilter(f, type, today);
    if ('test' in c) compiled.push({ key, test: c.test });
  }
  const sortType = sort ? treeColumnDataType(sort.key, ctx.customColumns) : null;
  const children = (guid: string) => tree.childrenById[guid] || [];

  // ---- sort the siblings of every parent; empty values last in both directions; stable ----
  const sortedCache: Record<string, string[]> = {};
  const childrenOf = (guid: string): string[] => {
    const kids = children(guid);
    if (!sort || !sortType || kids.length < 2) return kids;
    if (sortedCache[guid]) return sortedCache[guid];
    const dir = sort.direction === 'desc' ? -1 : 1;
    const keyed = kids.map((g, i) => ({ g, i, v: treeCellFilterValue(sort.key, g, ctx) }));
    keyed.sort((a, b) => {
      const ea = isEmptyValue(a.v);
      const eb = isEmptyValue(b.v);
      if (ea || eb) return ea === eb ? a.i - b.i : ea ? 1 : -1;
      return dir * compareFilterValues(a.v!, b.v!, sortType) || a.i - b.i;
    });
    return (sortedCache[guid] = keyed.map((k) => k.g));
  };

  // ---- filter: matching rows + their ancestors (post-order over the whole tree) ----
  let keep: Set<string> | null = null;
  let contextGUIDs: Record<string, true> | null = null;
  let matchCount: number | null = null;
  if (compiled.length) {
    const kept = new Set<string>();
    const context: Record<string, true> = {};
    let matches = 0;
    const seen = new Set<string>();
    const visit = (guid: string): boolean => {
      if (seen.has(guid)) return false;
      seen.add(guid);
      let anyChild = false;
      for (const c of children(guid)) if (visit(c)) anyChild = true;
      const match = compiled.every((f) => f.test(treeCellFilterValue(f.key, guid, ctx)));
      if (match) matches++;
      if (!match && !anyChild) return false;
      kept.add(guid);
      if (!match) context[guid] = true;
      return true;
    };
    for (const r of children(ROOT_KEY)) visit(r);
    keep = kept;
    contextGUIDs = context;
    matchCount = matches;
  }

  const out: string[] = [];
  const walk = (guid: string) => {
    if (keep && !keep.has(guid)) return;
    out.push(guid);
    if (expanded[guid] === false) return;
    for (const c of childrenOf(guid)) walk(c);
  };
  for (const r of childrenOf(ROOT_KEY)) walk(r);
  return { visibleRows: out, contextGUIDs, matchCount, appliedFilterKeys: compiled.map((c) => c.key) };
}

/** Collapsed context rows (ancestors of matches) - expanded once when a filter is applied. */
export function collapsedContextRows(contextGUIDs: Record<string, true> | null, expanded: Record<string, boolean>): string[] {
  if (!contextGUIDs) return [];
  return Object.keys(contextGUIDs).filter((g) => expanded[g] === false);
}
