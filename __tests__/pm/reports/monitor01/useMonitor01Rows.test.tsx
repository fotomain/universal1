/** @jest-environment jsdom */
// useMonitor01Rows: the first load in pages, the realtime patch by key (events of one burst applied together), the reconnect (read again), the project filter, the cleanup.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../ui/pmUiTestKit';

// a chainable fake of the query builder: every call returns the builder; awaiting it gives the page asked by range()
class Builder {
  calls: [string, any[]][] = [];
  from = 0;
  constructor(private readonly rows: any[], private readonly spy: (b: Builder) => void) {}
  select(...a: any[]) { this.calls.push(['select', a]); return this; }
  order(...a: any[]) { this.calls.push(['order', a]); return this; }
  eq(...a: any[]) { this.calls.push(['eq', a]); return this; }
  range(from: number, to: number) { this.from = from; this.calls.push(['range', [from, to]]); return this; }
  then(resolve: any, reject: any) { this.spy(this); return Promise.resolve({ data: this.rows.slice(this.from, this.from + 1000), error: null }).then(resolve, reject); }
}
const fake: any = {};
function resetFake(rows: any[]) {
  fake.rows = rows;
  fake.builders = [] as Builder[];
  fake.handlers = [] as ((p: any) => void)[];
  fake.statusCallbacks = [] as ((s: string) => void)[];
  fake.channelConfigs = [] as any[];
  fake.removed = 0;
  fake.client = {
    from: jest.fn(() => new Builder(fake.rows, (b) => fake.builders.push(b))),
    channel: jest.fn(() => {
      const ch: any = {
        on: (_kind: string, config: any, handler: any) => { fake.channelConfigs.push(config); fake.handlers.push(handler); return ch; },
        subscribe: (cb: (s: string) => void) => { fake.statusCallbacks.push(cb); return ch; },
      };
      return ch;
    }),
    removeChannel: jest.fn(() => { fake.removed += 1; }),
  };
}
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const { useMonitor01Rows } = require('../../../../kit8/pm/reports/monitor01/useMonitor01Rows');

const raw = (i: number, over: Record<string, any> = {}) => ({
  rowOwnerGUID: `t${i}`, genusGUID: 'timeGenus', resourceRoleGUID: 'r1', measureUnit: 'unit_hour', periodMonth: '2026-10-01', rowProjectGUID: 'p1', projectName: 'Alpha', taskName: `task${i}`,
  resourceRoleName: 'Role', qtyPlanned: '8.00', qtyContracted: '0.00', qtyRestToContract: '8.00', qtyReceived: '0.00', qtyUsed: '0.00', qtyOnHand: '0.00', lineCount: 1, hasStalePlan: false, updated_at: `v${i}`, ...over,
});

let latest: any;
function Probe({ project }: { project?: string | null }) {
  latest = useMonitor01Rows(project);
  return React.createElement('div', { 'data-testid': 'probe' }, String(latest.rows.length));
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const emit = (payload: any) => act(() => fake.handlers[fake.handlers.length - 1](payload));
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('reads every page of the first load (1000 rows a page)', async () => {
  resetFake(Array.from({ length: 1005 }, (_, i) => raw(i)));
  renderUI(<Probe />);
  await flush();
  expect(latest.isLoading).toBe(false);
  expect(latest.rows).toHaveLength(1005);
  expect(fake.builders.map((b: Builder) => b.from)).toEqual([0, 1000]);
  expect(latest.rows[0].qtyPlanned).toBe(8);                          // numeric strings become numbers
});

it('the project mode reads and listens to ONE project; the full data set to the table', async () => {
  resetFake([raw(1)]);
  renderUI(<Probe project="p1" />);
  await flush();
  expect(fake.builders[0].calls).toContainEqual(['eq', ['rowProjectGUID', 'p1']]);
  expect(fake.channelConfigs[0]).toMatchObject({ event: '*', schema: 'public', table: 'monitor01_view', filter: 'rowProjectGUID=eq.p1' });
  cleanupUI();
  resetFake([raw(1)]);
  renderUI(<Probe />);
  await flush();
  expect(fake.builders[0].calls.find(([m]: [string]) => m === 'eq')).toBeUndefined();
  expect(fake.channelConfigs[0].filter).toBeUndefined();
});

it('an error of the load is reported', async () => {
  resetFake([]);
  fake.client.from = jest.fn(() => ({ select: () => ({ order: function o() { return { order: o, range: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }) }; } }) }));
  renderUI(<Probe />);
  await flush();
  expect(latest.error).toBe('permission denied');
  expect(latest.isLoading).toBe(false);
});

