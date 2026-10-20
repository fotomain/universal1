// roiReportModel - the lines of Monitor02_ROINow, all pure (documentation/ROI_DOC.html section 7.2).
//   * a PROJECT line = roiOfMoney(Σ the month totals of the project in the period), under the project's own tax switches
//   * a TASK line = roiOfMoney(the money of the task for the period) - ONLY for a project whose roiForTasksFunctionalityEnabled is ON (its caller passes the task rows only then; here too)
//   * the FOOTER adds the five values of the project lines (already under each project's switches) and takes the ratios of the SUMS - never an average of ratios
import { RoiLine, RoiMoney, roiOfMoney, roiRatio, sumMoney } from './roiModel';
import type { RoiMonthRow, RoiProjectInfo, RoiTaskRow } from './roiApi';

export type RoiLevel = 'project' | 'task';
export interface RoiReportLine {
  key: string;
  level: RoiLevel;
  projectGUID: string;
  taskGUID?: string;
  label: string;
  money: RoiMoney;
  line: RoiLine;
}

export interface RoiReportFilters { startDate: string; finishDate: string; projectGUID: string; taskGUID: string }
export const EMPTY_ROI_FILTERS: RoiReportFilters = { startDate: '', finishDate: '', projectGUID: '', taskGUID: '' };

/** the month (first day) is in the period when it overlaps [from, to] (days 'YYYY-MM-DD', either may be empty) - the rule of Monitor01 and of the SQL (months, not days) */
export function roiMonthInPeriod(month: string, from: string | null, to: string | null): boolean {
  const m = month.slice(0, 7);
  if (from && m < from.slice(0, 7)) return false;
  if (to && m > to.slice(0, 7)) return false;
  return true;
}

export function buildRoiNowLines(projects: readonly RoiProjectInfo[], months: readonly RoiMonthRow[], tasks: readonly RoiTaskRow[], filters: { from: string | null; to: string | null; projectGUID?: string; taskGUID?: string }): RoiReportLine[] {
  const out: RoiReportLine[] = [];
  for (const p of projects) {
    if (filters.projectGUID && p.projectGUID !== filters.projectGUID) continue;
    const money = sumMoney(months.filter((m) => m.projectGUID === p.projectGUID && roiMonthInPeriod(m.month, filters.from, filters.to)).map((m) => m.money));
    out.push({ key: `p|${p.projectGUID}`, level: 'project', projectGUID: p.projectGUID, label: p.name, money, line: roiOfMoney(money, p.tax) });
    // the task level exists only while the project switch is ON: nothing is grouped, calculated or drawn otherwise
    if (!p.forTasks) continue;
    for (const t of tasks) {
      if (t.projectGUID !== p.projectGUID) continue;
      if (filters.taskGUID && t.taskGUID !== filters.taskGUID) continue;
      out.push({ key: `t|${t.taskGUID}`, level: 'task', projectGUID: p.projectGUID, taskGUID: t.taskGUID, label: t.taskName, money: t.money, line: roiOfMoney(t.money, p.tax) });
    }
  }
  return out;
}

/** the sum of lines: the five values are added, the ratios are taken of the sums */
export function sumRoiLines(lines: readonly RoiLine[]): RoiLine {
  const s = { planCost: 0, factCost: 0, planRevenue: 0, usedRevenue: 0, billedRevenue: 0 };
  for (const l of lines) { s.planCost += l.planCost; s.factCost += l.factCost; s.planRevenue += l.planRevenue; s.usedRevenue += l.usedRevenue; s.billedRevenue += l.billedRevenue; }
  const r = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    planCost: r(s.planCost), factCost: r(s.factCost), planRevenue: r(s.planRevenue), usedRevenue: r(s.usedRevenue), billedRevenue: r(s.billedRevenue),
    roi1: roiRatio(s.planRevenue, s.planCost), roi2: roiRatio(s.usedRevenue, s.planCost), roi3: roiRatio(s.billedRevenue, s.planCost), roi4: roiRatio(s.billedRevenue, s.factCost),
  };
}

/** the footer of the report: the sum of the PROJECT lines shown (the task lines are parts of them and are not added again) */
export const roiFooterOf = (lines: readonly RoiReportLine[]): RoiLine => sumRoiLines(lines.filter((l) => l.level === 'project').map((l) => l.line));

/** the items of the Project / Task selects of the bar: the projects of the report, the tasks of the loaded task lines (of the selected project) */
export interface RoiSelectOption { value: string; label: string }
export const roiProjectOptions = (projects: readonly RoiProjectInfo[]): RoiSelectOption[] => projects.map((p) => ({ value: p.projectGUID, label: p.name || p.projectGUID }));
export const roiTaskOptions = (tasks: readonly RoiTaskRow[], projectGUID?: string): RoiSelectOption[] =>
  tasks.filter((t) => !projectGUID || t.projectGUID === projectGUID).map((t) => ({ value: t.taskGUID, label: t.taskName || t.taskGUID }));
