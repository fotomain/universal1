// Payment plan - the sums of a payment (pure). The user types sumForContract (WITH VAT, in paymentPlanCurrency); sumForAccounting / sumForBudget are the same amount in the accounting / budget
// currency of the project, converted with the exchange rate OF THE PLANNED TRANSACTION DATE (the day the money moves; the latest rate on or before it, as everywhere:
// kit8/catalog/currency/exchange/currencyConvert.ts). A SNAPSHOT like the task lines (taskLineFx.ts): the rate is saved with the payment, so a new sum is converted with the SAME rate and a
// rate edited later never moves a saved sum; the date or the currency changing makes a new snapshot. "Recalculate" ignores the snapshot. No project currency = no converted sums.
import { convertWith, isMiss, pairRate, rateMissMessage, type RateBook } from '../../../../catalog/currency/exchange/currencyConvert';
import { fxEnabled, type LineFxProject } from '../finances/taskLineFx';
import { isPaymentDay } from './paymentPlanDates';
import { paymentNumber, type PaymentFxSnapshot, type TaskPaymentPlanRowJSON } from './paymentPlanModel';

export interface PaymentFxContext { book: RateBook; project: LineFxProject }

type FxFields = Pick<TaskPaymentPlanRowJSON, 'sumForAccounting' | 'sumForBudget' | 'paymentPlanFxSnapshot'>;
const EMPTY_FX: FxFields = { sumForAccounting: null, sumForBudget: null, paymentPlanFxSnapshot: null };

const codeOf = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null);

interface Target { key: 'accounting' | 'budget'; to: string; rateType: string }
const targetsOf = (p: LineFxProject): Target[] => [
  ...(p.accountingCurrency ? [{ key: 'accounting' as const, to: p.accountingCurrency, rateType: p.accountingRateType }] : []),
  ...(p.budgetCurrency ? [{ key: 'budget' as const, to: p.budgetCurrency, rateType: p.budgetRateType }] : []),
];

type Resolved = { ok: true; snapshot: PaymentFxSnapshot; missing?: string } | { ok: false; message: string };

function resolve(ctx: PaymentFxContext, json: Partial<TaskPaymentPlanRowJSON>, fresh: boolean): Resolved {
  const from = codeOf(json.paymentPlanCurrency);
  if (!from) return { ok: false, message: 'The currency of the payment is unknown: choose the contract' };
  const day = json.paymentPlannedTransactionDate;
  if (!isPaymentDay(day)) return { ok: false, message: 'The rate is taken for the planned date: enter it' };
  const targets = targetsOf(ctx.project);
  const inputs = `${from}|${day}`;
  const snap = json.paymentPlanFxSnapshot;
  if (!fresh && snap && snap.inputs === inputs && targets.every((t) => snap[t.key]?.to === t.to && snap[t.key]?.rateType === t.rateType)) return { ok: true, snapshot: snap };
  // each target on its own: a missing budget rate must not take the accounting sum away
  const rates: Partial<Record<'accounting' | 'budget', { to: string; rateType: string; rate: number }>> = {};
  let miss: string | undefined;
  for (const t of targets) {
    const p = pairRate(ctx.book, from, t.to, t.rateType, day);
    if (isMiss(p)) { miss = miss ?? rateMissMessage(p); continue; }
    rates[t.key] = { to: t.to, rateType: t.rateType, rate: p.rate };
  }
  if (Object.keys(rates).length === 0) return { ok: false, message: miss ?? 'There is no exchange rate' };
  return { ok: true, snapshot: { from, day, inputs, ...rates }, ...(miss ? { missing: miss } : {}) };
}

function build(ctx: PaymentFxContext, json: Partial<TaskPaymentPlanRowJSON>, fresh: boolean): Partial<FxFields> {
  const sum = paymentNumber(json.sumForContract);
  const next: FxFields = (() => {
    if (!fxEnabled(ctx.project) || sum === null) return { ...EMPTY_FX };
    const r = resolve(ctx, json, fresh);
    if (!r.ok) return { ...EMPTY_FX };
    const dec = (c: string) => ctx.book.currency(c)?.decimals ?? 2;
    const a = r.snapshot.accounting;
    const b = r.snapshot.budget;
    return { sumForAccounting: a ? convertWith(sum, a.rate, dec(a.to)) : null, sumForBudget: b ? convertWith(sum, b.rate, dec(b.to)) : null, paymentPlanFxSnapshot: r.snapshot };
  })();
  const patch: Partial<FxFields> = {};
  for (const k of Object.keys(next) as (keyof FxFields)[]) {
    if (JSON.stringify((json as any)[k] ?? null) !== JSON.stringify((next as any)[k] ?? null)) (patch as any)[k] = (next as any)[k];
  }
  return patch;
}

/** the patch for the converted sums of a payment (the snapshot is kept while currency + date are unchanged) */
export const computePaymentFx = (ctx: PaymentFxContext, json: Partial<TaskPaymentPlanRowJSON>): Partial<FxFields> => build(ctx, json, false);
/** "Recalculate": the snapshot is ignored, the rates are taken again */
export const recalculatePaymentFx = (ctx: PaymentFxContext, json: Partial<TaskPaymentPlanRowJSON>): Partial<FxFields> => build(ctx, json, true);

/** why a payment has no converted sum (null = nothing to report) */
export function paymentFxProblem(ctx: PaymentFxContext | null | undefined, json: Partial<TaskPaymentPlanRowJSON>): string | null {
  if (!ctx || !fxEnabled(ctx.project) || paymentNumber(json.sumForContract) === null) return null;
  const r = resolve(ctx, json, false);
  return r.ok ? r.missing ?? null : r.message;
}
