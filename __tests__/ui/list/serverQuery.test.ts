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
  it('filters: starts with / ends with / not equal / does not contain (an empty cell passes the last two)', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, filters: {
      title: { op: 'startsWith', value: 'moon' }, desc: { op: 'endsWith', value: 'sun' }, kind: { op: 'neq', value: 'vi"deo' }, owner: { op: 'notContains', value: 'a,b' },
    } });
    expect(calls).toContainEqual(['ilike', 'rowJSON->>mediaPostTitle', 'moon%']);
    expect(calls).toContainEqual(['ilike', 'rowJSON->>mediaPostDescription', '%sun']);
    expect(calls).toContainEqual(['or', 'rowJSON->>mediaKind.is.null,rowJSON->>mediaKind.neq."vi\\"deo"']);
    expect(calls).toContainEqual(['or', 'rowOwnerGUID.is.null,rowOwnerGUID.not.ilike.*a b*']);
  });
  it('filters of a number column: > < between (From > To is turned round) one of, not equal; invalid operands are not sent', () => {
    const { b, calls } = fake();
    applyServerQuery(b, { ...base, filters: { sec: { op: 'between', value: '20', value2: '10,5' } } });
    expect(calls).toContainEqual(['gte', 'rowJSON->mediaDurationSec', 10.5]);
    expect(calls).toContainEqual(['lte', 'rowJSON->mediaDurationSec', 20]);
    const o = fake();
    applyServerQuery(o.b, { ...base, filters: { sec: { op: 'oneOf', value: '1, 2 ; x, 3' } } });
    expect(o.calls).toContainEqual(['in', 'rowJSON->mediaDurationSec', [1, 2, 3]]);
    const g = fake();
    applyServerQuery(g.b, { ...base, filters: { sec: { op: 'gt', value: '5' } } });
    expect(g.calls).toContainEqual(['gt', 'rowJSON->mediaDurationSec', 5]);
    const l = fake();
    applyServerQuery(l.b, { ...base, filters: { sec: { op: 'lt', value: '5' } } });
    expect(l.calls).toContainEqual(['lt', 'rowJSON->mediaDurationSec', 5]);
    const n = fake();
    applyServerQuery(n.b, { ...base, filters: { sec: { op: 'neq', value: '5' } } });
    expect(n.calls).toContainEqual(['or', 'rowJSON->mediaDurationSec.is.null,rowJSON->mediaDurationSec.neq.5']);
    const bad = fake();
    applyServerQuery(bad.b, { ...base, filters: { sec: { op: 'between', value: '1', value2: 'x' } } });
    expect(names(bad.calls)).not.toContain('gte');
    expect(names(bad.calls)).not.toContain('lte');
  });
  it('filters of a date column: the typed form is turned into YYYY-MM-DD, text compare', () => {
    const dcols: VisualColumn[] = [{ key: 'due', title: 'Due', type: 'date', field: 'due' }];
    const run = (f: any) => { const x = fake(); applyServerQuery(x.b, { ...base, columns: dcols, filters: { due: f } }); return x.calls; };
    expect(run({ op: 'eq', value: '05.01.2026' })).toContainEqual(['eq', 'rowJSON->>due', '2026-01-05']);
    expect(run({ op: 'gte', value: '20260105' })).toContainEqual(['gte', 'rowJSON->>due', '2026-01-05']);
    expect(run({ op: 'between', value: '2026-01-31', value2: '2026-01-01' })).toEqual(expect.arrayContaining([['gte', 'rowJSON->>due', '2026-01-01'], ['lte', 'rowJSON->>due', '2026-01-31']]));
    expect(run({ op: 'oneOf', value: '2026-01-05,06.01.2026' })).toContainEqual(['in', 'rowJSON->>due', ['2026-01-05', '2026-01-06']]);
    expect(names(run({ op: 'gt', value: 'soon' }))).not.toContain('gt');
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
