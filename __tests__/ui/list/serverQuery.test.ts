// ReusableList, serverDataMode - the query of one page, with a fake PostgREST builder
import { applyServerQuery, defaultSearchFields, hasMorePages, rowsOf, safeSearchText, serverColumnPath } from '../../../kit8/ui/components/list/reusable/serverQuery';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

const cols: VisualColumn[] = [
  { key: 'title', title: 'Title', type: 'text', field: 'mediaPostTitle' },
  { key: 'desc', title: 'Desc', type: 'text', field: 'mediaPostDescription' },
  { key: 'sec', title: 'Sec', type: 'number', field: 'mediaDurationSec' },
  { key: 'owner', title: 'Owner', type: 'text', target: 'rowOwnerGUID' },
  { key: 'kind', title: 'Kind', type: 'select', field: 'mediaKind', options: [] },
];

/** records every call of the chain */
function fake() {
  const calls: any[][] = [];
  const b: any = new Proxy({}, { get: (_t, name: string) => (...args: any[]) => { calls.push([name, ...args]); return b; } });
  return { b, calls };
}
const base = { scope: { rowOwnerGUID: 'u1', rowParentGUID: 'empty' }, columns: cols, search: '', searchFields: ['mediaPostTitle'], filters: {}, sort: null, direction: 'asc' as const, from: 0, to: 49 };
const names = (calls: any[][]) => calls.map((c) => c[0]);

describe('serverColumnPath', () => {
  it('rowJSON text = ->>, rowJSON number = ->, a root column is itself', () => {
    expect(serverColumnPath(cols[0])).toBe('rowJSON->>mediaPostTitle');
    expect(serverColumnPath(cols[2])).toBe('rowJSON->mediaDurationSec');
    expect(serverColumnPath(cols[3])).toBe('rowOwnerGUID');
  });
  it('default search fields = the text columns of rowJSON', () => expect(defaultSearchFields(cols)).toEqual(['mediaPostTitle', 'mediaPostDescription']));
  it('search text loses PostgREST syntax characters', () => expect(safeSearchText('a,b(c)"d*%\\e')).toBe('a b c d e'));
});

describe('applyServerQuery', () => {
  it('first page: select with count, scope, order by orderInList, range', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, count: 'exact' });
    expect(calls[0]).toEqual(['select', '*', { count: 'exact' }]);
    expect(calls).toContainEqual(['match', { rowOwnerGUID: 'u1', rowParentGUID: 'empty' }]);
    expect(calls).toContainEqual(['order', 'orderInList', { ascending: true }]);
    expect(calls[calls.length - 1]).toEqual(['range', 0, 49]);
  });
  it('next page: no count; descending order', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, direction: 'desc', from: 50, to: 99, count: null });
    expect(calls[0]).toEqual(['select', '*', undefined]);
    expect(calls).toContainEqual(['order', 'orderInList', { ascending: false }]);
    expect(calls[calls.length - 1]).toEqual(['range', 50, 99]);
  });
  it('search = one or() over the search fields', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, search: 'sun, set', searchFields: ['mediaPostTitle', 'mediaPostDescription'] });
    expect(calls).toContainEqual(['or', 'rowJSON->>mediaPostTitle.ilike.*sun set*,rowJSON->>mediaPostDescription.ilike.*sun set*']);
  });
  it('no search fields or an empty search: no or()', () => {
    const a = fake(); applyServerQuery(a.b, { ...base, search: 'x', searchFields: [] });
    const c = fake(); applyServerQuery(c.b, { ...base, search: '   ' });
    expect(names(a.calls)).not.toContain('or');
    expect(names(c.calls)).not.toContain('or');
  });
  it('filters: contains / eq / gte / lte / empty / notEmpty', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, filters: {
      title: { op: 'contains', value: 'moon' }, sec: { op: 'gte', value: '12,5' }, kind: { op: 'eq', value: 'video' }, desc: { op: 'empty' }, owner: { op: 'notEmpty' },
    } });
    expect(calls).toContainEqual(['ilike', 'rowJSON->>mediaPostTitle', '%moon%']);
    expect(calls).toContainEqual(['gte', 'rowJSON->mediaDurationSec', 12.5]);
    expect(calls).toContainEqual(['eq', 'rowJSON->>mediaKind', 'video']);
    expect(calls).toContainEqual(['is', 'rowJSON->>mediaPostDescription', null]);
    expect(calls).toContainEqual(['not', 'rowOwnerGUID', 'is', null]);
  });
  it('a number filter with a value that is no number is not sent; a filter without a value is not sent', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, filters: { sec: { op: 'eq', value: 'abc' }, title: { op: 'contains', value: '  ' } } });
    expect(names(calls)).not.toContain('eq');
    expect(names(calls)).not.toContain('ilike');
  });
  it('a column sort goes first, orderInList breaks the ties', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, sort: { key: 'sec', direction: 'desc' } });
    const orders = calls.filter((c) => c[0] === 'order');
    expect(orders[0]).toEqual(['order', 'rowJSON->mediaDurationSec', { ascending: false, nullsFirst: false }]);
    expect(orders[1]).toEqual(['order', 'orderInList', { ascending: true }]);
  });
  it('all-rows mode (no scope): no match', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, scope: {} });
    expect(names(calls)).not.toContain('match');
  });
});

describe('answers', () => {
  it('rowsOf keeps rows with a rowGUID', () => {
    expect(rowsOf([{ rowGUID: 'a' }, null, { x: 1 }, { rowGUID: 'b' }]).map((r) => r.rowGUID)).toEqual(['a', 'b']);
    expect(rowsOf(null)).toEqual([]);
  });
  it('hasMorePages: by the counted total, else by a full page', () => {
    expect(hasMorePages(50, 50, 50, 120)).toBe(true);
    expect(hasMorePages(120, 20, 50, 120)).toBe(false);
    expect(hasMorePages(50, 50, 50, null)).toBe(true);
    expect(hasMorePages(70, 20, 50, null)).toBe(false);
  });
});
