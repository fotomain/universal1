// ReusableTable - geometry of the vertical scrollbar (pure, no React): see ReusableTableVScrollbar.tsx.
export const VSCROLL_BAR_WIDTH = 14;
export const VSCROLL_MIN_THUMB = 28;

export type VScrollMetrics = {
  /** px of the whole content of the body */
  contentH: number;
  /** px of the visible part of the body */
  viewH: number;
  /** px scrolled */
  offsetY: number;
  /** px between the top of the table content and the body (= the header row) */
  bodyY: number;
};

export const EMPTY_VSCROLL: VScrollMetrics = { contentH: 0, viewH: 0, offsetY: 0, bodyY: 0 };

/** the bar is needed only while the rows do not fit (1 px = rounding noise) */
export function vScrollNeeded(m: VScrollMetrics): boolean {
  return m.viewH > 0 && m.contentH - m.viewH > 1;
}

/** the biggest offset the body can have */
export function vScrollMax(m: VScrollMetrics): number {
  return Math.max(0, m.contentH - m.viewH);
}

/** height of the thumb: the share of the content that is visible, never smaller than VSCROLL_MIN_THUMB */
export function vThumbHeight(m: VScrollMetrics): number {
  if (!vScrollNeeded(m)) return m.viewH;
  return Math.min(m.viewH, Math.max(VSCROLL_MIN_THUMB, Math.round((m.viewH * m.viewH) / m.contentH)));
}

/** px the thumb can move inside the track */
export function vThumbTravel(m: VScrollMetrics): number {
  return Math.max(0, m.viewH - vThumbHeight(m));
}

/** top of the thumb inside the track for the current offset */
export function vThumbTop(m: VScrollMetrics): number {
  const max = vScrollMax(m);
  if (max <= 0) return 0;
  const clamped = Math.min(max, Math.max(0, m.offsetY));
  return (clamped / max) * vThumbTravel(m);
}

/** the offset of the body after the thumb was dragged `dy` px from a thumb that started at the offset `startOffset` */
export function vOffsetAfterDrag(m: VScrollMetrics, startOffset: number, dy: number): number {
  const travel = vThumbTravel(m);
  const max = vScrollMax(m);
  if (travel <= 0 || max <= 0) return 0;
  return Math.min(max, Math.max(0, startOffset + (dy / travel) * max));
}

/** a press on the track at `y` (px from the top of the track) centers the thumb there */
export function vOffsetForTrackPress(m: VScrollMetrics, y: number): number {
  const travel = vThumbTravel(m);
  const max = vScrollMax(m);
  if (travel <= 0 || max <= 0) return 0;
  const top = Math.min(travel, Math.max(0, y - vThumbHeight(m) / 2));
  return (top / travel) * max;
}
