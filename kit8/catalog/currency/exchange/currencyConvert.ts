// Currency conversion - the logic of D365 FO exchange rates, on top of the rate table of this app (pure, unit-tested).
//
//   A rate row (currencyExchangeRateTable) = one currency, one day, one RATE TYPE:  currencyRatio = units of the currency for 1 unit of the BASE
//   currency (EUR). The base currency has no rows: its ratio is 1.  A rate applies FROM its startingDate until the next rate of the same
//   currency and type: the rate on a day is the one with the latest startingDate <= that day (D365: valid from / valid to). A rate that starts
//   AFTER the day is never used. A day without a rate of the asked type is an ERROR (D365: "exchange rate not found"): nothing is converted and nothing
//   is taken from another rate type.
//
//   Pair (D365: from currency -> to currency):   rate(from -> to) = ratio(to) / ratio(from)        (triangulation through the base currency)
//   Amount:                                        amount in `to` = amount in `from` x rate(from -> to), rounded to the decimals of `to`
//   Example, base EUR, USD 1.08, GBP 0.85:  1000 USD -> EUR = 1000 x (1 / 1.08) = 925.93 | 500 EUR -> USD = 500 x 1.08 = 540.00 | 1000 USD -> GBP = 787.04
//   A rate row of another base (rowJSON.rateBase differs from the book's base) is not used.
import { DEFAULT_RATE_TYPE, rateTypeOf } from './currencyExchangeModel';

export const BASE_CURRENCY_DEFAULT = 'EUR';

export interface BookRate { day: string; ratio: number }
export interface BookCurrency { code: string; guid: string; decimals: number }

/** the currencies and their rates, ready to be asked: ratesOf(code, type) is sorted by day, oldest first */
export interface RateBook {
  base: string;
  currency: (code: string) => BookCurrency | undefined;
  ratesOf: (code: string, type: string) => BookRate[];
}

const codeOf = (row: any): string => String(row?.rowJSON?.currencyCode || '').trim().toUpperCase();

/** currencies = rows of currencyTable, rates = rows of currencyExchangeRateTable (all types) */
export function buildRateBook(currencies: any[], rates: any[], base: string = BASE_CURRENCY_DEFAULT): RateBook {
  const baseCode = base.toUpperCase();
  const byCode = new Map<string, BookCurrency>();
  const byGUID = new Map<string, string>();
  for (const c of currencies || []) {
    const code = codeOf(c);
    if (!code || !c?.rowGUID) continue;
    const dec = Number(c.rowJSON?.decimalDigits);
    byCode.set(code, { code, guid: c.rowGUID, decimals: Number.isInteger(dec) && dec >= 0 && dec <= 6 ? dec : 2 });
    byGUID.set(c.rowGUID, code);
  }
  const rated = new Map<string, BookRate[]>();
  for (const r of rates || []) {
    const code = byGUID.get(r?.rowOwnerGUID);
    const ratio = Number(r?.rowJSON?.currencyRatio);
    const day = String(r?.rowJSON?.startingDate || String(r?.rowParentGUID || '').slice(0, 10));
    if (!code || !(ratio > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    // a rate quoted against another base cannot be used with this one
    const rowBase = String(r?.rowJSON?.rateBase || '').toUpperCase();
    if (rowBase && rowBase !== baseCode) continue;
    const key = `${code}|${rateTypeOf(r)}`;
    (rated.get(key) ?? rated.set(key, []).get(key)!).push({ day, ratio });
  }
  for (const list of rated.values()) list.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return {
    base: baseCode,
    currency: (code) => byCode.get(String(code || '').toUpperCase()),
    ratesOf: (code, type) => rated.get(`${String(code || '').toUpperCase()}|${type || DEFAULT_RATE_TYPE}`) ?? [],
  };
}

export type RateMiss =
  | { reason: 'unknownCurrency'; code: string }
  | { reason: 'noRate'; code: string; rateType: string; day: string };

/** the rate of ONE currency against the base on a day: the latest startingDate <= day, of that type; null = none */
export function ratioOnDay(book: RateBook, code: string, rateType: string, day: string): { ratio: number; day: string } | RateMiss {
  const c = String(code || '').toUpperCase();
  if (!c || (c !== book.base && !book.currency(c))) return { reason: 'unknownCurrency', code: c };
  if (c === book.base) return { ratio: 1, day };
  const list = book.ratesOf(c, rateType);
  let best: BookRate | undefined;
  for (const r of list) { if (r.day <= day) best = r; else break; }
  return best ? { ratio: best.ratio, day: best.day } : { reason: 'noRate', code: c, rateType, day };
}

export interface PairRate {
  from: string;
  to: string;
  rateType: string;
  /** the day asked for */
  day: string;
  /** units of `to` for ONE unit of `from` */
  rate: number;
  /** the startingDate of the rate row used for each side (the base currency: the day itself) */
  fromRateDay: string;
  toRateDay: string;
}

/** D365: the rate of the pair from -> to on a day (same currency: 1) */
export function pairRate(book: RateBook, from: string, to: string, rateType: string, day: string): PairRate | RateMiss {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  const type = rateType || DEFAULT_RATE_TYPE;
  if (f && f === t) return { from: f, to: t, rateType: type, day, rate: 1, fromRateDay: day, toRateDay: day };
  const a = ratioOnDay(book, f, type, day);
  if ('reason' in a) return a;
  const b = ratioOnDay(book, t, type, day);
  if ('reason' in b) return b;
  return { from: f, to: t, rateType: type, day, rate: b.ratio / a.ratio, fromRateDay: a.day, toRateDay: b.day };
}
export const isMiss = (x: PairRate | RateMiss): x is RateMiss => 'reason' in x;

/** amount x rate, rounded to `decimals` (the decimals of the target currency) */
export function roundTo(amount: number, decimals: number): number {
  if (!Number.isFinite(amount)) return 0;
  const f = Math.pow(10, Math.max(0, Math.min(6, decimals)));
  return Math.round((amount + Number.EPSILON) * f) / f;
}

/** an amount converted with a given pair rate (a stored snapshot, or a fresh one) */
export const convertWith = (amount: number, rate: number, toDecimals: number): number => roundTo(amount * rate, toDecimals);

/** D365 shows a rate per 100 units of the from currency by default; here per 1 or per 100 (display only) */
export function displayPairRate(rate: number, per: 1 | 100 = 1): string {
  const x = rate * per;
  const digits = x >= 100 ? 2 : x >= 1 ? 4 : 6;
  return x.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** a message for a miss: 'No Default exchange rate for USD on 2026-03-01' */
export function rateMissMessage(miss: RateMiss): string {
  return miss.reason === 'unknownCurrency' ? `Currency ${miss.code || '?'} is not in the currency catalog` : `No ${miss.rateType} exchange rate of ${miss.code} on or before ${miss.day}`;
}
