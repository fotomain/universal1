// ReusableList - the pure engine (kit8/ui/components/list/reusable/listEngine.ts)
import { autoScrollSpeed, buildView, cachedSearchText, clampScroll, dropIndexAt, isQueryActive, queryKey, reorderResult, resolveListRoles } from '../../../kit8/ui/components/list/reusable/listEngine';
import type { ReusableTableRow, VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

const cols: VisualColumn[] = [
  { key: 'no', title: '#', type: 'rowNumber' },
  { key: 'kind', title: 'Kind', type: 'select', options: [{ value: 'v', label: 'Video' }] },
  { key: 'title', title: 'Title', type: 'text' },
  { key: 'note', title: 'Note', type: 'text' },
  { key: 'sec', title: 'Seconds', type: 'number' },
];
const row = (id: string, order: number, json: Record<string, any>): ReusableTableRow => ({ rowGUID: id, orderInList: order, rowJSON: json });
const rows = [row('a', 10, { title: 'Alpha', note: 'first', sec: 5 }), row('b', 20, { title: 'Bravo', note: 'second', sec: 30 }), row('c', 30, { title: 'Charlie', note: 'third', sec: 10 })];
const noQuery = { search: '', sort: null, filters: {} };

describe('resolveListRoles', () => {
  it('default: the first text column is the title, then subtitle and two meta; row numbers never show', () => {
    const r = resolveListRoles(cols);
    expect(r.title?.key).toBe('title');
    expect(r.subtitle?.key).toBe('kind');
    expect(r.meta.map((c) => c.key)).toEqual(['note', 'sec']);
    expect(r.badge).toEqual([]);
  });
  it('listRole of a column wins, hidden is hidden', () => {
    const r = resolveListRoles([
      { key: 'a', title: 'A', type: 'text', listRole: 'subtitle' }, { key: 'b', title: 'B', type: 'text', listRole: 'title' },
      { key: 'c', title: 'C', type: 'text', listRole: 'hidden' }, { key: 'd', title: 'D', type: 'text', listRole: 'badge' },
    ]);
    expect([r.title?.key, r.subtitle?.key, r.badge.map((c) => c.key)]).toEqual(['b', 'a', ['d']]);
  });
  it('no columns: nothing', () => expect(resolveListRoles([])).toEqual({ title: null, subtitle: null, meta: [], badge: [] }));
});

describe('buildView', () => {
  it('search is case insensitive over the columns', () => {
    const v = buildView(rows, { columns: cols, query: { ...noQuery, search: 'BRA' } });
    expect(v.map((r) => r.rowGUID)).toEqual(['b']);
  });
  it('a column filter and a column sort', () => {
    const v = buildView(rows, { columns: cols, query: { search: '', sort: { key: 'sec', direction: 'desc' }, filters: { sec: { op: 'gte', value: '10' } } } });
    expect(v.map((r) => r.rowGUID)).toEqual(['b', 'c']);
  });
  it("direction 'desc' = the highest orderInList first; a column sort wins over it", () => {
    expect(buildView(rows, { columns: cols, query: noQuery, direction: 'desc' }).map((r) => r.rowGUID)).toEqual(['c', 'b', 'a']);
    expect(buildView(rows, { columns: cols, query: { ...noQuery, sort: { key: 'title', direction: 'asc' } }, direction: 'desc' }).map((r) => r.rowGUID)).toEqual(['a', 'b', 'c']);
  });
  it('asc without a query returns the same array (no copy of a big list)', () => {
    expect(buildView(rows, { columns: cols, query: noQuery })).toBe(rows);
  });
  it('rowFilter (a folder) is applied first', () => {
    expect(buildView(rows, { columns: cols, query: noQuery, rowFilter: (r) => r.rowGUID !== 'a' }).map((r) => r.rowGUID)).toEqual(['b', 'c']);
  });
});

describe('search text cache', () => {
  it('is computed once per row object and again for a changed row / other columns', () => {
    const r = row('x', 1, { title: 'One' });
    const t1 = cachedSearchText(r, cols);
    expect(cachedSearchText(r, cols)).toBe(t1);
    expect(t1).toContain('one');
    const changed = { ...r, rowJSON: { title: 'Two' } };
    expect(cachedSearchText(changed, cols)).toContain('two');
    expect(cachedSearchText(r, [cols[2]])).toContain('one');
  });
  it('searches 100 000 rows quickly', () => {
    const big = Array.from({ length: 100_000 }, (_, i) => row(`g${i}`, i, { title: `Post ${i}`, note: i % 2 ? 'odd' : 'even' }));
    buildView(big, { columns: cols, query: { ...noQuery, search: 'post 9999' } }); // warms the cache
    const t0 = Date.now();
    const v = buildView(big, { columns: cols, query: { ...noQuery, search: 'post 99999' } });
    expect(v.length).toBe(1);
    expect(Date.now() - t0).toBeLessThan(300);
  });
});

describe('query helpers', () => {
  it('isQueryActive / queryKey', () => {
    expect(isQueryActive(noQuery, cols)).toBe(false);
    expect(isQueryActive({ ...noQuery, search: ' ' }, cols)).toBe(false);
    expect(isQueryActive({ ...noQuery, search: 'a' }, cols)).toBe(true);
    expect(isQueryActive({ ...noQuery, sort: { key: 'title', direction: 'asc' } }, cols)).toBe(true);
    expect(isQueryActive({ ...noQuery, filters: { sec: { op: 'eq', value: '1' } } }, cols)).toBe(true);
    expect(isQueryActive({ ...noQuery, filters: { sec: { op: 'eq', value: '' } } }, cols)).toBe(false);
    expect(queryKey(noQuery)).toBe(queryKey({ ...noQuery }));
    expect(queryKey(noQuery)).not.toBe(queryKey({ ...noQuery, search: 'x' }));
  });
});

describe('drag math', () => {
  it('dropIndexAt stays inside the list', () => {
    expect(dropIndexAt(0, 72, 100)).toBe(0);
    expect(dropIndexAt(143, 72, 100)).toBe(1);
    expect(dropIndexAt(144, 72, 100)).toBe(2);
    expect(dropIndexAt(-50, 72, 100)).toBe(0);
    expect(dropIndexAt(1e9, 72, 100)).toBe(99);
    expect(dropIndexAt(10, 72, 0)).toBe(0);
  });
  it('autoScrollSpeed: 0 in the middle, up near the top, down near the bottom, faster closer to the edge', () => {
    expect(autoScrollSpeed(300, 600)).toBe(0);
    expect(autoScrollSpeed(10, 600)).toBeLessThan(0);
    expect(autoScrollSpeed(590, 600)).toBeGreaterThan(0);
    expect(Math.abs(autoScrollSpeed(0, 600))).toBeGreaterThan(Math.abs(autoScrollSpeed(60, 600)));
    expect(autoScrollSpeed(10, 0)).toBe(0);
  });
  it('clampScroll keeps the offset in the content (500 000 rows too)', () => {
    expect(clampScroll(-5, 100, 72, 600)).toBe(0);
    expect(clampScroll(1e9, 100, 72, 600)).toBe(100 * 72 - 600);
    expect(clampScroll(50, 3, 72, 600)).toBe(0);
    expect(clampScroll(1e12, 500_000, 72, 600)).toBe(500_000 * 72 - 600);
  });
  it('reorderResult: the new orderInList lies between the new neighbours (ascending and descending list)', () => {
    const asc = reorderResult(rows, 0, 2)!; // a goes to the end: after c (30)
    expect(asc.guid).toBe('a');
    expect(asc.orderInList).toBeGreaterThan(30);
    const mid = reorderResult(rows, 2, 1)!; // c between a and b
    expect(mid.guid).toBe('c');
    expect(mid.orderInList).toBeGreaterThan(10);
    expect(mid.orderInList).toBeLessThan(20);
    const desc = [rows[2], rows[1], rows[0]]; // c b a (descending)
    const d = reorderResult(desc, 2, 0)!; // a to the top: higher than c (30)
    expect(d.guid).toBe('a');
    expect(d.orderInList).toBeGreaterThan(30);
    const d2 = reorderResult(desc, 0, 1)!; // c between b (20) and a (10) -> after b: 15
    expect(d2.orderInList).toBeLessThan(20);
    expect(d2.orderInList).toBeGreaterThan(10);
    expect(reorderResult(rows, 1, 1)).toBeNull();
    expect(reorderResult(rows, 0, 9)).toBeNull();
  });
});

describe('web scroll limit', () => {
  it('a browser scrolls about 17 million px safely: ~236 000 rows of 72 px', () => {
    const { webRowLimit, WEB_MAX_SCROLL_PX } = require('../../../kit8/ui/components/list/reusable/listEngine');
    expect(WEB_MAX_SCROLL_PX).toBeLessThan(17_895_697);
    expect(webRowLimit(72)).toBe(236111);
    expect(webRowLimit(0)).toBe(WEB_MAX_SCROLL_PX);
  });
});
