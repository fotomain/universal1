// Reports - the sums of the task lines of a project (pure, unit-tested): the pages Costs (Time + Material + Expense lines) and Revenues (Revenue lines) of the
// Reports view. Source: every line of the project (task_line_table, kit8/pm/view/task/plan/useProjectTaskLines.ts).
//   amount of a line = sumForAccounting when the project has an accounting currency (the lines are converted there), else sumForContract (the currency of the line)
//   the VAT the same way. A line without an amount counts as a line with 0.
import { roundMoney } from '../../../catalog/contract/contractModel';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import type { TaskLineRow } from '../task/finances/taskLineModel';
import { lineNumber } from '../task/finances/taskLineMoney';

export type ReportPage = 'costs' | 'revenues';
/** the genus of the lines of a page */
export const REPORT_GENUS: Record<ReportPage, string[]> = {
  costs: [MANAGEMENT_GENUS.time, MANAGEMENT_GENUS.material, MANAGEMENT_GENUS.expense],
  revenues: [MANAGEMENT_GENUS.revenue],
};

export interface ReportAmounts { count: number; sum: number; vat: number; total: number }
export const emptyAmounts = (): ReportAmounts => ({ count: 0, sum: 0, vat: 0, total: 0 });

/** amount + VAT of ONE line (accounting = the project converts the sums into an accounting currency) */
export function lineAmount(line: Pick<TaskLineRow, 'rowJSON'>, accounting: boolean): { sum: number; vat: number } {
  const j = line.rowJSON || {};
  return accounting
    ? { sum: lineNumber(j.sumForAccounting) ?? 0, vat: lineNumber(j.sumVATForAccounting) ?? 0 }
    : { sum: lineNumber(j.sumForContract) ?? 0, vat: lineNumber(j.sumVATForContract) ?? 0 };
}

const add = (a: ReportAmounts, sum: number, vat: number): ReportAmounts => ({ count: a.count + 1, sum: a.sum + sum, vat: a.vat + vat, total: a.total + sum + vat });
const rounded = (a: ReportAmounts): ReportAmounts => ({ count: a.count, sum: roundMoney(a.sum), vat: roundMoney(a.vat), total: roundMoney(a.total) });

export interface ReportRow extends ReportAmounts { key: string; budgetItem?: string; genus?: string }
export interface ProjectReport {
  page: ReportPage;
  totals: ReportAmounts;
  /** Costs: the Time lines of an equipment (a part of `totals`); Revenues: empty */
  equipment: ReportAmounts;
  /** Time lines of a person (a part of `totals`) */
  persons: ReportAmounts;
  workCenters: ReportAmounts;
  /** by management genus (Time · Material · Expense | Revenue), in the order of REPORT_GENUS */
  byGenus: ReportRow[];
  /** by budget item (a line without one: key 'none'), biggest total first */
  byBudgetItem: ReportRow[];
  /** by task (rowOwnerGUID), biggest total first */
  byTask: ReportRow[];
}

/** the report of one page over the lines of the whole project */
export function buildProjectReport(lines: TaskLineRow[], page: ReportPage, accounting = false): ProjectReport {
  const genus = REPORT_GENUS[page];
  const mine = (lines || []).filter((l) => genus.includes(l.rowParentGUID));
  let totals = emptyAmounts();
  let equipment = emptyAmounts();
  let persons = emptyAmounts();
  let workCenters = emptyAmounts();
  const byGenus = new Map<string, ReportAmounts>(genus.map((g) => [g, emptyAmounts()]));
  const byItem = new Map<string, ReportAmounts>();
  const byTask = new Map<string, ReportAmounts>();
  for (const l of mine) {
    const { sum, vat } = lineAmount(l, accounting);
    totals = add(totals, sum, vat);
    byGenus.set(l.rowParentGUID, add(byGenus.get(l.rowParentGUID) ?? emptyAmounts(), sum, vat));
    const item = String(l.rowJSON?.budgetItemTaskLine || 'none');
    byItem.set(item, add(byItem.get(item) ?? emptyAmounts(), sum, vat));
    byTask.set(l.rowOwnerGUID, add(byTask.get(l.rowOwnerGUID) ?? emptyAmounts(), sum, vat));
    if (l.rowParentGUID === MANAGEMENT_GENUS.time) {
      if (l.rowJSON?.taskResourceKind === 'equipment') equipment = add(equipment, sum, vat);
      else if (l.rowJSON?.taskResourceKind === 'workCenter') workCenters = add(workCenters, sum, vat);
      else persons = add(persons, sum, vat);
    }
  }
  const sorted = (m: Map<string, ReportAmounts>, extra: (key: string) => Partial<ReportRow>): ReportRow[] =>
    Array.from(m, ([key, a]) => ({ key, ...rounded(a), ...extra(key) })).sort((x, y) => y.total - x.total || x.key.localeCompare(y.key));
  return {
    page,
    totals: rounded(totals),
    equipment: rounded(equipment),
    persons: rounded(persons),
    workCenters: rounded(workCenters),
    byGenus: genus.map((g) => ({ key: g, genus: g, ...rounded(byGenus.get(g) ?? emptyAmounts()) })),
    byBudgetItem: sorted(byItem, (key) => ({ budgetItem: key })),
    byTask: sorted(byTask, () => ({})),
  };
}
