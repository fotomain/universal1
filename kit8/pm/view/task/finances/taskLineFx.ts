// Task lines - the sums of a line in the ACCOUNTING and the BUDGET currency of the project (pure), D365 style
// (kit8/catalog/currency/exchange/currencyConvert.ts: pair rates, rate types, "latest rate on or before the day", rounding to the target currency).
//
//   From          the currency of the line = the currency of sumForContract (lineContractCurrency: the contract, else the template, else the project's)
//   To            project.currencyForAccounting (rate type project.exchangeRateTypeForAccounting, default 'Default') and
//                 project.currencyForBudget     (rate type project.exchangeRateTypeForBudget, default 'Budget')
//   Which day     1. the date of the contract of the line, when one is selected (signed date, else start date) - STRICT: no rate on that day = no sum
//                 2. else the START of the task, when every rate it needs exists on that day
//                 3. else today
//   Sums          sumForAccounting / sumVATForAccounting / sumForBudget / sumVATForBudget = sumForContract / sumVATForContract x the pair rate,
//                 rounded to the decimals of the target currency (the VAT is converted with the same rate)
//   SNAPSHOT      the rate and the day are saved with the line (fxSnapshotTaskLine): changing a quantity or a price converts with the SAME rate, and a
//                 rate edited later never moves a saved sum. A new snapshot is made only when what it was made from changes (the currency, the
//                 target currency or rate type, the contract date, the task start). recalculateLineFx() is the separate algorithm that ignores the snapshot.
import { DEFAULT_RATE_TYPE, BUDGET_RATE_TYPE } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { convertWith, isMiss, pairRate, rateMissMessage, RateBook, RateMiss } from '../../../../catalog/currency/exchange/currencyConvert';
import { lineContractCurrency, TaskLineCatalogData } from './taskLineCatalogs';
import { lineNumber } from './taskLineMoney';
import type { LineFxRate, LineFxSnapshot, TaskLineGenusDef, TaskLineRowJSON } from './taskLineModel';

export interface LineFxProject {
  accountingCurrency: string | null;
  budgetCurrency: string | null;
  contractCurrency: string | null;
  accountingRateType: string;
  budgetRateType: string;
}
export interface LineFxContext {
  book: RateBook;
  project: LineFxProject;
  /** 'YYYY-MM-DD' of the start of the task (the schedule), null = unknown */
  taskStartDay: string | null;
  /** 'YYYY-MM-DD' */
  today: string;
}

const code = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().toUpperCase() : null);

/** the project's currencies and rate types (project_table.rowJSON) */
export function fxProjectOf(rowJSON: Record<string, any> | null | undefined): LineFxProject {
  const j = rowJSON || {};
  const type = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
  return {
    accountingCurrency: code(j.currencyForAccounting), budgetCurrency: code(j.currencyForBudget), contractCurrency: code(j.currencyForContract),
    accountingRateType: type(j.exchangeRateTypeForAccounting, DEFAULT_RATE_TYPE), budgetRateType: type(j.exchangeRateTypeForBudget, BUDGET_RATE_TYPE),
  };
}
/** the project converts the sums of its lines into at least one currency */
export const fxEnabled = (p: LineFxProject | null | undefined): boolean => !!(p && (p.accountingCurrency || p.budgetCurrency));

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** the contract of the line: the contract of the person (Time) or the contract with the partner (the others) */
function lineContract(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>) {
  const guid = genus.resource === 'person' ? json.taskResourceContract : json.taskLinePartnerContract;
  return guid ? d.contract.find((c) => c.rowGUID === guid) : undefined;
}
/** the date of the contract of the line: signed date, else start date (null = no contract, or it has no date) */
export function lineContractDate(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): string | null {
  const c = lineContract(d, genus, json);
  const j = c?.rowJSON || {};
  return isDay(j.contractSignedDate) ? j.contractSignedDate : isDay(j.contractStartDate) ? j.contractStartDate : null;
}

interface Target { key: 'accounting' | 'budget'; to: string; rateType: string }
const targetsOf = (p: LineFxProject): Target[] => [
  ...(p.accountingCurrency ? [{ key: 'accounting' as const, to: p.accountingCurrency, rateType: p.accountingRateType }] : []),
  ...(p.budgetCurrency ? [{ key: 'budget' as const, to: p.budgetCurrency, rateType: p.budgetRateType }] : []),
];

type Resolved =
  | { ok: true; snapshot: LineFxSnapshot; reused: boolean }
  | { ok: false; message: string };

