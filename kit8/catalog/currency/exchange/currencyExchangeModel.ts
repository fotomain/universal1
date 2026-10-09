// Currency exchange rates - table + row shape + validation (pure, unit-tested in __tests__/catalog/currency/exchange).
//   SQL: public."currencyExchangeRateTable" (kit8/sql/init/create_currency_exchange_rate_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = currencyTable.rowGUID (the currency) ·
//   rowParentGUID = the KEY of the rate: the day 'YYYY-MM-DD' of a Default rate, 'YYYY-MM-DD|Budget' of a rate of another RATE TYPE
//   -> ONE rate per currency, day and rate type (unique index (rowOwnerGUID, rowParentGUID)) ·
//   orderInList = -dayNumber (ascending order = newest first) · rowJSON = { startingDate, currencyRatio, rateType? }
//   currencyRatio = units of the currency for 1 unit of the BASE currency (EUR); the base itself has no rows (ratio 1). A rate applies from
//   its startingDate until the next rate of the same currency and rate type (the latest startingDate <= the day). Conversion: ./currencyConvert.ts
//   Rate types (as D365 FO): Default = the daily rate (accounting), Budget = the planned rate of a budget. SQL: kit8/sql/init/update_currency_exchange_rate_types.sql

/** Supabase table name (SQL: currencyExchangeRateTable). */
export const currencyExchangeRateTable = 'currencyExchangeRateTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const CURRENCY_EXCHANGE_ENTITY = 'currencyExchangeRateReusable';

export const CURRENCY_EXCHANGE_ROUTES = { list: '/currency/exchange/list', edit: '/currency/exchange/edit' } as const;

/** readData / realtime payload of ONE currency's rates (match scopes the read, the realtime changes and the list). */
export const exchangeReadParams = (currencyGUID: string) => ({
  paginationSize: 1000,
  originationCurrentPage: 0,
  match: { rowOwnerGUID: currencyGUID },
});

/** the kinds of rate a currency has (D365 FO: exchange rate types); a rate without rateType is a Default one */
export const RATE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'Default', label: 'Default', hint: 'the daily rate: accounting' },
  { value: 'Budget', label: 'Budget', hint: 'the planned rate of a budget' },
];
export const DEFAULT_RATE_TYPE = 'Default';
export const BUDGET_RATE_TYPE = 'Budget';

export interface CurrencyExchangeRowJSON {
  /** the day the rate starts to apply, 'YYYY-MM-DD' (the first 10 characters of rowParentGUID) */
  startingDate: string;
  /** exchange ratio, > 0, e.g. 1.0842 = units of this currency for 1 unit of the base currency */
  currencyRatio: number;
  /** 'Default' (or missing) | 'Budget' | ... */
  rateType?: string;
}

/** the rate type of a rate row ('Default' when it has none) */
export const rateTypeOf = (row: any): string => {
  const t = row?.rowJSON?.rateType;
  return typeof t === 'string' && t.trim() !== '' ? t.trim() : DEFAULT_RATE_TYPE;
};
/** rowParentGUID of a rate: the day, plus '|<type>' for a type other than Default (so one currency + day + type = one row) */
export const rateKeyOf = (day: string, rateType?: string | null): string => {
  const t = (rateType ?? '').trim();
  return !t || t === DEFAULT_RATE_TYPE ? day : `${day}|${t}`;
};

