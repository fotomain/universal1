// D365-like conversion on the rate table of this app: ratio = units of the currency for 1 base currency (EUR), the latest rate on or before the day,
// strict rate types, triangulation through the base, rounding to the decimals of the target.
import {
  buildRateBook, convertWith, displayPairRate, isMiss, pairRate, ratioOnDay, rateMissMessage, roundTo,
} from '../../../../kit8/catalog/currency/exchange/currencyConvert';
import { rateKeyOf } from '../../../../kit8/catalog/currency/exchange/currencyExchangeModel';

const cur = (guid: string, code: string, decimalDigits = 2) => ({ rowGUID: guid, rowJSON: { currencyCode: code, decimalDigits } });
const rate = (owner: string, day: string, ratio: number, rateType?: string, rateBase?: string) => ({
  rowGUID: `${owner}-${day}-${rateType ?? 'Default'}`, rowOwnerGUID: owner, rowParentGUID: rateKeyOf(day, rateType),
  rowJSON: { startingDate: day, currencyRatio: ratio, ...(rateType ? { rateType } : {}), ...(rateBase ? { rateBase } : {}) },
});
const currencies = [cur('c-eur', 'EUR'), cur('c-usd', 'USD'), cur('c-gbp', 'GBP'), cur('c-jpy', 'JPY', 0)];
const rates = [
  rate('c-usd', '2026-01-02', 1.05), rate('c-usd', '2026-03-02', 1.08), rate('c-usd', '2026-06-01', 1.1),
  rate('c-gbp', '2026-01-02', 0.85), rate('c-gbp', '2026-06-01', 0.86),
  rate('c-jpy', '2026-01-02', 160),
  rate('c-usd', '2026-01-01', 1.2, 'Budget'), rate('c-gbp', '2026-01-01', 0.9, 'Budget'),
];
const book = buildRateBook(currencies, rates);

describe('the rate of a currency on a day', () => {
  it('the latest rate whose startingDate is on or before the day (weekends and holidays use the last working day)', () => {
    expect(ratioOnDay(book, 'USD', 'Default', '2026-03-02')).toEqual({ ratio: 1.08, day: '2026-03-02' });
    expect(ratioOnDay(book, 'USD', 'Default', '2026-03-07')).toEqual({ ratio: 1.08, day: '2026-03-02' });
    expect(ratioOnDay(book, 'USD', 'Default', '2026-12-31')).toEqual({ ratio: 1.1, day: '2026-06-01' });
  });
  it('a rate that starts AFTER the day is never used', () => {
    expect(ratioOnDay(book, 'USD', 'Default', '2026-01-01')).toEqual({ reason: 'noRate', code: 'USD', rateType: 'Default', day: '2026-01-01' });
  });
  it('the base currency is always 1 (it has no rows); a currency that is not in the catalog is an error', () => {
    expect(ratioOnDay(book, 'EUR', 'Default', '2020-01-01')).toEqual({ ratio: 1, day: '2020-01-01' });
    expect(ratioOnDay(book, 'XXX', 'Default', '2026-03-02')).toEqual({ reason: 'unknownCurrency', code: 'XXX' });
  });
  it('rate TYPES are strict: no rate of the asked type = an error, never the rate of another type', () => {
    expect(ratioOnDay(book, 'USD', 'Budget', '2026-06-01')).toEqual({ ratio: 1.2, day: '2026-01-01' });
    expect(ratioOnDay(book, 'JPY', 'Budget', '2026-06-01')).toEqual({ reason: 'noRate', code: 'JPY', rateType: 'Budget', day: '2026-06-01' });
  });
});

describe('the pair from -> to (triangulation through the base)', () => {
  const day = '2026-03-02';
  const r = (from: string, to: string, type = 'Default') => pairRate(book, from, to, type, day) as any;
  it('USD -> EUR = 1 / 1.08; EUR -> USD = 1.08; USD -> GBP = 0.85 / 1.08 (GBP 0.85 on that day)', () => {
    expect(r('USD', 'EUR').rate).toBeCloseTo(1 / 1.08, 10);
    expect(r('EUR', 'USD').rate).toBeCloseTo(1.08, 10);
    expect(r('USD', 'GBP').rate).toBeCloseTo(0.85 / 1.08, 10);
    expect(r('GBP', 'USD').rate).toBeCloseTo(1.08 / 0.85, 10);
  });
  it('the reverse pair is the inverse (D365: reverse rate)', () => {
    expect(r('USD', 'GBP').rate * r('GBP', 'USD').rate).toBeCloseTo(1, 12);
  });
  it('the same currency is 1 (no lookup, also for a currency without rates)', () => {
    expect(pairRate(book, 'XXX', 'XXX', 'Default', day)).toMatchObject({ rate: 1 });
    expect(r('USD', 'USD').rate).toBe(1);
  });
  it('remembers which rate row was used for each side', () => {
    const p = pairRate(book, 'USD', 'GBP', 'Default', '2026-03-07') as any;
    expect(p).toMatchObject({ from: 'USD', to: 'GBP', rateType: 'Default', day: '2026-03-07', fromRateDay: '2026-03-02', toRateDay: '2026-01-02' });
  });
  it('a miss names the currency that has no rate (either side)', () => {
    const miss = pairRate(book, 'USD', 'JPY', 'Budget', '2026-06-01');
    expect(isMiss(miss)).toBe(true);
    expect(miss).toMatchObject({ reason: 'noRate', code: 'JPY', rateType: 'Budget' });
    expect(rateMissMessage(miss as any)).toBe('No Budget exchange rate of JPY on or before 2026-06-01');
    expect(rateMissMessage({ reason: 'unknownCurrency', code: 'XXX' })).toBe('Currency XXX is not in the currency catalog');
    expect(isMiss(pairRate(book, 'USD', 'GBP', 'Default', '2025-12-31'))).toBe(true);
  });
});

