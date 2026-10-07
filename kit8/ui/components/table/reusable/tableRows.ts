// ReusableTable - pure helpers (unit-tested: __tests__/ui/table/reusableTableRows.test.ts).
import { calculateNewOrderInList } from '../../list/web/lib/calculateNewOrderInList';
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';

export const fieldOf = (col: VisualColumn): string => col.field || col.key;
export const DEFAULT_WIDTH: Record<VisualColumn['type'], number> = { rowNumber: 48, catalog: 240, integer: 100, number: 110, text: 200, custom: 160 };
export const widthOf = (col: VisualColumn): number => col.width ?? DEFAULT_WIDTH[col.type];

const orderOf = (r: ReusableTableRow) => Number(r?.orderInList ?? 0);

/** ascending orderInList, stable */
export function sortRows(rows: ReusableTableRow[]): ReusableTableRow[] {
  return rows.map((r, i) => ({ r, i })).sort((a, b) => orderOf(a.r) - orderOf(b.r) || a.i - b.i).map((x) => x.r);
}

/** orderInList of the row at `index` of `next` (between its neighbours; `original` = the list before the change) */
export function orderAt(next: ReusableTableRow[], index: number, original: ReusableTableRow[]): number {
  return calculateNewOrderInList(next as any, index, original as any);
}

/** move a row to another index; returns the new list and the moved row with its new orderInList (null = nothing moved) */
export function moveRow(rows: ReusableTableRow[], from: number, to: number): { rows: ReusableTableRow[]; moved: ReusableTableRow | null } {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return { rows, moved: null };
  const next = [...rows];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  const moved = { ...item, orderInList: orderAt(next, to, rows) };
  next[to] = moved;
  return { rows: next, moved };
}

/** insert a row at an index with an orderInList between its neighbours */
export function insertRow(rows: ReusableTableRow[], row: ReusableTableRow, index: number): { rows: ReusableTableRow[]; inserted: ReusableTableRow } {
  const at = Math.max(0, Math.min(index, rows.length));
  const next = [...rows];
  next.splice(at, 0, row);
  const inserted = { ...row, orderInList: orderAt(next, at, rows) };
  next[at] = inserted;
  return { rows: next, inserted };
}

/** keys of the columns that depend (directly or through other columns) on `key` */
export function dependentColumns(columns: VisualColumn[], key: string): VisualColumn[] {
  const out: VisualColumn[] = [];
  const walk = (k: string) => {
    for (const col of columns) {
      if (col.type === 'catalog' && col.dependsOn === k && !out.includes(col)) {
        out.push(col);
        walk(col.key);
      }
    }
  };
  walk(key);
  return out;
}

/** rowJSON patch of one edited cell: the value + null for every column that depends on it */
export function patchForCell(columns: VisualColumn[], key: string, value: any): Record<string, any> {
  const col = columns.find((c) => c.key === key);
  if (!col) return {};
  const patch: Record<string, any> = { [fieldOf(col)]: value ?? null };
  for (const dep of dependentColumns(columns, key)) patch[fieldOf(dep)] = null;
  return patch;
}

/** rowJSON of a new row: every stored column field = null */
export function emptyRowJSON(columns: VisualColumn[]): Record<string, any> {
  const json: Record<string, any> = {};
  for (const col of columns) if (col.type !== 'rowNumber' && col.type !== 'custom') json[fieldOf(col)] = null;
  return json;
}

/** text typed into a number cell -> the stored number (null = empty / not a number); clamped to min / max */
export function parseNumberInput(text: string, opts: { integer?: boolean; min?: number; max?: number } = {}): number | null {
  const t = String(text ?? '').trim().replace(',', '.');
  if (t === '' || t === '-' ) return null;
  let n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (opts.integer) n = Math.trunc(n);
  if (opts.min !== undefined && n < opts.min) n = opts.min;
  if (opts.max !== undefined && n > opts.max) n = opts.max;
  return n;
}

/** what the user may type into a number cell */
export function sanitizeNumberText(text: string, integer: boolean, allowNegative: boolean): string {
  let t = String(text ?? '').replace(',', '.').replace(integer ? /[^0-9-]/g : /[^0-9.-]/g, '');
  const neg = allowNegative && t.startsWith('-');
  t = t.replace(/-/g, '');
  if (!integer) {
    const i = t.indexOf('.');
    if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
  }
  return (neg ? '-' : '') + t;
}

/** catalogTitle(col, guid) = the visible title of a stored catalog GUID */
export function rowSearchText(row: ReusableTableRow, columns: VisualColumn[], catalogTitle: (col: VisualColumn, guid: string) => string): string {
  const json = row?.rowJSON || {};
  const parts: string[] = [];
  for (const col of columns) {
    if (col.type === 'rowNumber') continue;
    if (col.type === 'custom') { if (col.searchText) parts.push(col.searchText(row)); continue; }
    const v = json[fieldOf(col)];
    if (v === null || v === undefined || v === '') continue;
    parts.push(col.type === 'catalog' ? catalogTitle(col, String(v)) : String(v));
  }
  return parts.join(' ').toLowerCase();
}

