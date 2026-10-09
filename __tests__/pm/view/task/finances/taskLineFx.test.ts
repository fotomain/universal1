// The sums of a task line in the accounting and the budget currency: D365 pair rates, rate types, the day by priority (contract date > task start > today),
// SNAPSHOT of the rate, VAT converted too, "Recalculate" as a separate algorithm.
import { computeFx, fxEnabled, fxProblem, fxProjectOf, fxSnapshotText, lineContractDate, LineFxContext, recalculateLineFx } from '../../../../../kit8/pm/view/task/finances/taskLineFx';
import { emptyTaskLineCatalogs, TaskLineCatalogData } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { computeTaskLineRowJSON } from '../../../../../kit8/pm/view/task/finances/taskLineCompute';
import { taskLineGenusDef, TaskLineRowJSON } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { buildRateBook } from '../../../../../kit8/catalog/currency/exchange/currencyConvert';
import { rateKeyOf } from '../../../../../kit8/catalog/currency/exchange/currencyExchangeModel';

const TIME = taskLineGenusDef('timeGenus')!;
const MATERIAL = taskLineGenusDef('materialGenus')!;
const cur = (guid: string, code: string, decimalDigits = 2) => ({ rowGUID: guid, rowJSON: { currencyCode: code, decimalDigits } });
const rate = (owner: string, day: string, ratio: number, rateType?: string) => ({ rowGUID: `${owner}-${day}-${rateType}`, rowOwnerGUID: owner, rowParentGUID: rateKeyOf(day, rateType), rowJSON: { startingDate: day, currencyRatio: ratio, ...(rateType ? { rateType } : {}) } });
const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList: 0, rowJSON });

const currencies = [cur('c-eur', 'EUR'), cur('c-usd', 'USD'), cur('c-gbp', 'GBP'), cur('c-jpy', 'JPY', 0)];
const ratesList = [
  rate('c-usd', '2026-01-02', 1.05), rate('c-usd', '2026-03-02', 1.08), rate('c-usd', '2026-06-01', 1.1),
  rate('c-gbp', '2026-01-02', 0.85), rate('c-jpy', '2026-01-02', 160),
  rate('c-usd', '2026-01-01', 1.2, 'Budget'), rate('c-gbp', '2026-01-01', 0.9, 'Budget'), rate('c-jpy', '2026-01-01', 170, 'Budget'),
];
const project = fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'EUR', currencyForBudget: 'GBP' });
const ctx = (over: Partial<LineFxContext> = {}, rates = ratesList): LineFxContext => ({ book: buildRateBook(currencies, rates), project, taskStartDay: '2026-03-02', today: '2026-10-09', ...over });
const data = (): TaskLineCatalogData => {
  const d = emptyTaskLineCatalogs();
  d.contract = [
    row('c_signed', 'p1', 'person', { contractCurrency: 'USD', contractSignedDate: '2026-01-15', contractStartDate: '2026-02-01' }),
    row('c_start', 'p1', 'person', { contractCurrency: 'USD', contractStartDate: '2026-02-01' }),
    row('c_nodate', 'p1', 'person', { contractCurrency: 'USD' }),
    row('c_jpy', 'p1', 'person', { contractCurrency: 'JPY', contractSignedDate: '2026-01-10' }),
    row('c_partner', 'partnerA', 'partner', { contractCurrency: 'USD', contractSignedDate: '2026-04-01' }),
  ];
  d.resourceContractTemplate = [row('tpl_gbp', 'materialGenus', 'empty', { title: 'T', currency: 'GBP' })];
  return d;
};
/** a line with 400 USD + 84 VAT (qty 10 x 40, VAT 21 %) */
const line = (extra: Partial<TaskLineRowJSON> = {}): Partial<TaskLineRowJSON> => ({ sumForContract: 400, sumVATForContract: 84, ...extra });

describe('the project: currencies and rate types', () => {
  it('the ISO codes (upper case) and the rate types: accounting = Default, budget = Budget, unless the project says otherwise', () => {
    expect(project).toEqual({ accountingCurrency: 'EUR', budgetCurrency: 'GBP', contractCurrency: 'USD', accountingRateType: 'Default', budgetRateType: 'Budget' });
    expect(fxProjectOf({ currencyForAccounting: 'eur', exchangeRateTypeForAccounting: 'Budget', exchangeRateTypeForBudget: 'Default' })).toMatchObject({ accountingCurrency: 'EUR', accountingRateType: 'Budget', budgetRateType: 'Default', budgetCurrency: null });
    expect(fxEnabled(project)).toBe(true);
    expect(fxEnabled(fxProjectOf({ currencyForContract: 'USD' }))).toBe(false);
    expect(fxEnabled(null)).toBe(false);
  });
});

