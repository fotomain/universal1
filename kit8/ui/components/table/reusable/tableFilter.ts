// ReusableTable - column sort + column filters, the light version of the Tasks Tree "Filter & sort"
// (kit8/pm/view/tree/filter). Pure, unit-tested. Catalog columns sort / filter by the visible TITLE, not the GUID.
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';
import { cellValue, displayText } from './tableRows';

export type ColumnFilterOp = 'contains' | 'eq' | 'gte' | 'lte' | 'empty' | 'notEmpty';
export interface ColumnFilter { op: ColumnFilterOp; value?: string }
export type ColumnFilters = Record<string, ColumnFilter>;
export interface ColumnSort { key: string; direction: 'asc' | 'desc' }
export type CatalogTitleFn = (col: VisualColumn, guid: string) => string;

export const FILTER_OP_LABEL: Record<ColumnFilterOp, string> = { contains: 'Contains', eq: '=', gte: '≥', lte: '≤', empty: 'Empty', notEmpty: 'Not empty' };
const isNumeric = (col: VisualColumn) => col.type === 'integer' || col.type === 'number';
/** columns the user can sort / filter */
export const isSortFilterColumn = (col: VisualColumn) => col.type !== 'rowNumber' && col.type !== 'custom';
export const filterOpsOf = (col: VisualColumn): ColumnFilterOp[] => (isNumeric(col) ? ['eq', 'gte', 'lte', 'empty', 'notEmpty'] : ['contains', 'empty', 'notEmpty']);
export const filterNeedsValue = (op: ColumnFilterOp) => op !== 'empty' && op !== 'notEmpty';

/** the value a column is compared by: number (number columns), catalog title or text; null = empty cell */
export function columnValue(row: ReusableTableRow, col: VisualColumn, catalogTitle: CatalogTitleFn): string | number | null {
  const v = cellValue(row, col);
  if (isNumeric(col)) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  const shown = displayText(row, col, catalogTitle);
  if (shown !== '') return shown;
  // a catalog GUID whose element is not loaded: compare by the GUID
  return v === null || v === undefined || v === '' || col.type === 'boolean' ? null : String(v);
}

export function matchesFilter(value: string | number | null, f: ColumnFilter): boolean {
  if (f.op === 'empty') return value === null;
  if (f.op === 'notEmpty') return value !== null;
  const raw = String(f.value ?? '').trim();
  if (raw === '') return true; // nothing typed yet = no filter
  if (f.op === 'contains') return value !== null && String(value).toLowerCase().includes(raw.toLowerCase());
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || value === null) return false;
  const v = Number(value);
  return f.op === 'eq' ? v === n : f.op === 'gte' ? v >= n : v <= n;
}

/** a filter that really filters (an op with a value, or empty / notEmpty) */
export const isActiveFilter = (f?: ColumnFilter | null): boolean => !!f && (!filterNeedsValue(f.op) || String(f.value ?? '').trim() !== '');

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
