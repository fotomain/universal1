// ReusableTable - pure helpers (unit-tested: __tests__/ui/table/reusableTableRows.test.ts).
import { calculateNewOrderInList } from '../../list/web/lib/calculateNewOrderInList';
import { REUSABLE_TABLE_ALL } from './reusableTableTypes';
import type { CellTarget, NewRowDefaults, ReusableTableRow, SelectOption, VisualColumn } from './reusableTableTypes';

export const fieldOf = (col: VisualColumn): string => col.field || col.key;
export const DEFAULT_WIDTH: Record<VisualColumn['type'], number> = {
  rowNumber: 48, catalog: 240, integer: 100, number: 110, text: 200, custom: 160,
  boolean: 90, select: 180, multiSelect: 220, date: 130, color: 130, json: 220,
};
export const widthOf = (col: VisualColumn): number => col.width ?? DEFAULT_WIDTH[col.type];

// ───────────── where a cell is stored: rowJSON[field] (default) or a root column of the row ─────────────
export const targetOf = (col: VisualColumn): CellTarget => col.target ?? 'rowJSON';
/** columns that hold no stored value */
export const isStoredColumn = (col: VisualColumn) => col.type !== 'rowNumber' && col.type !== 'custom';

/** the stored value of a cell */
export function cellValue(row: ReusableTableRow | null | undefined, col: VisualColumn): any {
  if (!row) return undefined;
  const target = targetOf(col);
  if (target !== 'rowJSON') {
    const v = row[target];
    // 'empty' is the "no parent / no owner" marker of the def-table pattern (kit8/sql/defTable.md)
    return v === 'empty' ? null : v;
  }
  return row.rowJSON?.[fieldOf(col)];
}

/** a cell change, split by where it is stored */
export interface CellPatch {
  rowJSON: Record<string, any>;
  /** root columns (rowOwnerGUID / rowParentGUID) */
  columns: Record<string, any>;
}

/** one edited cell: its value + null for every column that depends on it, split into rowJSON / root columns */
export function cellPatch(columns: VisualColumn[], key: string, value: any): CellPatch {
  const out: CellPatch = { rowJSON: {}, columns: {} };
  const col = columns.find((c) => c.key === key);
  if (!col) return out;
  const put = (c: VisualColumn, v: any) => {
    const target = targetOf(c);
    // a root column is NOT NULL in SQL: "nothing selected" is stored as 'empty'
    if (target === 'rowJSON') out.rowJSON[fieldOf(c)] = v ?? null;
    else out.columns[target] = v === null || v === undefined || v === '' ? 'empty' : v;
  };
  put(col, value);
  for (const dep of dependentColumns(columns, key)) put(dep, null);
  return out;
}

/** the scope (column equality) of a table: '*' / undefined columns are not part of it */
export function tableScope(listOwnerGUID?: string, listParentGUID?: string | null, match?: Record<string, any> | null): Record<string, any> {
  const scope: Record<string, any> = {};
  if (listOwnerGUID !== undefined && listOwnerGUID !== REUSABLE_TABLE_ALL) scope.rowOwnerGUID = listOwnerGUID;
  if (listParentGUID !== undefined && listParentGUID !== null && listParentGUID !== REUSABLE_TABLE_ALL) scope.rowParentGUID = listParentGUID;
  return { ...scope, ...(match || {}) };
}

/** rowOwnerGUID / rowParentGUID of a new row: newRowDefaults > the list scope > 'empty' */
export function newRowColumns(listOwnerGUID: string | undefined, listParentGUID: string | null | undefined, defaults?: NewRowDefaults | null): { rowOwnerGUID: string; rowParentGUID: string } {
  const pick = (scoped: string | null | undefined, fallback: string | undefined) => {
    if (fallback !== undefined && fallback !== null && fallback !== '') return fallback;
    if (scoped !== undefined && scoped !== null && scoped !== REUSABLE_TABLE_ALL) return scoped;
    return 'empty';
  };
  return { rowOwnerGUID: pick(listOwnerGUID, defaults?.rowOwnerGUID), rowParentGUID: pick(listParentGUID, defaults?.rowParentGUID) };
}

