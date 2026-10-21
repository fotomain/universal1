// The GOLDEN CASES of the cost of an hour (documentation/TIME_SHEET_WBS.html section 14.2, point 7): ONE table of inputs and expected numbers, checked here against the TypeScript of the task lines
// (currencyConvert.ts, taskLineContractCost.ts, resourceRoleCatalogTools.ts) and by kit8/docker/tests/94_timesheet_cost.sql against the SQL functions (fx_pair_rate, fx_convert, fx_miss_text,
// contract_hour_price, role_hour_rate). The last test reads the Docker test and checks that it carries every case with the same expected value - a change of either side fails one of the two.
import * as fs from 'fs';
import * as path from 'path';
import { buildRateBook, convertWith, isMiss, pairRate, rateMissMessage } from '../../../kit8/catalog/currency/exchange/currencyConvert';
import { contractUnitPrice } from '../../../kit8/pm/view/task/finances/taskLineContractCost';
import { currentRate } from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';

const cur = (code: string, dec = 2) => ({ rowGUID: `g-${code}`, rowJSON: { currencyCode: code, decimalDigits: dec } });
const rate = (code: string, day: string, ratio: number, type = 'Default', base?: string) => ({ rowOwnerGUID: `g-${code}`, rowParentGUID: day, rowJSON: { startingDate: day, currencyRatio: ratio, rateType: type, ...(base ? { rateBase: base } : {}) } });
/** the rate rows of the golden book - the Docker test inserts the SAME rows (EUR is the base) */
export const GOLDEN_CURRENCIES = [cur('EUR'), cur('USD'), cur('GBP'), cur('ZZZ', 0), cur('YYY', 3), cur('XCH')];
export const GOLDEN_RATES = [
  rate('USD', '2030-01-01', 1.25), rate('GBP', '2030-01-01', 0.8), rate('GBP', '2030-01-10', 0.9), rate('ZZZ', '2030-01-01', 150), rate('YYY', '2030-01-01', 1.2345), rate('USD', '2030-01-01', 1.2, 'Budget'),
  // type Test: rows quoted against USD (re-based) and rows quoted against the base
  rate('EUR', '2030-01-02', 0.8, 'Test', 'USD'), rate('XCH', '2030-01-02', 0.9, 'Test', 'USD'), rate('XCH', '2030-01-08', 0.99, 'Test', 'USD'), rate('XCH', '2030-01-05', 1.5, 'Test'), rate('XCH', '2030-01-09', 1.1, 'Test'),
];
const book = buildRateBook(GOLDEN_CURRENCIES, GOLDEN_RATES, 'EUR');
const pair = (f: string, t: string, type: string, day: string): number | string => { const r = pairRate(book, f, t, type, day); return isMiss(r) ? rateMissMessage(r) : r.rate; };

