// calculateTaskLinePlan - the plan of the task lines, calculated (pure: no React, no network). Post sends the result to the SQL procedure
// create_task_line_plan, which multiplies, rounds and runs Correct033 in ONE transaction.
//
// For every line of the task with a budget item:
//   1. the PERIODS = the active days of the calendar between the first and the last day of the task (an excluded day divides the timeline)
//   2. the weights = distributionShares(distribution of the line, number of periods) - the shapes stay in TypeScript (one source of truth)
//   3. the COEFFICIENTS = the weights normalized to baseOfDistribution = 1, 10 digits; the rounding rest goes to the LAST day with a non-zero
//      coefficient (Correct033 for the coefficients)
//   4. the totals (qtyTaskLine, sumForBudget, sumForContract, sumForAccounting) are passed as they are (null stays null)
// A line that cannot be posted is reported in `errors` and left out; the others are posted. A problem of the task itself (no dates, no active day,
// a year the calendar does not have) stops everything.
import { DISTRIBUTION, distributionShares } from '../../../../catalog/distribution/distributionModel';
import type { DefRow } from '../../../../catalog/product/productModel';
import { activeSegments, missingYears, resolveCalendarDays } from '../../../../catalog/management/calendar/managementCalendarModel';
import { postableLines, TaskLinePlanJSON, TaskLinePlanLineJSON } from './taskLinePlanModel';
import { TASK_LINE_GENUS } from '../finances/taskLineModel';
import type { TaskLineRow } from '../finances/taskLineModel';

/** the digits of rowCoefficient */
export const COEFFICIENT_DIGITS = 10;
/** the coefficients of a line add up to this (normalized) */
export const BASE_OF_DISTRIBUTION = 1;
const SCALE = 10 ** COEFFICIENT_DIGITS;

export interface CalculateTaskLinePlanArgs {
  taskGUID: string;
  /** the first and the last day of the task, 'YYYY-MM-DD' (closed range). null = the task has no dates yet */
  fromDay: string | null;
  toDay: string | null;
  lines: TaskLineRow[];
  /** the day rows of the calendar (managementCalendarDaysTable) covering [fromDay, toDay] */
  calendarDays: { rowJSON?: { day?: string; isActive?: boolean } | null }[];
  /** distributionGenericTable rows (the distribution of a line must be one of them) */
  distributions: DefRow<any>[];
  /** the name of the calendar, for the messages */
  calendarTitle?: string;
  timeZone?: string;
  /**
   * a check of a line before it is calculated (business units: a cost line is not posted to a revenue center); a message = the line is left out and reported.
   * Layer 2 of the check; the SQL procedure create_task_line_plan is the authority behind it.
   */
  lineCheck?: (line: TaskLineRow) => string | null;
}

export interface TaskLinePlanProblem { lineGUID: string | null; message: string }
export interface TaskLinePlanCalculation {
  /** null = nothing to post */
  taskLinePlanJSON: TaskLinePlanJSON | null;
  /** the lines in taskLinePlanJSON */
  postedLines: string[];
  /** lines without a budget item */
  skipped: string[];
  errors: TaskLinePlanProblem[];
  /** the periods (active days), the days the calendar excludes, and the runs of consecutive active days */
  days: string[];
  excludedDays: string[];
  segments: string[][];
}

const empty = (over: Partial<TaskLinePlanCalculation> = {}): TaskLinePlanCalculation => ({
  taskLinePlanJSON: null, postedLines: [], skipped: [], errors: [], days: [], excludedDays: [], segments: [], ...over,
});

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The normalized coefficients of `weights`: each rounded to 10 digits, adding up to exactly `base` (1). The rounding rest goes to the last day
 * with a non-zero coefficient. Integer arithmetic (units of 1e-10), so the sum is exact.
 */
export function normalizedCoefficients(weights: number[], base = BASE_OF_DISTRIBUTION): number[] {
  const total = weights.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (!(total > 0) || weights.length === 0) return weights.map(() => 0);
  const units = weights.map((w) => Math.round(((w > 0 ? w : 0) / total) * base * SCALE));
  const diff = Math.round(base * SCALE) - units.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let last = units.length - 1;
    while (last > 0 && units[last] === 0) last--;
    units[last] += diff;
  }
  return units.map((u) => u / SCALE);
}

const roundHalfAwayFromZero = (x: number): number => (x < 0 ? -Math.round(-x) : Math.round(x));

/**
 * Correct033, the preview twin of the SQL procedure: `total` split by `coefficients`, each part rounded to `decimals` on its own, and the
 * difference (total - sum of the parts; +0.01 for 100.00 on 3 equal days) added to the last row with a non-zero coefficient.
 * Integer cents, so 100.00 over 3 days = 33.33 · 33.33 · 33.34. null total = null parts.
 */