describe('realtime', () => {
  it('is "live" once the channel is subscribed', async () => {
    resetFake([raw(1)]);
    renderUI(<Probe />);
    await flush();
    expect(latest.live).toBe(false);
    act(() => fake.statusCallbacks[0]('SUBSCRIBED'));
    expect(latest.live).toBe(true);
    act(() => fake.statusCallbacks[0]('CHANNEL_ERROR'));
    expect(latest.live).toBe(false);
  });

  it('an event is PATCHED into the rows by its key - no refetch', async () => {
    resetFake([raw(1), raw(2)]);
    renderUI(<Probe />);
    await flush();
    const reads = fake.client.from.mock.calls.length;
    emit({ eventType: 'UPDATE', new: raw(1, { qtyPlanned: '30.00', qtyRestToContract: '30.00', updated_at: 'v1b' }), old: {} });
    await wait(150);
    expect(latest.rows.find((r: any) => r.rowOwnerGUID === 't1').qtyPlanned).toBe(30);
    expect(latest.rows.find((r: any) => r.rowOwnerGUID === 't2').qtyPlanned).toBe(8);
    expect(fake.client.from.mock.calls.length).toBe(reads);
  });

  it('INSERT adds and DELETE removes; the events of one burst are applied together', async () => {
    resetFake([raw(1)]);
    renderUI(<Probe />);
    await flush();
    let renders = 0;
    const before = latest.rows;
    emit({ eventType: 'INSERT', new: raw(7), old: {} });
    emit({ eventType: 'INSERT', new: raw(8), old: {} });
    emit({ eventType: 'DELETE', new: {}, old: raw(1) });
    expect(latest.rows).toBe(before);                                  // nothing yet: the burst window is open
    await wait(150);
    renders += 1;
    expect(latest.rows.map((r: any) => r.rowOwnerGUID).sort()).toEqual(['t7', 't8']);
    expect(renders).toBe(1);
    expect(latest.changedAt).toBeGreaterThan(0);
  });

  it('after a RECONNECT the rows are read again (the events of the gap are lost)', async () => {
    resetFake([raw(1)]);
    renderUI(<Probe />);
    await flush();
    act(() => fake.statusCallbacks[0]('SUBSCRIBED'));
    const reads = fake.client.from.mock.calls.length;
    act(() => fake.statusCallbacks[0]('CLOSED'));
    fake.rows = [raw(1), raw(2), raw(3)];
    act(() => fake.statusCallbacks[0]('SUBSCRIBED'));
    await flush();
    expect(fake.client.from.mock.calls.length).toBeGreaterThan(reads);
    expect(latest.rows).toHaveLength(3);
  });

  it('closes the channel when the screen goes away', async () => {
    resetFake([raw(1)]);
    renderUI(<Probe />);
    await flush();
    cleanupUI();
    expect(fake.removed).toBe(1);
  });
});

