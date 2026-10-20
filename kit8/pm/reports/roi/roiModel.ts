// roiModel - the ROI of the four kinds, as ONE pure function over a bundle of additive money (documentation/ROI_DOC.html section 6, SQL PART 33).
// No React, no Supabase, no I/O. The SAME rule is in SQL (roi_ratio / roi_cost / roi_revenue, the views and roi_project); tests/92_roi.sql and roiModel.test.ts use the same numbers.
//   ROI1 plan - plan       revenue plan                 / cost plan
//   ROI2 plan - fact       fact input of the Revenue lines / cost plan
//   ROI3 plan - invoiced   customer invoices            / cost plan
//   ROI4 fact - fact       customer invoices            / vendor invoices + the cost that is never invoiced (fact input of the lines without a vendor)
// ROI = (R - C) / C; C = 0 -> null (shown "-"): never 0, never infinity. The money is ADDED first (tasks, months, projects), the ratio is taken LAST - never the average of ratios.
import type { RoiTaxSettings } from './roiSettings';

/** the 15 additive components (the columns of project_status_roi_task_month / project_status_month_totals / project_status_roi_history): net, VAT, VAT that is cost */
export const ROI_MONEY_KEYS = [
  'costPlanNet', 'costPlanVat', 'costPlanVatInCost',
  'revenuePlanNet', 'revenuePlanVat',
  'revenueUsedNet', 'revenueUsedVat',
  'costOwnNet', 'costOwnVat', 'costOwnVatInCost',
  'costInvoicedNet', 'costInvoicedVat', 'costInvoicedVatInCost',
  'revenueInvoicedNet', 'revenueInvoicedVat',
] as const;
export type RoiMoneyKey = (typeof ROI_MONEY_KEYS)[number];
export type RoiMoney = Record<RoiMoneyKey, number>;

export const zeroMoney = (): RoiMoney => Object.fromEntries(ROI_MONEY_KEYS.map((k) => [k, 0])) as RoiMoney;

/** a bundle from a database row (PostgREST gives numbers, a numeric as text is read too; null / missing = 0) */
export const moneyOf = (row: Partial<Record<RoiMoneyKey, number | string | null>> | null | undefined): RoiMoney => {
  const m = zeroMoney();
  if (!row) return m;
  for (const k of ROI_MONEY_KEYS) {
    const n = Number(row[k] ?? 0);
    m[k] = Number.isFinite(n) ? n : 0;
  }
  return m;
};

export const addMoney = (a: RoiMoney, b: RoiMoney): RoiMoney => {
  const m = zeroMoney();
  for (const k of ROI_MONEY_KEYS) m[k] = a[k] + b[k];
  return m;
};

export const sumMoney = (list: Iterable<RoiMoney>): RoiMoney => {
  const m = zeroMoney();
  for (const x of list) for (const k of ROI_MONEY_KEYS) m[k] += x[k];
  return m;
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** cost side: net + (all the VAT when the purchase VAT is included, else only the VAT that is cost) */
const cost = (net: number, vat: number, inCost: number, includeVat: boolean): number => net + (includeVat ? vat : inCost);
/** revenue side: net + (the VAT when the sale VAT is included; the VAT of a revenue is never cost) */
const revenue = (net: number, vat: number, includeVat: boolean): number => net + (includeVat ? vat : 0);

/** the ratio: no cost = no value (null) */
export const roiRatio = (r: number, c: number): number | null => (c === 0 ? null : (r - c) / c);

export interface RoiLine {
  /** the five values under the tax switches (rounded to cents) */
  planCost: number;
  factCost: number;
  planRevenue: number;
  usedRevenue: number;
  billedRevenue: number;
  /** ROI1 .. ROI4 as a ratio (0.5 = 50 %), null = no cost */
  roi1: number | null;
  roi2: number | null;
  roi3: number | null;
  roi4: number | null;
}

export function roiOfMoney(m: RoiMoney, tax: RoiTaxSettings): RoiLine {
  const planCost = cost(m.costPlanNet, m.costPlanVat, m.costPlanVatInCost, tax.includePurchaseVat);
  const factCost = cost(m.costInvoicedNet, m.costInvoicedVat, m.costInvoicedVatInCost, tax.includePurchaseVat)
    + cost(m.costOwnNet, m.costOwnVat, m.costOwnVatInCost, tax.includePurchaseVat);
  const planRevenue = revenue(m.revenuePlanNet, m.revenuePlanVat, tax.includeSaleVat);
  const usedRevenue = revenue(m.revenueUsedNet, m.revenueUsedVat, tax.includeSaleVat);
  const billedRevenue = revenue(m.revenueInvoicedNet, m.revenueInvoicedVat, tax.includeSaleVat);
  return {
    planCost: round2(planCost), factCost: round2(factCost), planRevenue: round2(planRevenue), usedRevenue: round2(usedRevenue), billedRevenue: round2(billedRevenue),
    roi1: roiRatio(planRevenue, planCost), roi2: roiRatio(usedRevenue, planCost), roi3: roiRatio(billedRevenue, planCost), roi4: roiRatio(billedRevenue, factCost),
  };
}

export type RoiKind = 'roi1' | 'roi2' | 'roi3' | 'roi4';
export const ROI_KINDS: RoiKind[] = ['roi1', 'roi2', 'roi3', 'roi4'];
export const ROI_KIND_TITLE: Record<RoiKind, string> = { roi1: 'ROI1', roi2: 'ROI2', roi3: 'ROI3', roi4: 'ROI4' };
export const ROI_KIND_SUB: Record<RoiKind, string> = { roi1: 'plan - plan', roi2: 'plan - fact input', roi3: 'plan - invoiced', roi4: 'fact - fact' };

/** "50.0 %" ; null -> "-" */
export const formatRoi = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? '-' : `${(Math.round(v * 1000) / 10).toFixed(1)} %`);

/** the sign for the colour: positive / negative / none */
export const roiTone = (v: number | null | undefined): 'positive' | 'negative' | 'none' => (v === null || v === undefined || !Number.isFinite(v) ? 'none' : v >= 0 ? 'positive' : 'negative');

/** a money cell: "1 000.00" */
export const formatRoiMoney = (n: number): string => {
  const [i, d] = round2(n).toFixed(2).split('.');
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${d}`;
};
