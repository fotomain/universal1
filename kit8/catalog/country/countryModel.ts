// Country catalog - table + row shape + validation
//   SQL: public."countryTable" (kit8/sql/init/done/create_country_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = COUNTRY_CATALOG_OWNER (shared catalog) · rowParentGUID = 'empty' ·
//   orderInList · rowJSON = CountryRowJSON · created_at / updated_at

import type { CardItem } from '../../ui/components/list/web/lib/types';

/** Supabase table name (SQL: countryTable). */
export const countryTable = 'countryTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const COUNTRY_ENTITY = 'countryReusable';
/** rowOwnerGUID of every catalog row: the catalog is shared by all users. */
export const COUNTRY_CATALOG_OWNER = 'countryCatalog';

export const COUNTRY_ROUTES = {
  list: '/catalog/country',
  edit: '/catalog/country/edit',
} as const;

/** readData payload of the catalog (all rows; also the catch-up read after a realtime reconnect). */
export const COUNTRY_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface CountryRowJSON {
  /** Full country name, e.g. "Latvia" */
  countryName: string;
  /** ISO 3166-1 alpha-2 code, e.g. "LV" */
  countryCode: string;
  /** ISO 3166-1 alpha-3 code, e.g. "LVA" */
  countryCodeAlpha3?: string;
  /** ISO 3166-1 numeric code, e.g. "428" */
  countryNumericCode?: string;
  /** International phone calling code, e.g. "+371" */
  phonePrefix?: string;
  /** Default currency code, e.g. "EUR" */
  currencyCode?: string;
  /** Emoji flag, e.g. "🇱🇻" */
  flagEmoji?: string;
  /** Active in lists */
  isActive: boolean;
}

export interface CountryRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: CountryRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const emptyCountry = (): CountryRowJSON => ({
  countryName: '',
  countryCode: '',
  countryCodeAlpha3: '',
  countryNumericCode: '',
  phonePrefix: '',
  currencyCode: 'EUR',
  flagEmoji: '',
  isActive: true,
});

/** Seed list of default countries */
export const DEFAULT_COUNTRIES: Omit<CountryRowJSON, 'isActive'>[] = [
  { countryName: 'Latvia',         countryCode: 'LV', countryCodeAlpha3: 'LVA', countryNumericCode: '428', phonePrefix: '+371', currencyCode: 'EUR', flagEmoji: '🇱🇻' },
  { countryName: 'Estonia',        countryCode: 'EE', countryCodeAlpha3: 'EST', countryNumericCode: '233', phonePrefix: '+372', currencyCode: 'EUR', flagEmoji: '🇪🇪' },
  { countryName: 'Lithuania',      countryCode: 'LT', countryCodeAlpha3: 'LTU', countryNumericCode: '440', phonePrefix: '+370', currencyCode: 'EUR', flagEmoji: '🇱🇹' },
  { countryName: 'United States',  countryCode: 'US', countryCodeAlpha3: 'USA', countryNumericCode: '840', phonePrefix: '+1',   currencyCode: 'USD', flagEmoji: '🇺🇸' },
  { countryName: 'United Kingdom', countryCode: 'GB', countryCodeAlpha3: 'GBR', countryNumericCode: '826', phonePrefix: '+44',  currencyCode: 'GBP', flagEmoji: '🇬🇧' },
  { countryName: 'Germany',        countryCode: 'DE', countryCodeAlpha3: 'DEU', countryNumericCode: '276', phonePrefix: '+49',  currencyCode: 'EUR', flagEmoji: '🇩🇪' },
  { countryName: 'France',         countryCode: 'FR', countryCodeAlpha3: 'FRA', countryNumericCode: '250', phonePrefix: '+33',  currencyCode: 'EUR', flagEmoji: '🇫🇷' },
  { countryName: 'Spain',          countryCode: 'ES', countryCodeAlpha3: 'ESP', countryNumericCode: '724', phonePrefix: '+34',  currencyCode: 'EUR', flagEmoji: '🇪🇸' },
  { countryName: 'Italy',          countryCode: 'IT', countryCodeAlpha3: 'ITA', countryNumericCode: '380', phonePrefix: '+39',  currencyCode: 'EUR', flagEmoji: '🇮🇹' },
  { countryName: 'Poland',         countryCode: 'PL', countryCodeAlpha3: 'POL', countryNumericCode: '616', phonePrefix: '+48',  currencyCode: 'PLN', flagEmoji: '🇵🇱' },
  { countryName: 'Sweden',         countryCode: 'SE', countryCodeAlpha3: 'SWE', countryNumericCode: '752', phonePrefix: '+46',  currencyCode: 'SEK', flagEmoji: '🇸🇪' },
  { countryName: 'Norway',         countryCode: 'NO', countryCodeAlpha3: 'NOR', countryNumericCode: '578', phonePrefix: '+47',  currencyCode: 'NOK', flagEmoji: '🇳🇴' },
  { countryName: 'Finland',        countryCode: 'FI', countryCodeAlpha3: 'FIN', countryNumericCode: '246', phonePrefix: '+358', currencyCode: 'EUR', flagEmoji: '🇫🇮' },
  { countryName: 'Denmark',        countryCode: 'DK', countryCodeAlpha3: 'DNK', countryNumericCode: '208', phonePrefix: '+45',  currencyCode: 'DKK', flagEmoji: '🇩🇰' },
  { countryName: 'Switzerland',    countryCode: 'CH', countryCodeAlpha3: 'CHE', countryNumericCode: '756', phonePrefix: '+41',  currencyCode: 'CHF', flagEmoji: '🇨🇭' },
  { countryName: 'Canada',         countryCode: 'CA', countryCodeAlpha3: 'CAN', countryNumericCode: '124', phonePrefix: '+1',   currencyCode: 'CAD', flagEmoji: '🇨🇦' },
  { countryName: 'Japan',          countryCode: 'JP', countryCodeAlpha3: 'JPN', countryNumericCode: '392', phonePrefix: '+81',  currencyCode: 'JPY', flagEmoji: '🇯🇵' },
  { countryName: 'Australia',      countryCode: 'AU', countryCodeAlpha3: 'AUS', countryNumericCode: '036', phonePrefix: '+61',  currencyCode: 'AUD', flagEmoji: '🇦🇺' },
];

