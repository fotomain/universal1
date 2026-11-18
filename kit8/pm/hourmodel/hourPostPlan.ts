// hourPostPlan - the SLICES of a Time line for Post in the time-of-day model (documentation/RESOURCE_LEVELING_HOURS_WBS.html 4.5). Pure: no React / Supabase.
//
// The hours of a line are spread over the WORKING MINUTES of the task (the pieces of its bar, hourAxis.ts `pieces`) by the distribution of the line (uniform = the same share every minute);
// each piece of a working window is one slice { d: day, f: from minute, t: to minute, c: coefficient }. The coefficients add up to 1 (10 digits, the rest to the last slice: the same
// arithmetic as normalizedCoefficients). The DAY rows are made from the slices (a day = the sum of its slices), so day rows and slices cannot disagree; create_task_line_plan checks it.
import { DAY_MS } from '../model/constants';
import { distributionShares, DISTRIBUTION } from '../../catalog/distribution/distributionModel';
import { normalizedCoefficients } from '../view/task/plan/calculateTaskLinePlan';
import type { TaskLinePlanJSON } from '../view/task/plan/taskLinePlanModel';
import type { TaskLineRow } from '../view/task/finances/taskLineModel';
import { MINUTE_MS } from './hourAxis';
import type { AxisPiece } from './hourAxis';

export interface HourSlice { d: string; f: number; t: number; c: number }

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** the weights of the minutes of the pieces by a distribution (uniform when the shape is unknown or the number of minutes is below 2) */
function minuteShares(code: string | undefined, minutes: number): number[] {
  if (minutes <= 1 || !code || code === DISTRIBUTION.manual) return Array.from({ length: Math.max(1, minutes) }, () => 1 / Math.max(1, minutes));
  try { return distributionShares(code, minutes); } catch { return Array.from({ length: minutes }, () => 1 / minutes); }
}

/** the slices of ONE line over the pieces of the task; [] when the task has no working minute */
export function slicesOf(pieces: readonly AxisPiece[], distributionCode: string | undefined): HourSlice[] {
  const sized = pieces.map((p) => ({ p, minutes: Math.round((p.endMs - p.startMs) / MINUTE_MS) })).filter((x) => x.minutes > 0);
  const total = sized.reduce((a, x) => a + x.minutes, 0);
  if (total === 0) return [];
  const shares = minuteShares(distributionCode, total);
  const weights: number[] = [];
  let at = 0;
  for (const x of sized) {
    let w = 0;
    for (let i = 0; i < x.minutes; i++) w += shares[at + i] ?? 0;
    weights.push(w);
    at += x.minutes;
  }
  const c = normalizedCoefficients(weights);
  return sized.map((x, i) => {
    const dayMs = Math.floor(x.p.startMs / DAY_MS) * DAY_MS;
    return { d: isoDay(dayMs), f: Math.round((x.p.startMs - dayMs) / MINUTE_MS), t: Math.round((x.p.endMs - dayMs) / MINUTE_MS), c: c[i] };
  });
}

/** the day rows of a list of slices: one { d, c } per day (the coefficients of the slices of the day added up) */
export function daysOfSlices(slices: readonly HourSlice[]): { d: string; c: number }[] {
  const byDay = new Map<string, number>();
  for (const s of slices) byDay.set(s.d, Math.round(((byDay.get(s.d) ?? 0) + s.c) * 1e10) / 1e10);
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, c]) => ({ d, c }));
}

const isTimeLineOfResource = (l: TaskLineRow | undefined): boolean => {
  const j: any = l?.rowJSON || {};
  return l?.rowParentGUID === 'timeGenus' && !!j.taskResourceItem && (j.measureUnitTaskLine || 'unit_hour') === 'unit_hour';
};

/**
 * The plan of calculateTaskLinePlan for a project that plans by the clock: every Time line that books a resource in hours gets its slices over the pieces of the task, and its day rows
 * are the days of its slices. The other lines (materials, expenses, time without a resource) keep their days as they are. No pieces = nothing changes.
 */
export function withHourSlices(plan: TaskLinePlanJSON | null, lines: readonly TaskLineRow[], pieces: readonly AxisPiece[] | undefined): TaskLinePlanJSON | null {
  if (!plan || !pieces || pieces.length === 0) return plan;
  const byGuid = new Map(lines.map((l) => [l.rowGUID, l]));
  return {
    ...plan,
    lines: plan.lines.map((line) => {
      const row = byGuid.get(line.lineGUID);
      if (!isTimeLineOfResource(row)) return line;
      const slices = slicesOf(pieces, (row!.rowJSON as any)?.distributionForBudgetTaskLine);
      if (slices.length === 0) return line;
      return { ...line, days: daysOfSlices(slices), hours: slices };
    }),
  };
}
