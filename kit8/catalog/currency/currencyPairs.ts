// Currency pairs - what the currency table shows next to each currency (pure, unit-tested in __tests__/catalog/currency/currencyPairs.test.ts).
//   A rate row stores currencyRatio = units of the currency for 1 unit of the BASE currency (currencyExchangeModel.ts), so every currency is a PAIR
//   BASE/CODE ("EUR/USD" = 1 EUR is 1.0842 USD) with its ratio per rate type (Default, Budget) and the INVERSE ratio (1 USD in EUR).
//   The base currency itself has no rows: its pair is BASE/BASE and the ratio is 1.
import { BUDGET_RATE_TYPE, DEFAULT_RATE_TYPE, rateTypeOf } from './exchange/currencyExchangeModel';

/** the latest rate of one rate type */
export interface LatestRatio { ratio: number; day: string }

/** everything the table shows about the rates of one currency */
export interface PairRatios {
  /** latest Default rate (the daily one) */
  default?: LatestRatio;
  /** latest Budget rate */
  budget?: LatestRatio;
  /** how many rate rows the currency has (all types, all days) */
  count: number;
}

export const EMPTY_PAIR_RATIOS: PairRatios = { count: 0 };

/** "EUR/USD" */
export const pairLabel = (base: string, code: string): string => `${String(base || '').toUpperCase()}/${String(code || '').toUpperCase() || '???'}`;
/** "USD/EUR" - the same pair the other way round */
export const inversePairLabel = (base: string, code: string): string => pairLabel(code, base);

/** 1 / ratio (undefined when there is no usable ratio) */
export const inverseRatio = (ratio: number | undefined | null): number | undefined => (typeof ratio === 'number' && ratio > 0 && Number.isFinite(ratio) ? 1 / ratio : undefined);

/** a ratio as text: up to `digits` decimals, no trailing zeros ("1.0842", "157.3", "0.9223"); '' when there is none */
export function formatRatio(ratio: number | undefined | null, digits = 6): string {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '';
  const s = ratio.toFixed(digits);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/**
 * The latest ratios of one currency out of its newest rate rows (any order). A row quoted against another base (rowJSON.rateBase differs from
 * `base`) is not a ratio against the base: it is skipped. `total` is the number of rate rows of the currency on the server (the rows given may be
 * only the newest ones).
 */
export function latestPairRatios(rows: any[], base: string, total?: number): PairRatios {
  const baseCode = String(base || '').toUpperCase();
  const best = new Map<string, LatestRatio>();
  for (const r of rows || []) {
    const ratio = Number(r?.rowJSON?.currencyRatio);
    const day = String(r?.rowJSON?.startingDate || String(r?.rowParentGUID || '').slice(0, 10));
    const rowBase = String(r?.rowJSON?.rateBase || '').toUpperCase();
    if (!(ratio > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || (rowBase && rowBase !== baseCode)) continue;
    const type = rateTypeOf(r);
    const cur = best.get(type);
    if (!cur || day > cur.day) best.set(type, { ratio, day });
  }
  return { default: best.get(DEFAULT_RATE_TYPE), budget: best.get(BUDGET_RATE_TYPE), count: Math.max(total ?? 0, (rows || []).length) };
}

/** the base currency: ratio 1 on both types, no rate rows */
export const basePairRatios = (): PairRatios => ({ default: { ratio: 1, day: '' }, budget: { ratio: 1, day: '' }, count: 0 });
