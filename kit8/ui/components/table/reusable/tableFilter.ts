// ReusableTable - column sort + column filters, the light version of the Tasks Tree "Filter & sort"
// (kit8/pm/view/tree/filter). Pure, unit-tested. Catalog columns sort / filter by the visible TITLE, not the GUID.
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';
import { defaultFormatDateInput, defaultParseDateInput } from '../../common/date_input/dateInputFormat';
import { cellValue, displayText } from './tableRows';

export type ColumnFilterOp = 'contains' | 'eq' | 'gte' | 'lte' | 'empty' | 'notEmpty' | 'neq' | 'notContains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'between' | 'oneOf';
/** `value2` = the "To" of `between` (`value` is its "From"); `oneOf` keeps its comma separated list in `value` */
export interface ColumnFilter { op: ColumnFilterOp; value?: string; value2?: string }
export type ColumnFilters = Record<string, ColumnFilter>;
export interface ColumnSort { key: string; direction: 'asc' | 'desc' }
export type CatalogTitleFn = (col: VisualColumn, guid: string) => string;

/** how a column is filtered: text (equal ... ends with), number or date (is exactly ... is one of) */
export type FilterKind = 'text' | 'number' | 'date';
const isNumeric = (col: VisualColumn) => col.type === 'integer' || col.type === 'number';
export const filterKindOf = (col: VisualColumn): FilterKind => (isNumeric(col) ? 'number' : col.type === 'date' ? 'date' : 'text');

/** the operators in the order of the select list of the popup */
export const TEXT_FILTER_OPS: ColumnFilterOp[] = ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'empty', 'notEmpty'];
export const ORDERED_FILTER_OPS: ColumnFilterOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'oneOf', 'empty', 'notEmpty'];
export const TEXT_FILTER_OP_LABEL: Record<ColumnFilterOp, string> = {
  eq: 'equal', neq: 'not equal', contains: 'contains', notContains: 'does not contain', startsWith: 'starts with', endsWith: 'ends with', empty: 'empty', notEmpty: 'not empty',
  gt: '>', gte: '≥', lt: '<', lte: '≤', between: 'between', oneOf: 'one of',
};
/** labels of a NUMBER / DATE column */
export const ORDERED_FILTER_OP_LABEL: Record<ColumnFilterOp, string> = {
  eq: 'is exactly (=)', neq: 'is not (!=)', gt: 'is greater than (>)', gte: 'is greater than or equal to (>=)', lt: 'is less than (<)', lte: 'is less than or equal to (<=)',
  between: 'is between (..)', oneOf: 'is one of (,)', empty: 'is empty', notEmpty: 'is not empty', contains: 'contains', notContains: 'does not contain', startsWith: 'starts with', endsWith: 'ends with',
};
export const filterOpLabel = (kind: FilterKind, op: ColumnFilterOp): string => (kind === 'text' ? TEXT_FILTER_OP_LABEL : ORDERED_FILTER_OP_LABEL)[op];
/**
 * columns the user can sort / filter: every stored column, and a `custom` column that says what it shows as text (`searchText`) - it is
 * sorted / filtered by that text, like a catalog column by its title. A custom column without `searchText` has nothing to compare.
 */
export const isSortFilterColumn = (col: VisualColumn) => col.type !== 'rowNumber' && (col.type !== 'custom' || typeof col.searchText === 'function');
export const filterOpsOf = (col: VisualColumn): ColumnFilterOp[] => (filterKindOf(col) === 'text' ? TEXT_FILTER_OPS : ORDERED_FILTER_OPS);
/** the operator a popup starts with when the column has no filter yet */
export const defaultFilterOpOf = (col: VisualColumn): ColumnFilterOp => (filterKindOf(col) === 'text' ? 'contains' : 'eq');
export const filterNeedsValue = (op: ColumnFilterOp) => op !== 'empty' && op !== 'notEmpty';
export const filterNeedsSecondValue = (op: ColumnFilterOp) => op === 'between';

