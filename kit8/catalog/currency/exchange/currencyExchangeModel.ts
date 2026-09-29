// Currency exchange rates - table + row shape + validation (pure, unit-tested in __tests__/catalog/currency/exchange).
//   SQL: public."currencyExchangeRateTable" (kit8/sql/init/create_currency_exchange_rate_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = currencyTable.rowGUID (the currency) ·
//   rowParentGUID = the day 'YYYY-MM-DD' entered by the user -> ONE rate per currency per day (unique index) ·
//   orderInList = -dayNumber (ascending order = newest first) · rowJSON = { startingDate, currencyRatio }

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

export interface CurrencyExchangeRowJSON {
  /** the day the rate starts to apply, 'YYYY-MM-DD' (= rowParentGUID) */
  startingDate: string;
  /** exchange ratio, > 0, e.g. 1.0842 */
  currencyRatio: number;
}

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

export const emptyRate = (): CurrencyExchangeRowJSON => ({ startingDate: todayISO(), currencyRatio: NaN });

/** '1,0842' / ' 1.0842 ' -> 1.0842 (comma accepted as the decimal separator) */
export const parseRatio = (v: any): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? NaN : Number(s);
};

/** Form values -> stored shape. */
export function normalizeRate(v: { startingDate?: any; currencyRatio?: any }): CurrencyExchangeRowJSON {
  return { startingDate: String(v.startingDate ?? '').trim(), currencyRatio: parseRatio(v.currencyRatio) };
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
    const dup = rows.find((r) => r.rowGUID !== rowGUID && (!currencyGUID || r.rowOwnerGUID === currencyGUID) && r.rowParentGUID === v.startingDate);
    if (dup) {
      e.startingDate = `A rate for ${v.startingDate} already exists (one per day).`;
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

const dayOf = (row: any): string => row?.rowJSON?.startingDate || row?.rowParentGUID || '';

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
  for (const r of rows) {
    const d = dayOf(r);
    if (d && d < day && d > prevDay && Number.isFinite(Number(r?.rowJSON?.currencyRatio))) {
      prevDay = d;
      previousRatio = Number(r.rowJSON.currencyRatio);
    }
  }
  return {
    id: row?.rowGUID || `rate-${idx + 1}`,
    title: `${day} — ${formatRatio(j.currencyRatio)}`,
    description: formatDay(day),
    orderInList: row?.orderInList,
    rawItem: row,
    previousRatio,
  };
}
