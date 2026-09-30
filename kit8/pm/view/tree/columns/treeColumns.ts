// Tree grid columns: keys, titles, widths, responsive layout, column resizing and drag & drop
// reordering. Pure (no React / Skia) - used by the Skia tree, the inline cell editors, the hover
// panel placement and the unit tests.
//
// Saved per project in project_table.rowJSON.uxuiSettings:
//   treeColumnsOrder          e.g. ['wbs', 'name', 'start', 'days', 'progress', 'cc_k3v9x2qa'] (default: "#" first)
//   showTreeHierarchyNumbers  "#" column (outline number 1.2.3) on / off (default true)
//   treeColumnsWidths         widths of resized columns, e.g. { name: 260, cc_k3v9x2qa: 140 }
// Custom columns (tree/columns/customColumns.ts) are defined in project_table.rowJSON.customColumns.
//
// Coordinates: every x in a layout is a CONTENT x (0 = left edge of the first column). The tree
// scrolls horizontally when the columns are wider than the pane (contentWidth > width).

import { PM_TREE_COL_DAYS, PM_TREE_COL_KANBAN, PM_TREE_COL_KANBAN_PROGRESS, PM_TREE_COL_PROGRESS, PM_TREE_COL_START, PM_TREE_COL_WBS } from '../../../model/constants';
import { isCustomColumnKey, PMCustomColumnDef, PMCustomColumnKey, PMCustomColumnType, PM_CUSTOM_COLUMN_DEFAULT_WIDTH } from './customColumns';

/** Built-in columns: wbs = "#" (hierarchy / outline number), name = Task name, kanban = Kanban stage, kanbanStageProgressPercent = Kanban %. */
export type PMBuiltinTreeColumnKey = 'wbs' | 'name' | 'start' | 'days' | 'progress' | 'kanban' | 'kanbanStageProgressPercent';
/** Any tree column: built-in or custom ("cc_..."). */
export type PMTreeColumnKey = PMBuiltinTreeColumnKey | PMCustomColumnKey;

/** Default order: "#" column first, "Kanban" then "Kanban %" columns last (custom columns follow, in creation order). */
export const PM_TREE_COLUMNS_DEFAULT_ORDER: readonly PMBuiltinTreeColumnKey[] = ['wbs', 'name', 'start', 'days', 'progress', 'kanban', 'kanbanStageProgressPercent'];

export const PM_TREE_COLUMN_TITLES: Record<PMBuiltinTreeColumnKey, string> = {
  wbs: '#',
  name: 'Task name',
  start: 'Start',
  days: 'Days',
  progress: '%',
  kanban: 'Kanban',
  kanbanStageProgressPercent: 'Kanban %',
};

/** Default widths; the Task name column takes the rest of the pane until it is resized. */
export const PM_TREE_COLUMN_WIDTHS: Record<Exclude<PMBuiltinTreeColumnKey, 'name'>, number> = {
  wbs: PM_TREE_COL_WBS,
  start: PM_TREE_COL_START,
  days: PM_TREE_COL_DAYS,
  progress: PM_TREE_COL_PROGRESS,
  kanban: PM_TREE_COL_KANBAN,
  kanbanStageProgressPercent: PM_TREE_COL_KANBAN_PROGRESS,
};

/** The flexible Task name column never gets narrower than this: other built-in columns are hidden first. */
export const PM_TREE_NAME_MIN_WIDTH = 130;
/** Resizing limits (px). */
export const PM_TREE_COLUMN_MIN_WIDTH = 32;
export const PM_TREE_NAME_RESIZE_MIN_WIDTH = 80;
export const PM_TREE_COLUMN_MAX_WIDTH = 1200;
/** Half width of the grab zone around a header separator (px). */
export const PM_TREE_RESIZE_GRAB = 5;

/** Narrow pane: hide "#" first, then Kanban %, then Kanban, then %, then Days, then Start (Task name always stays). */
const HIDE_PRIORITY: readonly Exclude<PMBuiltinTreeColumnKey, 'name'>[] = ['wbs', 'kanbanStageProgressPercent', 'kanban', 'progress', 'days', 'start'];

export const isBuiltinTreeColumnKey = (k: unknown): k is PMBuiltinTreeColumnKey =>
  typeof k === 'string' && (PM_TREE_COLUMNS_DEFAULT_ORDER as readonly string[]).includes(k);

/**
 * Valid, complete, duplicate-free order: unknown keys dropped (also custom keys that are not in
 * `customKeys`), missing built-in keys re-inserted at their default place, missing custom keys
 * appended at the end (a new custom column is the last one).
 */