// ---- the safety net under Realtime: monitor01_stamp every 3 s -------------------------------------------------------------------------------------------------------------------------
describe('the safety net: monitor01_stamp every few seconds', () => {
  const POLL = 3000;
  let stamp: any;
  let rpcCalls: { name: string; args: any }[];
  function withRpc() {
    rpcCalls = [];
    fake.client.rpc = jest.fn(async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      if (name === 'monitor01_stamp') { if (stamp instanceof Error) throw stamp; return { data: stamp, error: null }; }
      return { data: { tasks: 1, upserted: 1, deleted: 0 }, error: null };
    });
  }
  const tick = async (ms = POLL) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  const loads = () => fake.builders.length;
  // the stamp of the rows the screen holds: 2 rows, the newest updated_at
  const same = () => ({ count: 2, maxUpdatedAt: '2026-10-14T10:00:00Z', queued: 0, queuedAgeSeconds: 0 });
  const rowsWithTime = () => [raw(1, { updated_at: '2026-10-14T09:00:00Z' }), raw(2, { updated_at: '2026-10-14T10:00:00Z' })];
  beforeEach(() => { jest.useFakeTimers(); stamp = same(); });
  afterEach(() => { jest.useRealTimers(); });

  it('asks the stamp every 3 s (the project mode for its project); the answer is "checked"', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe project="p1" />);
    await flush();
    expect(rpcCalls).toHaveLength(0);
    await tick();
    expect(rpcCalls).toEqual([{ name: 'monitor01_stamp', args: { p_project: 'p1' } }]);
    expect(latest.checkedAt).not.toBeNull();
    await tick();
    expect(rpcCalls.filter((c) => c.name === 'monitor01_stamp')).toHaveLength(2);
  });

  it('the rows are the same as on the server: nothing is read again', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    const before = loads();
    await tick(POLL * 4);
    expect(loads()).toBe(before);
    expect(rpcCalls.some((c) => c.name === 'monitor01_refresh_now')).toBe(false);
  });

  it('another number of rows twice in a row (a missed event): read again; once is only a tick of grace', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    const before = loads();
    stamp = { ...same(), count: 3 };
    await tick();
    await flush();
    expect(loads()).toBe(before);                      // the first mismatch: wait one tick (an event may be just arriving)
    await tick();
    await flush();
    expect(loads()).toBeGreaterThan(before);           // the second one: read again
  });

  it('a newer change on the server (same number of rows) is found too', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    const before = loads();
    stamp = { ...same(), maxUpdatedAt: '2026-10-14T10:00:05Z' };
    await tick(POLL * 2);
    await flush();
    expect(loads()).toBeGreaterThan(before);
  });

  it('a mismatch that went away by itself (the event arrived) does not read again', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    const before = loads();
    stamp = { ...same(), count: 3 };
    await tick();
    stamp = same();
    await tick(POLL * 3);
    await flush();
    expect(loads()).toBe(before);
  });

  it('the worker is late (a task waits in the queue longer than 6 s): compute NOW, then read again; at most once in 15 s', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe project="p1" />);
    await flush();
    const before = loads();
    stamp = { ...same(), queued: 2, queuedAgeSeconds: 12 };
    await tick();
    await flush();
    expect(rpcCalls.filter((c) => c.name === 'monitor01_refresh_now')).toEqual([{ name: 'monitor01_refresh_now', args: { p_project: 'p1' } }]);
    expect(loads()).toBeGreaterThan(before);
    await tick(POLL * 3);
    expect(rpcCalls.filter((c) => c.name === 'monitor01_refresh_now')).toHaveLength(1);     // the cooldown
    await tick(POLL * 3);
    expect(rpcCalls.filter((c) => c.name === 'monitor01_refresh_now')).toHaveLength(2);     // 15 s later it asks again while the queue is still stuck
  });

  it('a queue that is only a few seconds old is the worker\'s business: nothing is computed', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    stamp = { ...same(), queued: 3, queuedAgeSeconds: 2 };
    await tick(POLL * 3);
    expect(rpcCalls.some((c) => c.name === 'monitor01_refresh_now')).toBe(false);
  });

  it('an error of the stamp is not an error of the report (the next tick asks again)', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    stamp = new Error('network down');
    await tick(POLL * 2);
    expect(latest.error).toBeNull();
    expect(latest.rows).toHaveLength(2);
    stamp = same();
    await tick();
    expect(latest.checkedAt).not.toBeNull();
  });

  it('poll: false (Auto refresh off) asks nothing', async () => {
    resetFake(rowsWithTime());
    withRpc();
    function NoPoll() { latest = useMonitor01Rows(null, { poll: false }); return null; }
    renderUI(<NoPoll />);
    await flush();
    await tick(POLL * 3);
    expect(rpcCalls).toHaveLength(0);
  });

  it('stops asking when the screen goes away', async () => {
    resetFake(rowsWithTime());
    withRpc();
    renderUI(<Probe />);
    await flush();
    cleanupUI();
    await tick(POLL * 3);
    expect(rpcCalls).toHaveLength(0);
  });
});
