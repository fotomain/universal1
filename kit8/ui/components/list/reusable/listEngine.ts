// ReusableList - the pure engine: item roles of the columns, the shown view (search -> filters -> sort -> direction), the drag math.
// No React, no redux: unit tested (__tests__/ui/list/listEngine.test.ts). Big lists: the search text of a row is cached per row OBJECT.
import type { ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';
import { ColumnFilters, ColumnSort, CatalogTitleFn, filterRows, isActiveFilter, sortRowsByColumn } from '../../table/reusable/tableFilter';
import { moveRow, rowSearchText } from '../../table/reusable/tableRows';
import type { ListRoles } from './reusableListTypes';

// ---- roles of the columns in an item ----
const isShown = (col: VisualColumn) => col.type !== 'rowNumber' && col.listRole !== 'hidden';

/**
 * Which column fills which place of the default item. `listRole` of a column wins; without roles: the first text column (else the first
 * column) = title, the next column = subtitle, the next two = meta. A column with listRole 'hidden' (or a row number) is never shown.
 */
export function resolveListRoles(columns: VisualColumn[]): ListRoles {
  const shown = columns.filter(isShown);
  const explicit = (role: string) => shown.filter((c) => c.listRole === role);
  const anyRole = shown.some((c) => !!c.listRole);
  if (anyRole) {
    const [title = null] = explicit('title');
    const [subtitle = null] = explicit('subtitle');
    return { title, subtitle, meta: explicit('meta'), badge: explicit('badge') };
  }
  const title = shown.find((c) => c.type === 'text') ?? shown[0] ?? null;
  const rest = shown.filter((c) => c !== title);
  return { title, subtitle: rest[0] ?? null, meta: rest.slice(1, 3), badge: [] };
}

// ---- search ----
const NO_TITLE: CatalogTitleFn = () => '';
type CacheEntry = { columns: VisualColumn[]; title: CatalogTitleFn; text: string };
const searchCache = new WeakMap<object, CacheEntry>();

/** lower-case search text of a row; cached per row object (a changed row is a new object), recomputed when the columns / the catalog titles change */
export function cachedSearchText(row: ReusableTableRow, columns: VisualColumn[], catalogTitle: CatalogTitleFn = NO_TITLE): string {
  const hit = searchCache.get(row);
  if (hit && hit.columns === columns && hit.title === catalogTitle) return hit.text;
  const text = rowSearchText(row, columns, catalogTitle);
  searchCache.set(row, { columns, title: catalogTitle, text });
  return text;
}

// ---- the shown list ----
export interface ViewOptions {
  columns: VisualColumn[];
  query: { search: string; sort: ColumnSort | null; filters: ColumnFilters };
  catalogTitle?: CatalogTitleFn;
  /** rows of a picked folder etc. */
  rowFilter?: ((row: ReusableTableRow) => boolean) | null;
  /** 'desc': the highest orderInList first (when no column sort is active) */
  direction?: 'asc' | 'desc';
}

/** the list the user sees: folder filter -> search -> column filters -> column sort -> direction. `rows` are ascending by orderInList. */
export function buildView(rows: ReusableTableRow[], { columns, query, catalogTitle = NO_TITLE, rowFilter, direction = 'asc' }: ViewOptions): ReusableTableRow[] {
  const q = query.search.trim().toLowerCase();
  let out = rowFilter ? rows.filter(rowFilter) : rows;
  if (q) out = out.filter((r) => cachedSearchText(r, columns, catalogTitle).includes(q));
  out = filterRows(out, columns, query.filters, catalogTitle);
  if (query.sort) return sortRowsByColumn(out, columns, query.sort, catalogTitle);
  return direction === 'desc' ? [...out].reverse() : out === rows ? rows : out;
}

/** a search / filter / column sort is active: the shown order is not the stored order, so no reorder by position */
export function isQueryActive(query: { search: string; sort: ColumnSort | null; filters: ColumnFilters }, columns: VisualColumn[]): boolean {
  return query.search.trim() !== '' || !!query.sort || columns.some((c) => isActiveFilter(query.filters[c.key]));
}

/** a stable key of a query (a change reloads the server list) */
export const queryKey = (q: { search: string; sort: ColumnSort | null; filters: ColumnFilters }): string => JSON.stringify([q.search.trim(), q.sort, q.filters]);

// ---- drag reorder math (fixed item height) ----
/** the index an item dropped at `contentY` (px from the top of the content) lands on */
export function dropIndexAt(contentY: number, itemHeight: number, count: number): number {
  if (count <= 0 || itemHeight <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(contentY / itemHeight)));
}

/** px per tick the list scrolls while an item is held near its top (negative) or bottom (positive) edge; 0 in the middle */
export function autoScrollSpeed(fingerY: number, viewHeight: number, zone = 72, max = 22): number {
  if (viewHeight <= 0) return 0;
  if (fingerY < zone) return -Math.round(max * Math.min(1, (zone - Math.max(0, fingerY)) / zone));
  if (fingerY > viewHeight - zone) return Math.round(max * Math.min(1, (fingerY - (viewHeight - zone)) / zone));
  return 0;
}

/** a scroll offset kept inside the content */
export function clampScroll(offset: number, count: number, itemHeight: number, viewHeight: number): number {
  return Math.max(0, Math.min(offset, Math.max(0, count * itemHeight - viewHeight)));
}

/** the move of the item at `from` to `to` in the SHOWN list: the new orderInList (between the new neighbours; asc or desc detected) or null = nothing to save */
export function reorderResult(view: ReusableTableRow[], from: number, to: number): { guid: string; orderInList: number } | null {
  const { moved } = moveRow(view, from, to);
  return moved ? { guid: moved.rowGUID, orderInList: moved.orderInList as number } : null;
}

/**
 * A browser scroll element cannot be taller than about 33 554 428 px (Chrome / Edge) or 17 895 697 px (Firefox): rows beyond that cannot be reached by scrolling.
 * 17 000 000 px is the safe common limit: at 72 px per item that is about 236 000 rows. Above it a web list should use serverDataMode (or a bigger filter).
 */
export const WEB_MAX_SCROLL_PX = 17_000_000;
export const webRowLimit = (itemHeight: number): number => Math.floor(WEB_MAX_SCROLL_PX / Math.max(1, itemHeight));
