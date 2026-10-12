// Task line plan - the POSTED days of the task lines: one row per line and active calendar day.
//   SQL: kit8/sql/init/create_task_line_plan_table.sql · table task_line_plan · redux entity TASK_LINE_PLAN_ENTITY
//   rowProjectGUID = task.rowProjectGUID · rowOwnerGUID = task.rowGUID · rowParentGUID = task_line_table.rowGUID (the LINE) · orderInList
//   rowPeriodDatetime (the start of the day) · rowCoefficient (the share of the day; the coefficients of a line add up to baseOfDistribution = 1)
//   qtyTaskLine · sumForBudget · sumForContract (2 digits; the rows add up to the line, Correct033) · rowJSON { budgetItemTaskLine, taskManagementGenusLine, businessUnitAssigned, budgetKind }
//   Read-only for the app: the rows are written by the RPC create_task_line_plan (taskLinePlanApi.ts).
import { BUDGET_ITEM, budgetItemsOfGenus } from '../../../../catalog/budget/item/budgetItemModel';
import type { DefRow } from '../../../../catalog/product/productModel';
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';
import type { TaskLineRow } from '../finances/taskLineModel';

export const taskLinePlanTable = 'task_line_plan_movements';
export const TASK_LINE_PLAN_ENTITY = 'taskLinePlanReusable';
export const TASK_LINE_PLAN_ROUTE = '/pm/project/task/plan';

/** a row of task_line_plan as read into redux */
export interface TaskLinePlanRow {
  rowGUID: string;
  rowProjectGUID?: string;
  rowOwnerGUID: string;
  /** the line */
  rowParentGUID: string;
  orderInList: number;
  rowPeriodDatetime: string;
  rowCoefficient: number | string;
  qtyTaskLine: number | string | null;
  sumForBudget: number | string | null;
  sumForContract: number | string | null;
  /** businessUnitAssigned = the business unit the day was posted to (copied from the line when it was posted); budgetKind = 'cost' | 'revenue' */
  rowJSON?: { budgetItemTaskLine?: string | null; taskManagementGenusLine?: string | null; businessUnitAssigned?: string | null; budgetKind?: 'cost' | 'revenue' | null };
}

/** the minimum the RPC create_task_line_plan needs about one line */
export interface TaskLinePlanLineJSON {
  lineGUID: string;
  baseOfDistribution: number;
  qtyTaskLine: number | null;
  sumForBudget: number | null;
  sumForContract: number | null;
  days: { d: string; c: number }[];
}
export interface TaskLinePlanJSON {
  taskGUID: string;
  timeZone?: string;
  lines: TaskLinePlanLineJSON[];
}

const isSet = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'empty';

/** the lines that are budgeted (a budget item chosen) = the lines Post handles */
export const postableLines = (lines: TaskLineRow[]): TaskLineRow[] => (lines || []).filter((l) => isSet(l.rowJSON?.budgetItemTaskLine));

export type TaskPostState = 'post' | 'posted' | 'postNeeded';

/**
 * The state of the Post button of a task:
 *   'posted'      every line with a budget item is posted (taskIsPosted) and nothing changed since
 *   'postNeeded'  something was posted before (baseOfDistribution is set on a line) and a line is not posted now - changed, added, or the task dates moved
 *   'post'        nothing was ever posted (the first edit)
 * No budgeted line at all = 'post' (nothing to post yet).
 */
export function taskPostState(lines: TaskLineRow[]): TaskPostState {
  const budgeted = postableLines(lines);
  if (budgeted.length === 0) return 'post';
  if (budgeted.every((l) => l.rowJSON?.taskIsPosted === true)) return 'posted';
  const everPosted = (lines || []).some((l) => l.rowJSON?.taskIsPosted === true || (l.rowJSON?.baseOfDistribution ?? null) !== null);
  return everPosted ? 'postNeeded' : 'post';
}

/** the number form of a numeric column that PostgREST may send as a string */
export const planNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** the seed budget item of each genus (create_budget_item_table.sql generates them from the genus rows) */
const SEED_ITEM_OF_GENUS: Record<string, string> = {
  [MANAGEMENT_GENUS.time]: BUDGET_ITEM.time,
  [MANAGEMENT_GENUS.material]: BUDGET_ITEM.material,
  [MANAGEMENT_GENUS.expense]: BUDGET_ITEM.expense,
  [MANAGEMENT_GENUS.revenue]: BUDGET_ITEM.revenue,
};

/**
 * The budget item a NEW line of a genus gets, so it is postable at once: the seed item of the genus, else the first item of the genus, else null
 * (the budget items are not read yet / the genus has none).
 */
export function defaultBudgetItemOfGenus(budgetItemRows: DefRow<any>[], genus: string): string | null {
  const items = budgetItemsOfGenus(budgetItemRows, genus).slice().sort((a, b) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
  const seed = SEED_ITEM_OF_GENUS[genus];
  return (seed && items.find((r) => r.rowGUID === seed)?.rowGUID) || items[0]?.rowGUID || null;
}

// ---- the lines of the plan, summed (the proof that the days add up to the line) ----------------------------------------------------

export interface TaskLinePlanLineSummary {
  lineGUID: string;
  days: number;
  coefficient: number;
  qtyTaskLine: number | null;
  sumForBudget: number | null;
  sumForContract: number | null;
  /** the sums equal the totals of the line (Correct033) and the coefficients add up to the base */
  ok: boolean;
}

const cents = (v: number | null) => (v === null ? null : Math.round(v * 100));

/** the plan rows of each line summed and compared with the line: ok = nothing was lost by the rounding */
export function summarizeTaskLinePlan(planRows: TaskLinePlanRow[], lines: TaskLineRow[]): TaskLinePlanLineSummary[] {
  const byLine = new Map<string, TaskLinePlanRow[]>();
  for (const r of planRows || []) {
    const list = byLine.get(r.rowParentGUID);
    if (list) list.push(r); else byLine.set(r.rowParentGUID, [r]);
  }
  const sum = (rows: TaskLinePlanRow[], key: 'qtyTaskLine' | 'sumForBudget' | 'sumForContract'): number | null => {
    let any = false, total = 0;
    for (const r of rows) { const n = planNumber(r[key]); if (n !== null) { any = true; total += Math.round(n * 100); } }
    return any ? total / 100 : null;
  };
  return lines.filter((l) => byLine.has(l.rowGUID)).map((l) => {
    const rows = byLine.get(l.rowGUID)!;
    const coefficient = Math.round(rows.reduce((a, r) => a + Math.round((planNumber(r.rowCoefficient) ?? 0) * 1e10), 0)) / 1e10;
    const qty = sum(rows, 'qtyTaskLine'), budget = sum(rows, 'sumForBudget'), contract = sum(rows, 'sumForContract');
    const j = l.rowJSON || {};
    const same = (got: number | null, want: unknown) => {
      const w = typeof want === 'number' && Number.isFinite(want) ? want : null;
      return got === null ? w === null : cents(got) === cents(w);
    };
    return {
      lineGUID: l.rowGUID, days: rows.length, coefficient, qtyTaskLine: qty, sumForBudget: budget, sumForContract: contract,
      ok: coefficient === (j.baseOfDistribution ?? 1) && same(qty, j.qtyTaskLine) && same(budget, j.sumForBudget) && same(contract, j.sumForContract),
    };
  });
}
