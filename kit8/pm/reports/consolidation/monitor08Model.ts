// Monitor08 Consolidation - the pure model (documentation/CONSOLIDATION_WBS.html section 5). The rows come from the SQL function consolidation_report (one row per project x month x kind x side,
// the register summed in the consolidation currency AND in the budget currency of the project). This file turns them into the lines of the table:
//   columns  Budget (plan) · Ordered · Received · Used · Vendor invoice (invoiced) · Customer invoice (sold) - the purchase side for the first five, the sale side for the last
//   basis    'consolidation': o_amount (the two organization VAT switches already applied by the database); 'project': the components in the project's budget currency on the VAT basis
//            of the report (amountOfVatBasis) - such lines are NEVER added when the currencies differ (the total says why)
import { amountOfVatBasis, type VatBasis } from '../../vat/vatBasis';
import type { CurrencyBasis } from '../common/useCurrencyBasis';

export interface ConsolidationReportRow {
  project: string;
  projectName: string;
  /** first day of the month; null when the report is not by month */
  month: string | null;
  kind: string;
  side: 'purchase' | 'sale';
  qty: number;
  amount: number;
  net: number;
  vat: number;
  vatInCost: number;
  budgetCurrency: string;
  budgetNet: number;
  budgetVat: number;
  budgetVatInCost: number;
  currency: string;
}

export type Monitor08Column = 'plan' | 'ordered' | 'received' | 'used' | 'vendorInvoice' | 'customerInvoice';
export const MONITOR08_COLUMNS: { id: Monitor08Column; title: string; kind: string; side: 'purchase' | 'sale' }[] = [
  { id: 'plan', title: 'Budget', kind: 'plan', side: 'purchase' },
  { id: 'ordered', title: 'Ordered', kind: 'ordered', side: 'purchase' },
  { id: 'received', title: 'Received', kind: 'received', side: 'purchase' },
  { id: 'used', title: 'Used', kind: 'used', side: 'purchase' },
  { id: 'vendorInvoice', title: 'Vendor invoice', kind: 'invoiced', side: 'purchase' },
  { id: 'customerInvoice', title: 'Customer invoice', kind: 'sold', side: 'sale' },
];

const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** one RPC row (snake o_ names) -> the row of the model */
export function parseConsolidationReportRow(r: any): ConsolidationReportRow {
  return {
    project: String(r.o_project),
    projectName: String(r.o_project_name ?? r.o_project),
    month: r.o_month ? String(r.o_month) : null,
    kind: String(r.o_kind),
    side: r.o_side === 'sale' ? 'sale' : 'purchase',
    qty: num(r.o_qty),
    amount: num(r.o_amount),
    net: num(r.o_net),
    vat: num(r.o_vat),
    vatInCost: num(r.o_vat_in_cost),
    budgetCurrency: String(r.o_budget_currency ?? ''),
    budgetNet: num(r.o_budget_net),
    budgetVat: num(r.o_budget_vat),
    budgetVatInCost: num(r.o_budget_vat_in_cost),
    currency: String(r.o_currency ?? ''),
  };
}

export interface Monitor08Line {
  key: string;
  projectGUID: string;
  projectName: string;
  month: string | null;
  /** the currency of the amounts of this line: the consolidation currency, or the budget currency of the project */
  currency: string;
  amounts: Record<Monitor08Column, number>;
}

const emptyAmounts = (): Record<Monitor08Column, number> => ({ plan: 0, ordered: 0, received: 0, used: 0, vendorInvoice: 0, customerInvoice: 0 });

/** the lines of the table: one per project (and month); a row that belongs to no column (the revenue of the plan / of the fact input) is not shown */
export function buildMonitor08Lines(rows: ConsolidationReportRow[], basis: CurrencyBasis, vatBasis: VatBasis): Monitor08Line[] {
  const by = new Map<string, Monitor08Line>();
  for (const r of rows) {
    const col = MONITOR08_COLUMNS.find((c) => c.kind === r.kind && c.side === r.side);
    if (!col) continue;
    const key = `${r.project}|${r.month ?? ''}`;
    let line = by.get(key);
    if (!line) {
      line = { key, projectGUID: r.project, projectName: r.projectName, month: r.month, currency: basis === 'consolidation' ? r.currency : r.budgetCurrency, amounts: emptyAmounts() };
      by.set(key, line);
    }
    const v = basis === 'consolidation' ? r.amount : amountOfVatBasis(r.budgetNet, r.budgetVat, r.budgetVatInCost, vatBasis);
    line.amounts[col.id] = round2(line.amounts[col.id] + v);
  }
  return [...by.values()].sort((a, b) => a.projectName.localeCompare(b.projectName) || (a.month ?? '').localeCompare(b.month ?? ''));
}

export interface Monitor08Footer {
  /** null = the lines are in different currencies: they are not added */
  currency: string | null;
  amounts: Record<Monitor08Column, number> | null;
  /** the currencies that stopped the addition, when currency is null */
  mixed: string[];
}

/** the footer: the sum of the lines - only when ONE currency is on all of them (always true in the consolidation basis) */
export function monitor08Footer(lines: Monitor08Line[]): Monitor08Footer {
  const currencies = [...new Set(lines.map((l) => l.currency).filter(Boolean))];
  if (currencies.length > 1) return { currency: null, amounts: null, mixed: currencies.sort() };
  const sum = emptyAmounts();
  for (const l of lines) for (const c of MONITOR08_COLUMNS) sum[c.id] = round2(sum[c.id] + l.amounts[c.id]);
  return { currency: currencies[0] ?? null, amounts: sum, mixed: [] };
}

/** the line of the header that says what the numbers are: 'Amounts in EUR (consolidation) · VAT: purchase without, sale without' */
export function monitor08BasisText(basis: CurrencyBasis, currency: string, vatWords: string, vatBasisTitle: string): string {
  return basis === 'consolidation'
    ? `Amounts in ${currency || '?'} (consolidation) · ${vatWords} (set by the organization)`
    : `Amounts in the budget currency of each project · VAT basis: ${vatBasisTitle}`;
}

export interface Monitor08Filters { dateFrom: string; dateTo: string; byMonth: boolean }
export const EMPTY_MONITOR08_FILTERS: Monitor08Filters = { dateFrom: '', dateTo: '', byMonth: false };