export function normalizeTreeColumnsOrder(value: unknown, customKeys: readonly string[] = []): PMTreeColumnKey[] {
  const src = Array.isArray(value) ? value : [];
  const out: PMTreeColumnKey[] = [];
  for (const k of src) {
    if (out.includes(k)) continue;
    if (isBuiltinTreeColumnKey(k) || (isCustomColumnKey(k) && customKeys.includes(k))) out.push(k);
  }
  PM_TREE_COLUMNS_DEFAULT_ORDER.forEach((k, i) => {
    if (out.includes(k)) return;
    if (k === 'kanban' || k === 'kanbanStageProgressPercent') {
      out.push(k);
      return;
    }
    // insert after the nearest default predecessor that is already placed
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const p = out.indexOf(PM_TREE_COLUMNS_DEFAULT_ORDER[j]);
      if (p >= 0) {
        at = p + 1;
        break;
      }
    }
    out.splice(at, 0, k);
  });
  for (const k of customKeys) if (isCustomColumnKey(k) && !out.includes(k)) out.push(k);
  return out;
}

export function sameTreeColumnsOrder(a: readonly PMTreeColumnKey[], b: readonly PMTreeColumnKey[]) {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** Valid saved widths only (finite, clamped). */
export function normalizeTreeColumnsWidths(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (!isBuiltinTreeColumnKey(k) && !isCustomColumnKey(k)) continue;
    out[k] = clampTreeColumnWidth(k as PMTreeColumnKey, v);
  }
  return out;
}

export function clampTreeColumnWidth(key: PMTreeColumnKey, w: number): number {
  const min = key === 'name' ? PM_TREE_NAME_RESIZE_MIN_WIDTH : PM_TREE_COLUMN_MIN_WIDTH;
  return Math.round(Math.max(min, Math.min(PM_TREE_COLUMN_MAX_WIDTH, w)));
}

/** Title of any column (custom = its name). */
export function treeColumnTitle(key: PMTreeColumnKey, customColumns: readonly PMCustomColumnDef[] = []): string {
  if (isBuiltinTreeColumnKey(key)) return PM_TREE_COLUMN_TITLES[key];
  return customColumns.find((c) => c.key === key)?.name ?? key;
}

export interface PMTreeColumn {
  key: PMTreeColumnKey;
  title: string;
  /** left edge in tree CONTENT coordinates */
  x: number;
  w: number;
  /** custom column type (undefined = built-in) */
  customType?: PMCustomColumnType;
}

export interface PMTreeColumnsLayout {
  /** visible columns, left to right */
  columns: PMTreeColumn[];
  byKey: Partial<Record<PMTreeColumnKey, PMTreeColumn>>;
  /** x of the separators between visible columns (not the pane edges) */
  separators: number[];
  /** the full order (incl. hidden columns) */
  order: PMTreeColumnKey[];
  /** pane (viewport) width */
  width: number;
  /** total width of the visible columns (>= width unless the columns are narrower) - horizontal scroll when > width */
  contentWidth: number;
  /** effective widths of all laid-out columns (for resizing) */
  widths: Record<string, number>;
}

export interface PMTreeColumnsLayoutOptions {
  showHierarchyNumbers?: boolean;
  /** uxuiSettings.treeColumnsWidths (a Task name width switches it from "fill the pane" to fixed) */
  widths?: Record<string, number>;
  /** project custom columns (definitions) */
  customColumns?: readonly PMCustomColumnDef[];
}

export function layoutTreeColumns(width: number, orderIn: readonly PMTreeColumnKey[] | unknown, opts: PMTreeColumnsLayoutOptions = {}): PMTreeColumnsLayout {
  const customColumns = opts.customColumns ?? [];
  const customByKey = new Map(customColumns.map((c) => [c.key as string, c]));
  const order = normalizeTreeColumnsOrder(orderIn, customColumns.map((c) => c.key));
  const saved = opts.widths ?? {};
  const widthOf = (k: PMTreeColumnKey): number => {
    if (typeof saved[k] === 'number') return clampTreeColumnWidth(k, saved[k]);
    if (isCustomColumnKey(k)) return PM_CUSTOM_COLUMN_DEFAULT_WIDTH[customByKey.get(k)!.type];
    return PM_TREE_COLUMN_WIDTHS[k as Exclude<PMBuiltinTreeColumnKey, 'name'>];
  };
  const visible = new Set<PMTreeColumnKey>(order);
  if (opts.showHierarchyNumbers === false) visible.delete('wbs');
  const nameFixed = typeof saved.name === 'number';
  if (!nameFixed) {
    // responsive: hide built-in columns while the flexible Task name column would be too narrow
    // (custom columns never hide - the tree scrolls horizontally instead)
    const builtinFixed = () => {
      let s = 0;
      for (const k of visible) if (k !== 'name' && isBuiltinTreeColumnKey(k)) s += widthOf(k);
      return s;
    };
    for (const k of HIDE_PRIORITY) {
      if (width - builtinFixed() >= PM_TREE_NAME_MIN_WIDTH) break;
      visible.delete(k);
    }
  }
  let othersSum = 0;
  for (const k of visible) if (k !== 'name') othersSum += widthOf(k);
  const nameW = nameFixed ? widthOf('name') : Math.max(Math.min(PM_TREE_NAME_MIN_WIDTH, width), width - othersSum);
  const columns: PMTreeColumn[] = [];
  const byKey: PMTreeColumnsLayout['byKey'] = {};
  const widths: Record<string, number> = {};
  let x = 0;
  for (const key of order) {
    if (!visible.has(key)) continue;
    const w = key === 'name' ? nameW : widthOf(key);
    const custom = customByKey.get(key);
    const col: PMTreeColumn = { key, title: custom ? custom.name : PM_TREE_COLUMN_TITLES[key as PMBuiltinTreeColumnKey], x, w };
    if (custom) col.customType = custom.type;
    columns.push(col);
    byKey[key] = col;
    widths[key] = w;
    x += w;
  }
  const separators = columns.slice(1).map((c) => c.x);
  return { columns, byKey, separators, order, width, contentWidth: x, widths };
}

