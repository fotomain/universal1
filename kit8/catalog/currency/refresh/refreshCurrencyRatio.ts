// refreshCurrencyRatio - fills the exchange rates (currencyExchangeRateTable) of the last months from the
// Frankfurter API v2-1. ONLY days that have no rate yet are added: a rate somebody entered or corrected is never changed.
//   The refreshed rates are of the Default rate type; a Budget rate (key 'day|Budget') of the same day never blocks them.
//   currencyRatio = units of the currency for 1 base currency (EXPO_PUBLIC_CURRENCY_RATES_BASE, default EUR).
import { currencyExchangeRateTable, isValidISODate, orderInListForDate, todayISO } from '../exchange/currencyExchangeModel';
import { currencyRefreshConfig, CurrencyRefreshConfig } from './currencyRefreshConfig';
import { fetchRatesRange, fetchSupportedCurrencies, RatesByDay } from './frankfurterApi';

export interface CurrencyRefreshResult {
  from: string;
  to: string;
  base: string;
  /** currency code -> number of days added */
  added: Record<string, number>;
  addedTotal: number;
  /** nothing was missing for these */
  upToDate: string[];
  /** the service has no rates for these (or the code is not a currency code) */
  unsupported: string[];
  /** the base currency itself (its ratio is always 1) */
  baseSkipped: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' minus n months (2026-04-30 - 2 -> 2026-02-28) */
export function monthsBack(iso: string, n: number): string {
  const [y, m, d] = (isValidISODate(iso) ? iso : todayISO()).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 - n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

const codeOf = (row: any) => String(row?.rowJSON?.currencyCode || '').trim().toUpperCase();

/** the rows to insert: every (currency, day) of the service answer that is not stored yet */
export function missingRateRows(currencies: any[], rates: RatesByDay, existing: { rowOwnerGUID: string; rowParentGUID: string }[], base: string, providers?: string) {
  const have = new Set(existing.map((r) => `${r.rowOwnerGUID}|${r.rowParentGUID}`));
  const rows: any[] = [];
  for (const cur of currencies) {
    const code = codeOf(cur);
    if (!cur?.rowGUID || !code) continue;
    for (const day of Object.keys(rates).sort()) {
      const ratio = rates[day]?.[code];
      if (!(ratio > 0) || have.has(`${cur.rowGUID}|${day}`)) continue;
      rows.push({
        rowOwnerGUID: cur.rowGUID,
        rowParentGUID: day,
        orderInList: orderInListForDate(day),
        rowJSON: { startingDate: day, currencyRatio: Math.round(ratio * 1e6) / 1e6, rateType: 'Default', rateSource: 'frankfurter', rateBase: base, ...(providers ? { rateProviders: providers } : {}) },
      });
    }
  }
  return rows;
}

/**
 * currencies = rows of currencyTable (all of them, or ONE for a single line).
 * supabase   = the app's Supabase client (the user must be signed in: only signed-in users may write rates).
 */
export async function refreshCurrencyRatio(args: { currencies: any[]; supabase: any; today?: string; config?: CurrencyRefreshConfig; fetchFn?: typeof fetch }): Promise<CurrencyRefreshResult> {
  const cfg = args.config ?? currencyRefreshConfig();
  const to = args.today ?? todayISO();
  const from = monthsBack(to, cfg.months);
  const result: CurrencyRefreshResult = { from, to, base: cfg.base, added: {}, addedTotal: 0, upToDate: [], unsupported: [], baseSkipped: false };

  const all = args.currencies.filter((c) => c?.rowGUID);
  result.baseSkipped = all.some((c) => codeOf(c) === cfg.base);
  let wanted = all.filter((c) => codeOf(c) !== cfg.base);
  // only the currencies the service publishes (asking for an unknown one fails the whole request)
  const supported = await fetchSupportedCurrencies(cfg.apiUrl, args.fetchFn);
  result.unsupported = wanted.filter((c) => !(codeOf(c) in supported)).map((c) => codeOf(c) || '???');
  wanted = wanted.filter((c) => codeOf(c) in supported);
  if (wanted.length === 0) return result;

  const rates = await fetchRatesRange({ apiUrl: cfg.apiUrl, base: cfg.base, symbols: wanted.map(codeOf), from, to, providers: cfg.providers, fetchFn: args.fetchFn });

  const { data: existing, error: readError } = await args.supabase
    .from(currencyExchangeRateTable)
    .select('rowOwnerGUID,rowParentGUID')
    .in('rowOwnerGUID', wanted.map((c) => c.rowGUID))
    .gte('rowParentGUID', from)
    .lte('rowParentGUID', to)
    .limit(20000);
  if (readError) throw new Error(readError.message || String(readError));

  const rows = missingRateRows(wanted, rates, existing || [], cfg.base, cfg.providers);
  for (let i = 0; i < rows.length; i += 500) {
    // ignoreDuplicates: a day another user added meanwhile stays as it is (unique: currency + day)
    const { error } = await args.supabase.from(currencyExchangeRateTable).upsert(rows.slice(i, i + 500), { onConflict: 'rowOwnerGUID,rowParentGUID', ignoreDuplicates: true });
    if (error) throw new Error(error.message || String(error));
  }
  const codeByGUID = new Map(wanted.map((c) => [c.rowGUID, codeOf(c)]));
  for (const r of rows) {
    const code = codeByGUID.get(r.rowOwnerGUID)!;
    result.added[code] = (result.added[code] || 0) + 1;
  }
  result.addedTotal = rows.length;
  result.upToDate = wanted.map(codeOf).filter((code) => !result.added[code]);
  return result;
}

/** one line for the snackbar */
export function currencyRefreshMessage(r: CurrencyRefreshResult): string {
  const parts: string[] = [];
  const added = Object.entries(r.added);
  if (added.length) parts.push(`Rates added (${r.from} … ${r.to}, base ${r.base}): ${added.map(([code, n]) => `${code} ${n} d`).join(', ')}`);
  if (r.upToDate.length) parts.push(`up to date: ${r.upToDate.join(', ')}`);
  if (r.unsupported.length) parts.push(`no rates published for: ${r.unsupported.join(', ')}`);
  if (r.baseSkipped && parts.length === 0) parts.push(`${r.base} is the base currency: its ratio is always 1`);
  return parts.join(' · ') || 'No currencies to refresh';
}
