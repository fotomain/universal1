// kit8/redux/reusable: Supabase Realtime -> redux-saga eventChannel -> reusableCrudSlice (any browser's changes).
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { reusableCrudSlice } from '../../kit8/redux/reusable/reusableCrudSlice';
import { reusableRootSaga } from '../../kit8/redux/reusable/reusableRootSaga';
import { applyRealtimeChangeToList, removeRow, upsertRow } from '../../kit8/redux/reusable/realtimeRows';
import { toRealtimeRowChange } from '../../kit8/redux/reusable/createSupabaseTableChannel';

const row = (id: string, order: number, name = id) => ({ rowGUID: id, orderInList: order, rowJSON: { name } });

describe('realtimeRows', () => {
  it('upsert keeps orderInList order and replaces by rowGUID; remove by id', () => {
    let list: any[] = [row('a', 1), row('c', 3)];
    list = upsertRow(list, row('b', 2));
    expect(list.map((r) => r.rowGUID)).toEqual(['a', 'b', 'c']);
    list = upsertRow(list, row('a', 4, 'A2'));
    expect(list.map((r) => r.rowGUID)).toEqual(['b', 'c', 'a']);
    expect(list[2].rowJSON.name).toBe('A2');
    expect(removeRow(list, 'c').map((r) => r.rowGUID)).toEqual(['b', 'a']);
    expect(upsertRow(undefined, row('x', 1))).toHaveLength(1);
  });

  it('INSERT / UPDATE upsert, DELETE removes old.rowGUID', () => {
    const list = [row('a', 1)];
    expect(applyRealtimeChangeToList(list, { eventType: 'INSERT', table: 't', new: row('b', 2), old: null })).toHaveLength(2);
    expect(applyRealtimeChangeToList(list, { eventType: 'UPDATE', table: 't', new: row('a', 1, 'z'), old: { rowGUID: 'a' } })[0].rowJSON.name).toBe('z');
    expect(applyRealtimeChangeToList(list, { eventType: 'DELETE', table: 't', new: null, old: { rowGUID: 'a' } })).toEqual([]);
  });

  it('toRealtimeRowChange keeps the serializable part of a supabase payload', () => {
    expect(toRealtimeRowChange({ eventType: 'DELETE', table: 't', new: {}, old: { rowGUID: 'a' }, commit_timestamp: 'x', errors: null }))
      .toEqual({ eventType: 'DELETE', table: 't', new: null, old: { rowGUID: 'a' }, commitTimestamp: 'x' });
  });
});

describe('reusableCrudSlice realtime reducers', () => {
  const slice = reusableCrudSlice('things');
  const r = slice.reducer;
  it('status, changes, updateOneSuccess merges the server row', () => {
    let s: any = r(undefined, { type: '@@init' });
    expect(s.realtimeStatus).toBe('idle');
    s = r(s, slice.actions.startRealtime({}));
    expect(s.realtimeStatus).toBe('subscribing');
    s = r(s, slice.actions.realtimeStatusChanged({ status: 'SUBSCRIBED' }));
    expect(s.realtimeStatus).toBe('subscribed');
    s = r(s, slice.actions.readDataSuccess({ data: [row('a', 1), row('b', 2)] }));
    s = r(s, slice.actions.applyRealtimeChange({ eventType: 'UPDATE', table: 't', new: row('b', 0, 'moved'), old: null }));
    expect(s.entityDataFromServer.map((x: any) => x.rowGUID)).toEqual(['b', 'a']);
    expect(s.lastRealtimeEvent).toMatchObject({ eventType: 'UPDATE', rowGUID: 'b' });
    s = r(s, slice.actions.applyRealtimeChange({ eventType: 'DELETE', table: 't', new: null, old: { rowGUID: 'a' } }));
    expect(s.entityDataFromServer.map((x: any) => x.rowGUID)).toEqual(['b']);
    s = r(s, slice.actions.updateOneSuccess({ lastUpdatedData: row('b', 0, 'server') }));
    expect(s.entityDataFromServer[0].rowJSON.name).toBe('server');
    s = r(s, slice.actions.updateOneSuccess({ lastUpdatedData: row('zzz', 1) })); // not in the list: ignored
    expect(s.entityDataFromServer).toHaveLength(1);
    s = r(s, slice.actions.realtimeStatusChanged({ status: 'CHANNEL_ERROR', error: 'boom' }));
    expect([s.realtimeStatus, s.realtimeError]).toEqual(['error', 'boom']);
  });
});