// ───────────── columns: order (drag & drop of the headers) + widths (drag a header separator) ─────────────
export const MIN_COLUMN_WIDTH = 40;
export const MAX_COLUMN_WIDTH = 800;
export const clampColumnWidth = (w: number): number => Math.round(Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, w)));

/** the columns in the user's order (unknown keys ignored, new columns appended) with the user's widths */
export function arrangeColumns(columns: VisualColumn[], order?: string[] | null, widths?: Record<string, number> | null): VisualColumn[] {
  const byKey = new Map(columns.map((col) => [col.key, col]));
  const keys = [...(order || []).filter((k, i, a) => byKey.has(k) && a.indexOf(k) === i)];
  for (const col of columns) if (!keys.includes(col.key)) keys.push(col.key);
  return keys.map((k) => {
    const col = byKey.get(k)!;
    const w = widths?.[k];
    return typeof w === 'number' && Number.isFinite(w) ? ({ ...col, width: clampColumnWidth(w) } as VisualColumn) : col;
  });
}

/** keys after moving the column at `from` to `to` */
export function moveColumn(keys: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= keys.length || to >= keys.length) return keys;
  const next = [...keys];
  const [k] = next.splice(from, 1);
  next.splice(to, 0, k);
  return next;
}

/** index the dragged column lands on: the column under the CENTER of the dragged header (dx = horizontal drag in px) */
export function columnDropIndex(widths: number[], from: number, dx: number): number {
  if (from < 0 || from >= widths.length) return from;
  let left = 0;
  for (let i = 0; i < from; i++) left += widths[i];
  const center = left + widths[from] / 2 + dx;
  let x = 0;
  for (let i = 0; i < widths.length; i++) {
    x += widths[i];
    if (center < x) return i;
  }
  return widths.length - 1;
}

/** value after one press of − (direction -1) / + (direction 1): empty counts as 0, clamped to min / max, no float noise */
export function stepNumber(value: unknown, direction: 1 | -1, opts: { step?: number; integer?: boolean; min?: number; max?: number } = {}): number {
  const step = opts.step && opts.step > 0 ? opts.step : 1;
  const current = Number(value);
  let n = (Number.isFinite(current) && value !== null && value !== '' ? current : 0) + direction * step;
  n = opts.integer ? Math.round(n) : Math.round(n * 1e6) / 1e6;
  if (opts.min !== undefined && n < opts.min) n = opts.min;
  if (opts.max !== undefined && n > opts.max) n = opts.max;
  return n;
}

/**
 * Columns fill the table: when the table is wider than its columns, the extra px are shared (proportionally)
 * by the columns the user did not resize; row number columns keep their width.
 */
export function stretchColumns(columns: VisualColumn[], available: number, userWidths?: Record<string, number> | null): VisualColumn[] {
  const total = columns.reduce((w, col) => w + widthOf(col), 0);
  const extra = Math.floor(available - total);
  const flexible = columns.filter((col) => col.type !== 'rowNumber' && userWidths?.[col.key] === undefined);
  const flexTotal = flexible.reduce((w, col) => w + widthOf(col), 0);
  if (!(extra > 0) || flexTotal <= 0) return columns;
  let left = extra;
  return columns.map((col) => {
    if (!flexible.includes(col)) return col;
    const isLast = col === flexible[flexible.length - 1];
    const add = isLast ? left : Math.floor((extra * widthOf(col)) / flexTotal);
    left -= add;
    return { ...col, width: widthOf(col) + add } as VisualColumn;
  });
}

/**
 * Selected rows one step up (-1) / down (1), together, keeping their order. A block of neighbouring selected rows
 * moves by letting the row next to it jump over the block, so `moved` = the rows whose orderInList changed
 * (one per block). A block already at the edge stays.
 */
export function moveSelectedRows(rows: ReusableTableRow[], ids: string[], direction: 1 | -1): { rows: ReusableTableRow[]; moved: ReusableTableRow[] } {
  const selected = new Set(ids);
  let list = rows;
  const moved: ReusableTableRow[] = [];
  // blocks = [start, end] of neighbouring selected rows
  const blocks: [number, number][] = [];
  rows.forEach((r, i) => {
    if (!selected.has(r.rowGUID)) return;
    const last = blocks[blocks.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else blocks.push([i, i]);
  });
  // up: from the top block; down: from the bottom block - a jump never changes the indexes of the blocks still to do
  for (const [start, end] of direction === -1 ? blocks : [...blocks].reverse()) {
    const from = direction === -1 ? start - 1 : end + 1;
    const to = direction === -1 ? end : start;
    if (from < 0 || from >= list.length) continue;
    const res = moveRow(list, from, to);
    if (!res.moved) continue;
    list = res.rows;
    moved.push(res.moved);
  }
  return { rows: list, moved };
}
