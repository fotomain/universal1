// ReusableList, serverDataMode - the database query of one page: scope + search + column filters + sort + range + count.
// Pure: it only CALLS the methods of a Supabase (PostgREST) query builder, so a test passes a fake builder.
// A cell lives in rowJSON (default), or in a root column (target 'rowOwnerGUID' / 'rowParentGUID' / any real column).
//   text compare / sort   rowJSON->>field   (text)
//   number compare / sort rowJSON->field    (jsonb: numbers compare as numbers)
import type { ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';
import { ColumnFilter, ColumnSort, ColumnFilters, filterNeedsValue, isActiveFilter } from '../../table/reusable/tableFilter';
import { fieldOf, targetOf } from '../../table/reusable/tableRows';

const isNumeric = (col: VisualColumn) => col.type === 'integer' || col.type === 'number';

/** the PostgREST column expression of a column: 'rowJSON->>field' / 'rowJSON->field' / a root column */
export function serverColumnPath(col: VisualColumn): string {
  const target = targetOf(col);
  if (target !== 'rowJSON') return target;
  return `rowJSON${isNumeric(col) ? '->' : '->>'}${fieldOf(col)}`;
}

/** text for an `or(...)` / ilike value: the characters PostgREST reads as syntax are replaced by a space */
export const safeSearchText = (s: string): string => s.replace(/[,()"\\*%]/g, ' ').replace(/\s+/g, ' ').trim();

/** the rowJSON fields the search box looks in (default: the text columns; select / catalog columns hold GUIDs / codes, so they are not searched) */
export function defaultSearchFields(columns: VisualColumn[]): string[] {
  return columns.filter((c) => c.type === 'text' && targetOf(c) === 'rowJSON').map((c) => fieldOf(c));
}

export interface ServerPageRequest {
  /** rowOwnerGUID / rowParentGUID of the list (empty object in all-rows mode) */
  scope: Record<string, any>;
  columns: VisualColumn[];
  search: string;
  searchFields: string[];
  filters: ColumnFilters;
  sort: ColumnSort | null;
  /** with no column sort: ascending / descending orderInList */
  direction: 'asc' | 'desc';
  from: number;
  to: number;
  /** count the rows behind the query (first page) */
  count?: 'exact' | 'estimated' | 'planned' | null;
}

function applyFilter(q: any, col: VisualColumn, f: ColumnFilter): any {
  const path = serverColumnPath(col);
  const raw = String(f.value ?? '').trim();
  switch (f.op) {
    case 'empty': return q.is(path, null);
    case 'notEmpty': return q.not(path, 'is', null);
    case 'contains': return q.ilike(path, `%${safeSearchText(raw)}%`);
    case 'eq': return isNumeric(col) ? q.eq(path, Number(raw.replace(',', '.'))) : q.eq(path, raw);
    case 'gte': return q.gte(path, Number(raw.replace(',', '.')));
    case 'lte': return q.lte(path, Number(raw.replace(',', '.')));
    default: return q;
  }
}

/** put every part of the request on the builder (`from('table')` result); returns it. The caller awaits it. */
export function applyServerQuery(builder: any, req: ServerPageRequest): any {
  let q = builder.select('*', req.count ? { count: req.count } : undefined);
  if (req.scope && Object.keys(req.scope).length > 0) q = q.match(req.scope);
  const text = safeSearchText(req.search);
  if (text && req.searchFields.length > 0) q = q.or(req.searchFields.map((f) => `rowJSON->>${f}.ilike.*${text}*`).join(','));
  for (const col of req.columns) {
    const f = req.filters[col.key];
    if (!isActiveFilter(f)) continue;
    // a number filter with a value that is no number is not sent (the database would refuse the whole query)
    if (isNumeric(col) && filterNeedsValue(f.op) && !Number.isFinite(Number(String(f.value).replace(',', '.')))) continue;
    q = applyFilter(q, col, f);
  }
  const sortCol = req.sort && req.columns.find((c) => c.key === req.sort!.key);
  if (req.sort && sortCol) {
    q = q.order(serverColumnPath(sortCol), { ascending: req.sort.direction !== 'desc', nullsFirst: false });
    q = q.order('orderInList', { ascending: req.direction !== 'desc' });
  } else {
    q = q.order('orderInList', { ascending: req.direction !== 'desc' });
  }
  return q.range(req.from, req.to);
}

/** the rows of a server answer: only objects with a rowGUID */
export const rowsOf = (data: unknown): ReusableTableRow[] => (Array.isArray(data) ? (data as ReusableTableRow[]).filter((r) => r && typeof r.rowGUID === 'string') : []);

/** all rows of the query are loaded */
export const hasMorePages = (loaded: number, pageRows: number, pageSize: number, total: number | null): boolean => (total !== null && total >= 0 ? loaded < total : pageRows >= pageSize);