describe('the day of the rate: contract date, then the start of the task, then today', () => {
  it('the date of the contract of the line (signed, else start); only a contract that is SELECTED counts', () => {
    const d = data();
    expect(lineContractDate(d, TIME, { taskResourceContract: 'c_signed' })).toBe('2026-01-15');
    expect(lineContractDate(d, TIME, { taskResourceContract: 'c_start' })).toBe('2026-02-01');
    expect(lineContractDate(d, TIME, { taskResourceContract: 'c_nodate' })).toBeNull();
    expect(lineContractDate(d, TIME, {})).toBeNull();
    expect(lineContractDate(d, MATERIAL, { taskLinePartnerContract: 'c_partner' })).toBe('2026-04-01'); // the others: the contract with the partner
    expect(lineContractDate(d, MATERIAL, { taskResourceContract: 'c_signed' })).toBeNull();
  });

  it('1. the contract date wins: USD of 2026-01-15 is 1.05 although the task starts in March (1.08)', () => {
    const p = computeFx(ctx(), data(), TIME, line({ taskResourceContract: 'c_signed' }));
    expect(p.fxSnapshotTaskLine).toMatchObject({ day: '2026-01-15', dayFrom: 'contract', inputs: '2026-01-15|2026-03-02' });
    expect(p.fxSnapshotTaskLine!.accounting!.rate).toBeCloseTo(1 / 1.05, 10);
    expect(p.sumForAccounting).toBe(380.95);
  });
  it('1. the contract date is STRICT: no rate on it = no sum (the start of the task is not tried)', () => {
    const c = ctx({}, ratesList.filter((r) => r.rowParentGUID !== '2026-01-02' || r.rowOwnerGUID !== 'c-usd')); // USD has no rate before March
    const d = data();
    expect(computeFx(c, d, TIME, line({ taskResourceContract: 'c_signed' })).sumForAccounting).toBeUndefined(); // nothing saved yet -> nothing to clear
    expect(fxProblem(c, d, TIME, line({ taskResourceContract: 'c_signed' }))).toBe('No Default exchange rate of USD on or before 2026-01-15');
  });
  it('2. no contract: the start of the task when every rate exists on it', () => {
    const p = computeFx(ctx(), data(), TIME, line());
    expect(p.fxSnapshotTaskLine).toMatchObject({ day: '2026-03-02', dayFrom: 'task', inputs: '|2026-03-02' });
    expect(p.sumForAccounting).toBe(370.37);
  });
  it('3. no rate on the start of the task: today (the latest rate on or before today)', () => {
    // the task starts before the first USD rate
    const p = computeFx(ctx({ taskStartDay: '2025-12-01' }), data(), TIME, line());
    expect(p.fxSnapshotTaskLine).toMatchObject({ day: '2026-10-09', dayFrom: 'today' });
    expect(p.fxSnapshotTaskLine!.accounting!.rate).toBeCloseTo(1 / 1.1, 10);
  });
  it('3. a task with no start: today', () => {
    expect(computeFx(ctx({ taskStartDay: null }), data(), TIME, line()).fxSnapshotTaskLine).toMatchObject({ dayFrom: 'today' });
  });
});