/** id -> [what, expected]; the Docker test uses the same ids: `golden <id>` */
export const FX_GOLDEN: Record<string, [string, number | string]> = {
  fx1: ['EUR -> USD Default 2030-01-05', 1.25],
  fx2: ['USD -> EUR Default 2030-01-05', 0.8],
  fx3: ['USD -> GBP Default 2030-01-05 (the first GBP row)', 0.64],
  fx4: ['USD -> GBP Default 2030-01-12 (the later GBP row)', 0.72],
  fx5: ['USD -> EUR Budget 2030-01-05 (another rate type)', 0.8333333333333334],
  fx6: ['EUR -> XCH Budget: no Budget row of XCH', 'No Budget exchange rate of XCH on or before 2030-01-05'],
  fx7: ['EUR -> ZZZ Default 2029-12-31: before the first row', 'No Default exchange rate of ZZZ on or before 2029-12-31'],
  fx8: ['EUR -> QQQ: not in the catalog', 'Currency QQQ is not in the currency catalog'],
  fx9: ['USD -> USD: the same currency', 1],
  fx10: ['EUR -> XCH Test 2030-01-03: re-based (0.9 / 0.8)', 1.125],
  fx11: ['EUR -> XCH Test 2030-01-04: still the re-based row', 1.125],
  fx12: ['EUR -> XCH Test 2030-01-06: a row quoted against the base is newer', 1.5],
  fx13: ['EUR -> XCH Test 2030-01-08: the re-based row of that day is newer (0.99 / 0.8)', 1.2375],
  fx14: ['EUR -> XCH Test 2030-01-09: the native row of that day is newer', 1.1],
  fx15: ['EUR -> USD Test 2030-01-05: the other base itself (1 / 0.8)', 1.25],
  fx16: ['EUR -> XCH Test 2030-01-01: before any row of the type', 'No Test exchange rate of XCH on or before 2030-01-01'],
};
export const FX_CASES: Record<string, () => number | string> = {
  fx1: () => pair('EUR', 'USD', 'Default', '2030-01-05'), fx2: () => pair('USD', 'EUR', 'Default', '2030-01-05'), fx3: () => pair('USD', 'GBP', 'Default', '2030-01-05'), fx4: () => pair('USD', 'GBP', 'Default', '2030-01-12'),
  fx5: () => pair('USD', 'EUR', 'Budget', '2030-01-05'), fx6: () => pair('EUR', 'XCH', 'Budget', '2030-01-05'), fx7: () => pair('EUR', 'ZZZ', 'Default', '2029-12-31'), fx8: () => pair('EUR', 'QQQ', 'Default', '2030-01-05'),
  fx9: () => pair('USD', 'USD', 'Default', '2030-01-05'), fx10: () => pair('EUR', 'XCH', 'Test', '2030-01-03'), fx11: () => pair('EUR', 'XCH', 'Test', '2030-01-04'), fx12: () => pair('EUR', 'XCH', 'Test', '2030-01-06'),
  fx13: () => pair('EUR', 'XCH', 'Test', '2030-01-08'), fx14: () => pair('EUR', 'XCH', 'Test', '2030-01-09'), fx15: () => pair('EUR', 'USD', 'Test', '2030-01-05'), fx16: () => pair('EUR', 'XCH', 'Test', '2030-01-01'),
};
export const CONVERT_GOLDEN: Record<string, [string, number]> = {
  cv1: ['100 EUR -> ZZZ (0 decimals) at 150', 15000],
  cv2: ['33.33 EUR -> ZZZ: 4999.5 rounds to 5000', 5000],
  cv3: ['10 EUR -> YYY (3 decimals) at 1.2345', 12.345],
  cv4: ['261.92 EUR -> USD at 1.25', 327.4],
};
const conv = (amount: number, to: string, decimals: number) => convertWith(amount, pair('EUR', to, 'Default', '2030-01-05') as number, decimals);
export const CONVERT_CASES: Record<string, () => number> = { cv1: () => conv(100, 'ZZZ', 0), cv2: () => conv(33.33, 'ZZZ', 0), cv3: () => conv(10, 'YYY', 3), cv4: () => conv(261.92, 'USD', 2) };

const hour = (period: string, sum: number) => contractUnitPrice({ contractPaymentsPeriod: period, contractSumBeforeVAT: sum } as any, 'unit_hour');
export const CONTRACT_GOLDEN: Record<string, [string, number | null]> = {
  ct1: ['Month 5500 / 168', 32.74], ct2: ['Day 183 / 8 = 22.875', 22.88], ct3: ['Week 1000 / 40', 25], ct4: ['OneTime: no hourly price', null], ct5: ['Quarter 504 / 504', 1], ct6: ['Year 2016 / 2016', 1], ct7: ['a sum of 0: no price', null],
};
export const CONTRACT_CASES: Record<string, () => number | null> = {
  ct1: () => hour('Month', 5500), ct2: () => hour('Day', 183), ct3: () => hour('Week', 1000), ct4: () => hour('OneTime', 100), ct5: () => hour('Quarter', 504), ct6: () => hour('Year', 2016), ct7: () => hour('Month', 0),
};