// ───────────── select / multiSelect options + the visible text of any cell ─────────────
export function optionsOf(col: VisualColumn, row: ReusableTableRow | null | undefined): SelectOption[] {
  if (col.type !== 'select' && col.type !== 'multiSelect') return [];
  const o = typeof col.options === 'function' ? (row ? col.options(row) : []) : col.options;
  return Array.isArray(o) ? o : [];
}
/** label of a stored option value (unknown value = the value itself) */
export function optionLabel(options: SelectOption[], value: any): string {
  if (value === null || value === undefined || value === '') return '';
  const found = options.find((o) => o.value === String(value));
  return found ? found.label : String(value);
}
/** options whose label / hint / value contain the typed text */
export function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.value}`.toLowerCase().includes(q));
}
/** stored multiSelect value -> string[] (a single string is one value) */
export const asStringArray = (v: any): string[] => (Array.isArray(v) ? v.map(String) : v === null || v === undefined || v === '' ? [] : [String(v)]);

/** what a cell shows as text: catalog / select = title, boolean = Yes / No, json = compact JSON */
export function displayText(row: ReusableTableRow, col: VisualColumn, catalogTitle: (col: VisualColumn, guid: string) => string): string {
  if (col.type === 'rowNumber') return '';
  if (col.type === 'custom') return col.searchText ? col.searchText(row) : '';
  const v = cellValue(row, col);
  if (col.type === 'boolean') return v === true ? 'Yes' : v === false ? 'No' : '';
  if (v === null || v === undefined || v === '') return '';
  if (col.type === 'catalog') return catalogTitle(col, String(v));
  if (col.type === 'select') return optionLabel(optionsOf(col, row), v);
  if (col.type === 'multiSelect') { const opts = optionsOf(col, row); return asStringArray(v).map((x) => optionLabel(opts, x)).join(', '); }
  if (col.type === 'json') { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}

/** 'YYYY-MM-DD' of a real day */
export function isValidDay(s: unknown): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
/** '#RGB' / '#RRGGBB' */
export const isHexColor = (s: unknown): boolean => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s ?? ''));

/** the built-in check of a typed value (date / color); null = ok */
export function builtInCellError(col: VisualColumn, value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (col.type === 'date' && !isValidDay(value)) return `${col.title}: use the form YYYY-MM-DD (e.g. 2026-10-08)`;
  if (col.type === 'color' && !isHexColor(value)) return `${col.title}: use the form #RRGGBB (e.g. #D32F2F)`;
  return null;
}

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
  return cellPatch(columns, key, value).rowJSON;
}

/** rowJSON of a new row: every stored rowJSON field = null (boolean = false, multiSelect = []) */
export function emptyRowJSON(columns: VisualColumn[]): Record<string, any> {
  const json: Record<string, any> = {};
  for (const col of columns) {
    if (!isStoredColumn(col) || targetOf(col) !== 'rowJSON') continue;
    json[fieldOf(col)] = col.type === 'boolean' ? false : col.type === 'multiSelect' ? [] : null;
  }
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
  const parts: string[] = [];
  for (const col of columns) {
    if (col.type === 'rowNumber') continue;
    const t = displayText(row, col, catalogTitle);
    if (t) parts.push(t);
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
 * "Fit to width": the width of EVERY column so that all of them are visible at once - together exactly `available` px (the table body without the
 * service columns). The columns keep their proportions (a wide column stays wider than a narrow one), a row number column keeps its width, and no
 * column gets narrower than MIN_COLUMN_WIDTH (or wider than MAX_COLUMN_WIDTH): a column that hits a limit is fixed there and the others share the rest.
 * When even the minimum widths do not fit, every column gets the minimum (the table then scrolls). Returns { [column key]: width }.
 */
export function fitColumnWidths(columns: VisualColumn[], available: number): Record<string, number> {
  const out: Record<string, number> = {};
  const flexible: VisualColumn[] = [];
  let fixedTotal = 0;
  for (const col of columns) {
    if (col.type === 'rowNumber') { out[col.key] = widthOf(col); fixedTotal += widthOf(col); } else flexible.push(col);
  }
  if (!flexible.length) return out;
  let target = Math.floor(available - fixedTotal);
  if (!(target > flexible.length * MIN_COLUMN_WIDTH)) { for (const col of flexible) out[col.key] = MIN_COLUMN_WIDTH; return out; }
  // columns stuck at a limit leave the share; the rest is scaled until nothing new gets stuck
  let free = flexible.slice();
  for (let guard = 0; guard <= flexible.length; guard++) {
    const total = free.reduce((w, col) => w + widthOf(col), 0);
    const scale = target / total;
    const stuck = free.filter((col) => widthOf(col) * scale < MIN_COLUMN_WIDTH || widthOf(col) * scale > MAX_COLUMN_WIDTH);
    if (!stuck.length) break;
    for (const col of stuck) {
      const w = widthOf(col) * scale < MIN_COLUMN_WIDTH ? MIN_COLUMN_WIDTH : MAX_COLUMN_WIDTH;
      out[col.key] = w;
      target -= w;
    }
    free = free.filter((col) => !stuck.includes(col));
    if (!free.length) return out;
  }
  const total = free.reduce((w, col) => w + widthOf(col), 0);
  let left = target;
  free.forEach((col, i) => {
    const w = i === free.length - 1 ? left : Math.floor((widthOf(col) * target) / total);
    out[col.key] = w;
    left -= w;
  });
  return out;
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

/** 'rgb(231, 224, 236)' / 'rgba(…)' / '#abc' -> '#e7e0ec' (alpha kept as #rrggbbaa); anything else is returned as it is */
export function colorToHex(color: string): string {
  const c = String(color || '').trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(c);
  if (!m) return c.startsWith('#') ? c.toLowerCase() : c;
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}${alpha < 1 ? h(alpha * 255) : ''}`;
}
