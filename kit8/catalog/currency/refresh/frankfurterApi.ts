// Frankfurter API v2 (https://frankfurter.dev/javascript/): exchange rates as JSON. No SDK, no key, CORS open -
// plain fetch works in the browser and in React Native.
//   GET {api}/rates?base=EUR&quotes=USD,GBP&from=2026-08-07&to=2026-10-07[&providers=ECB]
//       -> a flat array, one row per day and quote: [{ date, base, quote, rate }, ...]
//   GET {api}/currencies -> [{ iso_code, iso_numeric, name, symbol, start_date, end_date }, ...]
// fetch resolves on HTTP errors, so res.ok is checked; an invalid currency code answers 422 with { status, message }.
// No quotas, but the service is rate-limited against abuse: an answer is kept in memory, so repeated refreshes
// of the same range on the same day do not call it again.

/** day -> { CODE: units of CODE for 1 base } */
export type RatesByDay = Record<string, Record<string, number>>;
export interface FrankfurterCurrency { iso_code: string; iso_numeric?: string; name?: string; symbol?: string; start_date?: string; end_date?: string }

const cache = new Map<string, any>();
export const __clearFrankfurterCache = () => cache.clear();

/** GET + JSON; the service's own message for 4xx answers ("invalid currency: ABC") */
async function getJSON(url: string, fetchFn: typeof fetch): Promise<any> {
  const hit = cache.get(url);
  if (hit !== undefined) return hit;
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { Accept: 'application/json' } });
  } catch (e: any) {
    throw new Error(`Rates service is not reachable (${e?.message || e})`);
  }
  if (!res.ok) {
    let message = '';
    try { message = String((await res.json())?.message || ''); } catch { /* no JSON body */ }
    throw new Error(message ? `Rates service: ${message}` : `Rates service answered ${res.status}`);
  }
  const json = await res.json();
  cache.set(url, json);
  return json;
}

const isCode = (s: string) => /^[A-Z]{3,5}$/.test(s);

/** rates of the quotes for every published day of from..to (providers: '' = all, or e.g. 'ECB') */
export async function fetchRatesRange(args: { apiUrl: string; base: string; symbols: string[]; from: string; to: string; providers?: string; fetchFn?: typeof fetch }): Promise<RatesByDay> {
  const { apiUrl, base, from, to } = args;
  const quotes = [...new Set(args.symbols.map((s) => s.toUpperCase()))].filter((s) => isCode(s) && s !== base).sort();
  if (quotes.length === 0) return {};
  const query = [`base=${encodeURIComponent(base)}`, `quotes=${quotes.join(',')}`, `from=${from}`, `to=${to}`];
  if (args.providers) query.push(`providers=${encodeURIComponent(args.providers)}`);
  const rows = await getJSON(`${apiUrl}/rates?${query.join('&')}`, args.fetchFn ?? fetch);
  const out: RatesByDay = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = String(r?.date || '');
    const rate = Number(r?.rate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !r?.quote || !Number.isFinite(rate) || rate <= 0) continue;
    (out[day] = out[day] || {})[String(r.quote).toUpperCase()] = rate;
  }
  return out;
}

/** the currencies the service has rates for: { USD: 'United States Dollar', ... } */
export async function fetchSupportedCurrencies(apiUrl: string, fetchFn: typeof fetch = fetch): Promise<Record<string, string>> {
  const list = await getJSON(`${apiUrl}/currencies`, fetchFn);
  const out: Record<string, string> = {};
  for (const c of Array.isArray(list) ? (list as FrankfurterCurrency[]) : []) if (c?.iso_code) out[String(c.iso_code).toUpperCase()] = c.name || '';
  return out;
}
