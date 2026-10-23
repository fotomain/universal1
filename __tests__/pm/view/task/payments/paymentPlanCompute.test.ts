// The derived fields of a payment after a cell changed: direction, payee, contract, currency, budget item (follows the contract, the user's choice stays), business unit,
// the default shift (contract -> payment terms of the partner -> 0), shift <-> date, the converted sums, unposted.
import { computePaymentPlanRowJSON, defaultPaymentShift, paymentPlanProblems } from '../../../../../kit8/pm/view/task/payments/paymentPlanCompute';
import { emptyPaymentPlanLine, type TaskPaymentPlanRowJSON } from '../../../../../kit8/pm/view/task/payments/paymentPlanModel';
import { DAYS, fxContext, paymentCtx, paymentData } from './paymentsTestKit';

/** the row after the patch is merged: what the table stores */
const run = (json: Partial<TaskPaymentPlanRowJSON>, direction: 'outbound' | 'inbound' = 'outbound', over = {}): Partial<TaskPaymentPlanRowJSON> => {
  const ctx = paymentCtx(direction, over);
  return { ...json, ...computePaymentPlanRowJSON(ctx, json) };
};

describe('the direction, the payee and the contract', () => {
  it('the direction is the sub-tab', () => {
    expect(run({}).paymentPlanPaymentDirection).toBe('outbound');
    expect(run({}, 'inbound').paymentPlanPaymentDirection).toBe('inbound');
  });
  it('a contract chosen first gives its payee (a partner, or a person)', () => {
    expect(run({ paymentPlanContract: 'c_sup' })).toMatchObject({ paymentPlanPartner: 'partnerA', paymentPlanPayeeKind: 'partner' });
    expect(run({ paymentPlanContract: 'c_person' })).toMatchObject({ paymentPlanPerson: 'pers1', paymentPlanPayeeKind: 'person' });
  });
  it('a person is never an Inbound payee: his contract is not taken, and a person on an Inbound payment is cleared', () => {
    const r = run({ paymentPlanContract: 'c_person' }, 'inbound');
    expect(r.paymentPlanPerson ?? null).toBeNull();
    expect(r.paymentPlanContract ?? null).toBeNull();
    expect(run({ paymentPlanPerson: 'pers1', paymentPlanPartner: null }, 'inbound').paymentPlanPerson).toBeNull();
  });
  it('a contract of another payee goes when the payee changes', () => {
    const r = run({ paymentPlanPartner: 'partnerB', paymentPlanContract: 'c_sup', paymentPlanPayeeKind: 'partner' });
    expect(r.paymentPlanContract).toBeNull();
  });
  it('partner AND person: the one that is not the payee of the last time is the new choice', () => {
    expect(run({ paymentPlanPartner: 'partnerA', paymentPlanPerson: 'pers1', paymentPlanPayeeKind: 'partner' })).toMatchObject({ paymentPlanPartner: null, paymentPlanPerson: 'pers1', paymentPlanPayeeKind: 'person' });
    expect(run({ paymentPlanPartner: 'partnerA', paymentPlanPerson: 'pers1', paymentPlanPayeeKind: 'person' })).toMatchObject({ paymentPlanPartner: 'partnerA', paymentPlanPerson: null, paymentPlanPayeeKind: 'partner' });
  });
});

describe('the currency', () => {
  it('is the currency of the contract (upper case), else the currency of the project, else empty; never typed', () => {
    expect(run({ paymentPlanContract: 'c_sup' }).paymentPlanCurrency).toBe('USD');
    expect(run({ paymentPlanPartner: 'partnerA' }, 'outbound', { projectCurrency: 'gbp' }).paymentPlanCurrency).toBe('GBP');
    expect(run({}).paymentPlanCurrency).toBeNull();
    expect(run({ paymentPlanContract: 'c_sup', paymentPlanCurrency: 'JPY' }).paymentPlanCurrency).toBe('USD');
  });
});

