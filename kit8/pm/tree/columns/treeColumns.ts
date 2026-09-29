// Tree grid columns: keys, titles, widths, responsive layout and drag & drop reordering.
// Pure (no React / Skia) - used by the Skia tree, the inline cell editors, the hover panel
// placement and the unit tests.
//
// Saved per project in project_table.rowJSON.uxuiSettings:
//   treeColumnsOrder          e.g. ['wbs', 'name', 'start', 'days', 'progress'] (default: "#" first)
//   showTreeHierarchyNumbers  "#" column (outline number 1.2.3) on / off (default true)

import { PM_TREE_COL_DAYS, PM_TREE_COL_PROGRESS, PM_TREE_COL_START, PM_TREE_COL_WBS } from '../../constants';

/** wbs = "#" (hierarchy / outline number), name = Task name (flexible width). */
export type PMTreeColumnKey = 'wbs' | 'name' | 'start' | 'days' | 'progress';

/** Default order: the "#" column is the first one. */
export const PM_TREE_COLUMNS_DEFAULT_ORDER: readonly PMTreeColumnKey[] = ['wbs', 'name', 'start', 'days', 'progress'];

export const PM_TREE_COLUMN_TITLES: Record<PMTreeColumnKey, string> = {
  wbs: '#',
  name: 'Task name',
  start: 'Start',
  days: 'Days',
  progress: '%',
};

/** Fixed widths; the Task name column takes the rest of the pane. */
export const PM_TREE_COLUMN_WIDTHS: Record<Exclude<PMTreeColumnKey, 'name'>, number> = {
  wbs: PM_TREE_COL_WBS,
  start: PM_TREE_COL_START,
  days: PM_TREE_COL_DAYS,
  progress: PM_TREE_COL_PROGRESS,
};

/** The Task name column never gets narrower than this: other columns are hidden first. */
export const PM_TREE_NAME_MIN_WIDTH = 130;

/** Narrow pane: hide "#" first, then %, then Days, then Start (Task name always stays). */
const HIDE_PRIORITY: readonly Exclude<PMTreeColumnKey, 'name'>[] = ['wbs', 'progress', 'days', 'start'];

const isKey = (k: unknown): k is PMTreeColumnKey => typeof k === 'string' && (PM_TREE_COLUMNS_DEFAULT_ORDER as readonly string[]).includes(k);

/** Valid, complete, duplicate-free order (unknown keys dropped, missing ones added at their default place). */
export function normalizeTreeColumnsOrder(value: unknown): PMTreeColumnKey[] {
  const src = Array.isArray(value) ? value : [];
  const out: PMTreeColumnKey[] = [];
  for (const k of src) if (isKey(k) && !out.includes(k)) out.push(k);
  PM_TREE_COLUMNS_DEFAULT_ORDER.forEach((k, i) => {
    if (out.includes(k)) return;
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
  return out;
}

export function sameTreeColumnsOrder(a: readonly PMTreeColumnKey[], b: readonly PMTreeColumnKey[]) {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

export interface PMTreeColumn {
  key: PMTreeColumnKey;
  title: string;
  /** left edge in tree canvas coordinates */
  x: number;
  w: number;
}

export interface PMTreeColumnsLayout {
  /** visible columns, left to right */
  columns: PMTreeColumn[];
  byKey: Partial<Record<PMTreeColumnKey, PMTreeColumn>>;
  /** x of the separators between visible columns (not the pane edges) */
  separators: number[];
  /** the full saved order (incl. hidden columns) */
  order: PMTreeColumnKey[];
  width: number;
}

export function layoutTreeColumns(
  width: number,
  orderIn: readonly PMTreeColumnKey[] | unknown,
  opts: { showHierarchyNumbers?: boolean } = {}
): PMTreeColumnsLayout {
  const order = normalizeTreeColumnsOrder(orderIn);
  const visible = new Set<PMTreeColumnKey>(order);
  if (opts.showHierarchyNumbers === false) visible.delete('wbs');
  const fixedSum = () => {
    let s = 0;
    for (const k of visible) if (k !== 'name') s += PM_TREE_COLUMN_WIDTHS[k];
    return s;
  };
  for (const k of HIDE_PRIORITY) {
    if (width - fixedSum() >= PM_TREE_NAME_MIN_WIDTH) break;
    visible.delete(k);
  }
  const nameW = Math.max(0, width - fixedSum());
  const columns: PMTreeColumn[] = [];
  const byKey: PMTreeColumnsLayout['byKey'] = {};
  let x = 0;
  for (const key of order) {
    if (!visible.has(key)) continue;
    const w = key === 'name' ? nameW : PM_TREE_COLUMN_WIDTHS[key];
    const col = { key, title: PM_TREE_COLUMN_TITLES[key], x, w };
    columns.push(col);
    byKey[key] = col;
    x += w;
  }
  const separators = columns.slice(1).map((c) => c.x);
  return { columns, byKey, separators, order, width };
}

/** Visible column under x (null outside the pane). */
export function treeColumnAt(layout: PMTreeColumnsLayout, x: number): PMTreeColumnKey | null {
  for (const c of layout.columns) if (x >= c.x && x < c.x + c.w) return c.key;
  return null;
}

/** Drop slot (0 = before the first visible column ... n = after the last) nearest to x. */
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
