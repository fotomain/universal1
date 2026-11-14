// ReusableList - the drag reorder controller (no React): ghost, drop index, drop line, auto scroll at the edges, one onDrop at the end
import { createReorderController } from '../../../kit8/ui/components/list/reusable/reorderController';

const H = 72;
function setup(count = 100, opts: Partial<{ enabled: boolean; lastDropIndex: number }> = {}) {
  const calls: any = { drop: [] as any[], change: [] as any[], scroll: [] as number[], ghost: [] as number[], line: [] as number[] };
  const state = { count, enabled: true, lastDropIndex: undefined as number | undefined, ...opts };
  const c = createReorderController({
    opts: () => ({ itemHeight: H, count: state.count, enabled: state.enabled, lastDropIndex: state.lastDropIndex }),
    measure: (cb) => cb(100, 600), // the list starts at y 100 and is 600 high
    scrollTo: (o) => calls.scroll.push(o),
    onDrop: (from, to) => calls.drop.push([from, to]),
    onChange: (s) => calls.change.push(s),
    ghostY: { setValue: (v) => calls.ghost.push(v) },
    lineY: { setValue: (v) => calls.line.push(v) },
  });
  return { c, calls, state };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('picks an item, follows the finger, drops it once on the item under the finger', () => {
  const { c, calls } = setup();
  c.start('g5', 5, 100 + 5 * H + 30); // the finger is on item 5 (list top = 100, no scroll)
  expect(c.isActive()).toBe(true);
  expect(calls.change[0]).toEqual({ from: 5, target: 5, guid: 'g5' });
  c.move(100 + 2 * H + 10); // over item 2
  expect(calls.change[calls.change.length - 1]).toEqual({ from: 5, target: 2, guid: 'g5' });
  expect(calls.line[calls.line.length - 1]).toBe(2 * H); // the line sits ABOVE item 2 when moving up
  c.end();
  expect(calls.drop).toEqual([[5, 2]]);
  expect(calls.change[calls.change.length - 1]).toBeNull();
  expect(c.isActive()).toBe(false);
});

it('moving down: the line is under the target item', () => {
  const { c, calls } = setup();
  c.start('g1', 1, 100 + H + 10);
  c.move(100 + 4 * H + 10);
  expect(calls.line[calls.line.length - 1]).toBe(5 * H);
  c.end();
  expect(calls.drop).toEqual([[1, 4]]);
});

it('dropped where it was picked: no onDrop', () => {
  const { c, calls } = setup();
  c.start('g3', 3, 100 + 3 * H + 10);
  c.move(100 + 3 * H + 40);
  c.end();
  expect(calls.drop).toEqual([]);
});

it('the ghost stays inside the list', () => {
  const { c, calls } = setup();
  c.start('g0', 0, 150);
  c.move(-500);
  expect(calls.ghost[calls.ghost.length - 1]).toBe(0);
  c.move(5000);
  expect(calls.ghost[calls.ghost.length - 1]).toBe(600 - H);
  c.cancel();
});

it('near the bottom edge the list scrolls by itself and the drop index follows (500 000 rows)', () => {
  const { c, calls } = setup(500_000);
  c.start('g2', 2, 100 + 300);
  c.move(100 + 600 - 4); // finger at the bottom edge of the list
  jest.advanceTimersByTime(16 * 10);
  expect(calls.scroll.length).toBeGreaterThanOrEqual(10);
  expect(calls.scroll[calls.scroll.length - 1]).toBeGreaterThan(calls.scroll[0]);
  const last = calls.change[calls.change.length - 1];
  expect(last.target).toBeGreaterThan(8); // 600 px = 8 items; it moved on
  c.end();
  expect(calls.drop[0][0]).toBe(2);
  expect(calls.drop[0][1]).toBe(last.target);
  // the timer is gone
  const n = calls.scroll.length;
  jest.advanceTimersByTime(500);
  expect(calls.scroll.length).toBe(n);
});

it('near the top edge it scrolls up, but not below 0', () => {
  const { c, calls } = setup();
  c.onScroll(500);
  c.start('g20', 20, 100 + 300);
  c.move(100 + 2);
  jest.advanceTimersByTime(16 * 100);
  expect(calls.scroll.every((o) => o >= 0)).toBe(true);
  expect(calls.scroll[calls.scroll.length - 1]).toBe(0);
  c.cancel();
});

it('the last drop index limits the target (server list with more pages: not after the last loaded row)', () => {
  const { c, calls } = setup(10, { lastDropIndex: 8 });
  c.start('g1', 1, 100 + H + 10);
  c.move(100 + 599);
  expect(calls.change[calls.change.length - 1].target).toBe(8);
  c.end();
  expect(calls.drop).toEqual([[1, 8]]);
});

it('does not start when reorder is off, and cancel never drops', () => {
  const off = setup(100, { enabled: false });
  off.c.start('g1', 1, 200);
  expect(off.c.isActive()).toBe(false);
  const { c, calls } = setup();
  c.start('g1', 1, 200);
  c.move(400);
  c.cancel();
  c.end();
  expect(calls.drop).toEqual([]);
  expect(calls.change[calls.change.length - 1]).toBeNull();
});

it('with a cached measure of the list a drag starts at once (a quick press does not lose its drop); the fresh measure corrects it', () => {
  const calls: any = { drop: [], scroll: [] };
  let measured: ((top: number, height: number) => void) | null = null;
  const c = createReorderController({
    opts: () => ({ itemHeight: H, count: 100, enabled: true }),
    measure: (cb) => { measured = cb; }, // never answers by itself: the test answers later
    cached: () => ({ top: 100, height: 600 }),
    scrollTo: (o) => calls.scroll.push(o), onDrop: (f, t) => calls.drop.push([f, t]), onChange: () => {},
    ghostY: { setValue: () => {} }, lineY: { setValue: () => {} },
  });
  c.start('g1', 1, 100 + H + 10);
  expect(c.isActive()).toBe(true); // active before the measure answered
  c.move(100 + 5 * H + 10);
  c.end();
  expect(calls.drop).toEqual([[1, 5]]);
  measured!(100, 600); // the late answer changes nothing after the end
  expect(c.isActive()).toBe(false);
});
