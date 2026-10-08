// Currency rates refresh - settings from .env (EXPO_PUBLIC_* are compiled into the app; none of them is a secret).
//   EXPO_PUBLIC_CURRENCY_RATES_API_URL   Frankfurter API v2-1 (no key)                       default https://api.frankfurter.dev/v2
//   EXPO_PUBLIC_CURRENCY_RATES_PROVIDERS optional: only these rate providers, e.g. ECB    default '' (all providers, blended)
//   EXPO_PUBLIC_CURRENCY_RATES_BASE      the base currency: a stored currencyRatio = units of the currency for 1 base   default EUR
//   EXPO_PUBLIC_CURRENCY_RATES_MONTHS    how many last months are filled in                 default 2
const env = (name: string, value: string | undefined, fallback: string) => {
  const v = (value ?? '').trim();
  return v === '' ? fallback : v;
};

export interface CurrencyRefreshConfig { apiUrl: string; base: string; months: number; providers?: string }

export function currencyRefreshConfig(): CurrencyRefreshConfig {
  // process.env.EXPO_PUBLIC_* must be written out in full: Expo replaces them at build time
  const months = Number(env('MONTHS', process.env.EXPO_PUBLIC_CURRENCY_RATES_MONTHS, '2'));
  return {
    apiUrl: env('API_URL', process.env.EXPO_PUBLIC_CURRENCY_RATES_API_URL, 'https://api.frankfurter.dev/v2').replace(/\/+$/, ''),
    providers: env('PROVIDERS', process.env.EXPO_PUBLIC_CURRENCY_RATES_PROVIDERS, '').toUpperCase(),
    base: env('BASE', process.env.EXPO_PUBLIC_CURRENCY_RATES_BASE, 'EUR').toUpperCase(),
    months: Number.isFinite(months) && months > 0 ? Math.min(24, Math.round(months)) : 2,
  };
}