/** Largest horizontal scroll of the tree. */
export function treeMaxScrollX(layout: Pick<PMTreeColumnsLayout, 'contentWidth' | 'width'>): number {
  return Math.max(0, layout.contentWidth - layout.width);
}

/** Visible column under content x (null outside the columns). */
export function treeColumnAt(layout: PMTreeColumnsLayout, x: number): PMTreeColumnKey | null {
  for (const c of layout.columns) if (x >= c.x && x < c.x + c.w) return c.key;
  return null;
}

/**
 * Column whose RIGHT edge is within `grab` px of content x (header resize handle), or null.
 * The nearest edge wins; the last column can be resized too.
 */
export function treeColumnResizeHandleAt(layout: PMTreeColumnsLayout, x: number, grab = PM_TREE_RESIZE_GRAB): PMTreeColumnKey | null {
  let best: PMTreeColumnKey | null = null;
  let bestD = grab + 0.001;
  for (const c of layout.columns) {
    const d = Math.abs(c.x + c.w - x);
    if (d < bestD) {
      bestD = d;
      best = c.key;
    }
  }
  return best;
}

/** New widths map after resizing `key` to `w` (clamped). */
export function resizeTreeColumn(layout: PMTreeColumnsLayout, key: PMTreeColumnKey, w: number, saved: Record<string, number> = {}): Record<string, number> {
  return { ...saved, [key]: clampTreeColumnWidth(key, w) };
}

/** Horizontal scroll that makes column `key` fully visible (keeps `scrollX` when it already is). */
export function scrollXToRevealColumn(layout: PMTreeColumnsLayout, key: PMTreeColumnKey, scrollX: number): number {
  const c = layout.byKey[key];
  const max = treeMaxScrollX(layout);
  if (!c) return Math.max(0, Math.min(max, scrollX));
  let s = scrollX;
  if (c.x + c.w > s + layout.width) s = c.x + c.w - layout.width;
  if (c.x < s) s = c.x;
  return Math.max(0, Math.min(max, s));
}

/** Drop slot (0 = before the first visible column ... n = after the last) nearest to content x. */
export function treeColumnDropSlot(layout: PMTreeColumnsLayout, x: number): number {
  const bounds = [0, ...layout.columns.map((c) => c.x + c.w)];
  let best = 0;
  for (let i = 1; i < bounds.length; i++) if (Math.abs(bounds[i] - x) < Math.abs(bounds[best] - x)) best = i;
  return best;
}

/**
 * Moves `key` to a drop slot among the VISIBLE columns (see treeColumnDropSlot).
 * Hidden columns keep their place in the full order. Returns the same array when nothing moves.
 */
export function moveTreeColumn(layout: PMTreeColumnsLayout, key: PMTreeColumnKey, slot: number): PMTreeColumnKey[] {
  const visible = layout.columns.map((c) => c.key);
  const from = visible.indexOf(key);
  if (from < 0 || slot === from || slot === from + 1) return layout.order;
  const rest = layout.order.filter((k) => k !== key);
  const before = visible[slot]; // insert before this visible column, or after the last one
  const at = before && before !== key ? rest.indexOf(before) : rest.indexOf(visible[visible.length - 1]) + 1;
  const next = [...rest];
  next.splice(Math.max(0, at), 0, key);
  return sameTreeColumnsOrder(next, layout.order) ? layout.order : next;
}
