// The pure part of the project cost total (kit8/pm/cost/costTotalModel.ts + projectCostBudgetOn of taskInputScope.ts): the rule of the switches, the rows, the realtime events, the texts.
import { COST_TOTAL_TABLE, RPC_UPDATE_PROJECT_COST_TOTAL, applyCostEvents, costColumnShown, costCurrencyOf, costSwitchUsable, costTotalsOf, emitCostTotalsStale, formatCost, onCostTotalsStale, parseCostAnswer, parseCostRow } from '../../../kit8/pm/cost/costTotalModel';
import { projectCostBudgetOn } from '../../../kit8/pm/model/taskInputScope';

// the same cases as tests/80_project_cost.sql ("gate: ..."): the SQL project_cost_budget_on and this function are ONE rule
export const GATE_CASES: [string, Record<string, unknown>, boolean][] = [
  ['nothing saved = master off', {}, false],
  ['master on, children not saved (default on)', { projectExpenseBudgetNeeded: true }, true],
  ['master off whatever the children say', { projectExpenseBudgetNeeded: false, projectTimeCostsNeeded: true, projectMaterialCostsNeeded: true }, false],
  ['Time, Material and Expense all off', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }, false],
  ['Material only', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: true, projectExpenseCostsNeeded: false }, true],
  ['Expense only', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: true }, true],
  ['Time only (person on by default)', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }, true],
  ['Time with neither person nor equipment', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }, false],
  ['Time of equipment only', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }, true],
  ['Time of partner only', { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: false, projectTimeOfPartnerNeeded: true, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }, true],
  ['a string is not a boolean', { projectExpenseBudgetNeeded: 'true' }, false],
];

describe('projectCostBudgetOn: the server works only while one of Time / Material / Expense is on', () => {
  it.each(GATE_CASES)('%s', (_name, json, expected) => {
    expect(projectCostBudgetOn(json)).toBe(expected);
  });
  it('null / undefined = off', () => {
    expect(projectCostBudgetOn(null)).toBe(false);
    expect(projectCostBudgetOn(undefined)).toBe(false);
  });
});

describe('the switch showTotalCostOnTheGanttChart', () => {
  const on = { projectExpenseBudgetNeeded: true };
  it('is usable only while a cost budget is on', () => {
    expect(costSwitchUsable(on)).toBe(true);
    expect(costSwitchUsable({})).toBe(false);
    expect(costSwitchUsable({ ...on, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false })).toBe(false);
  });
  it('the column is shown only when the budget is on AND the switch is on; the stored value is kept when the budget goes off', () => {
    expect(costColumnShown({ ...on, showTotalCostOnTheGanttChart: true })).toBe(true);
    expect(costColumnShown({ ...on, showTotalCostOnTheGanttChart: false })).toBe(false);
    expect(costColumnShown({ ...on })).toBe(false);
    expect(costColumnShown({ projectExpenseBudgetNeeded: false, showTotalCostOnTheGanttChart: true })).toBe(false);
    expect(costColumnShown(null)).toBe(false);
  });
  it('the currency of the column header is the budget currency in capitals', () => {
    expect(costCurrencyOf({ currencyForBudget: 'eur' })).toBe('EUR');
    expect(costCurrencyOf({})).toBe('');
    expect(costCurrencyOf(undefined)).toBe('');
  });
});

describe('rows and totals', () => {
  it('numeric columns arrive as strings', () => {
    expect(parseCostRow({ rowOwnerGUID: 't1', costOwnForBudget: '10.50', costTotalForBudget: '48250.00' })).toEqual({ taskGUID: 't1', own: 10.5, total: 48250, ownWithVat: 0, totalWithVat: 0 });
  });
  it('costTotalsOf keeps the total per task and skips zeros', () => {
    const m = costTotalsOf([parseCostRow({ rowOwnerGUID: 't1', costTotalForBudget: '5' }), parseCostRow({ rowOwnerGUID: 't2', costTotalForBudget: '0' })]);
    expect([...m.entries()]).toEqual([['t1', 5]]);
  });
});

