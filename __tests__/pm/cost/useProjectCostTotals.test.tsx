/** @jest-environment jsdom */
// useProjectCostTotals: the first load, the realtime patch by key (events of one burst applied together, no refetch), the reconnect (read again), the "stale" bus, off while disabled, the cleanup.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../ui/pmUiTestKit';

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
jest.doMock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const { useProjectCostTotals } = require('../../../kit8/pm/cost/useProjectCostTotals');
const { emitCostTotalsStale } = require('../../../kit8/pm/cost/costTotalModel');

const raw = (id: string, total: string, own = '0') => ({ rowOwnerGUID: id, costOwnForBudget: own, costTotalForBudget: total });

let latest: any;
function Probe({ project, enabled = true }: { project?: string | null; enabled?: boolean }) {
  latest = useProjectCostTotals(project, enabled);
  return React.createElement('div', { 'data-testid': 'probe' }, String(latest.totals.size));
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const emit = (payload: any) => act(() => fake.handlers[fake.handlers.length - 1](payload));
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('reads the cost rows of the project, every page (1000 rows a page)', async () => {
  resetFake(Array.from({ length: 1005 }, (_, i) => raw(`t${i}`, '10.00')));
  renderUI(<Probe project="p1" />);
  await flush();
  expect(latest.isLoading).toBe(false);
  expect(latest.totals.size).toBe(1005);
  expect(latest.totals.get('t0')).toBe(10);                      // numeric strings become numbers
  expect(fake.builders.map((b: Builder) => b.from)).toEqual([0, 1000]);
  expect(fake.builders[0].calls).toContainEqual(['eq', ['rowProjectGUID', 'p1']]);
});

it('listens to the table with the filter of the project', async () => {
  resetFake([raw('t1', '5')]);
  renderUI(<Probe project="p1" />);
  await flush();
  expect(fake.channelConfigs[0]).toMatchObject({ event: '*', schema: 'public', table: 'project_task_cost_total', filter: 'rowProjectGUID=eq.p1' });
});

it('a realtime event is PATCHED into the map (no refetch); a burst is applied together', async () => {
  resetFake([raw('t1', '100'), raw('t2', '50')]);
  renderUI(<Probe project="p1" />);
  await flush();
  const reads = fake.builders.length;
  await emit({ eventType: 'UPDATE', new: raw('t1', '120') });
  await emit({ eventType: 'INSERT', new: raw('t3', '7') });
  await emit({ eventType: 'DELETE', old: { rowOwnerGUID: 't2' } });
  expect(latest.totals.get('t1')).toBe(100);                      // not yet: the batch time has not passed
  await wait(250);
  expect(latest.totals.get('t1')).toBe(120);
  expect(latest.totals.get('t3')).toBe(7);
  expect(latest.totals.has('t2')).toBe(false);
  expect(fake.builders).toHaveLength(reads);                      // nothing was read again
});

it('after a reconnect everything is read again (the events of the gap are lost)', async () => {
  resetFake([raw('t1', '100')]);
  renderUI(<Probe project="p1" />);
  await flush();
  act(() => fake.statusCallbacks[0]('SUBSCRIBED'));
  expect(latest.live).toBe(true);
  fake.rows = [raw('t1', '999')];
  act(() => fake.statusCallbacks[0]('CLOSED'));
  expect(latest.live).toBe(false);
  act(() => fake.statusCallbacks[0]('SUBSCRIBED'));
  await flush();
  expect(latest.totals.get('t1')).toBe(999);
});

it('the stale bus (the toolbar command) reads the totals again; another project does not', async () => {
  resetFake([raw('t1', '100')]);
  renderUI(<Probe project="p1" />);
  await flush();
  fake.rows = [raw('t1', '300')];
  act(() => emitCostTotalsStale('other'));
  await flush();
  expect(latest.totals.get('t1')).toBe(100);
  act(() => emitCostTotalsStale('p1'));
  await flush();
  expect(latest.totals.get('t1')).toBe(300);
});

it('disabled (no cost budget / the switch is off) or no project: no query, no channel, an empty map', async () => {
  resetFake([raw('t1', '100')]);
  renderUI(<Probe project="p1" enabled={false} />);
  await flush();
  expect(fake.client.from).not.toHaveBeenCalled();
  expect(fake.client.channel).not.toHaveBeenCalled();
  expect(latest.totals.size).toBe(0);
  cleanupUI();
  renderUI(<Probe project={null} />);
  await flush();
  expect(fake.client.from).not.toHaveBeenCalled();
});

it('an error of the load is reported, and the channel is removed on unmount', async () => {
  resetFake([]);
  fake.client.from = jest.fn(() => ({ select() { return this; }, order() { return this; }, eq() { return this; }, range() { return this; }, then(res: any) { return Promise.resolve({ data: null, error: { message: 'boom' } }).then(res); } }));
  renderUI(<Probe project="p1" />);
  await flush();
  expect(latest.error).toBe('boom');
  cleanupUI();
  expect(fake.removed).toBe(1);
});