export interface CurrencyExchangeRow {
  rowGUID: string;
  /** currencyTable.rowGUID */
  rowOwnerGUID: string;
  /** 'YYYY-MM-DD' */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: CurrencyExchangeRowJSON;
  created_at?: string;
  updated_at?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** today in the user's time zone, 'YYYY-MM-DD' */
export const todayISO = (d: Date = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' of a real calendar day (2026-02-30 is not). */
export function isValidISODate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** days since 1970-01-01 (UTC calendar, no DST effects) */
export const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** 'YYYY-MM-DD' + n days */
export function addDays(iso: string, n: number): string {
  const base = isValidISODate(iso) ? iso : todayISO();
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** orderInList of a rate: newer day = smaller number, so the reusable ascending order lists the newest first. */
export const orderInListForDate = (iso: string): number => -dayNumber(iso);

export const emptyRate = (): CurrencyExchangeRowJSON => ({ startingDate: todayISO(), currencyRatio: NaN, rateType: DEFAULT_RATE_TYPE });

/** '1,0842' / ' 1.0842 ' -> 1.0842 (comma accepted as the decimal separator) */
export const parseRatio = (v: any): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? NaN : Number(s);
};

/** Form values -> stored shape. */
export function normalizeRate(v: { startingDate?: any; currencyRatio?: any; rateType?: any }): CurrencyExchangeRowJSON {
  const type = String(v.rateType ?? '').trim();
  return { startingDate: String(v.startingDate ?? '').trim(), currencyRatio: parseRatio(v.currencyRatio), rateType: type || DEFAULT_RATE_TYPE };
}

export type CurrencyExchangeErrors = Partial<Record<keyof CurrencyExchangeRowJSON, string>> & { duplicateRowGUID?: string };

/**
 * Field errors ({} = valid). One rate per currency per day: another row of the same currency
 * (rowOwnerGUID) on the same day (rowParentGUID) -> startingDate error + duplicateRowGUID (to open it).
 */
export function validateRate(
  v: CurrencyExchangeRowJSON,
  rows: Pick<CurrencyExchangeRow, 'rowGUID' | 'rowOwnerGUID' | 'rowParentGUID'>[] = [],
  currencyGUID?: string | null,
  rowGUID?: string | null
): CurrencyExchangeErrors {
  const e: CurrencyExchangeErrors = {};
  if (!isValidISODate(v.startingDate)) e.startingDate = 'Date: YYYY-MM-DD, e.g. 2026-09-29.';
  else {
    // one rate per currency, day AND rate type
    const key = rateKeyOf(v.startingDate, v.rateType);
    const dup = rows.find((r) => r.rowGUID !== rowGUID && (!currencyGUID || r.rowOwnerGUID === currencyGUID) && r.rowParentGUID === key);
    if (dup) {
      e.startingDate = `A ${v.rateType && v.rateType !== DEFAULT_RATE_TYPE ? `${v.rateType} ` : ''}rate for ${v.startingDate} already exists (one per day and rate type).`;
      e.duplicateRowGUID = dup.rowGUID;
    }
  }
  if (!Number.isFinite(v.currencyRatio)) e.currencyRatio = 'Ratio: a number, e.g. 1.0842.';
  else if (v.currencyRatio <= 0) e.currencyRatio = 'Ratio must be greater than 0.';
  else if (v.currencyRatio >= 1e12) e.currencyRatio = 'Ratio is too large.';
  return e;
}

/** 1.084200 -> '1.0842', 150 -> '150', up to `maxDecimals` digits */
export function formatRatio(n: any, maxDecimals = 6): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: maxDecimals, minimumFractionDigits: 0 });
}

/** % change from the previous (older) rate, null when there is none */
export function ratioChangePercent(ratio: any, previousRatio: any): number | null {
  const a = Number(ratio);
  const b = Number(previousRatio);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return ((a - b) / b) * 100;
}

/** 'Tue, 29 Sep 2026' */
export function formatDay(iso: string): string {
  if (!isValidISODate(iso)) return iso || '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const dayOf = (row: any): string => row?.rowJSON?.startingDate || String(row?.rowParentGUID || '').slice(0, 10);

/** Newest first (the list order); rows without a valid day go last. */
export const sortRatesNewestFirst = <T>(rows: T[]): T[] => [...rows].sort((a: any, b: any) => (dayOf(b) > dayOf(a) ? 1 : dayOf(b) < dayOf(a) ? -1 : 0));

export type RateCardItem = {
  id: string;
  title: string;
  description: string;
  orderInList?: number;
  rawItem?: any;
  /** ratio of the previous (older) day that has a rate, for the ▲ / ▼ change */
  previousRatio?: number;
};

/**
 * Row -> card of ListWebCardsComponent (title / description drive its search).
 * `rows` = the whole (scoped) list: the previous rate is the newest row with an OLDER day.
 */
export function rateToCard(row: any, idx = 0, rows: any[] = []): RateCardItem {
  const j: Partial<CurrencyExchangeRowJSON> = row?.rowJSON || {};
  const day = dayOf(row);
  let previousRatio: number | undefined;
  let prevDay = '';
  const type = rateTypeOf(row);
  for (const r of rows) {
    const d = dayOf(r);
    if (rateTypeOf(r) === type && d && d < day && d > prevDay && Number.isFinite(Number(r?.rowJSON?.currencyRatio))) {
      prevDay = d;
      previousRatio = Number(r.rowJSON.currencyRatio);
    }
  }
  return {
    id: row?.rowGUID || `rate-${idx + 1}`,
    title: `${day} — ${formatRatio(j.currencyRatio)}`,
    description: type === DEFAULT_RATE_TYPE ? formatDay(day) : `${formatDay(day)} · ${type}`,
    orderInList: row?.orderInList,
    rawItem: row,
    previousRatio,
  };
}