const role: any = { rowGUID: 'rg1' };
const roleType: any = { rowJSON: { baseUnit: 'unit_hour' } };
const rp = (price: number, from: string, variant = 'empty', pt = 'pt_customerA', unit = 'unit_hour') => ({ rowOwnerGUID: 'rg1', rowParentGUID: variant, rowJSON: { priceTypeGUID: pt, price, validFrom: from, measureUnit: unit } });
/** the rows of role rg1 (the Docker test inserts the same rows for a test role); the first price list that fits roles is pt_customerA */
export const GOLDEN_ROLE_RATES: any[] = [rp(50, '2030-01-01'), rp(55, '2030-01-10'), rp(70, '2030-01-01', 'pv7'), rp(400, '2030-01-20', 'empty', 'pt_customerA', 'unit_day'), rp(99, '2030-01-01', 'empty', 'pt_bill')];
const roleRate = (rows: any[], day: string) => currentRate(rows, role, roleType, null, 'pt_customerA', day)?.rowJSON?.price ?? null;
export const ROLE_GOLDEN: Record<string, [string, number | null]> = {
  rr1: ['2030-01-05: the first row', 50], rr2: ['2030-01-12: the later row (variant rows and other price lists are not used)', 55], rr3: ['2029-12-31: before the first row', null],
  rr4: ['2030-01-25: the day row is not newer in the hour unit', 55], rr5: ['only a day row: the rate of any unit', 400],
};
export const ROLE_CASES: Record<string, () => number | null> = {
  rr1: () => roleRate(GOLDEN_ROLE_RATES, '2030-01-05'), rr2: () => roleRate(GOLDEN_ROLE_RATES, '2030-01-12'), rr3: () => roleRate(GOLDEN_ROLE_RATES, '2029-12-31'), rr4: () => roleRate(GOLDEN_ROLE_RATES, '2030-01-25'),
  rr5: () => roleRate([{ rowOwnerGUID: 'rg1', rowParentGUID: 'empty', rowJSON: { priceTypeGUID: 'pt_customerA', price: 400, validFrom: '2030-01-01', measureUnit: 'unit_day' } }], '2030-01-05'),
};

describe('the TypeScript gives the golden numbers', () => {
  // the TypeScript works in floating point, the SQL in numeric: equal to 12 digits (texts exactly)
  it.each(Object.keys(FX_GOLDEN))('exchange rate %s', (id) => {
    const got = FX_CASES[id](); const want = FX_GOLDEN[id][1];
    if (typeof want === 'number') expect(got as number).toBeCloseTo(want, 12); else expect(got).toBe(want);
  });
  it.each(Object.keys(CONVERT_GOLDEN))('convert %s', (id) => expect(CONVERT_CASES[id]()).toBe(CONVERT_GOLDEN[id][1]));
  it.each(Object.keys(CONTRACT_GOLDEN))('contract hour price %s', (id) => expect(CONTRACT_CASES[id]()).toBe(CONTRACT_GOLDEN[id][1]));
  it.each(Object.keys(ROLE_GOLDEN))('role rate %s', (id) => expect(ROLE_CASES[id]()).toBe(ROLE_GOLDEN[id][1]));
});

describe('the Docker test of the SQL carries every case with the same expected value', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/docker/tests/94_timesheet_cost.sql'), 'utf8');
  const all: [string, string, number | string | null][] = [
    ...Object.entries(FX_GOLDEN).map(([id, [, v]]) => [id, 'fx', v] as [string, string, number | string]),
    ...Object.entries(CONVERT_GOLDEN).map(([id, [, v]]) => [id, 'cv', v] as [string, string, number]),
    ...Object.entries(CONTRACT_GOLDEN).map(([id, [, v]]) => [id, 'ct', v] as [string, string, number | null]),
    ...Object.entries(ROLE_GOLDEN).map(([id, [, v]]) => [id, 'rr', v] as [string, string, number | null]),
  ];
  it.each(all.map(([id, , v]) => [id, v]))('golden %s', (id, v) => {
    // the SQL test writes:  -- golden <id> = <expected>
    const line = sql.split('\n').find((l) => l.includes(`-- golden ${id} =`));
    expect(line).toBeDefined();
    const expected = String(line!.split(`-- golden ${id} =`)[1]).trim();
    expect(expected).toBe(v === null ? 'NULL' : String(v));
  });
});
