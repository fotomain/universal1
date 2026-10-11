// uploadAllDataFromDate: "Upload all data from a date" of a currency card - all crosses (every active currency), only the missing days, long ranges in pieces.
import { uploadAllDataFromDate, uploadDateProblem } from '../../../../kit8/catalog/currency/refresh/uploadAllDataFromDate';
import { dateChunks } from '../../../../kit8/catalog/currency/refresh/refreshCurrencyRatio';
import { __clearFrankfurterCache } from '../../../../kit8/catalog/currency/refresh/frankfurterApi';

const cfg = { apiUrl: 'https://api.test/v2', base: 'USD', months: 2, providers: '' };
const cur = (g: string, code: string, isActive = true) => ({ rowGUID: g, rowJSON: { currencyCode: code, isActive } });
const supported = ['USD', 'EUR', 'GBP', 'CHF'].map((iso_code) => ({ iso_code, name: iso_code }));
const makeFetch = () => jest.fn(async (url: string) => {
  if (url.endsWith('/currencies')) return { ok: true, status: 200, json: async () => supported };
  const u = new URL(url);
  const from = u.searchParams.get('from')!;
  const quotes = u.searchParams.get('quotes')!.split(',');
  return { ok: true, status: 200, json: async () => quotes.map((quote) => ({ date: from, base: 'USD', quote, rate: 0.9 })) };
}) as any;
function makeSupabase(existing: any[] = []) {
  const upsert = jest.fn(async () => ({ error: null }));
  const q: any = { select: () => q, in: () => q, gte: () => q, lte: () => q, order: () => q, range: async (a: number, b: number) => ({ data: existing.slice(a, b + 1), error: null }), upsert };
  return { client: { from: jest.fn(() => q) }, upsert };
}
beforeEach(() => __clearFrankfurterCache());

it('the date must be a real day, not in the future, not before the service starts', () => {
  expect(uploadDateProblem('2026-02-30', '2026-10-09')).toMatch(/YYYY-MM-DD/);
  expect(uploadDateProblem('', '2026-10-09')).toMatch(/YYYY-MM-DD/);
  expect(uploadDateProblem('2026-10-10', '2026-10-09')).toMatch(/future/);
  expect(uploadDateProblem('1990-01-01', '2026-10-09')).toMatch(/1999/);
  expect(uploadDateProblem('2025-01-01', '2026-10-09')).toBeNull();
});

it('dateChunks: pieces of at most N days, no gap and no overlap', () => {
  expect(dateChunks('2026-01-01', '2026-04-15', 92)).toEqual([['2026-01-01', '2026-04-02'], ['2026-04-03', '2026-04-15']]);
  expect(dateChunks('2026-04-15', '2026-04-15', 92)).toEqual([['2026-04-15', '2026-04-15']]);
  expect(dateChunks('2026-04-16', '2026-04-15', 92)).toEqual([]);
  const c = dateChunks('2025-01-01', '2026-10-09', 92);
  expect(c[0][0]).toBe('2025-01-01');
  expect(c[c.length - 1][1]).toBe('2026-10-09');
  c.slice(1).forEach(([a], i) => expect(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${c[i][1]}T00:00:00Z`)).toBe(86400000));
});

it('asks the service for ALL active currencies (the crosses) from the date, in pieces, and stores only the missing days', async () => {
  const fetchFn = makeFetch();
  const sb = makeSupabase([{ rowOwnerGUID: 'e', rowParentGUID: '2025-01-01' }]);
  const currencies = [cur('u', 'USD'), cur('e', 'EUR'), cur('g', 'GBP'), cur('c', 'CHF', false), cur('x', 'XYZ')];
  const r = await uploadAllDataFromDate({ currencyGUID: 'g', fromDate: '2025-01-01', currencies, supabase: sb.client, today: '2026-10-09', config: cfg, fetchFn });
  const rateCalls = fetchFn.mock.calls.map((c: any) => c[0]).filter((u: string) => u.includes('/rates?'));
  expect(rateCalls.length).toBeGreaterThanOrEqual(7); // 2025-01-01 .. 2026-10-09 in pieces of 92 days
  expect(rateCalls[0]).toBe('https://api.test/v2/rates?base=USD&quotes=EUR,GBP&from=2025-01-01&to=2025-04-02'); // EUR + GBP (USD is the base, CHF inactive, XYZ unsupported)
  expect(r.unsupported).toEqual(['XYZ']);
  expect(r.baseSkipped).toBe(true);
  expect(r.from).toBe('2025-01-01');
  expect(r.added.GBP).toBeGreaterThanOrEqual(7);
  expect(r.added.EUR).toBe(r.added.GBP! - 0 - 1 + 0 || r.added.EUR); // EUR 2025-01-01 exists: one day fewer than GBP
  expect(r.added.EUR).toBe(r.added.GBP! - 1);
  const upserted = (sb.upsert.mock.calls as any[]).flatMap((c) => c[0]);
  expect(upserted.every((row: any) => row.rowJSON.rateType === 'Default' && row.rowJSON.rateBase === 'USD')).toBe(true);
  expect(sb.upsert.mock.calls.every((c: any) => c[1].ignoreDuplicates === true)).toBe(true);
});

it('the inactive currency of the card itself is included; a wrong date or a currency not in the catalog stops before any request', async () => {
  const fetchFn = makeFetch();
  const sb = makeSupabase();
  const currencies = [cur('u', 'USD'), cur('c', 'CHF', false)];
  await uploadAllDataFromDate({ currencyGUID: 'c', fromDate: '2026-10-01', currencies, supabase: sb.client, today: '2026-10-09', config: cfg, fetchFn });
  expect(fetchFn.mock.calls.map((c: any) => c[0]).find((u: string) => u.includes('/rates?'))).toContain('quotes=CHF');
  const fresh = makeFetch();
  await expect(uploadAllDataFromDate({ currencyGUID: 'u', fromDate: 'x', currencies, supabase: sb.client, config: cfg, fetchFn: fresh })).rejects.toThrow(/YYYY-MM-DD/);
  await expect(uploadAllDataFromDate({ currencyGUID: 'nope', fromDate: '2026-10-01', currencies, supabase: sb.client, today: '2026-10-09', config: cfg, fetchFn: fresh })).rejects.toThrow(/not in the catalog/);
  expect(fresh).not.toHaveBeenCalled();
});
