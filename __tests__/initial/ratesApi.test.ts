// The algorithm of the rate of 31 December and the writes of the rates window, with a fake Supabase and a fake rates service.
import { __clearFrankfurterCache } from '../../kit8/catalog/currency/refresh/frankfurterApi';
import { fillRatesOfDay, importRates, ratesInForceNow } from '../../kit8/initial/data/code/rates/ratesApi';

const cfg = { apiUrl: 'https://rates.test/v2', base: 'EUR', months: 2, providers: '' };
const cur = (code: string) => ({ rowGUID: `g-${code}`, rowJSON: { currencyCode: code } });

/** a Supabase that answers the three kinds of call of ratesApi */
function fakeSupabase(stored: { rowOwnerGUID: string; rowParentGUID: string }[] = []) {
  const upserts: { rows: any[]; opts: any }[] = [];
  const from = () => {
    const q: any = {};
    const b: any = {
      select: () => b,
      eq: (_c: string, v: string) => { q.owner = v; return b; },
      lte: (_c: string, v: string) => { q.lte = v; return b; },
      not: () => b,
      limit: () => Promise.resolve({ data: stored.filter((r) => r.rowOwnerGUID === q.owner && r.rowParentGUID <= q.lte && !r.rowParentGUID.includes('|')), error: null }),
      upsert: (rows: any[], opts: any) => {
        upserts.push({ rows, opts });
        const result = Promise.resolve({ data: rows.map((_, i) => ({ rowGUID: String(i) })), error: null });
        return Object.assign(result, { select: () => result });
      },
    };
    return b;
  };
  return { from, upserts };
}

/** the rates service: the days it publishes per currency */
function fakeFetch(published: Record<string, Record<string, number>>, supported = ['USD', 'GBP', 'CHF']) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    if (url.endsWith('/currencies')) return { ok: true, json: async () => supported.map((iso_code) => ({ iso_code, name: iso_code })) };
    const rows: any[] = [];
    for (const [day, quotes] of Object.entries(published)) for (const [quote, rate] of Object.entries(quotes)) if (url.includes(quote)) rows.push({ date: day, base: 'EUR', quote, rate });
    return { ok: true, json: async () => rows };
  }) as unknown as typeof fetch;
  return { fn, urls };
}

beforeEach(() => __clearFrankfurterCache());