/** Normalizes country row values before persisting */
export function normalizeCountry(raw: Partial<CountryRowJSON>): CountryRowJSON {
  const code2 = (raw.countryCode || '').trim().toUpperCase();
  const code3 = (raw.countryCodeAlpha3 || '').trim().toUpperCase();
  const name = (raw.countryName || '').trim();
  const num = (raw.countryNumericCode || '').trim();
  const prefix = (raw.phonePrefix || '').trim();
  const curr = (raw.currencyCode || '').trim().toUpperCase();
  const flag = (raw.flagEmoji || '').trim();
  const isActive = raw.isActive !== false;

  return {
    countryName: name,
    countryCode: code2,
    ...(code3 ? { countryCodeAlpha3: code3 } : {}),
    ...(num ? { countryNumericCode: num } : {}),
    ...(prefix ? { phonePrefix: prefix.startsWith('+') ? prefix : `+${prefix}` } : {}),
    ...(curr ? { currencyCode: curr } : {}),
    ...(flag ? { flagEmoji: flag } : {}),
    isActive,
  };
}

export type CountryErrors = Partial<Record<keyof CountryRowJSON, string>>;

/** Validates country row */
export function validateCountry(raw: Partial<CountryRowJSON>): { valid: boolean; errors: CountryErrors } {
  const errors: CountryErrors = {};
  const name = (raw.countryName || '').trim();
  const code2 = (raw.countryCode || '').trim().toUpperCase();

  if (!name) {
    errors.countryName = 'Country name is required';
  } else if (name.length < 2) {
    errors.countryName = 'Country name must be at least 2 characters';
  }

  if (!code2) {
    errors.countryCode = '2-letter country code is required';
  } else if (!/^[A-Z]{2}$/.test(code2)) {
    errors.countryCode = 'Country code must be exactly 2 letters (e.g. LV, US)';
  }

  const code3 = raw.countryCodeAlpha3?.trim().toUpperCase();
  if (code3 && !/^[A-Z]{3}$/.test(code3)) {
    errors.countryCodeAlpha3 = 'Alpha-3 code must be 3 letters (e.g. LVA, USA)';
  }

  const curr = raw.currencyCode?.trim().toUpperCase();
  if (curr && !/^[A-Z]{3}$/.test(curr)) {
    errors.currencyCode = 'Currency code must be 3 letters (e.g. EUR)';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Maps a CountryRow to CardItem for ListWebCardsComponent */
export function countryToCard(row: CountryRow, index = 0): CardItem {
  const json = row.rowJSON || ({} as CountryRowJSON);
  const flag = json.flagEmoji ? `${json.flagEmoji} ` : '';
  const title = `${flag}${json.countryName || 'Untitled Country'} (${json.countryCode || '??'})`;

  const details = [
    json.countryCodeAlpha3 ? `Alpha-3: ${json.countryCodeAlpha3}` : null,
    json.phonePrefix ? `Phone: ${json.phonePrefix}` : null,
    json.currencyCode ? `Currency: ${json.currencyCode}` : null,
  ].filter(Boolean).join(' · ');

  return {
    id: row.rowGUID,
    title,
    description: details || 'No details',
    orderInList: row.orderInList ?? index,
    rawItem: row,
  };
}
