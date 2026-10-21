// Reports: the sums of the task lines of a project on the pages Costs (Time + Material + Expense) and Revenues (Revenue).
import { buildProjectReport, lineAmount, REPORT_GENUS } from '../../../../kit8/pm/view/reports/reportsModel';

const line = (rowGUID: string, task: string, genus: string, json: any) => ({ rowGUID, rowOwnerGUID: task, rowParentGUID: genus, orderInList: 0, rowJSON: json });
const lines = [
  line('l1', 't1', 'timeGenus', { sumForContract: 100, sumVATForContract: 21, sumForAccounting: 90, sumVATForAccounting: 19, budgetItemTaskLine: 'timeBudgetItem' }),
  line('l2', 't1', 'timeGenus', { taskResourceKind: 'equipment', sumForContract: 300, sumVATForContract: 63, budgetItemTaskLine: 'timeBudgetItem' }),
  line('l3', 't2', 'materialGenus', { sumForContract: 50.5, sumVATForContract: 10.6, budgetItemTaskLine: 'materialBudgetItem' }),
  line('l4', 't2', 'expenseGenus', { sumForContract: null }),
  line('l5', 't2', 'revenueGenus', { sumForContract: 1000, sumVATForContract: 210, budgetItemTaskLine: 'revenueBudgetItem' }),
  line('l6', 't3', 'timeGenus', { taskResourceKind: 'person', sumForContract: 10, sumVATForContract: 2 }),
];

describe('Costs', () => {
  const r = buildProjectReport(lines as any, 'costs');
  it('Time + Material + Expense lines only; a line without an amount counts as a line with 0', () => {
    expect(REPORT_GENUS.costs).toEqual(['timeGenus', 'materialGenus', 'expenseGenus']);
    expect(r.totals).toEqual({ count: 5, sum: 460.5, vat: 96.6, total: 557.1 });
  });
  it('the Time lines of an equipment and of persons (a line without a kind is a person\'s) are parts of the total', () => {
    expect(r.equipment).toMatchObject({ count: 1, sum: 300 });
    expect(r.persons).toMatchObject({ count: 2, sum: 110 });
  });
  it('the Time lines of a work center are their own part (not the persons\'): Time of work centers', () => {
    const withWc = buildProjectReport([...lines, line('l7', 't3', 'timeGenus', { taskResourceKind: 'workCenter', sumForContract: 40, sumVATForContract: 8 })] as any, 'costs');
    expect(withWc.workCenters).toMatchObject({ count: 1, sum: 40 });
    expect(withWc.persons).toMatchObject({ count: 2, sum: 110 });
    expect(withWc.equipment).toMatchObject({ count: 1, sum: 300 });
    expect(withWc.totals.sum).toBe(500.5);
    expect(r.workCenters).toMatchObject({ count: 0, sum: 0 });
  });
  it('by genus, in the order of the page', () => {
    expect(r.byGenus.map((g) => [g.key, g.count, g.sum])).toEqual([['timeGenus', 3, 410], ['materialGenus', 1, 50.5], ['expenseGenus', 1, 0]]);
  });
  it('by budget item (biggest total first; none = no item) and by task', () => {
    expect(r.byBudgetItem.map((i) => [i.key, i.count, i.total])).toEqual([['timeBudgetItem', 2, 484], ['none', 2, 12], ['materialBudgetItem', 1, 61.1]].sort((a: any, b: any) => b[2] - a[2]));
    expect(r.byTask.map((t) => [t.key, t.count, t.total])).toEqual([['t1', 2, 484], ['t2', 2, 61.1], ['t3', 1, 12]]);
  });
});

describe('Revenues', () => {
  it('Revenue lines only', () => {
    const r = buildProjectReport(lines as any, 'revenues');
    expect(r.totals).toEqual({ count: 1, sum: 1000, vat: 210, total: 1210 });
    expect(r.byGenus.map((g) => g.key)).toEqual(['revenueGenus']);
    expect(r.byTask.map((t) => t.key)).toEqual(['t2']);
  });
});

describe('the currency', () => {
  it('a project with an accounting currency adds up the converted sums; else the sums of the lines', () => {
    expect(lineAmount(lines[0] as any, false)).toEqual({ sum: 100, vat: 21 });
    expect(lineAmount(lines[0] as any, true)).toEqual({ sum: 90, vat: 19 });
    expect(buildProjectReport(lines as any, 'costs', true).totals.sum).toBe(90);
  });
  it('no lines: zeros, empty tables', () => {
    const r = buildProjectReport([], 'costs');
    expect(r.totals).toEqual({ count: 0, sum: 0, vat: 0, total: 0 });
    expect(r.byBudgetItem).toEqual([]);
    expect(r.byTask).toEqual([]);
    expect(r.byGenus).toHaveLength(3);
  });
});
