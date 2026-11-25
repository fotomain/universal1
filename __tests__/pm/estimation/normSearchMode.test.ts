// The search of the norm books: Start (default) | Contains | Finished = the ilike pattern of the code / title.
import { DEFAULT_NORM_SEARCH_MODE, NORM_SEARCH_TIMEOUT_TEXT, NormSearchTimeoutError, normSearchPattern, searchNorms } from '../../../kit8/pm/estimation/ui/normBookApi';

test('the default mode is Start and each mode makes its own pattern', () => {
  expect(DEFAULT_NORM_SEARCH_MODE).toBe('start');
  expect(normSearchPattern('Разраб', 'start')).toBe('Разраб*');
  expect(normSearchPattern('Разраб', 'contains')).toBe('*Разраб*');
  expect(normSearchPattern('Разраб', 'finished')).toBe('*Разраб');
});

test('searchNorms sends the pattern of the mode to code and title', async () => {
  const calls: string[] = [];
  const chain: any = { select: () => chain, eq: () => chain, or: (s: string) => { calls.push(s); return chain; }, order: () => chain, limit: async () => ({ data: [], error: null }) };
  const client = { from: () => chain };
  await searchNorms(client, null, 'dig');
  await searchNorms(client, null, 'dig', 60, 'contains');
  await searchNorms(client, null, 'dig', 60, 'finished');
  expect(calls).toEqual([
    'rowJSON->>code.ilike.dig*,rowJSON->>title.ilike.dig*',
    'rowJSON->>code.ilike.*dig*,rowJSON->>title.ilike.*dig*',
    'rowJSON->>code.ilike.*dig,rowJSON->>title.ilike.*dig',
  ]);
});

const fakeClient = (result: { data?: any[]; error?: any }, calls: string[] = []) => {
  const chain: any = {
    select: () => chain, eq: () => chain, or: () => chain,
    order: () => { calls.push('order'); return chain; },
    limit: async (n: number) => { calls.push(`limit ${n}`); return { data: result.data ?? null, error: result.error ?? null }; },
  };
  return { from: () => chain };
};
const norm = (code: string) => ({ rowGUID: code, rowOwnerGUID: 'b', rowParentGUID: 'empty', orderInList: 0, rowJSON: { nodeKind: 'norm', code, title: code } });

test('the search has NO order by (an order made the database find EVERY match first = the statement timeout of "Разр"); the rows are sorted by code here', async () => {
  const calls: string[] = [];
  const rows = await searchNorms(fakeClient({ data: [norm('ФЕР10-2'), norm('ФЕР2-1'), norm('ФЕР10-1')] }, calls), null, 'Разр');
  expect(calls).toEqual(['limit 60']);
  expect(rows.map((r) => r.rowGUID)).toEqual(['ФЕР2-1', 'ФЕР10-1', 'ФЕР10-2']);
});

test('the statement timeout of the database becomes a message that tells what to do (never the raw words of the database)', async () => {
  const err = searchNorms(fakeClient({ error: { message: 'canceling statement due to statement timeout', code: '57014' } }), null, 'Разр');
  await expect(err).rejects.toBeInstanceOf(NormSearchTimeoutError);
  await expect(searchNorms(fakeClient({ error: { message: 'canceling statement due to statement timeout' } }), null, 'Разр')).rejects.toThrow(NORM_SEARCH_TIMEOUT_TEXT);
  await expect(searchNorms(fakeClient({ error: { message: 'permission denied' } }), null, 'Разр')).rejects.toThrow('permission denied');
});
