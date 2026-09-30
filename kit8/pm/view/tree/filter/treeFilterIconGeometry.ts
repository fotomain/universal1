// Where the filter icon of a tree column header sits (Skia header + hit-testing in the tree).
// Pure (no React / Skia). Coordinates are tree CONTENT x (see tree/columns/treeColumns.ts).
//
//   | Title…          ↑ ▾ |   ▾ = no filter (light arrow)   funnel = filtered (uxuiSettings.columnFilterIconColor)
//                     └ sort arrow (only when the column is sorted)

import { PM_SCALE_HEIGHT } from '../../../model/constants';
import { PMTreeColumn, PMTreeColumnKey, PMTreeColumnsLayout, PM_TREE_RESIZE_GRAB } from '../columns/treeColumns';

export const PM_TREE_FILTER_ICON_SIZE = 12;
/** gap between the icon and the column's right edge (keeps the resize handle free) */
export const PM_TREE_FILTER_ICON_RIGHT_PAD = 7;
/** narrower columns get no icon (Filter & sort stays in the header menu) */
export const PM_TREE_FILTER_ICON_MIN_COLUMN = 34;
/** width of the sort arrow drawn left of the icon */
export const PM_TREE_SORT_ARROW_W = 10;

export interface PMTreeFilterIconBox {
  x: number;
  y: number;
  size: number;
}

/** Icon box of a column (null = too narrow). */
export function treeFilterIconBox(c: Pick<PMTreeColumn, 'x' | 'w'>): PMTreeFilterIconBox | null {
  if (c.w < PM_TREE_FILTER_ICON_MIN_COLUMN) return null;
  const size = PM_TREE_FILTER_ICON_SIZE;
  return { x: c.x + c.w - PM_TREE_FILTER_ICON_RIGHT_PAD - size, y: Math.round((PM_SCALE_HEIGHT - size) / 2), size };
}

/** Width left for the header title (after the left padding, the icon and the sort arrow). */
export function treeHeaderTitleWidth(c: Pick<PMTreeColumn, 'x' | 'w'>, pad: number, sorted: boolean): number {
  const icon = treeFilterIconBox(c) ? PM_TREE_FILTER_ICON_SIZE + PM_TREE_FILTER_ICON_RIGHT_PAD + 2 : 0;
  return c.w - pad - 4 - icon - (sorted && icon ? PM_TREE_SORT_ARROW_W : 0);
}

/**
 * Column whose filter icon is under (content x, y), or null. The zone is a bit wider than the icon
 * (sort arrow included) but stops before the resize handle of the column's right edge.
 */
export function treeFilterIconAt(layout: Pick<PMTreeColumnsLayout, 'columns'>, x: number, y: number, grab = PM_TREE_RESIZE_GRAB): PMTreeColumnKey | null {
  if (y < 0 || y >= PM_SCALE_HEIGHT) return null;
  for (const c of layout.columns) {
    if (x < c.x || x >= c.x + c.w) continue;
    const box = treeFilterIconBox(c);
    if (!box) return null;
    const left = box.x - PM_TREE_SORT_ARROW_W;
    const right = c.x + c.w - grab;
    return x >= left && x < right ? c.key : null;
  }
  return null;
}
