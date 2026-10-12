// Pie chart model - pure (no React / Skia), unit-tested: rows -> slices (angles, fractions, colors).
//   buildPieSlices(data)  rows with a value > 0 only; biggest first; beyond `maxSlices` the smallest are added up into "Other".
// Angles are in degrees, clockwise, the first slice starts at 12 o'clock (-90°) - the way the Skia path draws them.

export interface PieDatum {
  key: string;
  label: string;
  value: number;
  /** own color of this slice (default: PIE_COLORS in order) */
  color?: string;
}

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  /** value / total, 0..1 */
  fraction: number;
  /** degrees, -90 = 12 o'clock */
  startDeg: number;
  sweepDeg: number;
  color: string;
}

/** muted palette of the reference picture: slate blue, orange, green, yellow, then more */
export const PIE_COLORS: readonly string[] = ['#3F4A7A', '#E8714A', '#7BBF8E', '#F0B93A', '#8C6BB1', '#4DA6C9', '#C95B7E', '#9AA3AF'];
export const PIE_OTHER_KEY = '__other';
export const PIE_START_DEG = -90;

export interface BuildPieOptions {
  /** most slices drawn, "Other" included (default 8) */
  maxSlices?: number;
  otherLabel?: string;
  colors?: readonly string[];
}

export function buildPieSlices(data: readonly PieDatum[], opts: BuildPieOptions = {}): PieSlice[] {
  const maxSlices = Math.max(2, Math.floor(opts.maxSlices ?? 8));
  const colors = opts.colors && opts.colors.length ? opts.colors : PIE_COLORS;
  let rows = (data || []).filter((d) => Number.isFinite(d.value) && d.value > 0).sort((a, b) => b.value - a.value);
  if (rows.length > maxSlices) {
    const rest = rows.slice(maxSlices - 1);
    rows = [...rows.slice(0, maxSlices - 1), { key: PIE_OTHER_KEY, label: opts.otherLabel ?? 'Other', value: rest.reduce((a, r) => a + r.value, 0) }];
  }
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (total <= 0) return [];
  let at = PIE_START_DEG;
  return rows.map((r, i) => {
    const fraction = r.value / total;
    const sweepDeg = fraction * 360;
    const slice: PieSlice = { key: r.key, label: r.label, value: r.value, fraction, startDeg: at, sweepDeg, color: r.color ?? colors[i % colors.length] };
    at += sweepDeg;
    return slice;
  });
}

/** 0.2534 -> "25.3%" ; below 0.1% -> "<0.1%" */
export function formatPiePercent(fraction: number): string {
  const p = fraction * 100;
  if (p > 0 && p < 0.1) return '<0.1%';
  return `${p.toFixed(1)}%`;
}
