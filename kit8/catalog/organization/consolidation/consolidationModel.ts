// The consolidation settings of an ORGANIZATION (documentation/CONSOLIDATION_WBS.html, SQL PART 52) and the words of the screens. Pure (no React, no Supabase): tested without a screen.
//   organizationTable.rowJSON (top level, NOT defaultProjectSettings - a project never copies them):
//     currencyForConsolidation          OBLIGATORY ISO 4217 code: the one currency in which the money of ALL projects is added
//     exchangeRateTypeForConsolidation  rate type of the conversion (default 'Default')
//     consolidationIncludePurchaseVAT   purchase side: ON = net + all VAT (With VAT), OFF = net + the VAT that is cost (the Cost basis, IFRS)
//     consolidationIncludeSaleVAT       sale side: ON = net + VAT, OFF = net
//     consolidationState                'ready' | 'recalculating' | 'gaps' - written by the DATABASE only
// The amount a report adds is chosen at READ time (consolidationAmount = the twin of the SQL function consolidation_amount): a change of a switch needs no recalculation.
export const CONSOLIDATION_DEFAULT_RATE_TYPE = 'Default';

export type ConsolidationState = 'ready' | 'recalculating' | 'gaps';
export type ConsolidationSide = 'purchase' | 'sale';

export interface ConsolidationSettings {
  /** '' while it is not set (a form that is not saved yet) */
  currency: string;
  rateType: string;
  includePurchaseVAT: boolean;
  includeSaleVAT: boolean;
}

export interface ConsolidationStatus extends ConsolidationSettings {
  state: ConsolidationState;
  /** movements waiting for an exchange rate */
  gaps: number;
  /** projects queued for the worker */
  queued: number;
}

export const isConsolidationCurrency = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim());
const codeOf = (v: unknown): string => (isConsolidationCurrency(v) ? v.trim().toUpperCase() : '');

/** the settings of an organization rowJSON (a missing key reads as the default; the switches are OFF unless stored true) */
export function consolidationSettingsOf(json: Record<string, any> | null | undefined): ConsolidationSettings {
  const type = typeof json?.exchangeRateTypeForConsolidation === 'string' ? json.exchangeRateTypeForConsolidation.trim() : '';
  return {
    currency: codeOf(json?.currencyForConsolidation),
    rateType: type || CONSOLIDATION_DEFAULT_RATE_TYPE,
    includePurchaseVAT: json?.consolidationIncludePurchaseVAT === true,
    includeSaleVAT: json?.consolidationIncludeSaleVAT === true,
  };
}

/** the keys written into the organization rowJSON ('' currency = not written: the database keeps / fills it) */
export function consolidationPatchOf(s: ConsolidationSettings): Record<string, any> {
  return {
    ...(codeOf(s.currency) ? { currencyForConsolidation: codeOf(s.currency) } : {}),
    exchangeRateTypeForConsolidation: s.rateType?.trim() || CONSOLIDATION_DEFAULT_RATE_TYPE,
    consolidationIncludePurchaseVAT: s.includePurchaseVAT === true,
    consolidationIncludeSaleVAT: s.includeSaleVAT === true,
  };
}

/** the message of a save without the currency */
export const CONSOLIDATION_CURRENCY_REQUIRED = 'The currency for consolidation is obligatory.';

export interface ConsolidationChange {
  /** the currency or the rate type changed: every project is recalculated by the database */
  recalculates: boolean;
  currencyFrom: string;
  currencyTo: string;
  rateTypeFrom: string;
  rateTypeTo: string;
  /** a VAT switch changed (no recalculation) */
  vatChanged: boolean;
}

/** what a save changes; `before` = null for a new organization (nothing to recalculate) */
export function changedConsolidation(before: ConsolidationSettings | null, after: ConsolidationSettings): ConsolidationChange {
  const b = before ?? after;
  return {
    recalculates: !!before && !!b.currency && (b.currency !== after.currency || b.rateType !== after.rateType),
    currencyFrom: b.currency,
    currencyTo: after.currency,
    rateTypeFrom: b.rateType,
    rateTypeTo: after.rateType,
    vatChanged: b.includePurchaseVAT !== after.includePurchaseVAT || b.includeSaleVAT !== after.includeSaleVAT,
  };
}

