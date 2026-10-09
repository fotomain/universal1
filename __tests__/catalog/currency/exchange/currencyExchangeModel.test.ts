// kit8/catalog/currency/exchange/currencyExchangeModel: days, one rate per currency per day, card mapping.
import {
  addDays,
  currencyExchangeRateTable,
  CURRENCY_EXCHANGE_ROUTES,
  exchangeReadParams,
  formatRatio,
  isValidISODate,
  normalizeRate,
  orderInListForDate,
  parseRatio,
  ratioChangePercent,
  RATE_TYPES,
  rateKeyOf,
  rateTypeOf,
  rateToCard,
  sortRatesNewestFirst,
  todayISO,
  validateRate,
} from '../../../../kit8/catalog/currency/exchange/currencyExchangeModel';

const rate = (id: string, day: string, ratio: number, owner = 'usd') => ({
  rowGUID: id, rowOwnerGUID: owner, rowParentGUID: day, orderInList: orderInListForDate(day), rowJSON: { startingDate: day, currencyRatio: ratio },
});

it('table, routes and the currency scope', () => {
  expect(currencyExchangeRateTable).toBe('currencyExchangeRateTable');
  expect(CURRENCY_EXCHANGE_ROUTES).toEqual({ list: '/currency/exchange/list', edit: '/currency/exchange/edit' });
  expect(exchangeReadParams('usd')).toEqual({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: 'usd' } });
});

it('days: valid calendar dates, +/- days across months and years, local today', () => {
  expect(isValidISODate('2026-09-29')).toBe(true);
  expect(isValidISODate('2026-02-30')).toBe(false);
  expect(isValidISODate('2026-9-29')).toBe(false);
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(todayISO(new Date(2026, 8, 29, 23, 59))).toBe('2026-09-29');
});

it('orderInList: newer day = smaller number (ascending list = newest first)', () => {
  expect(orderInListForDate('2026-09-29')).toBeLessThan(orderInListForDate('2026-09-28'));
  expect(orderInListForDate('2026-09-29') - orderInListForDate('2026-09-28')).toBe(-1);
});

it('ratio parsing accepts a decimal comma, rejects text', () => {
  expect(parseRatio('1,0842')).toBe(1.0842);
  expect(parseRatio(' 150 ')).toBe(150);
  expect(parseRatio('abc')).toBeNaN();
  expect(parseRatio('')).toBeNaN();
  expect(normalizeRate({ startingDate: ' 2026-09-29 ', currencyRatio: '0.85' })).toEqual({ startingDate: '2026-09-29', currencyRatio: 0.85, rateType: 'Default' });
});

it('validation: date, ratio > 0, one rate per currency per day (other currencies do not count)', () => {
  const rows = [rate('a', '2026-09-28', 1.08), rate('x', '2026-09-29', 7, 'cny')];
  expect(validateRate({ startingDate: '2026-09-29', currencyRatio: 1.09 }, rows, 'usd')).toEqual({});
  const dup = validateRate({ startingDate: '2026-09-28', currencyRatio: 1.09 }, rows, 'usd');
  expect(dup.startingDate).toMatch(/already exists/);
  expect(dup.duplicateRowGUID).toBe('a');
  expect(validateRate({ startingDate: '2026-09-28', currencyRatio: 1.09 }, rows, 'usd', 'a')).toEqual({}); // editing itself
  expect(validateRate({ startingDate: 'x', currencyRatio: 0 }, rows, 'usd')).toMatchObject({ startingDate: expect.any(String), currencyRatio: expect.stringMatching(/greater than 0/) });
  expect(validateRate({ startingDate: '2026-09-30', currencyRatio: NaN }, rows, 'usd').currencyRatio).toMatch(/a number/);
});

it('card: title / description for search, previous rate = newest older day', () => {
  const rows = sortRatesNewestFirst([rate('a', '2026-09-27', 1.0), rate('c', '2026-09-29', 1.1), rate('b', '2026-09-28', 1.05)]);
  expect(rows.map((r) => r.rowGUID)).toEqual(['c', 'b', 'a']);
  const card = rateToCard(rows[0], 0, rows);
  expect(card).toMatchObject({ id: 'c', title: '2026-09-29 — 1.1', previousRatio: 1.05 });
  expect(card.description).toMatch(/29 Sept? 2026/);
  expect(rateToCard(rows[2], 2, rows).previousRatio).toBeUndefined();
  expect(ratioChangePercent(1.1, 1.0)).toBeCloseTo(10);
  expect(ratioChangePercent(1.1, undefined)).toBeNull();
  expect(formatRatio(1.084200)).toBe('1.0842');
});

