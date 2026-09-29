// Pure geometry for the chart (no Skia import): time-scale cells for the 2-tier header
// and bar/link anchor math. Shared by PMProjectGanttChart and unit tests.

import { DAY_MS } from '../../model/constants';
import { MONTHS_SHORT } from '../project/scheduling';

export type PMScaleUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface PMScaleCell {
  x: number; // px from timeline start (committed zoom)
  w: number;
  label: string;
  strong?: boolean;
}

export interface PMScaleLevels {
  top: PMScaleUnit;
  bottom: PMScaleUnit;
}

/** DHTMLX-style automatic scale config for the current zoom. */
export function scaleLevelsFor(dayWidth: number): PMScaleLevels {
  if (dayWidth >= 18) return { top: 'month', bottom: 'day' };
  if (dayWidth >= 6) return { top: 'month', bottom: 'week' };
  if (dayWidth >= 2) return { top: 'year', bottom: 'month' };
  return { top: 'year', bottom: 'quarter' };
}

/** Zoom (px per day) of the Day / Week / Month / Year toolbar buttons. */
export const PM_ZOOM_PRESETS = { day: 36, week: 12, month: 4, year: 1.2 } as const;

const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function unitStart(ms: number, unit: PMScaleUnit): number {
  const d = new Date(ms);
  switch (unit) {
    case 'day':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    case 'week': {
      const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
      return day - dow * DAY_MS;
    }
    case 'month':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    case 'quarter':
      return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
    case 'year':
      return Date.UTC(d.getUTCFullYear(), 0, 1);
  }
}

function nextUnit(ms: number, unit: PMScaleUnit): number {
  const d = new Date(ms);
  switch (unit) {
    case 'day':
      return ms + DAY_MS;
    case 'week':
      return ms + 7 * DAY_MS;
    case 'month':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    case 'quarter':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1);
    case 'year':
      return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  }
}

function labelFor(ms: number, unit: PMScaleUnit, dayWidth: number): string {
  const d = new Date(ms);
  switch (unit) {
    case 'day':
      return dayWidth >= 44 ? `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()}` : String(d.getUTCDate());
    case 'week':
      return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
    case 'month':
      return dayWidth >= 6 ? `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}` : MONTHS_SHORT[d.getUTCMonth()];
    case 'quarter':
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    case 'year':
      return String(d.getUTCFullYear());
  }
}

/** Cells of one scale row that intersect [fromDay, toDay] (day offsets from timeline start). */
export function scaleCells(
  timelineStartMs: number,
  fromDay: number,
  toDay: number,
  unit: PMScaleUnit,
  dayWidth: number
): PMScaleCell[] {
  const cells: PMScaleCell[] = [];
  const fromMs = timelineStartMs + fromDay * DAY_MS;
  const toMs = timelineStartMs + (toDay + 1) * DAY_MS;
  let s = unitStart(fromMs, unit);
  for (let guard = 0; s < toMs && guard < 2000; guard++) {
    const e = nextUnit(s, unit);
    const x = ((s - timelineStartMs) / DAY_MS) * dayWidth;
    const w = ((e - s) / DAY_MS) * dayWidth;
    const d = new Date(s);
    cells.push({ x, w, label: labelFor(s, unit, dayWidth), strong: unit === 'day' && (d.getUTCDay() === 0 || d.getUTCDay() === 6) });
    s = e;
  }
  return cells;
}

export function isWeekendDay(timelineStartMs: number, dayOffset: number): boolean {
  const dow = new Date(timelineStartMs + dayOffset * DAY_MS).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Monday on or before `ms` (UTC). */
export function mondayOnOrBefore(ms: number): number {
  return unitStart(ms, 'week');
}

// =====================================================================================
// Dependency arrow routing (pure; drawn by the chart, also used for arrow hit-testing)
// =====================================================================================

export interface PMLinkRoute {
  /** smoothForm: cubic Bézier; squareForm: orthogonal polyline */
  form: 'smoothForm' | 'squareForm';
  x1: number;
  y1: number;
  /** line end = arrow base */
  endX: number;
  y2: number;
  /** arrow tip (x) and direction (+1 = points right) */
  tipX: number;
  dir2: number;
  /** cubic control points (smoothForm only) */
  c?: [number, number, number, number];
  /** polyline through the route (squareForm corners, or smoothForm samples) */
  points: number[];
}

/**
 * Route from (x1,y1) leaving in direction dir1 (+1 = to the right, i.e. from a bar finish)
 * to the arrow tip (x2,y2) entering in direction dir2 (+1 = into a bar start).
 * rowHeight is used by squareForm to run the horizontal detour along a row boundary.
 */
export function routeLink(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dir1: number,
  dir2: number,
  form: 'smoothForm' | 'squareForm',
  rowHeight: number
): PMLinkRoute {
  const tipX = x2 - dir2 * 1;
  const endX = tipX - dir2 * 6;
  if (form === 'squareForm') {
    const gap = 10;
    const sx = x1 + dir1 * gap;
    const ex = tipX - dir2 * gap;
    let pts: number[];
    if (dir1 === -1 && dir2 === 1) {
      const m = Math.min(sx, ex); // SS: one vertical left of both starts
      pts = [x1, y1, m, y1, m, y2, endX, y2];
    } else if (dir1 === 1 && dir2 === -1) {
      const m = Math.max(sx, ex); // FF: one vertical right of both finishes
      pts = [x1, y1, m, y1, m, y2, endX, y2];
    } else if ((ex - sx) * dir1 >= 0) {
      pts = [x1, y1, sx, y1, sx, y2, endX, y2]; // FS forward / SF backward: one vertical
    } else {
      const midY = y1 + Math.sign(y2 - y1 || 1) * (rowHeight / 2); // detour along the row boundary
      pts = [x1, y1, sx, y1, sx, midY, ex, midY, ex, y2, endX, y2];
    }
    return { form, x1, y1, endX, y2, tipX, dir2, points: pts };
  }
  const bend = Math.max(18, Math.min(80, Math.abs(x2 - x1) / 2 + Math.abs(y2 - y1) / 4));
  const c: [number, number, number, number] = [x1 + dir1 * bend, y1, tipX - dir2 * bend, y2];
  const points: number[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const bx = u * u * u * x1 + 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t * endX;
    const by = u * u * u * y1 + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * y2;
    points.push(bx, by);
  }
  points.push(tipX, y2);
  return { form, x1, y1, endX, y2, tipX, dir2, c, points };
}

/** Squared distance from (px,py) to a polyline [x0,y0,x1,y1,...] after mapping x -> x*sx + ox. */
export function distanceToPolyline(px: number, py: number, pts: number[], sx = 1, ox = 0): number {
  let best = Infinity;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i] * sx + ox;
    const ay = pts[i + 1];
    const bx = pts[i + 2] * sx + ox;
    const by = pts[i + 3];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    const qx = ax + t * dx - px;
    const qy = ay + t * dy - py;
    best = Math.min(best, qx * qx + qy * qy);
  }
  return Math.sqrt(best);
}