describe('applyCostEvents: Realtime patches the map by the task key', () => {
  const base = new Map([['t1', 100], ['t2', 50]]);
  it('INSERT / UPDATE set the total, DELETE removes the key', () => {
    const next = applyCostEvents(base, [
      { eventType: 'UPDATE', new: { rowOwnerGUID: 't1', costTotalForBudget: '120.00' } },
      { eventType: 'INSERT', new: { rowOwnerGUID: 't3', costTotalForBudget: '7' } },
      { eventType: 'DELETE', old: { rowOwnerGUID: 't2' } },
    ]);
    expect([...next.entries()].sort()).toEqual([['t1', 120], ['t3', 7]]);
    expect(base.get('t1')).toBe(100);                         // the old map is not changed
  });
  it('returns the SAME map when nothing changes (no render)', () => {
    expect(applyCostEvents(base, [{ eventType: 'UPDATE', new: { rowOwnerGUID: 't1', costTotalForBudget: '100' } }])).toBe(base);
    expect(applyCostEvents(base, [{ eventType: 'DELETE', old: { rowOwnerGUID: 'nope' } }])).toBe(base);
    expect(applyCostEvents(base, [])).toBe(base);
  });
  it('a row that became 0 is removed', () => {
    const next = applyCostEvents(base, [{ eventType: 'UPDATE', new: { rowOwnerGUID: 't2', costTotalForBudget: '0' } }]);
    expect(next.has('t2')).toBe(false);
  });
  it('the later event of a burst wins', () => {
    const next = applyCostEvents(base, [
      { eventType: 'UPDATE', new: { rowOwnerGUID: 't1', costTotalForBudget: '1' } },
      { eventType: 'UPDATE', new: { rowOwnerGUID: 't1', costTotalForBudget: '2' } },
    ]);
    expect(next.get('t1')).toBe(2);
  });
});

describe('texts and the answer of the command', () => {
  it('formatCost: thousands separated, 2 decimals, empty without a cost', () => {
    expect(formatCost(48250)).toBe('48 250.00');
    expect(formatCost(1234567.5)).toBe('1 234 567.50');
    expect(formatCost(12)).toBe('12.00');
    expect(formatCost(-1500)).toBe('-1 500.00');
    expect(formatCost(0)).toBe('');
    expect(formatCost(undefined)).toBe('');
    expect(formatCost(NaN)).toBe('');
  });
  it('parseCostAnswer reads the answer of update_project_cost_total', () => {
    expect(parseCostAnswer({ tasks: 7, rows: 4, projectTotal: 70, changedRows: 1, ms: 12, flushed: 1 })).toEqual({ tasks: 7, rows: 4, projectTotal: 70, changedRows: 1, ms: 12, flushed: 1 });
    expect(parseCostAnswer(null)).toEqual({ tasks: 0, rows: 0, projectTotal: 0, changedRows: 0, ms: 0, flushed: 0 });
  });
  it('names of the table and of the RPC are those of the SQL', () => {
    expect(COST_TOTAL_TABLE).toBe('project_task_cost_total');
    expect(RPC_UPDATE_PROJECT_COST_TOTAL).toBe('update_project_cost_total');
  });
});

describe('the stale bus', () => {
  it('listeners are told, and can leave', () => {
    const fn = jest.fn();
    const off = onCostTotalsStale(fn);
    emitCostTotalsStale('p1');
    expect(fn).toHaveBeenCalledWith('p1');
    off();
    emitCostTotalsStale('p1');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('the cost with VAT (costTotalForBudgetWithVAT)', () => {
  const { costWithVatColumnShown } = require('../../../kit8/pm/cost/costTotalModel');
  it('the column is shown only while a cost budget is on AND its own switch is on (off by default)', () => {
    const on = { projectExpenseBudgetNeeded: true };
    expect(costWithVatColumnShown(on)).toBe(false);
    expect(costWithVatColumnShown({ ...on, showTotalCostWithVATOnTheGanttChart: true })).toBe(true);
    expect(costWithVatColumnShown({ showTotalCostWithVATOnTheGanttChart: true })).toBe(false);       // no cost budget
    expect(costWithVatColumnShown(null)).toBe(false);
  });
  it('a row carries both totals; each map holds one of them (a zero is no entry)', () => {
    const rows = [parseCostRow({ rowOwnerGUID: 't1', costTotalForBudget: '100', costTotalForBudgetWithVAT: '121', costOwnForBudgetWithVAT: '121' }), parseCostRow({ rowOwnerGUID: 't2', costTotalForBudget: '50', costTotalForBudgetWithVAT: '0' })];
    expect(rows[0]).toMatchObject({ total: 100, totalWithVat: 121, ownWithVat: 121 });
    expect([...costTotalsOf(rows)]).toEqual([['t1', 100], ['t2', 50]]);
    expect([...costTotalsOf(rows, 'totalWithVat')]).toEqual([['t1', 121]]);
  });
  it('Realtime events patch the chosen total', () => {
    const start = costTotalsOf([parseCostRow({ rowOwnerGUID: 't1', costTotalForBudgetWithVAT: '121' })], 'totalWithVat');
    const next = applyCostEvents(start, [{ eventType: 'UPDATE', new: { rowOwnerGUID: 't1', costTotalForBudget: '100', costTotalForBudgetWithVAT: '130' } }], 'totalWithVat');
    expect(next.get('t1')).toBe(130);
    expect(applyCostEvents(next, [{ eventType: 'UPDATE', new: { rowOwnerGUID: 't1', costTotalForBudget: '100', costTotalForBudgetWithVAT: '130' } }], 'totalWithVat')).toBe(next);   // nothing changed: the same map
    expect(applyCostEvents(next, [{ eventType: 'DELETE', old: { rowOwnerGUID: 't1' } }], 'totalWithVat').has('t1')).toBe(false);
  });
});
