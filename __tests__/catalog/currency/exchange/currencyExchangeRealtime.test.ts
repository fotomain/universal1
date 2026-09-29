// Rates of ONE currency: readParams.match scopes the server read (.match) and the realtime changes.
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { reusableCrudSlice } from '../../../../kit8/redux/reusable/reusableCrudSlice';
import { reusableRootSaga, dbErrorMessage } from '../../../../kit8/redux/reusable/reusableRootSaga';
import { matchRow, scopeRealtimeChange } from '../../../../kit8/redux/reusable/realtimeRows';
import { exchangeReadParams } from '../../../../kit8/catalog/currency/exchange/currencyExchangeModel';

const T = 'currencyExchangeRateTable';
const rate = (id: string, owner: string, day: string) => ({ rowGUID: id, rowOwnerGUID: owner, rowParentGUID: day, orderInList: 0, rowJSON: { startingDate: day, currencyRatio: 1 } });

describe('scope helpers', () => {
  const m = { rowOwnerGUID: 'usd' };
  it('matchRow', () => {
    expect(matchRow(rate('a', 'usd', '2026-09-29'), m)).toBe(true);
    expect(matchRow(rate('a', 'gbp', '2026-09-29'), m)).toBe(false);
    expect(matchRow(null, m)).toBe(false);
    expect(matchRow({ any: 1 }, undefined)).toBe(true);
  });
  it('scopeRealtimeChange', () => {
    const ins = (o: string) => ({ eventType: 'INSERT' as const, table: T, new: rate('a', o, 'd'), old: null });
    expect(scopeRealtimeChange(ins('usd'), m)).toEqual(ins('usd'));
    expect(scopeRealtimeChange(ins('gbp'), m)).toBeNull();
    // moved to another currency -> removed from this list
    expect(scopeRealtimeChange({ eventType: 'UPDATE', table: T, new: rate('a', 'gbp', 'd'), old: rate('a', 'usd', 'd') }, m)).toMatchObject({ eventType: 'DELETE', old: { rowGUID: 'a' } });
    expect(scopeRealtimeChange({ eventType: 'DELETE', table: T, new: null, old: rate('a', 'gbp', 'd') }, m)).toBeNull();
    expect(scopeRealtimeChange({ eventType: 'DELETE', table: T, new: null, old: { rowGUID: 'a' } as any }, m)).not.toBeNull();
  });
  it('db errors -> user messages', () => {
    expect(dbErrorMessage({ code: '23505' })).toMatch(/duplicate/);
    expect(dbErrorMessage({ message: 'boom' })).toBe('boom');
  });
});

function fakeSupabase(rows: any[]) {
  const channels: any[] = [];
  const matches: any[] = [];
  const sb: any = {
    channels, matches,
    channel(name: string) {
      const ch: any = { name, handlers: [] as any[], statusCb: null as any };
      ch.on = (_e: string, cfg: any, cb: any) => ((ch.cfg = cfg), ch.handlers.push(cb), ch);
      ch.subscribe = (cb: any) => ((ch.statusCb = cb), ch);
      ch.emit = (p: any) => ch.handlers.forEach((h: any) => h(p));
      channels.push(ch);
      return ch;
    },
    removeChannel() {},
    from() {
      let match: any = null;
      const q: any = {
        select: () => q, order: () => q, or: () => q,
        match: (m: any) => ((match = m), matches.push(m), q),
        range: async () => ({ data: rows.filter((r) => !match || Object.entries(match).every(([k, v]) => r[k] === v)), error: null }),
      };
      return q;
    },
  };
  return sb;
}

it('saga: scoped read + only this currency\'s realtime changes reach the list', async () => {
  const slice = reusableCrudSlice('currencyExchangeRateReusable');
  const sb = fakeSupabase([rate('u1', 'usd', '2026-09-28'), rate('g1', 'gbp', '2026-09-28')]);
  const mw = createSagaMiddleware({ context: { dbAdapters: { supabaseAdapter: { supabase: sb } } } });
  const store = configureStore({ reducer: { r: slice.reducer, uxuiState: (s: any = {}) => s }, middleware: (g) => g({ serializableCheck: false }).concat(mw) });
  mw.run(reusableRootSaga({ tableName: T, entityKey: 'currencyExchangeRateReusable', itemLabel: 'Exchange rate', actions: slice.actions }));
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const ids = () => (store.getState() as any).r.entityDataFromServer.map((x: any) => x.rowGUID);

  store.dispatch(slice.actions.startRealtime({ readParams: exchangeReadParams('usd') }));
  await flush();
  const ch = sb.channels[0];
  ch.statusCb('SUBSCRIBED');
  await flush();
  expect(sb.matches).toContainEqual({ rowOwnerGUID: 'usd' });
  expect(ids()).toEqual(['u1']);

  ch.emit({ eventType: 'INSERT', table: T, new: rate('g2', 'gbp', '2026-09-29'), old: {} });
  ch.emit({ eventType: 'INSERT', table: T, new: rate('u2', 'usd', '2026-09-29'), old: {} });
  ch.emit({ eventType: 'DELETE', table: T, new: {}, old: rate('u1', 'usd', '2026-09-28') });
  await flush();
  expect(ids()).toEqual(['u2']);
});