export const CONSOLIDATION_CHANGE_TITLE = 'Change the consolidation settings?';
export const CONSOLIDATION_CHANGE_MESSAGE =
  'Yes: save, then the database recalculates sumForConsolidation of ALL projects of the organization (the reports show the new figures when it is ready). Cancel: do not save. There is no "save only": half of the book in the old currency would be wrong.';

/** one line per change: 'Currency for consolidation: USD → EUR' */
export function consolidationChangeLines(c: ConsolidationChange): string[] {
  const out: string[] = [];
  if (c.currencyFrom !== c.currencyTo) out.push(`Currency for consolidation: ${c.currencyFrom || '-'} → ${c.currencyTo || '-'}`);
  if (c.rateTypeFrom !== c.rateTypeTo) out.push(`Exchange rate type: ${c.rateTypeFrom} → ${c.rateTypeTo}`);
  return out;
}

export const PURCHASE_VAT_TEXT =
  'Include purchase VAT into consolidation. ON: the purchase side (plan, orders, receipts, fact, vendor invoices) is consolidated WITH all its VAT. OFF (default): net + only the part of the VAT that is not recoverable (the IFRS cost); with fully recoverable VAT this is the net.';
export const SALE_VAT_TEXT =
  'Include sale VAT into consolidation. ON: the sale side (customer invoices, revenue) is consolidated WITH its VAT. OFF (default): net - the VAT of a sale is never cost.';

export const CONSOLIDATION_STATE_TEXT: Record<ConsolidationState, string> = {
  ready: 'Ready',
  recalculating: 'Recalculating ...',
  gaps: 'Some movements wait for an exchange rate',
};

/** the answer of the SQL function consolidation_status (null = the user has no organization / the function is not installed) */
export function parseConsolidationStatus(raw: any): ConsolidationStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const state: ConsolidationState = raw.state === 'recalculating' || raw.state === 'gaps' ? raw.state : 'ready';
  return {
    currency: codeOf(raw.currency),
    rateType: typeof raw.rateType === 'string' && raw.rateType ? raw.rateType : CONSOLIDATION_DEFAULT_RATE_TYPE,
    includePurchaseVAT: raw.includePurchaseVAT === true,
    includeSaleVAT: raw.includeSaleVAT === true,
    state,
    gaps: Number(raw.gaps) || 0,
    queued: Number(raw.queued) || 0,
  };
}

/** side of a register row: the sale side = kind sold or the Revenue genus (the same rule as the SQL report) */
export const consolidationSideOf = (kind: string, genus?: string | null): ConsolidationSide => (kind === 'sold' || genus === 'revenueGenus' ? 'sale' : 'purchase');

/** the amount a report adds (the twin of public.consolidation_amount): purchase ON = net + VAT, OFF = net + VAT that is cost; sale ON = net + VAT, OFF = net */
export function consolidationAmount(net: number, vat: number, vatInCost: number, side: ConsolidationSide, s: Pick<ConsolidationSettings, 'includePurchaseVAT' | 'includeSaleVAT'>): number {
  const n = Number(net) || 0;
  const v = Number(vat) || 0;
  const c = Number(vatInCost) || 0;
  if (side === 'sale') return n + (s.includeSaleVAT ? v : 0);
  return n + (s.includePurchaseVAT ? v : c);
}

/** the words of the VAT basis the organization chose, for a report header: 'VAT: purchase without, sale without' */
export const consolidationVatWords = (s: Pick<ConsolidationSettings, 'includePurchaseVAT' | 'includeSaleVAT'>): string =>
  `VAT: purchase ${s.includePurchaseVAT ? 'with' : 'without'}, sale ${s.includeSaleVAT ? 'with' : 'without'}`;
