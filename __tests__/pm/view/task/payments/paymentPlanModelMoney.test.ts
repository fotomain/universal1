// The model (post state, the payments of a direction, the budget items of the payments genus) and the sums (snapshot of the rate of the planned date).
import { isPaymentBudgetItemOf, paymentGenusOf, paymentPayeeOf, paymentPostState, paymentsOfDirection, PAYMENT_SUB_TABS, type TaskPaymentPlanRow } from '../../../../../kit8/pm/view/task/payments/paymentPlanModel';
import { computePaymentFx, paymentFxProblem, recalculatePaymentFx } from '../../../../../kit8/pm/view/task/payments/paymentPlanMoney';
import { fxContext, project } from './paymentsTestKit';
import { buildRateBook } from '../../../../../kit8/catalog/currency/exchange/currencyConvert';

const p = (id: string, dir: string, json: any = {}): TaskPaymentPlanRow => ({ rowGUID: id, rowOwnerGUID: 't', rowParentGUID: dir, rowJSON: json });

describe('the sub-tabs: Outbound, Inbound and an EMPTY Cash flow', () => {
  it('three, in this order', () => {
    expect(PAYMENT_SUB_TABS.map((t) => t.id)).toEqual(['outbound', 'inbound', 'cashFlow']);
  });
  it('the payments of a direction', () => {
    const rows = [p('1', 'outbound'), p('2', 'inbound'), p('3', 'outbound')];
    expect(paymentsOfDirection(rows, 'outbound').map((r) => r.rowGUID)).toEqual(['1', '3']);
  });
});

describe('the budget item of a payment is an item of the payments genus of its direction', () => {
  it('outbound -> outboundPaymentGenus, inbound -> inboundPaymentGenus', () => {
    expect(paymentGenusOf('outbound')).toBe('outboundPaymentGenus');
    expect(paymentGenusOf('inbound')).toBe('inboundPaymentGenus');
    expect(isPaymentBudgetItemOf('outbound', { rowJSON: { managementGenusItem: 'outboundPaymentGenus' } })).toBe(true);
    expect(isPaymentBudgetItemOf('outbound', { rowJSON: { managementGenusItem: 'inboundPaymentGenus' } })).toBe(false);
    expect(isPaymentBudgetItemOf('outbound', { rowJSON: { managementGenusItem: 'timeGenus' } })).toBe(false);
    expect(isPaymentBudgetItemOf('outbound', undefined)).toBe(false);
  });
  it('the payee: a partner or a person', () => {
    expect(paymentPayeeOf({ paymentPlanPartner: 'a' })).toEqual({ kind: 'partner', guid: 'a' });
    expect(paymentPayeeOf({ paymentPlanPerson: 'b' })).toEqual({ kind: 'person', guid: 'b' });
    expect(paymentPayeeOf({ paymentPlanPartner: 'empty' })).toBeNull();
  });
});

describe('the Post button state', () => {
  it('no payment or never posted = Post; all posted = Posted; a posted payment changed = Post needed', () => {
    expect(paymentPostState([])).toBe('post');
    expect(paymentPostState([p('1', 'outbound', { paymentIsPosted: false })])).toBe('post');
    expect(paymentPostState([p('1', 'outbound', { paymentIsPosted: true }), p('2', 'inbound', { paymentIsPosted: true })])).toBe('posted');
    expect(paymentPostState([p('1', 'outbound', { paymentIsPosted: true }), p('2', 'inbound', { paymentIsPosted: false })])).toBe('postNeeded');
  });
  it('the only payment posted once and changed since: Post needed, not Post (paymentEverPosted)', () => {
    expect(paymentPostState([p('1', 'outbound', { paymentIsPosted: false, paymentEverPosted: true })])).toBe('postNeeded');
  });
});

describe('the converted sums (snapshot of the rate of the planned date)', () => {
  const j = { paymentPlanCurrency: 'USD', paymentPlannedTransactionDate: '2026-10-06', sumForContract: 125 };
  it('accounting EUR (Default) and budget GBP (Budget) of the project, rounded to the decimals of the currency', () => {
    const patch = computePaymentFx(fxContext(), j);
    expect(patch.sumForAccounting).toBe(100);
    expect(patch.paymentPlanFxSnapshot).toMatchObject({ from: 'USD', day: '2026-10-06', accounting: { to: 'EUR', rateType: 'Default', rate: 0.8 } });
    expect(typeof patch.sumForBudget).toBe('number');
  });
  it('the snapshot is reused for a new sum; "Recalculate" ignores it', () => {
    const first = { ...j, ...computePaymentFx(fxContext(), j) };
    const newSum = { ...first, sumForContract: 250 };
    expect(computePaymentFx(fxContext(), newSum).sumForAccounting).toBe(200);
    const stale = { ...first, paymentPlanFxSnapshot: { ...first.paymentPlanFxSnapshot!, accounting: { to: 'EUR', rateType: 'Default', rate: 0.5 } } };
    // the saved rate (0.5) is still valid by its inputs: the sum is converted with IT, a rate edited later never moves a saved sum
    expect(computePaymentFx(fxContext(), stale).sumForAccounting).toBe(62.5);
    expect(recalculatePaymentFx(fxContext(), { ...stale, sumForAccounting: 62.5 }).sumForAccounting).toBe(100);
  });
  it('a project with no accounting / budget currency, a payment with no sum, no currency or no date: nothing converted, no problem reported', () => {
    expect(computePaymentFx({ book: fxContext().book, project: { ...project, accountingCurrency: null, budgetCurrency: null } }, j)).toEqual({});
    expect(computePaymentFx(fxContext(), { ...j, sumForContract: null })).toEqual({});
    expect(paymentFxProblem(fxContext(), { ...j, sumForContract: null })).toBeNull();
    expect(paymentFxProblem(fxContext(), { ...j, paymentPlanCurrency: null })).toBe('The currency of the payment is unknown: choose the contract');
    expect(paymentFxProblem(fxContext(), { ...j, paymentPlannedTransactionDate: null })).toBe('The rate is taken for the planned date: enter it');
  });
  it('no exchange rate on or before the planned date: a problem, and no converted sum', () => {
    const book = buildRateBook([{ rowGUID: 'c-eur', rowJSON: { currencyCode: 'EUR', decimalDigits: 2 } }, { rowGUID: 'c-usd', rowJSON: { currencyCode: 'USD', decimalDigits: 2 } }], []);
    const ctx = { book, project };
    expect(paymentFxProblem(ctx, j)).toBeTruthy();
    expect(computePaymentFx(ctx, j).sumForAccounting ?? null).toBeNull();
  });
});