describe('the budget item follows the contract; the user can change it (R12, R13)', () => {
  it('a new payment takes the OUTBOUND item of its contract, an Inbound payment the INBOUND item', () => {
    expect(run({ paymentPlanContract: 'c_sup' })).toMatchObject({ paymentPlanBudgetItem: 'bi_out', paymentPlanBudgetItemAuto: 'bi_out', paymentPlanBudgetItemSource: 'contract' });
    expect(run({ paymentPlanContract: 'c_cust' }, 'inbound')).toMatchObject({ paymentPlanBudgetItem: 'bi_in', paymentPlanBudgetItemSource: 'contract' });
  });
  it('a person contract gives its outbound item', () => {
    expect(run({ paymentPlanContract: 'c_person' }).paymentPlanBudgetItem).toBe('bi_out2');
  });
  it('a contract with BOTH roles has two items, one per direction', () => {
    expect(run({ paymentPlanContract: 'c_bothRoles' }).paymentPlanBudgetItem).toBe('bi_out');
    expect(run({ paymentPlanContract: 'c_bothRoles' }, 'inbound').paymentPlanBudgetItem).toBe('bi_in');
  });
  it('the contract has no item for the direction: the payment has none (the line asks for one)', () => {
    const r = run({ paymentPlanContract: 'c_supB' });
    expect(r.paymentPlanBudgetItem ?? null).toBeNull();
    expect(paymentPlanProblems({ ...paymentCtx(), afterFinishOn: true }, r)).toContain('Choose the budget item');
  });
  it('an item that is not a payment item of the direction is not taken from the contract (an old choice)', () => {
    expect(run({ paymentPlanContract: 'c_custBad' }, 'inbound').paymentPlanBudgetItem ?? null).toBeNull();
  });
  it('THE USER CAN CHANGE IT: his choice is kept and marked "line"', () => {
    const first = run({ paymentPlanContract: 'c_sup' });
    const changed = run({ ...first, paymentPlanBudgetItem: 'bi_out2' });
    expect(changed).toMatchObject({ paymentPlanBudgetItem: 'bi_out2', paymentPlanBudgetItemSource: 'line' });
  });
  it('... and it stays when the contract changes; an item that still follows the contract moves with it', () => {
    const first = run({ paymentPlanContract: 'c_sup' });
    const mine = run({ ...first, paymentPlanBudgetItem: 'bi_out2' });
    expect(run({ ...mine, paymentPlanPartner: 'partnerA', paymentPlanContract: 'c_bothRoles' }).paymentPlanBudgetItem).toBe('bi_out2');
    // the same payment, item NOT touched by the user: a contract with another item changes it
    const swapped = run({ ...first, paymentPlanPartner: 'partnerB', paymentPlanContract: 'c_supB' });
    expect(swapped.paymentPlanBudgetItem ?? null).toBeNull();
  });
  it('a cleared item follows the contract again', () => {
    const first = run({ paymentPlanContract: 'c_sup' });
    expect(run({ ...first, paymentPlanBudgetItem: null }).paymentPlanBudgetItem).toBe('bi_out');
  });
  it('a refresh never takes his item: the compute keeps a "line" item', () => {
    const mine = run({ paymentPlanContract: 'c_sup', paymentPlanBudgetItem: 'bi_out2', paymentPlanBudgetItemAuto: 'bi_out' });
    expect(mine.paymentPlanBudgetItem).toBe('bi_out2');
  });
});

describe('the business unit and the default shift', () => {
  it('an empty business unit takes businessUnitAssigned of the contract; a unit typed stays', () => {
    expect(run({ paymentPlanContract: 'c_sup' }).paymentPlanBusinessUnit).toBe('bu1');
    expect(run({ paymentPlanContract: 'c_sup', paymentPlanBusinessUnit: 'bu2' }).paymentPlanBusinessUnit).toBe('bu2');
  });
  it('shift: the contract first (30), else the payment terms of the partner (supplier data for Outbound), else 0', () => {
    expect(run({ paymentPlanContract: 'c_sup' })).toMatchObject({ paymentPlanTimelineShiftDays: 30, paymentPlannedTransactionDate: '2026-10-31' });
    expect(run({ paymentPlanContract: 'c_supB' })).toMatchObject({ paymentPlanTimelineShiftDays: 21, paymentPlannedTransactionDate: '2026-10-22' });
    expect(run({ paymentPlanContract: 'c_supC' })).toMatchObject({ paymentPlanTimelineShiftDays: 0, paymentPlannedTransactionDate: '2026-10-01' });
    expect(run({ paymentPlanContract: 'c_person' })).toMatchObject({ paymentPlanTimelineShiftDays: 0 });
  });
  it('Inbound reads the CUSTOMER data of the partner, not the supplier data', () => {
    const d = paymentData();
    const noShiftContract = d.contract.find((c) => c.rowGUID === 'c_custBad');
    expect(defaultPaymentShift({ contract: d.contract, partner: d.partner, budgetItem: d.budgetItem }, 'inbound', noShiftContract, { kind: 'partner', guid: 'custA' })).toBe(12);
    expect(defaultPaymentShift({ contract: d.contract, partner: d.partner, budgetItem: d.budgetItem }, 'outbound', undefined, { kind: 'partner', guid: 'custA' })).toBe(0);
  });
  it('0 is a value: a contract with shift 0 does not fall through to the partner', () => {
    const d = paymentData();
    d.contract = [{ ...d.contract[1], rowJSON: { ...d.contract[1].rowJSON, paymentTimelineShiftDays: 0 } }];
    expect(defaultPaymentShift({ contract: d.contract, partner: d.partner, budgetItem: d.budgetItem }, 'outbound', d.contract[0], { kind: 'partner', guid: 'partnerB' })).toBe(0);
  });
  it('the manager can overwrite the shift: his value stays', () => {
    const first = run({ paymentPlanContract: 'c_sup' });
    expect(run({ ...first, paymentPlanTimelineShiftDays: 3 })).toMatchObject({ paymentPlanTimelineShiftDays: 3, paymentPlannedTransactionDate: '2026-10-04' });
  });
  it('a payment with a typed date gets no default shift', () => {
    expect(run({ paymentPlannedTransactionDate: '2026-10-08' })).toMatchObject({ paymentPlanTimelineShiftDays: 7, paymentPlanDateSource: 'date' });
  });
});