describe('the sums', () => {
  it('sum AND VAT are converted with the same pair rate: 400 / 84 USD -> 370.37 / 77.78 EUR (Default), 300 / 63 GBP (Budget 0.9 / 1.2)', () => {
    const p = computeFx(ctx(), data(), TIME, line());
    expect([p.sumForAccounting, p.sumVATForAccounting, p.sumForBudget, p.sumVATForBudget]).toEqual([370.37, 77.78, 300, 63]);
    expect(p.fxSnapshotTaskLine).toMatchObject({ from: 'USD', accounting: { to: 'EUR', rateType: 'Default' }, budget: { to: 'GBP', rateType: 'Budget' } });
  });
  it('rounded to the decimals of the TARGET currency (JPY: 0)', () => {
    const c = ctx({ project: fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'JPY', currencyForBudget: 'JPY' }) });
    const p = computeFx(c, data(), TIME, line({ sumForContract: 10.5, sumVATForContract: 2.205 }));
    expect(Number.isInteger(p.sumForAccounting)).toBe(true);
    expect(Number.isInteger(p.sumVATForAccounting)).toBe(true);
  });
  it('the line currency = the accounting currency: rate 1, no lookup of a rate for it', () => {
    const c = ctx({ project: fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'USD' }) }, []);
    const p = computeFx(c, data(), TIME, line());
    expect([p.sumForAccounting, p.sumVATForAccounting]).toEqual([400, 84]);
    expect(p.fxSnapshotTaskLine!.accounting!.rate).toBe(1);
    expect(p.sumForBudget).toBeUndefined();
  });
  it('only the currencies the project has: no budget currency = no budget sums', () => {
    const c = ctx({ project: fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'EUR' }) });
    const p = computeFx(c, data(), TIME, line());
    expect(p.sumForAccounting).toBe(370.37);
    expect(p.fxSnapshotTaskLine!.budget).toBeUndefined();
    expect(p.sumForBudget).toBeUndefined();
  });
  it('the currency of the line: the contract (JPY) before the project\'s; for a Material line the partner contract, else the template', () => {
    expect(computeFx(ctx(), data(), TIME, line({ taskResourceContract: 'c_jpy' })).fxSnapshotTaskLine!.from).toBe('JPY');
    expect(computeFx(ctx(), data(), MATERIAL, line({ resourceContractTemplateTaskLine: 'tpl_gbp' })).fxSnapshotTaskLine!.from).toBe('GBP');
    expect(computeFx(ctx(), data(), MATERIAL, line({ taskLinePartnerContract: 'c_partner', resourceContractTemplateTaskLine: 'tpl_gbp' })).fxSnapshotTaskLine!.from).toBe('USD');
  });
  it('no sum yet (no qty / price) or no accounting / budget currency on the project: the converted sums are cleared', () => {
    const saved = computeFx(ctx(), data(), TIME, line());
    const withSaved = { ...line(), ...saved };
    expect(computeFx(ctx(), data(), TIME, { ...withSaved, sumForContract: null, sumVATForContract: null })).toMatchObject({ sumForAccounting: null, sumForBudget: null, fxSnapshotTaskLine: null });
    const none = ctx({ project: fxProjectOf({ currencyForContract: 'USD' }) });
    expect(computeFx(none, data(), TIME, withSaved)).toMatchObject({ sumForAccounting: null, sumVATForAccounting: null, sumForBudget: null, sumVATForBudget: null, fxSnapshotTaskLine: null });
  });
});

