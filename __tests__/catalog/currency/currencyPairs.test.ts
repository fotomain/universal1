// Currency pairs: BASE/CODE labels, the inverse ratio, the latest Default / Budget ratio of a currency, the columns of the currency table.
import { basePairRatios, formatRatio, inversePairLabel, inverseRatio, latestPairRatios, pairLabel } from '../../../kit8/catalog/currency/currencyPairs';
import { buildCurrencyTableColumns } from '../../../kit8/catalog/currency/currencyTableColumns';

const rate = (day: string, ratio: number, rateType?: string, rateBase?: string) => ({ rowParentGUID: rateType ? `${day}|${rateType}` : day, rowJSON: { startingDate: day, currencyRatio: ratio, ...(rateType ? { rateType } : {}), ...(rateBase ? { rateBase } : {}) } });

describe('pairs and ratios', () => {
  it('labels and the inverse', () => {
    expect(pairLabel('eur', 'usd')).toBe('EUR/USD');
    expect(inversePairLabel('EUR', 'USD')).toBe('USD/EUR');
    expect(pairLabel('EUR', '')).toBe('EUR/???');
    expect(inverseRatio(4)).toBe(0.25);
    expect(inverseRatio(0)).toBeUndefined();
    expect(inverseRatio(undefined)).toBeUndefined();
  });
  it('formatRatio: up to 6 decimals, no trailing zeros', () => {
    expect(formatRatio(1.0842)).toBe('1.0842');
    expect(formatRatio(157.3)).toBe('157.3');
    expect(formatRatio(2)).toBe('2');
    expect(formatRatio(1 / 1.0842)).toBe('0.922339');
    expect(formatRatio(undefined)).toBe('');
    expect(formatRatio(NaN)).toBe('');
  });
  it('latestPairRatios: the newest day of each rate type; another base and bad rows are skipped; the count is the larger of the rows and the total', () => {
    const rows = [rate('2026-10-01', 1.1), rate('2026-10-09', 1.08), rate('2026-10-05', 1.2, 'Budget'), rate('2026-10-10', 9, undefined, 'USD'), rate('2026-10-10', -1), rate('bad', 1)];
    expect(latestPairRatios(rows, 'EUR')).toEqual({ default: { ratio: 1.08, day: '2026-10-09' }, budget: { ratio: 1.2, day: '2026-10-05' }, count: 6 });
    expect(latestPairRatios(rows, 'EUR', 450).count).toBe(450);
    expect(latestPairRatios([], 'EUR')).toEqual({ default: undefined, budget: undefined, count: 0 });
    expect(basePairRatios().default?.ratio).toBe(1);
  });
});

describe('the currency table columns', () => {
  const ratios = { USD: { default: { ratio: 1.25, day: '2026-10-09' }, budget: { ratio: 1.2, day: '2026-10-01' }, count: 40 } } as any;
  const cols = buildCurrencyTableColumns({ base: 'EUR', ratiosOf: (code) => ratios[code] ?? { count: 0 }, textColor: '#000', linkColor: '#00f', onOpenRates: () => {} });
  const row = { rowGUID: 'u', rowJSON: { currencyCode: 'USD', currencyName: 'Dollar' } } as any;
  const col = (key: string) => cols.find((c) => c.key === key) as any;
  it('# · Pair first, then the currency, then every ratio', () => {
    expect(cols.map((c) => c.key)).toEqual(['n', 'pair', 'code', 'name', 'symbol', 'decimals', 'ratio', 'inverse', 'rateDate', 'budgetRatio', 'budgetInverse', 'budgetDate', 'rates', 'active']);
  });
  it('the ratios are searchable text', () => {
    expect(col('pair').searchText(row)).toBe('EUR/USD USD/EUR');
    expect(col('ratio').searchText(row)).toBe('1.25');
    expect(col('inverse').searchText(row)).toBe('0.8');
    expect(col('rateDate').searchText(row)).toBe('2026-10-09');
    expect(col('budgetRatio').searchText(row)).toBe('1.2');
    expect(col('rates').searchText(row)).toBe('40');
    expect(col('ratio').searchText({ rowGUID: 'x', rowJSON: { currencyCode: 'JPY' } })).toBe('');
  });
  it('only Active is editable', () => {
    expect(cols.filter((c) => c.editable !== false).map((c) => c.key)).toEqual(['n', 'active']);
  });
});