describe('the sums in the accounting and budget currency (rate of the planned date)', () => {
  it('USD 100 on 2026-10-06 is converted with the rate of the latest day on or before it', () => {
    const r = run({ paymentPlanContract: 'c_sup', paymentPlanTimelineShiftDays: 5, sumForContract: 125 }, 'outbound', { fx: fxContext() });
    expect(r.paymentPlannedTransactionDate).toBe('2026-10-06');
    // 1 EUR = 1.25 USD on 2026-10-05: 125 USD = 100 EUR
    expect(r.sumForAccounting).toBe(100);
    expect(r.paymentPlanFxSnapshot).toMatchObject({ from: 'USD', day: '2026-10-06' });
  });
  it('a new sum keeps the SAME rate (the snapshot); another date takes the rate of that date', () => {
    const first = run({ paymentPlanContract: 'c_sup', paymentPlanTimelineShiftDays: 5, sumForContract: 125 }, 'outbound', { fx: fxContext() });
    const again = run({ ...first, sumForContract: 250 }, 'outbound', { fx: fxContext() });
    expect(again.sumForAccounting).toBe(200);
    const earlier = run({ ...first, paymentPlanTimelineShiftDays: 0 }, 'outbound', { fx: fxContext() });
    expect(earlier.paymentPlannedTransactionDate).toBe('2026-10-01');
    // 2026-10-01 is before the rate of 2026-10-05: the rate of 2026-01-02 (1.05) is the latest
    expect(earlier.sumForAccounting).toBe(119.05);
  });
  it('no project currency, no sum or no exchange rates: no converted sums', () => {
    expect(run({ paymentPlanContract: 'c_sup', sumForContract: 100 }).sumForAccounting ?? null).toBeNull();
    expect(run({ paymentPlanContract: 'c_sup' }, 'outbound', { fx: fxContext() }).sumForAccounting ?? null).toBeNull();
  });
});

describe('every change makes the payment unposted', () => {
  it('paymentIsPosted is false in every patch', () => {
    expect(run({ ...emptyPaymentPlanLine(), paymentIsPosted: true }).paymentIsPosted).toBe(false);
  });
});

describe('the problems of a payment (the Errors column)', () => {
  const ctx = { ...paymentCtx(), afterFinishOn: true };
  it('an empty payment lists what it lacks', () => {
    expect(paymentPlanProblems(ctx, {})).toEqual(expect.arrayContaining(['Choose the budget item', 'Choose the supplier or the person', 'Choose the contract', 'Enter the shift in days or the planned date', 'Enter the sum (with VAT)']));
  });
  it('an Inbound payment asks for the customer', () => {
    expect(paymentPlanProblems({ ...paymentCtx('inbound'), afterFinishOn: true }, {})).toContain('Choose the customer');
  });
  it('a complete payment has none', () => {
    const r = run({ paymentPlanContract: 'c_sup', sumForContract: 10 });
    expect(paymentPlanProblems(ctx, r)).toEqual([]);
  });
  it('a cost budget item (Time) is not a payment item', () => {
    const r = run({ paymentPlanContract: 'c_sup', sumForContract: 10, paymentPlanBudgetItem: 'bi_time' });
    expect(paymentPlanProblems(ctx, r)).toContain('The budget item is not an outbound payment item');
  });
  it('a missing exchange rate is reported', () => {
    const r = run({ paymentPlanContract: 'c_sup', sumForContract: 10, paymentPlannedTransactionDate: '2025-06-01' }, 'outbound', { fx: fxContext() });
    expect(paymentPlanProblems({ ...ctx, fx: fxContext() }, r).length).toBeGreaterThan(0);
  });
  void DAYS;
});
