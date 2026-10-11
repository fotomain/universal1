// uploadAllDataFromDate - the "Upload all data from a date" button of a currency card: fills every missing Default rate from the chosen day up to today.
//   "All cross": the rates of EVERY active currency of the catalog (and of the one of the card, even when it is inactive) are loaded for the same days, not only of
//   the card's currency - a conversion between two currencies needs both of them on the same day (D365 pair rate = ratio(to) / ratio(from), currencyConvert.ts).
//   "Other ratios": all of them are stored against the base currency (EXPO_PUBLIC_CURRENCY_RATES_BASE); every other pair (cross rate) is made from them when a
//   sum is converted, and rows quoted against ANOTHER base (e.g. EUR rows while the base is USD) are re-based the same way (buildRateBook), so nothing is stored twice.
//   Only days that have no rate yet are added: a rate somebody entered or corrected is never changed.
import { isValidISODate, todayISO } from '../exchange/currencyExchangeModel';
import { CurrencyRefreshResult, refreshCurrencyRatio } from './refreshCurrencyRatio';
import type { CurrencyRefreshConfig } from './currencyRefreshConfig';

export interface UploadFromDateArgs {
  /** the card the button belongs to (currencyTable.rowGUID) */
  currencyGUID: string;
  /** 'YYYY-MM-DD' */
  fromDate: string;
  /** all rows of currencyTable */
  currencies: any[];
  supabase: any;
  today?: string;
  config?: CurrencyRefreshConfig;
  fetchFn?: typeof fetch;
}

/** why a date cannot be used (null = it can) */
export function uploadDateProblem(fromDate: string, today: string = todayISO()): string | null {
  if (!isValidISODate(fromDate)) return 'Enter the date as YYYY-MM-DD';
  if (fromDate > today) return 'The date is in the future';
  if (fromDate < '1999-01-01') return 'The service has no rates before 1999';
  return null;
}

export async function uploadAllDataFromDate(args: UploadFromDateArgs): Promise<CurrencyRefreshResult> {
  const today = args.today ?? todayISO();
  const problem = uploadDateProblem(args.fromDate, today);
  if (problem) throw new Error(problem);
  const list = args.currencies.filter((c) => c?.rowGUID && (c.rowJSON?.isActive !== false || c.rowGUID === args.currencyGUID));
  if (!list.some((c) => c.rowGUID === args.currencyGUID)) throw new Error('The currency is not in the catalog');
  return refreshCurrencyRatio({ currencies: list, supabase: args.supabase, today, config: args.config, fetchFn: args.fetchFn, from: args.fromDate });
}
