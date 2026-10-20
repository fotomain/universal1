// The lines of Monitor02_ROINow (documentation/ROI_DOC.html section 7.2): project lines, task lines only for a project with the task switch ON, the footer = the sums, the period by months.
import { RoiMonthRow, RoiProjectInfo, RoiTaskRow } from '../../../../kit8/pm/reports/roi/roiApi';
import { RoiMoney, zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';
import { buildRoiNowLines, roiFooterOf, roiMonthInPeriod, roiProjectOptions, roiTaskOptions, sumRoiLines } from '../../../../kit8/pm/reports/roi/roiReportModel';

const NONE = { includeSaleVat: false, includePurchaseVat: false };
const m = (o: Partial<RoiMoney>): RoiMoney => ({ ...zeroMoney(), ...o });
const proj = (guid: string, name: string, over: Partial<RoiProjectInfo> = {}): RoiProjectInfo => ({ projectGUID: guid, name, tax: NONE, forTasks: true, history: false, ...over });
const month = (projectGUID: string, month: string, money: Partial<RoiMoney>): RoiMonthRow => ({ projectGUID, month, money: m(money) });
const task = (projectGUID: string, taskGUID: string, taskName: string, money: Partial<RoiMoney>): RoiTaskRow => ({ projectGUID, taskGUID, taskName, money: m(money) });

// the page: Design 1000 / 1500 / 1200, Build 4000 / 3600 / 0 -> the project 5000 / 5100 / 1200
const months = [month('p1', '2026-09-01', { costPlanNet: 4000, revenuePlanNet: 3600 }), month('p1', '2026-10-01', { costPlanNet: 1000, revenuePlanNet: 1500, revenueInvoicedNet: 1200, costInvoicedNet: 900 })];
const tasks = [task('p1', 't-design', 'Design', { costPlanNet: 1000, revenuePlanNet: 1500, revenueInvoicedNet: 1200, costInvoicedNet: 900 }), task('p1', 't-build', 'Build', { costPlanNet: 4000, revenuePlanNet: 3600 })];
const NO_FILTER = { from: null, to: null };

describe('buildRoiNowLines', () => {
  it('a project line (the sum of its months) and, under it, a line per task', () => {
    const lines = buildRoiNowLines([proj('p1', 'Alpha')], months, tasks, NO_FILTER);
    expect(lines.map((l) => `${l.level}:${l.label}`)).toEqual(['project:Alpha', 'task:Design', 'task:Build']);
    expect(lines[0].line).toMatchObject({ planCost: 5000, planRevenue: 5100, billedRevenue: 1200, factCost: 900 });
    expect(Math.round((lines[0].line.roi1 as number) * 1000) / 1000).toBe(0.02);                     // (5100 - 5000) / 5000, NOT the average of 50 % and -10 %
    expect(Math.round((lines[1].line.roi1 as number) * 1000) / 1000).toBe(0.5);
  });
  it('the task switch OFF: no task line is made, whatever task rows are passed', () => {
    const lines = buildRoiNowLines([proj('p1', 'Alpha', { forTasks: false })], months, tasks, NO_FILTER);
    expect(lines.map((l) => l.level)).toEqual(['project']);
  });
  it('several projects: each with its own switch and its own tax switches', () => {
    const lines = buildRoiNowLines(
      [proj('p1', 'Alpha'), proj('p2', 'Beta', { forTasks: false, tax: { includeSaleVat: true, includePurchaseVat: false } })],
      [...months, month('p2', '2026-10-01', { costPlanNet: 100, revenueInvoicedNet: 200, revenueInvoicedVat: 40 })],
      tasks,
      NO_FILTER,
    );
    expect(lines.map((l) => l.key)).toEqual(['p|p1', 't|t-design', 't|t-build', 'p|p2']);
    expect(lines[3].line.billedRevenue).toBe(240);                                                    // Beta includes the sale VAT, Alpha does not
    expect(lines[0].line.billedRevenue).toBe(1200);
  });
  it('the period is by MONTH: any day of a month counts for the whole month', () => {
    const only = buildRoiNowLines([proj('p1', 'Alpha')], months, tasks, { from: '2026-10-15', to: '2026-10-20' });
    expect(only[0].line).toMatchObject({ planCost: 1000, planRevenue: 1500 });
    const upToSep = buildRoiNowLines([proj('p1', 'Alpha')], months, tasks, { from: null, to: '2026-09-30' });
    expect(upToSep[0].line).toMatchObject({ planCost: 4000, billedRevenue: 0 });
  });
  it('the Project filter keeps one project; the Task filter keeps one task line (the project line stays: it is the total)', () => {
    const two = [proj('p1', 'Alpha'), proj('p2', 'Beta')];
    expect(buildRoiNowLines(two, months, tasks, { ...NO_FILTER, projectGUID: 'p2' }).map((l) => l.key)).toEqual(['p|p2']);
    expect(buildRoiNowLines(two, months, tasks, { ...NO_FILTER, taskGUID: 't-build' }).map((l) => l.key)).toEqual(['p|p1', 't|t-build', 'p|p2']);
  });
  it('a project without any number still has its line, with no value ("-")', () => {
    const [l] = buildRoiNowLines([proj('p9', 'Empty')], [], [], NO_FILTER);
    expect([l.line.roi1, l.line.roi4]).toEqual([null, null]);
  });
});

describe('the footer', () => {
  it('adds the project lines (the task lines are parts of them and are not added again); the ratios are of the SUMS', () => {
    const lines = buildRoiNowLines([proj('p1', 'Alpha'), proj('p2', 'Beta', { forTasks: false })], [...months, month('p2', '2026-10-01', { costPlanNet: 1000, revenuePlanNet: 3000 })], tasks, NO_FILTER);
    const f = roiFooterOf(lines);
    expect(f).toMatchObject({ planCost: 6000, planRevenue: 8100 });
    expect(Math.round((f.roi1 as number) * 10000) / 10000).toBe(0.35);                                // (8100 - 6000) / 6000
  });
  it('sumRoiLines of nothing has no ratio', () => {
    expect(sumRoiLines([]).roi1).toBeNull();
  });
  it('projects with different tax switches are added AFTER their own switches (the values are already on each project\'s basis)', () => {
    const lines = buildRoiNowLines(
      [proj('a', 'A', { forTasks: false }), proj('b', 'B', { forTasks: false, tax: { includeSaleVat: true, includePurchaseVat: true } })],
      [month('a', '2026-10-01', { costPlanNet: 100, costPlanVat: 20, revenueInvoicedNet: 150, revenueInvoicedVat: 30 }), month('b', '2026-10-01', { costPlanNet: 100, costPlanVat: 20, revenueInvoicedNet: 150, revenueInvoicedVat: 30 })],
      [],
      NO_FILTER,
    );
    expect(roiFooterOf(lines)).toMatchObject({ planCost: 220, billedRevenue: 330 });                  // A: 100 / 150 (net), B: 120 / 180 (with VAT)
  });
});

describe('the period test and the selects', () => {
  it('roiMonthInPeriod: overlap by month, open ends', () => {
    expect(roiMonthInPeriod('2026-10-01', '2026-10-31', '2026-10-01')).toBe(true);
    expect(roiMonthInPeriod('2026-09-01', '2026-10-01', null)).toBe(false);
    expect(roiMonthInPeriod('2026-11-01', null, '2026-10-31')).toBe(false);
    expect(roiMonthInPeriod('2026-11-01', null, null)).toBe(true);
  });
  it('the items of the Project and Task selects', () => {
    expect(roiProjectOptions([proj('p1', 'Alpha'), proj('p2', '')])).toEqual([{ value: 'p1', label: 'Alpha' }, { value: 'p2', label: 'p2' }]);
    expect(roiTaskOptions(tasks, 'p1')).toEqual([{ value: 't-design', label: 'Design' }, { value: 't-build', label: 'Build' }]);
    expect(roiTaskOptions(tasks, 'other')).toEqual([]);
  });
});