export function distributeCorrect033(total: number | null, coefficients: number[], decimals = 2): (number | null)[] {
  if (total === null || !Number.isFinite(total)) return coefficients.map(() => null);
  const f = 10 ** decimals;
  const totalUnits = roundHalfAwayFromZero(total * f);
  const parts = coefficients.map((c) => roundHalfAwayFromZero(totalUnits * c));
  if (coefficients.length > 0) {
    let last = coefficients.length - 1;
    while (last > 0 && !(coefficients[last] > 0)) last--;
    parts[last] += totalUnits - parts.reduce((a, b) => a + b, 0);
  }
  return parts.map((p) => p / f);
}

export function calculateTaskLinePlan(args: CalculateTaskLinePlanArgs): TaskLinePlanCalculation {
  const { taskGUID, fromDay, toDay, lines, calendarDays, distributions, calendarTitle, timeZone, lineCheck } = args;
  // the lines one after the other as the tabs show them: by genus, then by the order inside the genus (the rows of the plan follow this order)
  const rank = (g: string) => { const i = TASK_LINE_GENUS.findIndex((x) => x.genus === g); return i < 0 ? TASK_LINE_GENUS.length : i; };
  const budgeted = postableLines(lines).slice().sort((a, b) => rank(a.rowParentGUID) - rank(b.rowParentGUID) || (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
  const skipped = (lines || []).filter((l) => !budgeted.includes(l)).map((l) => l.rowGUID);
  if (budgeted.length === 0) return empty({ skipped });

  // ---- the task itself ----
  if (!fromDay || !toDay) return empty({ skipped, errors: [{ lineGUID: null, message: 'The task has no start and finish date yet' }] });
  const cal = resolveCalendarDays(calendarDays, fromDay, toDay);
  const calName = calendarTitle ? `"${calendarTitle}"` : 'The calendar';
  if (cal.missing.length > 0) {
    return empty({ skipped, excludedDays: cal.excluded, errors: [{ lineGUID: null, message: `${calName} is not filled for ${missingYears(cal.missing)}: use Fill in Management calendars` }] });
  }
  if (cal.active.length === 0) {
    return empty({ skipped, excludedDays: cal.excluded, errors: [{ lineGUID: null, message: `${calName} has no active day between ${fromDay} and ${toDay}` }] });
  }
  const segments = activeSegments(cal.active);

  // ---- the lines ----
  const errors: TaskLinePlanProblem[] = [];
  const out: TaskLinePlanLineJSON[] = [];
  const byCode = new Map(distributions.map((d) => [d.rowGUID, d]));
  for (const line of budgeted) {
    const j = line.rowJSON || {};
    const bad = lineCheck?.(line);
    if (bad) { errors.push({ lineGUID: line.rowGUID, message: bad }); continue; }
    const code = j.distributionForBudgetTaskLine;
    if (!code) { errors.push({ lineGUID: line.rowGUID, message: 'Choose the budget distribution of the line' }); continue; }
    if (code === DISTRIBUTION.manual) { errors.push({ lineGUID: line.rowGUID, message: 'The manual distribution is not used for posting yet: choose another one' }); continue; }
    if (distributions.length > 0 && !byCode.has(code)) { errors.push({ lineGUID: line.rowGUID, message: `Unknown budget distribution "${code}"` }); continue; }
    const qty = num(j.qtyTaskLine), budget = num(j.sumForBudget), contract = num(j.sumForContract), accounting = num(j.sumForAccounting);
    if (qty === null && budget === null && contract === null && accounting === null) { errors.push({ lineGUID: line.rowGUID, message: 'The line has no quantity and no sum to post' }); continue; }
    let weights: number[];
    try { weights = distributionShares(code, cal.active.length); } catch (e: any) { errors.push({ lineGUID: line.rowGUID, message: String(e?.message || e) }); continue; }
    const c = normalizedCoefficients(weights);
    out.push({
      lineGUID: line.rowGUID,
      baseOfDistribution: BASE_OF_DISTRIBUTION,
      qtyTaskLine: qty, sumForBudget: budget, sumForContract: contract, sumForAccounting: accounting,
      days: cal.active.map((d, i) => ({ d, c: c[i] })),
    });
  }

  return {
    taskLinePlanJSON: out.length ? { taskGUID, ...(timeZone ? { timeZone } : {}), lines: out } : null,
    postedLines: out.map((l) => l.lineGUID),
    skipped, errors,
    days: cal.active, excludedDays: cal.excluded, segments,
  };
}
