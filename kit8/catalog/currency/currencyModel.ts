// Currency catalog - table + row shape + validation (pure, unit-tested in __tests__/catalog/currency).
//   SQL: public."currencyTable" (kit8/sql/init/create_currency_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = CURRENCY_CATALOG_OWNER (shared catalog) · rowParentGUID = 'empty' ·
//   orderInList · rowJSON = CurrencyRowJSON · created_at / updated_at

/** Supabase table name (SQL: currencyTable). */
export const currenciesTable = 'currencyTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const CURRENCY_ENTITY = 'currencyReusable';
/** rowOwnerGUID of every catalog row: the catalog is shared by all users. */
export const CURRENCY_CATALOG_OWNER = 'currencyCatalog';

export const CURRENCY_ROUTES = { list: '/currency/list', edit: '/currency/edit' } as const;

/** readData payload of the catalog (all rows; also the catch-up read after a realtime reconnect). */
export const CURRENCY_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface CurrencyRowJSON {
  /** ISO 4217 alphabetic code, e.g. "EUR" */
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  /** ISO 4217 numeric code, e.g. "978" (optional) */
  currencyNumericCode?: string;
  /** digits after the decimal point (0..4), e.g. 2 */
  decimalDigits: number;
  isActive: boolean;
}

export interface CurrencyRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: CurrencyRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const currencyExample: CurrencyRowJSON = {
  currencyCode: 'EUR',
  currencyName: 'Euro',
  currencySymbol: '€',
  currencyNumericCode: '978',
  decimalDigits: 2,
  isActive: true,
};

export const emptyCurrency = (): CurrencyRowJSON => ({
  currencyCode: '',
  currencyName: '',
  currencySymbol: '',
  currencyNumericCode: '',
  decimalDigits: 2,
  isActive: true,
});

/** Form values -> stored shape (trimmed, code upper-case, decimals as a number). */
export function normalizeCurrency(v: Partial<CurrencyRowJSON>): CurrencyRowJSON {
  const d = Number(v.decimalDigits);
  return {
    currencyCode: String(v.currencyCode ?? '').trim().toUpperCase(),
    currencyName: String(v.currencyName ?? '').trim(),
    currencySymbol: String(v.currencySymbol ?? '').trim(),
    currencyNumericCode: String(v.currencyNumericCode ?? '').trim(),
    decimalDigits: Number.isFinite(d) ? Math.round(d) : NaN,
    isActive: v.isActive !== false,
  };
}

export type CurrencyErrors = Partial<Record<keyof CurrencyRowJSON, string>>;

/** Field errors ({} = valid). The code must be unique in the catalog (other rows than `rowGUID`). */
export function validateCurrency(v: CurrencyRowJSON, rows: Pick<CurrencyRow, 'rowGUID' | 'rowJSON'>[] = [], rowGUID?: string | null): CurrencyErrors {
  const e: CurrencyErrors = {};
  if (!/^[A-Z]{3}$/.test(v.currencyCode)) e.currencyCode = 'Code: 3 letters (ISO 4217), e.g. EUR.';
  else if (rows.some((r) => r.rowGUID !== rowGUID && String(r.rowJSON?.currencyCode || '').toUpperCase() === v.currencyCode))
    e.currencyCode = `${v.currencyCode} is already in the catalog.`;
  if (!v.currencyName) e.currencyName = 'Name is required.';
  else if (v.currencyName.length > 60) e.currencyName = 'Name: at most 60 characters.';
  if (v.currencySymbol.length > 5) e.currencySymbol = 'Symbol: at most 5 characters.';
  if (v.currencyNumericCode && !/^\d{3}$/.test(v.currencyNumericCode)) e.currencyNumericCode = 'Numeric code: 3 digits, e.g. 978.';
  if (!Number.isInteger(v.decimalDigits) || v.decimalDigits < 0 || v.decimalDigits > 4) e.decimalDigits = 'Decimals: 0 to 4.';
  return e;
}

/** Row -> card of ListWebCardsComponent (title / description drive its search). */
export function currencyToCard(row: any, idx = 0) {
  const j: Partial<CurrencyRowJSON> = row?.rowJSON || {};
  const code = j.currencyCode || '???';
  return {
    id: row?.rowGUID || `currency-${idx + 1}`,
    title: `${code} — ${j.currencyName || ''}`.trim(),
    description: [j.currencySymbol, `${j.decimalDigits ?? 2} decimals`, j.currencyNumericCode, j.isActive === false ? 'inactive' : '']
      .filter(Boolean)
      .join(' · '),
    orderInList: row?.orderInList,
    rawItem: row,
  };
}
