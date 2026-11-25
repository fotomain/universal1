// Estimation dashboard - sort, filter and FIND of the ESTIMATE GRID columns (pure: no React, no Skia). The grid stands beside the task tree, ONE grid row per tree row, so a filter or a sort of
// the grid has to reorder / hide the TREE rows too: `buildExternalView` makes the `PMTreeExternalView` the PM store hands to the tree (tree/filter/treeColumnFilter.ts) - the rows that
// match (their ancestors stay as context rows) and the order of the siblings of every parent (a stage keeps its tasks). The operators and the way a value is compared are the ones of the
// ReusableTable (`kit8/ui/components/table/reusable/tableFilter.ts`): text = Contains / Empty / Not empty, numbers = = / ≥ / ≤ / Empty / Not empty; empty cells last in both sort directions.
import { matchesFilter, type ColumnFilter, type ColumnFilterOp, type ColumnFilters, type ColumnSort } from '../../../ui/components/table/reusable/tableFilter';
import type { PMTreeExternalView } from '../../view/tree/filter/treeColumnFilter';
import { cellText, type CellContext, type GridColumn, type GridRow } from './estimateGridModel';

export type { ColumnFilter, ColumnFilters, ColumnSort };

/** the columns whose values are numbers (filtered with = / ≥ / ≤, sorted 0 -> 9) */
export const gridColumnIsNumeric = (col: GridColumn): boolean => col.kind === 'number' || col.kind === 'calc' || col.kind === 'sum' || col.kind === 'price' || col.kind === 'perArea' || col.kind === 'share';

/** the value a column is compared by: a number (numeric columns), the shown text, null = an empty cell */
export function gridColumnValue(col: GridColumn, row: GridRow, ctx: CellContext): string | number | null {
  const j = (row.line?.rowJSON ?? null) as Record<string, any> | null;
  if (col.kind === 'number') {
    // a stage shows the subtotal of the quantity only; the other input columns are empty there
    if (!row.line) return col.key === 'qty' && typeof row.unit === 'string' ? row.qty : null;
    const n = Number(j?.[col.field ?? col.key]);
    return j?.[col.field ?? col.key] === undefined || j?.[col.field ?? col.key] === '' || !Number.isFinite(n) ? null : n;
  }
  if (col.kind === 'calc') return col.pick ? col.pick(row.cost) || null : null;
  if (col.kind === 'sum') return row.sums[col.sumKey ?? ctx.sumKey] || null;
  if (col.kind === 'price') return row.price || null;
  if (col.kind === 'perArea') return ctx.area ? row.cost.current / ctx.area || null : null;
  if (col.kind === 'share') return ctx.totalCurrent ? row.cost.current / ctx.totalCurrent || null : null;
  const t = cellText(col, row, ctx);
  return t === '' ? null : t;
}

/** the operators of the filter popup of a column */
export const gridFilterOps = (col: GridColumn): ColumnFilterOp[] => (gridColumnIsNumeric(col) ? ['eq', 'gte', 'lte', 'empty', 'notEmpty'] : ['contains', 'empty', 'notEmpty']);

export interface ExternalViewInput {
  /** the key of the root of the tree (the parent of the top rows) */
  rootKey: string;
  childrenById: Record<string, readonly string[] | undefined>;
  /** the grid row of EVERY task of the tree (not only the visible ones) */
  rowOf: (guid: string) => GridRow | undefined;
  columns: readonly GridColumn[];
  ctx: CellContext;
  filters: ColumnFilters;
  sort: ColumnSort | null;
}

/** every row of the tree, parents first */
export function allTreeGUIDs(rootKey: string, childrenById: Record<string, readonly string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (g: string) => { for (const c of childrenById[g] ?? []) { if (seen.has(c)) continue; seen.add(c); out.push(c); walk(c); } };
  walk(rootKey);
  return out;
}

/** a filter that really filters: an operator with a value, or Empty / Not empty */
export const isFilterActive = (f?: ColumnFilter | null): boolean => !!f && (f.op === 'empty' || f.op === 'notEmpty' || String(f.value ?? '').trim() !== '');

/** the filter + sort of the grid as the tree needs it; null when there is neither */
export function buildExternalView(input: ExternalViewInput): PMTreeExternalView | null {
  const { columns, ctx } = input;
  const active = columns.filter((c) => isFilterActive(input.filters[c.key]));
  const sortCol = input.sort ? columns.find((c) => c.key === input.sort!.key) ?? null : null;
  if (!active.length && !sortCol) return null;
  const valueOf = (col: GridColumn, guid: string): string | number | null => { const r = input.rowOf(guid); return r ? gridColumnValue(col, r, ctx) : null; };
  let matches: Set<string> | null = null;
  if (active.length) {
    matches = new Set<string>();
    for (const g of allTreeGUIDs(input.rootKey, input.childrenById)) {
      if (active.every((c) => matchesFilter(valueOf(c, g), input.filters[c.key]))) matches.add(g);
    }
  }
  let compare: PMTreeExternalView['compare'] = null;
  if (sortCol && input.sort) {
    const dir = input.sort.direction === 'desc' ? -1 : 1;
    const cache = new Map<string, string | number | null>();
    const v = (g: string) => { if (!cache.has(g)) cache.set(g, valueOf(sortCol, g)); return cache.get(g)!; };
    compare = (a, b) => {
      const x = v(a);
      const y = v(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // empty cells last in both directions
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
      return dir * cmp;
    };
  }
  return { matches, compare };
}

// ---- Find (Ctrl + F): the cells of the rows shown that contain the text ---------------------------------------------------------------------------------------------------------------
export interface FindMatch { rowIndex: number; guid: string; colKey: string }

/** the cells (row by row, left to right) whose shown text contains `query` (case does not matter); fewer than 1 character = none */
export function findCells(rows: readonly GridRow[], columns: readonly GridColumn[], ctx: CellContext, query: string): FindMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: FindMatch[] = [];
  rows.forEach((row, rowIndex) => {
    for (const c of columns) {
      if (c.kind === 'share') continue;
      if (cellText(c, row, ctx).toLowerCase().includes(q)) out.push({ rowIndex, guid: row.guid, colKey: c.key });
    }
  });
  return out;
}

/** the next (d = 1) / previous (d = -1) match after the current one, going round */
export const stepFind = (count: number, current: number, d: 1 | -1): number => (count === 0 ? -1 : current < 0 ? (d === 1 ? 0 : count - 1) : (current + d + count) % count);