/** the snapshot of a line: the saved one when it is still valid, else the rates of the day that the priority picks */
function resolveFx(ctx: LineFxContext, d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>, fresh: boolean): Resolved {
  const from = code(lineContractCurrency(d, json, ctx.project.contractCurrency));
  if (!from) return { ok: false, message: 'The currency of the line is unknown: pick a contract, or set the contract currency of the project' };
  const targets = targetsOf(ctx.project);
  const contractDate = lineContractDate(d, genus, json);
  const inputs = `${contractDate ?? ''}|${ctx.taskStartDay ?? ''}`;

  const snap = json.fxSnapshotTaskLine;
  if (!fresh && snap && snap.from === from && snap.inputs === inputs && targets.every((t) => snap[t.key]?.to === t.to && snap[t.key]?.rateType === t.rateType)) {
    return { ok: true, snapshot: snap, reused: true };
  }

  // the day: the contract's date (strict) | the start of the task if it has every rate | today
  const candidates: { day: string; dayFrom: LineFxSnapshot['dayFrom'] }[] = contractDate
    ? [{ day: contractDate, dayFrom: 'contract' }]
    : [...(ctx.taskStartDay ? [{ day: ctx.taskStartDay, dayFrom: 'task' as const }] : []), { day: ctx.today, dayFrom: 'today' as const }];
  let lastMiss: RateMiss | null = null;
  for (const cand of candidates) {
    const rates: Partial<Record<'accounting' | 'budget', LineFxRate>> = {};
    let miss: RateMiss | null = null;
    for (const t of targets) {
      const p = pairRate(ctx.book, from, t.to, t.rateType, cand.day);
      if (isMiss(p)) { miss = p; break; }
      rates[t.key] = { to: t.to, rateType: t.rateType, rate: p.rate };
    }
    if (!miss) return { ok: true, reused: false, snapshot: { from, day: cand.day, dayFrom: cand.dayFrom, inputs, ...rates } };
    lastMiss = miss;
  }
  return { ok: false, message: rateMissMessage(lastMiss!) };
}

const EMPTY_FX = { sumForAccounting: null, sumVATForAccounting: null, sumForBudget: null, sumVATForBudget: null, fxSnapshotTaskLine: null } as const;

function fxPatch(next: Partial<TaskLineRowJSON>, json: Partial<TaskLineRowJSON>): Partial<TaskLineRowJSON> {
  const patch: Partial<TaskLineRowJSON> = {};
  for (const k of Object.keys(next) as (keyof TaskLineRowJSON)[]) {
    const a = JSON.stringify((json as any)[k] ?? null);
    const b = JSON.stringify((next as any)[k] ?? null);
    if (a !== b) (patch as any)[k] = (next as any)[k] ?? null;
  }
  return patch;
}

function build(ctx: LineFxContext, d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>, fresh: boolean): Partial<TaskLineRowJSON> {
  const sum = lineNumber(json.sumForContract);
  if (!fxEnabled(ctx.project) || sum === null) return fxPatch({ ...EMPTY_FX }, json);
  const vat = lineNumber(json.sumVATForContract) ?? 0;
  const r = resolveFx(ctx, d, genus, json, fresh);
  if (!r.ok) return fxPatch({ ...EMPTY_FX }, json);
  const dec = (c: string) => ctx.book.currency(c)?.decimals ?? 2;
  const a = r.snapshot.accounting;
  const b = r.snapshot.budget;
  return fxPatch({
    sumForAccounting: a ? convertWith(sum, a.rate, dec(a.to)) : null,
    sumVATForAccounting: a ? convertWith(vat, a.rate, dec(a.to)) : null,
    sumForBudget: b ? convertWith(sum, b.rate, dec(b.to)) : null,
    sumVATForBudget: b ? convertWith(vat, b.rate, dec(b.to)) : null,
    fxSnapshotTaskLine: r.snapshot,
  }, json);
}

/** the patch for the fx fields of a line after its sums were (re)computed: keeps the snapshot while what it was made from is unchanged */
export function computeFx(ctx: LineFxContext, d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): Partial<TaskLineRowJSON> {
  return build(ctx, d, genus, json, false);
}

/** "Recalculate": the SEPARATE algorithm - the snapshot is ignored, the rates of today's choice of day are taken again */
export function recalculateLineFx(ctx: LineFxContext, d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): Partial<TaskLineRowJSON> {
  return build(ctx, d, genus, json, true);
}

/** why a line has no sum in the accounting / budget currency (null = nothing to report) */
export function fxProblem(ctx: LineFxContext | null | undefined, d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): string | null {
  if (!ctx || !fxEnabled(ctx.project) || lineNumber(json.sumForContract) === null) return null;
  const r = resolveFx(ctx, d, genus, json, false);
  return r.ok ? null : r.message;
}

/** 'USD → EUR 0.925926 (Default, 2026-03-02)' - what the snapshot says, for a tip */
export function fxSnapshotText(s: LineFxSnapshot | null | undefined): string {
  if (!s) return '';
  return [s.accounting && `${s.from} → ${s.accounting.to} ${Math.round(s.accounting.rate * 1e6) / 1e6} (${s.accounting.rateType})`, s.budget && `${s.from} → ${s.budget.to} ${Math.round(s.budget.rate * 1e6) / 1e6} (${s.budget.rateType})`]
    .filter(Boolean).join(' · ') + ` · ${s.day}`;
}
