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
  expect(normalizeRate({ startingDate: ' 2026-09-29 ', currencyRatio: '0.85' })).toEqual({ startingDate: '2026-09-29', currencyRatio: 0.85 });
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