/** Minimal supabase-js: realtime channels (driven by the test) + a table read. */
function fakeSupabase(rows: any[]) {
  const channels: any[] = [];
  const sb: any = {
    channels,
    removed: [] as any[],
    channel(name: string) {
      const ch: any = { name, handlers: [] as any[], statusCb: null as any };
      ch.on = (_evt: string, cfg: any, cb: any) => {
        ch.cfg = cfg;
        ch.handlers.push(cb);
        return ch;
      };
      ch.subscribe = (cb: any) => {
        ch.statusCb = cb;
        return ch;
      };
      ch.emit = (payload: any) => ch.handlers.forEach((h: any) => h(payload));
      channels.push(ch);
      return ch;
    },
    removeChannel(ch: any) {
      sb.removed.push(ch);
    },
    from() {
      const q: any = { select: () => q, order: () => q, or: () => q, range: async () => ({ data: rows, error: null }) };
      return q;
    },
  };
  return sb;
}

function setup(rows: any[] = [row('a', 1)]) {
  const slice = reusableCrudSlice('currencyReusable');
  const sb = fakeSupabase(rows);
  const sagaMw = createSagaMiddleware({ context: { dbAdapters: { supabaseAdapter: { supabase: sb } } } });
  const seen: any[] = [];
  const store = configureStore({
    reducer: { currencyReusable: slice.reducer, uxuiState: (s: any = {}) => s },
    middleware: (gdm) => gdm({ serializableCheck: false }).concat(sagaMw, () => (next: any) => (a: any) => (seen.push(a), next(a))),
  });
  sagaMw.run(reusableRootSaga({ tableName: 'currencyTable', entityKey: 'currencyReusable', itemLabel: 'Currency', actions: slice.actions }));
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { store, slice, sb, seen, flush, state: () => store.getState().currencyReusable as any };
}

describe('reusableRootSaga realtime worker', () => {
  it('start -> channel on the table; SUBSCRIBED -> catch-up readData; changes from other browsers reach the list; stop closes', async () => {
    const t = setup([row('a', 1), row('b', 2)]);
    t.store.dispatch(t.slice.actions.startRealtime({ readParams: { paginationSize: 1000 } }));
    await t.flush();
    expect(t.sb.channels).toHaveLength(1);
    const ch = t.sb.channels[0];
    expect(ch.cfg).toEqual({ event: '*', schema: 'public', table: 'currencyTable' });

    ch.statusCb('SUBSCRIBED');
    await t.flush();
    expect(t.state().realtimeStatus).toBe('subscribed');
    expect(t.seen.some((a) => a.type === 'currencyReusable/readData' && a.payload.paginationSize === 1000)).toBe(true);
    expect(t.state().entityDataFromServer.map((r: any) => r.rowGUID)).toEqual(['a', 'b']);

    ch.emit({ eventType: 'INSERT', table: 'currencyTable', new: row('c', 3), old: {} });
    ch.emit({ eventType: 'UPDATE', table: 'currencyTable', new: row('a', 1, 'renamed elsewhere'), old: { rowGUID: 'a' } });
    ch.emit({ eventType: 'DELETE', table: 'currencyTable', new: {}, old: { rowGUID: 'b' } });
    await t.flush();
    const list = t.state().entityDataFromServer;
    expect(list.map((r: any) => r.rowGUID)).toEqual(['a', 'c']);
    expect(list[0].rowJSON.name).toBe('renamed elsewhere');

    t.store.dispatch(t.slice.actions.stopRealtime());
    await t.flush();
    expect(t.sb.removed).toContain(ch);
    expect(t.state().realtimeStatus).toBe('idle');
  });

  it('a second start replaces the channel (one subscription per entity); reconnect refetches again', async () => {
    const t = setup();
    t.store.dispatch(t.slice.actions.startRealtime({}));
    await t.flush();
    t.store.dispatch(t.slice.actions.startRealtime({ filter: 'rowOwnerGUID=eq.x' }));
    await t.flush();
    expect(t.sb.channels).toHaveLength(2);
    expect(t.sb.removed).toContain(t.sb.channels[0]);
    expect(t.sb.channels[1].cfg.filter).toBe('rowOwnerGUID=eq.x');
    const reads = () => t.seen.filter((a) => a.type === 'currencyReusable/readData').length;
    t.sb.channels[1].statusCb('SUBSCRIBED');
    await t.flush();
    t.sb.channels[1].statusCb('CHANNEL_ERROR', new Error('socket down'));
    await t.flush();
    expect(t.state().realtimeStatus).toBe('error');
    t.sb.channels[1].statusCb('SUBSCRIBED');
    await t.flush();
    expect(reads()).toBe(2);
  });
});
