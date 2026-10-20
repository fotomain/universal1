// roiHistoryModel - the points of Monitor03_ROIHistory, all pure (documentation/ROI_DOC.html section 7.3).
//   mode 'month'    the CUMULATIVE curve in business time of the month totals (cumulateMonthRows: summed from the first month of the period); one point per month with data
//   mode 'seen'     the log "as seen on a day" (project_status_roi_history): a STEP line (the value stays until the next row), the reason of every row is a marker
// Both give RoiPoint { x: 'YYYY-MM-DD', money, line } - the ratios are roiOfMoney(money) under the project's CURRENT tax switches, so a switch redraws the whole curve.
import { RoiKind, RoiLine, RoiMoney, roiOfMoney } from './roiModel';
import type { RoiTaxSettings } from './roiSettings';
import type { RoiHistoryRow, RoiMonthRow } from './roiApi';
import { addMoney, zeroMoney } from './roiModel';
import { roiMonthInPeriod } from './roiReportModel';

export type RoiHistoryMode = 'month' | 'seen';
export interface RoiPoint { x: string; reason: string; money: RoiMoney; line: RoiLine }

/** the first days of every month from the month of `from` to the month of `to` (both 'YYYY-MM-DD'), at most ROI_MAX_FILLED_MONTHS */
export const ROI_MAX_FILLED_MONTHS = 240;
export function roiMonthsBetween(from: string, to: string): string[] {
  let y = +from.slice(0, 4);
  let m = +from.slice(5, 7);
  const out: string[] = [];
  while ((y < +to.slice(0, 4) || (y === +to.slice(0, 4) && m <= +to.slice(5, 7))) && out.length < ROI_MAX_FILLED_MONTHS) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/**
 * The cumulative business-time curve of the MONTH TOTALS (one row per month, not cumulative) for a period: only the months that overlap [from, to] (days 'YYYY-MM-DD', either may be empty = open), summed
 * from the FIRST month of the period on - so a period shows "the ROI of that period, month by month", not the ROI since the start of the project.
 * fill = true and BOTH days given: every month of the period is a row (a month without data adds zero: before the first data the ratios are empty - no cost, no ratio -, after the last they stay
 * where they are), so the table and the chart cover the whole period the user typed.
 */
export function cumulateMonthRows(rows: readonly RoiMonthRow[], period: { from: string | null; to: string | null } = { from: null, to: null }, fill = false): RoiMonthRow[] {
  let run: RoiMoney = zeroMoney();
  const inPeriod = rows.filter((r) => roiMonthInPeriod(r.month, period.from, period.to));
  let base: RoiMonthRow[] = [...inPeriod];
  if (fill && period.from && period.to) {
    const byMonth = new Map(inPeriod.map((r) => [r.month.slice(0, 7), r]));
    const projectGUID = rows[0]?.projectGUID ?? '';
    base = roiMonthsBetween(period.from, period.to).map((month) => byMonth.get(month.slice(0, 7)) ?? { projectGUID, month, money: zeroMoney() });
  }
  return base
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => { run = addMoney(run, r.money); return { ...r, money: run }; });
}

/** the rows of the history log whose DAY is in [from, to] (inclusive; either may be empty = open) */
export function filterHistoryRows(rows: readonly RoiHistoryRow[], period: { from: string | null; to: string | null } = { from: null, to: null }): RoiHistoryRow[] {
  return rows.filter((r) => (!period.from || r.day >= period.from) && (!period.to || r.day <= period.to));
}

export function pointsOfMonthCurve(rows: readonly RoiMonthRow[], tax: RoiTaxSettings): RoiPoint[] {
  return [...rows].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ x: r.month, reason: '', money: r.money, line: roiOfMoney(r.money, tax) }));
}

export function pointsOfHistory(rows: readonly RoiHistoryRow[], tax: RoiTaxSettings): RoiPoint[] {
  return [...rows].sort((a, b) => a.day.localeCompare(b.day)).map((r) => ({ x: r.day, reason: r.reason, money: r.money, line: roiOfMoney(r.money, tax) }));
}

/** days between two 'YYYY-MM-DD' (UTC) */
export const roiDaysBetween = (a: string, b: string): number => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

export interface RoiChartPoint { x: number; y: number | null; index: number }
export interface RoiChartSeries { kind: RoiKind; points: RoiChartPoint[] }
export interface RoiChartData { series: RoiChartSeries[]; xMax: number; yMin: number; yMax: number; empty: boolean }

/**
 * The series of a chart: x = days since the first point (a real time axis: two months apart are two months apart), y = the ratio in percent; a null ratio (no cost) is a gap, not a zero.
 * The y range covers 0 and every drawn value (so the zero line is always inside), with a margin.
 */
export function roiChartData(points: readonly RoiPoint[], kinds: readonly RoiKind[]): RoiChartData {
  if (points.length === 0) return { series: kinds.map((kind) => ({ kind, points: [] })), xMax: 0, yMin: -100, yMax: 100, empty: true };
  const x0 = points[0].x;
  const xs = points.map((p) => roiDaysBetween(x0, p.x));
  let lo = 0;
  let hi = 0;
  const series = kinds.map((kind) => ({
    kind,
    points: points.map((p, index) => {
      const v = p.line[kind];
      const y = v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 10;
      if (y !== null) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
      return { x: xs[index], y, index };
    }),
  }));
  const pad = Math.max(5, (hi - lo) * 0.08);
  return { series, xMax: Math.max(1, xs[xs.length - 1]), yMin: lo - pad, yMax: hi + pad, empty: false };
}

/** the path of a series as a list of segments: a STEP line (horizontal to the next x, then vertical) or a straight line; a gap (null y) breaks the line */
export function roiSeriesSegments(points: readonly RoiChartPoint[], step: boolean): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (p.y === null) { flush(); continue; }
    if (step && cur.length) cur.push({ x: p.x, y: cur[cur.length - 1].y });
    cur.push({ x: p.x, y: p.y });
  }
  flush();
  return out;
}
