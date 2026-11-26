// ratesApi - the exchange rates of the initial data against Supabase + the rates service (Frankfurter, kit8/catalog/currency/refresh):
//   fillRatesOfDay        THE ALGORITHM of Q5: the rate in force on one day (31 December of the previous year) for every currency of the catalog that has none.
//                         The service publishes working days only, so the last published day on or before the wanted one is taken (up to 10 days back) and stored as the rate
//                         OF the wanted day (rowJSON.rateFromDay says which day it was read from). A currency that already has a Default rate on or before the day is not touched.
//   fillRatesFromYearStart  every missing day from 1 January of this year to today (refreshCurrencyRatio of the currency screen, so the same rules: existing rates never change)
//   importRates           the rows of a CSV file (ratesModel.parseRatesCsv); existing rates stay unless `overwrite`
//   ratesInForceNow       the check at the start
import { addDays, currencyExchangeRateTable, orderInListForDate, todayISO } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { currencyRefreshConfig, CurrencyRefreshConfig } from '../../../../catalog/currency/refresh/currencyRefreshConfig';
import { fetchRatesRange, fetchSupportedCurrencies } from '../../../../catalog/currency/refresh/frankfurterApi';
import { CurrencyRefreshResult, refreshCurrencyRatio } from '../../../../catalog/currency/refresh/refreshCurrencyRatio';
import { RATES_REQUIRED_CODES } from '../initialDataModel';
import { ParsedRate, previousYearEnd, rateCurrencies, rateRowsOf, ratesInForce, yearStart } from './ratesModel';

/** how far back from the wanted day the last published day is looked for (a long holiday) */
export const RATE_LOOKBACK_DAYS = 10;

const codeOf = (c: any): string => String(c?.rowJSON?.currencyCode ?? '').trim().toUpperCase();

export async function readCurrencies(supabase: any): Promise<any[]> {
  const { data, error } = await supabase.from('currencyTable').select('rowGUID,rowJSON').order('orderInList');
  if (error) throw new Error(error.message || String(error));
  return data || [];
}

/** the Default rate in force on `day` of one currency: one row or none */
async function rateOnOrBefore(supabase: any, currencyGUID: string, day: string): Promise<boolean> {
  const { data, error } = await supabase.from(currencyExchangeRateTable).select('rowOwnerGUID,rowParentGUID')
    .eq('rowOwnerGUID', currencyGUID).lte('rowParentGUID', day).not('rowParentGUID', 'like', '%|%').limit(1);
  if (error) throw new Error(error.message || String(error));
  return (data || []).length > 0;
}

/** the check at the start: the rate of 31 December of the previous year is there for the required currencies */
export async function ratesInForceNow(supabase: any, currencies: any[], today: string = todayISO(), config: CurrencyRefreshConfig = currencyRefreshConfig()): Promise<boolean> {
  const day = previousYearEnd(today);
  const wanted = currencies.filter((c) => c?.rowGUID && (RATES_REQUIRED_CODES as readonly string[]).includes(codeOf(c)) && codeOf(c) !== config.base);
  const rows: { rowOwnerGUID: string; rowParentGUID: string }[] = [];
  await Promise.all(wanted.map(async (c) => { if (await rateOnOrBefore(supabase, c.rowGUID, day)) rows.push({ rowOwnerGUID: c.rowGUID, rowParentGUID: day }); }));
  return ratesInForce(currencies, rows, day, config.base);
}

export interface RatesOfDayResult {
  day: string;
  base: string;
  /** currency code -> the day the value was read from */
  added: Record<string, string>;
  /** had a rate in force already */
  upToDate: string[];
  /** the service does not publish them */
  unsupported: string[];
  /** published, but no day within RATE_LOOKBACK_DAYS before the wanted day */
  noRate: string[];
}

export async function fillRatesOfDay(args: { supabase: any; currencies: any[]; day: string; config?: CurrencyRefreshConfig; fetchFn?: typeof fetch }): Promise<RatesOfDayResult> {
  const cfg = args.config ?? currencyRefreshConfig();
  const result: RatesOfDayResult = { day: args.day, base: cfg.base, added: {}, upToDate: [], unsupported: [], noRate: [] };
  const wanted = rateCurrencies(args.currencies, cfg.base);
  if (wanted.length === 0) return result;
  const inForce = await Promise.all(wanted.map((c) => rateOnOrBefore(args.supabase, c.rowGUID, args.day)));
  const open = wanted.filter((_, i) => !inForce[i]);
  result.upToDate = wanted.filter((_, i) => inForce[i]).map(codeOf);
  if (open.length === 0) return result;

  const supported = await fetchSupportedCurrencies(cfg.apiUrl, args.fetchFn);
  result.unsupported = open.filter((c) => !(codeOf(c) in supported)).map(codeOf);
  const asked = open.filter((c) => codeOf(c) in supported);
  if (asked.length === 0) return result;

  const rates = await fetchRatesRange({ apiUrl: cfg.apiUrl, base: cfg.base, symbols: asked.map(codeOf), from: addDays(args.day, -RATE_LOOKBACK_DAYS), to: args.day, providers: cfg.providers, fetchFn: args.fetchFn });
  const days = Object.keys(rates).filter((d) => d <= args.day).sort();
  const rows: any[] = [];
  for (const c of asked) {
    const code = codeOf(c);
    const from = [...days].reverse().find((d) => rates[d]?.[code] > 0);
    if (!from) { result.noRate.push(code); continue; }
    rows.push({
      rowOwnerGUID: c.rowGUID,
      rowParentGUID: args.day,
      orderInList: orderInListForDate(args.day),
      rowJSON: { startingDate: args.day, currencyRatio: Math.round(rates[from][code] * 1e6) / 1e6, rateType: 'Default', rateSource: 'frankfurter', rateBase: cfg.base, rateFromDay: from, ...(cfg.providers ? { rateProviders: cfg.providers } : {}) },
    });
    result.added[code] = from;
  }
  if (rows.length) {
    // a day another user wrote meanwhile stays as it is
    const { error } = await args.supabase.from(currencyExchangeRateTable).upsert(rows, { onConflict: 'rowOwnerGUID,rowParentGUID', ignoreDuplicates: true });
    if (error) throw new Error(error.message || String(error));
  }
  return result;
}

/** every missing day from 1 January of this year up to today, all currencies of the catalog */
export async function fillRatesFromYearStart(args: { supabase: any; currencies: any[]; today?: string; config?: CurrencyRefreshConfig; fetchFn?: typeof fetch }): Promise<CurrencyRefreshResult> {
  const today = args.today ?? todayISO();
  return refreshCurrencyRatio({ currencies: args.currencies, supabase: args.supabase, today, config: args.config, fetchFn: args.fetchFn, from: yearStart(today) });
}

export interface RatesImportResult { written: number; skipped: number }

/** writes the parsed rates; overwrite = replace a rate of the same currency, day and type (default: it stays) */
export async function importRates(args: { supabase: any; rates: ParsedRate[]; base: string; overwrite?: boolean }): Promise<RatesImportResult> {
  const rows = rateRowsOf(args.rates, args.base);
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const { data, error } = await args.supabase.from(currencyExchangeRateTable)
      .upsert(part, { onConflict: 'rowOwnerGUID,rowParentGUID', ignoreDuplicates: !args.overwrite }).select('rowGUID');
    if (error) throw new Error(error.message || String(error));
    written += Array.isArray(data) ? data.length : 0;
  }
  return { written, skipped: rows.length - written };
}