describe('rate types (as D365 FO: Default and Budget)', () => {
  const typed = (id: string, day: string, ratio: number, rateType?: string, owner = 'usd') => ({
    rowGUID: id, rowOwnerGUID: owner, rowParentGUID: rateKeyOf(day, rateType), orderInList: orderInListForDate(day), rowJSON: { startingDate: day, currencyRatio: ratio, ...(rateType ? { rateType } : {}) },
  });

  it('the key of a rate: the day for a Default rate, "day|Type" for another type - one currency + day + type = one row', () => {
    expect(rateKeyOf('2026-01-01')).toBe('2026-01-01');
    expect(rateKeyOf('2026-01-01', 'Default')).toBe('2026-01-01');
    expect(rateKeyOf('2026-01-01', 'Budget')).toBe('2026-01-01|Budget');
    expect(rateKeyOf('2026-01-01', ' ')).toBe('2026-01-01');
  });
  it('the type of a row: a row without a type is a Default rate', () => {
    expect(rateTypeOf(rate('a', '2026-01-01', 1))).toBe('Default');
    expect(rateTypeOf(typed('b', '2026-01-01', 1, 'Budget'))).toBe('Budget');
    expect(rateTypeOf(null)).toBe('Default');
    expect(RATE_TYPES.map((t) => t.value)).toEqual(['Default', 'Budget']);
  });
  it('a Default and a Budget rate of the SAME day do not clash; two of the same type do', () => {
    const rows = [typed('a', '2026-01-01', 1.1), typed('b', '2026-01-01', 1.2, 'Budget')];
    expect(validateRate({ startingDate: '2026-01-01', currencyRatio: 1.3, rateType: 'Budget' }, rows, 'usd', 'new')).toMatchObject({ duplicateRowGUID: 'b' });
    expect(validateRate({ startingDate: '2026-01-01', currencyRatio: 1.3, rateType: 'Default' }, rows, 'usd', 'new')).toMatchObject({ duplicateRowGUID: 'a' });
    expect(validateRate({ startingDate: '2026-01-02', currencyRatio: 1.3, rateType: 'Budget' }, rows, 'usd', 'new')).toEqual({});
    expect(validateRate({ startingDate: '2026-01-01', currencyRatio: 1.3, rateType: 'Budget' }, [typed('a', '2026-01-01', 1.1)], 'usd', 'new')).toEqual({});
    expect(validateRate({ startingDate: '2026-01-01', currencyRatio: 1.3, rateType: 'Budget' }, rows, 'usd', 'b')).toEqual({}); // editing the row itself
    expect(validateRate({ startingDate: '2026-01-01', currencyRatio: 1.3, rateType: 'Budget' }, rows, 'usd', 'new').startingDate).toContain('Budget rate');
  });
  it('the card: the day is read from startingDate (the key may have a suffix), the previous rate is of the same type, the type is named', () => {
    const rows = [typed('a', '2026-01-01', 1.1), typed('b', '2026-02-01', 1.2), typed('c', '2026-01-15', 9, 'Budget'), typed('d', '2026-03-01', 9.9, 'Budget')];
    expect(rateToCard(rows[1], 0, rows).previousRatio).toBe(1.1);
    const budget = rateToCard(rows[3], 3, rows);
    expect(budget.previousRatio).toBe(9);
    expect(budget.title).toBe('2026-03-01 — 9.9');
    expect(budget.description).toMatch(/· Budget$/);
    expect(rateToCard(rows[1], 0, rows).description).not.toMatch(/Budget/);
  });
  it('sorting uses the day, not the key', () => {
    const rows = [typed('a', '2026-01-01', 1, 'Budget'), typed('b', '2026-02-01', 1)];
    expect(sortRatesNewestFirst(rows).map((r) => r.rowGUID)).toEqual(['b', 'a']);
  });
});