describe('the snapshot', () => {
  const saved = () => ({ ...line(), ...computeFx(ctx(), data(), TIME, line()) });

  it('a change of the quantity converts with the SAME rate: the rate of the book moved on, the saved line does not', () => {
    const moved = ctx({}, ratesList.map((r) => (r.rowOwnerGUID === 'c-usd' && r.rowParentGUID === '2026-03-02' ? { ...r, rowJSON: { ...r.rowJSON, currencyRatio: 1.5 } } : r)));
    const next = computeFx(moved, data(), TIME, { ...saved(), sumForContract: 800, sumVATForContract: 168 });
    expect(next.sumForAccounting).toBe(740.74); // 800 / 1.08
    expect(next.fxSnapshotTaskLine).toBeUndefined(); // unchanged
  });
  it('a line saved today and read after a rate was ADDED for the start of the task keeps its day (today) - the inputs are the same', () => {
    const early = computeFx(ctx({ taskStartDay: '2025-12-01' }), data(), TIME, line());
    expect(early.fxSnapshotTaskLine!.dayFrom).toBe('today');
    const again = computeFx(ctx({ taskStartDay: '2025-12-01' }), data(), TIME, { ...line(), ...early });
    expect(again.fxSnapshotTaskLine).toBeUndefined();
  });
  it('a new snapshot when the currency of the line, the target, its rate type, the contract date or the start of the task changed', () => {
    const s = saved();
    expect(computeFx(ctx(), data(), TIME, { ...s, taskResourceContract: 'c_jpy' }).fxSnapshotTaskLine!.from).toBe('JPY');
    expect(computeFx(ctx({ project: fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'GBP', currencyForBudget: 'GBP' }) }), data(), TIME, s).fxSnapshotTaskLine!.accounting!.to).toBe('GBP');
    expect(computeFx(ctx({ project: fxProjectOf({ currencyForContract: 'USD', currencyForAccounting: 'EUR', currencyForBudget: 'GBP', exchangeRateTypeForAccounting: 'Budget' }) }), data(), TIME, s).fxSnapshotTaskLine!.accounting!.rateType).toBe('Budget');
    expect(computeFx(ctx(), data(), TIME, { ...s, taskResourceContract: 'c_signed' }).fxSnapshotTaskLine!.dayFrom).toBe('contract');
    expect(computeFx(ctx({ taskStartDay: '2026-06-02' }), data(), TIME, s).fxSnapshotTaskLine).toMatchObject({ day: '2026-06-02', dayFrom: 'task' });
  });
  it('a saved line does not need the rates any more: they may even be deleted', () => {
    expect(computeFx(ctx({}, []), data(), TIME, saved())).toEqual({});
    expect(fxProblem(ctx({}, []), data(), TIME, saved())).toBeNull();
  });
  it('a snapshot that has to be made again and finds no rate: the saved sums are cleared - and the missing rate is reported', () => {
    const none = ctx({}, []);
    const changed = { ...saved(), taskResourceContract: 'c_jpy' }; // another currency: the snapshot is not valid
    expect(computeFx(none, data(), TIME, changed)).toMatchObject({ sumForAccounting: null, sumVATForAccounting: null, sumForBudget: null, sumVATForBudget: null, fxSnapshotTaskLine: null });
    expect(fxProblem(none, data(), TIME, changed)).toMatch(/^No Default exchange rate of JPY/);
    expect(fxProblem(none, data(), TIME, line())).toMatch(/^No Default exchange rate of USD/);
  });
});

describe('Recalculate = the separate algorithm', () => {
  it('ignores the snapshot: the rates of the book are taken again', () => {
    const s = { ...line(), ...computeFx(ctx(), data(), TIME, line()) };
    const moved = ctx({}, ratesList.map((r) => (r.rowOwnerGUID === 'c-usd' && r.rowParentGUID === '2026-03-02' ? { ...r, rowJSON: { ...r.rowJSON, currencyRatio: 1.5 } } : r)));
    expect(computeFx(moved, data(), TIME, s)).toEqual({}); // the normal algorithm keeps the snapshot
    const fresh = recalculateLineFx(moved, data(), TIME, s);
    expect(fresh.sumForAccounting).toBe(266.67);
    expect(fresh.fxSnapshotTaskLine!.accounting!.rate).toBeCloseTo(1 / 1.5, 10);
  });
  it('nothing changed: nothing to write', () => {
    const s = { ...line(), ...computeFx(ctx(), data(), TIME, line()) };
    expect(recalculateLineFx(ctx(), data(), TIME, s)).toEqual({});
  });
});

describe('integrated in computeTaskLineRowJSON', () => {
  it('after the sums of the line: qty x price, VAT, then the converted sums; without fx the converted fields are not touched', () => {
    const d = data();
    const base = { taskResourceContract: null, qtyTaskLine: 10, priceTaskLine: 40, priceAutoTaskLine: 40, priceSourceTaskLine: 'manual' as const, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 21 };
    const p = computeTaskLineRowJSON(d, TIME, base, undefined, ctx());
    expect([p.sumForContract, p.sumVATForContract, p.sumForAccounting, p.sumForBudget]).toEqual([400, 84, 370.37, 300]);
    const without = computeTaskLineRowJSON(d, TIME, base);
    expect('sumForAccounting' in without).toBe(false);
    expect('fxSnapshotTaskLine' in without).toBe(false);
  });
});

describe('fxSnapshotText', () => {
  it('names the pairs, the rates, the types and the day', () => {
    const s = computeFx(ctx(), data(), TIME, line()).fxSnapshotTaskLine!;
    expect(fxSnapshotText(s)).toBe('USD → EUR 0.925926 (Default) · USD → GBP 0.75 (Budget) · 2026-03-02');
    expect(fxSnapshotText(null)).toBe('');
  });
});
