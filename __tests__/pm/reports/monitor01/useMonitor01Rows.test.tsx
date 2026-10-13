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
  resourceRoleName: 'Role', qtyPlanned: '8.00', qtyContracted: '0.00', qtyRestToContract: '8.00', qtyDelivered: '0.00', qtyUsed: '0.00', qtyOnHand: '0.00', lineCount: 1, hasStalePlan: false, updated_at: `v${i}`, ...over,
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