// ---- the operands of the number / date operators ------------------------------------------------------------------------------------------------------------------------------------
/** a typed number ("5", "5,5", "5.5"); null = not a number */
export function parseNumberOperand(s: string): number | null {
  const t = String(s ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
/** a typed day (2026-01-05, 05.01.2026, 20260105 ...) as 'YYYY-MM-DD'; null = not a date */
export function parseDayOperand(s: string): string | null {
  const d = defaultParseDateInput(String(s ?? '').trim());
  return d ? defaultFormatDateInput(d) : null;
}
/** the entries of a list typed with commas (or semicolons) */
export const splitFilterList = (s: string): string[] => String(s ?? '').split(/[;,]/).map((x) => x.trim()).filter((x) => x !== '');
/** the 'YYYY-MM-DD' a stored day / timestamp starts with */
const dayOf = (v: unknown): string | null => /^\d{4}-\d{2}-\d{2}/.exec(String(v ?? ''))?.[0] ?? null;
/** the operands of a filter as the kind needs them; entries that are no number / date are dropped (a filter with nothing usable left filters nothing) */
export function filterOperands(kind: FilterKind, f: ColumnFilter): { a: number | string | null; b: number | string | null; list: (number | string)[] } {
  const parse = (s: string): number | string | null => (kind === 'number' ? parseNumberOperand(s) : kind === 'date' ? parseDayOperand(s) : null);
  return {
    a: parse(String(f.value ?? '')),
    b: parse(String(f.value2 ?? '')),
    list: splitFilterList(String(f.value ?? '')).map(parse).filter((x): x is number | string => x !== null),
  };
}

/** the value a column is compared by: number (number columns), catalog title or text; null = empty cell */
export function columnValue(row: ReusableTableRow, col: VisualColumn, catalogTitle: CatalogTitleFn): string | number | null {
  const v = cellValue(row, col);
  if (isNumeric(col)) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  const shown = displayText(row, col, catalogTitle);
  if (shown !== '') return shown;
  if (col.type === 'custom') return null;
  // a catalog GUID whose element is not loaded: compare by the GUID
  return v === null || v === undefined || v === '' || col.type === 'boolean' ? null : String(v);
}

export function matchesFilter(value: string | number | null, f: ColumnFilter): boolean {
  if (f.op === 'empty') return value === null;
  if (f.op === 'notEmpty') return value !== null;
  const raw = String(f.value ?? '').trim();
  if (raw === '') return true; // nothing typed yet = no filter
  const text = value === null ? null : String(value).trim().toLowerCase();
  const needle = raw.toLowerCase();
  // the text operators; an empty cell is "not equal" to anything and "does not contain" anything
  if (f.op === 'contains') return text !== null && text.includes(needle);
  if (f.op === 'notContains') return text === null || !text.includes(needle);
  if (f.op === 'startsWith') return text !== null && text.startsWith(needle);
  if (f.op === 'endsWith') return text !== null && text.endsWith(needle);
  const numeric = typeof value === 'number';
  if ((f.op === 'eq' || f.op === 'neq') && !numeric) {
    // a day compares as a day (05.01.2026 = 2026-01-05), any other text as text
    const day = value === null ? null : dayOf(value);
    const dayRaw = day ? parseDayOperand(raw) : null;
    const same = text !== null && (day && dayRaw ? day === dayRaw : text === needle);
    return f.op === 'eq' ? same : !same;
  }
  if (value === null) return false; // an empty cell is not greater, not between, not one of anything
  // numbers (value is a number) and days (value is 'YYYY-MM-DD...'): the operands are read the same way; an operand that is no number / date = no filter
  const kind: FilterKind = numeric ? 'number' : 'date';
  // both sides are numbers or both are 'YYYY-MM-DD' strings, so < / > are right for either
  const { a, b, list } = filterOperands(kind, f) as { a: any; b: any; list: any[] };
  const key: any = numeric ? Number(value) : dayOf(value);
  if (f.op === 'oneOf') return list.length === 0 ? true : key !== null && list.includes(key);
  if (f.op === 'between') {
    if (a === null || b === null) return true;
    if (key === null) return false;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return key >= lo && key <= hi;
  }
  if (a === null) return true;
  if (key === null) return f.op === 'neq';
  switch (f.op) {
    case 'eq': return key === a;
    case 'neq': return key !== a;
    case 'gt': return key > a;
    case 'gte': return key >= a;
    case 'lt': return key < a;
    default: return key <= a;
  }
}

/** a filter that really filters (an op with a value, or empty / notEmpty) */
export const isActiveFilter = (f?: ColumnFilter | null): boolean => !!f && (!filterNeedsValue(f.op) || String(f.value ?? '').trim() !== '') && (!filterNeedsSecondValue(f.op) || String(f.value2 ?? '').trim() !== '');

/** rows that pass ALL column filters */
export function filterRows(rows: ReusableTableRow[], columns: VisualColumn[], filters: ColumnFilters, catalogTitle: CatalogTitleFn): ReusableTableRow[] {
  const active = columns.filter((col) => isActiveFilter(filters[col.key]));
  if (active.length === 0) return rows;
  return rows.filter((r) => active.every((col) => matchesFilter(columnValue(r, col, catalogTitle), filters[col.key])));
}

/** rows sorted by one column; empty cells last in both directions; stable (the list order breaks ties) */
export function sortRowsByColumn(rows: ReusableTableRow[], columns: VisualColumn[], sort: ColumnSort | null, catalogTitle: CatalogTitleFn): ReusableTableRow[] {
  const col = sort && columns.find((x) => x.key === sort.key);
  if (!sort || !col) return rows;
  const dir = sort.direction === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i, v: columnValue(r, col, catalogTitle) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const cmp = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: 'base' });
      return cmp !== 0 ? dir * cmp : a.i - b.i;
    })
    .map((x) => x.r);
}
