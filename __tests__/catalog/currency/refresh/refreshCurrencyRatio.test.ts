// refreshCurrencyRatio: last months from the Frankfurter API, only the days without a rate are added.
import { currencyRefreshMessage, missingRateRows, monthsBack, refreshCurrencyRatio } from '../../../../kit8/catalog/currency/refresh/refreshCurrencyRatio';
import { __clearFrankfurterCache, fetchRatesRange } from '../../../../kit8/catalog/currency/refresh/frankfurterApi';

const cfg = { apiUrl: 'https://api.test/v2', base: 'EUR', months: 2, providers: '' };
const cur = (g: string, code: string) => ({ rowGUID: g, rowJSON: { currencyCode: code } });
const byDay = { '2026-10-05': { USD: 1.0841239, GBP: 0.86 }, '2026-10-06': { USD: 1.09, GBP: 0.87 } };
// v2: a flat array, one row per day and quote
const answer = Object.entries(byDay).flatMap(([date, r]) => Object.entries(r).map(([quote, rate]) => ({ date, base: 'EUR', quote, rate })));
const currencies = ['USD', 'GBP', 'EUR'].map((iso_code) => ({ iso_code, name: iso_code }));
const makeFetch = () => jest.fn(async (url: string) => ({
  ok: true, status: 200,
  json: async () => (url.endsWith('/currencies') ? currencies : answer),
})) as any;
function makeSupabase(existing: any[] = []) {
  const upsert = jest.fn(async () => ({ error: null }));
  const q: any = { select: () => q, in: () => q, gte: () => q, lte: () => q, limit: async () => ({ data: existing, error: null }), upsert };
  return { client: { from: jest.fn(() => q) }, upsert };
}
beforeEach(() => __clearFrankfurterCache());

it('monthsBack keeps the day when the month has it', () => {
  expect(monthsBack('2026-10-07', 2)).toBe('2026-08-07');
  expect(monthsBack('2026-04-30', 2)).toBe('2026-02-28');
  expect(monthsBack('2026-01-15', 2)).toBe('2025-11-15');
});

it('missingRateRows: only (currency, day) pairs that are not stored; ratio rounded to 6 digits', () => {
  const rows = missingRateRows([cur('u', 'USD'), cur('g', 'GBP')], byDay, [{ rowOwnerGUID: 'u', rowParentGUID: '2026-10-06' }], 'EUR');
  expect(rows.map((r) => `${r.rowOwnerGUID} ${r.rowParentGUID} ${r.rowJSON.currencyRatio}`)).toEqual(['u 2026-10-05 1.084124', 'g 2026-10-05 0.86', 'g 2026-10-06 0.87']);
  expect(rows[0]).toMatchObject({ rowJSON: { startingDate: '2026-10-05', rateSource: 'frankfurter', rateBase: 'EUR' } });
  expect(rows[0].orderInList).toBeLessThan(0);
});

it('asks the 2 last months for the supported currencies and inserts the missing days only', async () => {
  const fetchFn = makeFetch();
  const sb = makeSupabase([{ rowOwnerGUID: 'u', rowParentGUID: '2026-10-05' }]);
  const r = await refreshCurrencyRatio({ currencies: [cur('u', 'USD'), cur('g', 'GBP'), cur('e', 'EUR'), cur('x', 'XYZ')], supabase: sb.client, today: '2026-10-07', config: cfg, fetchFn });
  expect(fetchFn.mock.calls[1][0]).toBe('https://api.test/v2/rates?base=EUR&quotes=GBP,USD&from=2026-08-07&to=2026-10-07');
  expect(sb.upsert).toHaveBeenCalledTimes(1);
  const [rows, opts] = sb.upsert.mock.calls[0] as any;
  expect(rows).toHaveLength(3);
  expect(opts).toEqual({ onConflict: 'rowOwnerGUID,rowParentGUID', ignoreDuplicates: true }); // existing rates are never changed
  expect(r).toMatchObject({ added: { USD: 1, GBP: 2 }, addedTotal: 3, unsupported: ['XYZ'], baseSkipped: true, upToDate: [] });
  expect(currencyRefreshMessage(r)).toContain('USD 1 d, GBP 2 d');
  expect(currencyRefreshMessage(r)).toContain('no rates published for: XYZ');
});

it('nothing missing -> no write; the answer of the day is cached (no second request)', async () => {
  const fetchFn = makeFetch();
  const all = [{ rowOwnerGUID: 'u', rowParentGUID: '2026-10-05' }, { rowOwnerGUID: 'u', rowParentGUID: '2026-10-06' }];
  const sb = makeSupabase(all);
  const args = { currencies: [cur('u', 'USD')], supabase: sb.client, today: '2026-10-07', config: cfg, fetchFn };
  const r = await refreshCurrencyRatio(args);
  expect(sb.upsert).not.toHaveBeenCalled();
  expect(r.upToDate).toEqual(['USD']);
  await refreshCurrencyRatio(args);
  expect(fetchFn).toHaveBeenCalledTimes(2); // /currencies + the range, once each
});

it('only the base currency -> no request for rates; service error is reported', async () => {
  const fetchFn = makeFetch();
  const r = await refreshCurrencyRatio({ currencies: [cur('e', 'EUR')], supabase: makeSupabase().client, today: '2026-10-07', config: cfg, fetchFn });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(currencyRefreshMessage(r)).toContain('base currency');
  // fetch resolves on HTTP errors: res.ok is checked, the service's message is shown
  await expect(fetchRatesRange({ ...cfg, symbols: ['USD'], from: 'a', to: 'b', fetchFn: (async () => ({ ok: false, status: 500, json: async () => { throw new Error('no body'); } })) as any })).rejects.toThrow('500');
  await expect(fetchRatesRange({ ...cfg, symbols: ['ABC'], from: 'a', to: 'c', fetchFn: (async () => ({ ok: false, status: 422, json: async () => ({ status: 422, message: 'invalid currency: ABC' }) })) as any })).rejects.toThrow('invalid currency: ABC');
  await expect(fetchRatesRange({ ...cfg, symbols: ['USD'], from: 'a', to: 'd', fetchFn: (async () => { throw new Error('offline'); }) as any })).rejects.toThrow('not reachable');
});

it('providers pin (e.g. ECB) is sent and stored with the rate', async () => {
  const fetchFn = makeFetch();
  const sb = makeSupabase();
  await refreshCurrencyRatio({ currencies: [cur('u', 'USD')], supabase: sb.client, today: '2026-10-07', config: { ...cfg, providers: 'ECB' }, fetchFn });
  expect(fetchFn.mock.calls[1][0]).toContain('&providers=ECB');
  expect((sb.upsert.mock.calls[0] as any)[0][0].rowJSON).toMatchObject({ rateSource: 'frankfurter', rateBase: 'EUR', rateProviders: 'ECB' });
});