describe('fillRatesOfDay - the rate in force on 31 December of the previous year', () => {
  it('the service publishes working days only: the last published day on or before the wanted one is stored AS the wanted day', async () => {
    const sb = fakeSupabase();
    const svc = fakeFetch({ '2025-12-29': { USD: 1.17, GBP: 0.86 }, '2025-12-30': { USD: 1.18, GBP: 0.87 } });
    const r = await fillRatesOfDay({ supabase: sb, currencies: [cur('EUR'), cur('USD'), cur('GBP')], day: '2025-12-31', config: cfg, fetchFn: svc.fn });
    expect(r.added).toEqual({ USD: '2025-12-30', GBP: '2025-12-30' });
    expect(sb.upserts.length).toBe(1);
    expect(sb.upserts[0].opts).toMatchObject({ onConflict: 'rowOwnerGUID,rowParentGUID', ignoreDuplicates: true });
    const row = sb.upserts[0].rows.find((x) => x.rowOwnerGUID === 'g-USD');
    expect(row.rowParentGUID).toBe('2025-12-31');
    expect(row.rowJSON).toMatchObject({ startingDate: '2025-12-31', currencyRatio: 1.18, rateType: 'Default', rateSource: 'frankfurter', rateBase: 'EUR', rateFromDay: '2025-12-30' });
    // the request looks 10 days back from the wanted day
    expect(svc.urls.find((u) => u.includes('/rates?'))).toContain('from=2025-12-21&to=2025-12-31');
  });
  it('a currency that has a rate in force already is not touched and not asked for', async () => {
    const sb = fakeSupabase([{ rowOwnerGUID: 'g-USD', rowParentGUID: '2025-12-15' }]);
    const svc = fakeFetch({ '2025-12-30': { USD: 1.18, GBP: 0.87 } });
    const r = await fillRatesOfDay({ supabase: sb, currencies: [cur('EUR'), cur('USD'), cur('GBP')], day: '2025-12-31', config: cfg, fetchFn: svc.fn });
    expect(r.upToDate).toEqual(['USD']);
    expect(Object.keys(r.added)).toEqual(['GBP']);
    expect(svc.urls.find((u) => u.includes('/rates?'))).not.toContain('USD');
  });
  it('everything is in force: the service is not called at all', async () => {
    const sb = fakeSupabase([{ rowOwnerGUID: 'g-USD', rowParentGUID: '2025-12-31' }, { rowOwnerGUID: 'g-GBP', rowParentGUID: '2025-12-31' }]);
    const svc = fakeFetch({});
    const r = await fillRatesOfDay({ supabase: sb, currencies: [cur('EUR'), cur('USD'), cur('GBP')], day: '2025-12-31', config: cfg, fetchFn: svc.fn });
    expect(r.added).toEqual({});
    expect(svc.urls).toEqual([]);
    expect(sb.upserts).toEqual([]);
  });
  it('a currency the service does not publish, and one with no day in the ten days before', async () => {
    const sb = fakeSupabase();
    const svc = fakeFetch({ '2025-12-30': { USD: 1.18 } }, ['USD', 'GBP']);
    const r = await fillRatesOfDay({ supabase: sb, currencies: [cur('EUR'), cur('USD'), cur('GBP'), cur('ZZZ')], day: '2025-12-31', config: cfg, fetchFn: svc.fn });
    expect(r.unsupported).toEqual(['ZZZ']);
    expect(r.noRate).toEqual(['GBP']);
    expect(Object.keys(r.added)).toEqual(['USD']);
  });
  it('a rate AFTER the wanted day is never used', async () => {
    const sb = fakeSupabase();
    const svc = fakeFetch({ '2026-01-02': { USD: 1.3 } });
    const r = await fillRatesOfDay({ supabase: sb, currencies: [cur('EUR'), cur('USD')], day: '2025-12-31', config: cfg, fetchFn: svc.fn });
    expect(r.noRate).toEqual(['USD']);
    expect(sb.upserts).toEqual([]);
  });
});

describe('ratesInForceNow - the check at the start', () => {
  it('true when USD and GBP have a rate on or before 31 December of the previous year', async () => {
    const stored = [{ rowOwnerGUID: 'g-USD', rowParentGUID: '2025-12-30' }, { rowOwnerGUID: 'g-GBP', rowParentGUID: '2025-12-31' }];
    expect(await ratesInForceNow(fakeSupabase(stored), [cur('EUR'), cur('USD'), cur('GBP')], '2026-11-26', cfg)).toBe(true);
    expect(await ratesInForceNow(fakeSupabase(stored.slice(0, 1)), [cur('EUR'), cur('USD'), cur('GBP')], '2026-11-26', cfg)).toBe(false);
    expect(await ratesInForceNow(fakeSupabase(), [], '2026-11-26', cfg)).toBe(false);
  });
});

describe('importRates', () => {
  const rates = [{ currencyGUID: 'g-USD', currencyCode: 'USD', day: '2026-01-02', ratio: 1.08, rateType: 'Default', line: 2 }];
  it('keeps what exists unless asked to replace', async () => {
    const sb = fakeSupabase();
    await importRates({ supabase: sb, rates, base: 'EUR' });
    expect(sb.upserts[0].opts.ignoreDuplicates).toBe(true);
    await importRates({ supabase: sb, rates, base: 'EUR', overwrite: true });
    expect(sb.upserts[1].opts.ignoreDuplicates).toBe(false);
    expect(sb.upserts[1].rows[0]).toMatchObject({ rowOwnerGUID: 'g-USD', rowParentGUID: '2026-01-02' });
  });
  it('reports written and skipped', async () => {
    const sb: any = { from: () => ({ upsert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) };
    expect(await importRates({ supabase: sb, rates, base: 'EUR' })).toEqual({ written: 0, skipped: 1 });
  });
});
