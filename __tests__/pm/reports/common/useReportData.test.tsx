/** @jest-environment jsdom */
// useReportData: loads on mount and when the deps change, re-reads on a Realtime event (debounced) and on a reconnect, shows the error, skips the load while disabled, closes the channel.
import React from 'react';
import { act } from 'react';
import { cleanupUI, renderUI, textOf } from '../../ui/pmUiTestKit';

const mockHandlers: { event?: () => void; status?: (s: string) => void } = {};
const mockRemove = jest.fn();
const mockClient = {
  channel: jest.fn(() => {
    const ch: any = { on: (_t: string, _f: any, cb: () => void) => { mockHandlers.event = cb; return ch; }, subscribe: (cb: (s: string) => void) => { mockHandlers.status = cb; return ch; } };
    return ch;
  }),
  removeChannel: mockRemove,
};
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));
const { useReportData, REPORT_EVENT_DEBOUNCE_MS } = require('../../../../kit8/pm/reports/common/useReportData');

const load = jest.fn(async (_c: any) => 'answer-' + load.mock.calls.length);
function Probe({ dep, watch = true, enabled = true, fail = false }: { dep: string; watch?: boolean; enabled?: boolean; fail?: boolean }) {
  const r = useReportData({ load: async (c: any) => { if (fail) throw new Error('boom'); return load(c); }, deps: [dep], realtimeTable: 'some_table', watch, initial: 'none', enabled });
  return <>{[`data:${r.data}`, `live:${r.live}`, `err:${r.error ?? ''}`, `loading:${r.isLoading}`].map((t) => <span key={t} data-testid={t.split(':')[0]}>{t}</span>)}</>;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => { load.mockClear(); mockRemove.mockClear(); mockClient.channel.mockClear(); mockHandlers.event = undefined; mockHandlers.status = undefined; });
afterEach(cleanupUI);

it('loads on mount, again when a dependency changes', async () => {
  const { rerender } = renderUI(<Probe dep="a" />) as any;
  await flush();
  expect(load).toHaveBeenCalledTimes(1);
  expect(textOf('data')).toBe('data:answer-1');
  rerender(<Probe dep="b" />);
  await flush();
  expect(load).toHaveBeenCalledTimes(2);
});

it('a Realtime event re-reads after the debounce, several events make one read; SUBSCRIBED sets live; a reconnect reads again', async () => {
  renderUI(<Probe dep="a" />);
  await flush();
  expect(mockClient.channel).toHaveBeenCalledTimes(1);
  act(() => { mockHandlers.status?.('SUBSCRIBED'); });
  expect(textOf('live')).toBe('live:true');
  act(() => { mockHandlers.event?.(); mockHandlers.event?.(); mockHandlers.event?.(); });
  await wait(REPORT_EVENT_DEBOUNCE_MS + 150);
  expect(load).toHaveBeenCalledTimes(2);
  act(() => { mockHandlers.status?.('CLOSED'); });
  expect(textOf('live')).toBe('live:false');
  act(() => { mockHandlers.status?.('SUBSCRIBED'); });
  await flush();
  expect(load).toHaveBeenCalledTimes(3);
});

it('watch off: no channel; disabled: no read; an error of the read is shown', async () => {
  renderUI(<Probe dep="a" watch={false} />);
  await flush();
  expect(mockClient.channel).not.toHaveBeenCalled();
  cleanupUI();
  load.mockClear();
  renderUI(<Probe dep="a" enabled={false} />);
  await flush();
  expect(load).not.toHaveBeenCalled();
  cleanupUI();
  renderUI(<Probe dep="a" fail />);
  await flush();
  expect(textOf('err')).toBe('err:boom');
});

it('the channel is removed when the screen goes', async () => {
  renderUI(<Probe dep="a" />);
  await flush();
  cleanupUI();
  expect(mockRemove).toHaveBeenCalled();
});