describe('amounts', () => {
  const day = '2026-03-02';
  it('1000 USD -> EUR = 925.93, 500 EUR -> USD = 540.00, 1000 USD -> GBP = 787.04 (the example of the docs)', () => {
    const usdEur = pairRate(book, 'USD', 'EUR', 'Default', day) as any;
    expect(convertWith(1000, usdEur.rate, 2)).toBe(925.93);
    const eurUsd = pairRate(book, 'EUR', 'USD', 'Default', day) as any;
    expect(convertWith(500, eurUsd.rate, 2)).toBe(540);
    const usdGbp = pairRate(book, 'USD', 'GBP', 'Default', day) as any;
    expect(convertWith(1000, usdGbp.rate, 2)).toBe(787.04);
  });
  it('the WRONG direction is 17 % off: 1000 USD x 1.08 would be 1080', () => {
    expect(1000 * 1.08).toBe(1080);
    expect(1080 / 925.93).toBeGreaterThan(1.16);
  });
  it('rounded to the decimals of the TARGET currency (JPY has 0)', () => {
    const eurJpy = pairRate(book, 'EUR', 'JPY', 'Default', day) as any;
    expect(convertWith(10.5, eurJpy.rate, book.currency('JPY')!.decimals)).toBe(1680);
    expect(roundTo(2.345, 2)).toBe(2.35);
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(NaN, 2)).toBe(0);
  });
  it('the budget type has its own (planned) rate: 1000 USD = 833.33 EUR at 1.2, not 925.93', () => {
    const p = pairRate(book, 'USD', 'EUR', 'Budget', day) as any;
    expect(convertWith(1000, p.rate, 2)).toBe(833.33);
  });
});

describe('the book', () => {
  it('a rate of another base is not used; rows without a type are Default; garbage rows are skipped', () => {
    const b = buildRateBook(currencies, [
      rate('c-usd', '2026-01-01', 1.05, undefined, 'EUR'), rate('c-usd', '2026-02-01', 9.99, undefined, 'USD'),
      { rowGUID: 'x', rowOwnerGUID: 'c-usd', rowParentGUID: 'bad', rowJSON: { currencyRatio: 1.5 } },
      { rowGUID: 'y', rowOwnerGUID: 'nobody', rowParentGUID: '2026-01-01', rowJSON: { startingDate: '2026-01-01', currencyRatio: 1.5 } },
      { rowGUID: 'z', rowOwnerGUID: 'c-usd', rowParentGUID: '2026-04-01', rowJSON: { startingDate: '2026-04-01', currencyRatio: -3 } },
    ]);
    expect(b.ratesOf('USD', 'Default')).toEqual([{ day: '2026-01-01', ratio: 1.05 }]);
    expect(b.ratesOf('usd', 'Budget')).toEqual([]);
  });
  it('another base currency: its rows are the ones quoted against it', () => {
    const b = buildRateBook(currencies, [rate('c-eur', '2026-01-01', 0.93, undefined, 'USD')], 'USD');
    expect(b.base).toBe('USD');
    expect(ratioOnDay(b, 'EUR', 'Default', '2026-02-01')).toEqual({ ratio: 0.93, day: '2026-01-01' });
    expect(ratioOnDay(b, 'USD', 'Default', '2026-02-01')).toEqual({ ratio: 1, day: '2026-02-01' });
  });
  it('the decimals of a currency default to 2', () => {
    expect(buildRateBook([cur('c-x', 'XAU', 99 as any)], []).currency('XAU')!.decimals).toBe(2);
  });
});

describe('display', () => {
  it('per 1 or per 100 units of the from currency (D365 shows per 100)', () => {
    expect(displayPairRate(0.925926, 1)).toBe('0.925926');
    expect(displayPairRate(0.925926, 100)).toBe('92.5926');
    expect(displayPairRate(1.08, 1)).toBe('1.08');
    expect(displayPairRate(160, 1)).toBe('160');
  });
});
