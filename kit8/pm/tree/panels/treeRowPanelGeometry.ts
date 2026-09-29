// Where the tree row CRUD panel (PMTreeRowHoverPanel) goes: it takes the room its icons need,
// not only the width of the Task name column. It ends at the right edge of the Task name column
// when it fits there, otherwise it grows over the neighbouring columns (#, Start, Days, %) and,
// on very narrow panes, is clamped to the tree. Pure (unit-tested).

import { PMTreeColumnsLayout } from '../columns/treeColumns';

/** compact PMIconButton (16px icon + 2×4px padding) + a little air */
export const PM_TREE_ROW_PANEL_ICON_WIDTH = 26;
const PANEL_PAD = 8; // panel paddingHorizontal + border
const EDGE = 4; // gap to the tree edges

/** Buttons in the panel: add below · add above · (stage: add inside) · 7 row actions (PMRowActionButtons). */
export function treeRowPanelIconCount(isSummary: boolean) {
  return 2 + (isSummary ? 1 : 0) + 7;
}

export function treeRowPanelNaturalWidth(isSummary: boolean) {
  return treeRowPanelIconCount(isSummary) * PM_TREE_ROW_PANEL_ICON_WIDTH + PANEL_PAD;
}

export interface PMTreeRowPanelBox {
  /** left edge in tree canvas coordinates */
  left: number;
  width: number;
}

export function placeTreeRowPanel(layout: PMTreeColumnsLayout, isSummary: boolean): PMTreeRowPanelBox {
  const width = Math.max(0, Math.min(treeRowPanelNaturalWidth(isSummary), layout.width - 2 * EDGE));
  const name = layout.byKey.name;
  const anchorRight = name ? name.x + name.w - EDGE : layout.width - EDGE;
  let left = anchorRight - width;
  if (left < EDGE) left = EDGE; // name column too narrow: grow to the right over the next columns
  if (left + width > layout.width - EDGE) left = Math.max(EDGE, layout.width - EDGE - width);
  return { left, width };
}

/** True when canvas point x is over the panel box. */
export function isOverTreeRowPanel(box: PMTreeRowPanelBox | null, x: number) {
  return !!box && x >= box.left && x <= box.left + box.width;
}
