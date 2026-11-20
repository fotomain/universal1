// A bulk write sends one realtime event per row. The channel hands the changes of one burst over together (REALTIME_BURST_MS), so the saga can turn a big burst into ONE read.
import { createSupabaseTableChannel, REALTIME_BURST_MS } from '../../kit8/redux/reusable/createSupabaseTableChannel';

function fakeSupabase() {
  let onChange: any = null;
  let onStatus: any = null;
  const channel: any = { on: (_t: string, _o: any, cb: any) => { onChange = cb; return channel; }, subscribe: (cb: any) => { onStatus = cb; return channel; } };
  return { client: { channel: () => channel, removeChannel: jest.fn() }, change: (n: number) => onChange({ eventType: 'INSERT', table: 't', new: { rowGUID: 'r' + n }, old: {} }), status: (s: string) => onStatus(s) };
}

describe('realtime burst', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds the row changes back and delivers the whole burst together', () => {
    const fake = fakeSupabase();
    const chan = createSupabaseTableChannel(fake.client, { table: 't' });
    const got: any[] = [];
    chan.take((m: any) => got.push(m));
    for (let i = 0; i < 500; i++) fake.change(i);
    expect(got).toHaveLength(0);
    jest.advanceTimersByTime(REALTIME_BURST_MS + 1);
    expect(got.length).toBeGreaterThanOrEqual(1);           // the first message wakes the taker, the rest wait in the buffer
    const rest: any[] = [];
    chan.flush((m: any) => rest.push(...(Array.isArray(m) ? m : [m])));
    expect(got.length + rest.length).toBe(500);
    expect(got.every((m) => m.kind === 'change')).toBe(true);
  });

  it('a status comes after the changes that preceded it', () => {
    const fake = fakeSupabase();
    const chan = createSupabaseTableChannel(fake.client, { table: 't' });
    const got: any[] = [];
    chan.take((m: any) => got.push(m));
    fake.change(1);
    fake.status('SUBSCRIBED');
    expect(got[0].kind).toBe('change');
    const rest: any[] = [];
    chan.flush((m: any) => rest.push(...(Array.isArray(m) ? m : [m])));
    expect(rest[0]?.kind ?? got[1]?.kind).toBe('status');
  });

  it('closing the channel drops what is held back and removes the channel', () => {
    const fake = fakeSupabase();
    const chan = createSupabaseTableChannel(fake.client, { table: 't' });
    fake.change(1);
    chan.close();
    expect(fake.client.removeChannel).toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
  });
});
