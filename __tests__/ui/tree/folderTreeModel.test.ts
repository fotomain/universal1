// TREE.PLUGIN - folderTreeModel (pure): index, flatten, search, counts, moves, 200k speed.
import {
  buildSearchMask, buildTreeIndex, computeSubtreeTotals, countItemsByFolder, dropPositionAt, flattenTree, FolderTreeNode, orderBetween,
  pathOf, planCreate, planDuplicate, planMove, planStep, subtreeIds, treeOps,
} from '../../../kit8/ui/components/tree/folderTreeModel';

const n = (id: string, parentId: string | null, title = id, order?: number): FolderTreeNode => ({ id, parentId, title, order });
//  A            B
//  ├ A1         └ B1
//  │ └ A1a
//  └ A2
const sample = [n('A', null, 'Alpha', 1000), n('A1', 'A', 'Alpha one', 1000), n('A1a', 'A1', 'Deep', 1000), n('A2', 'A', 'Alpha two', 2000), n('B', 'empty', 'Beta', 2000), n('B1', 'B', 'Beta one', 1000)];
const ids = (ix: ReturnType<typeof buildTreeIndex>, flat: ReturnType<typeof flattenTree>) => Array.from(flat.idx).map((i) => ix.nodes[i].id);

describe('index + flatten', () => {
  it('shows only the open folders, in order, with depth', () => {
    const ix = buildTreeIndex(sample);
    expect(ids(ix, flattenTree(ix, { expanded: new Set() }))).toEqual(['A', 'B']);
    const flat = flattenTree(ix, { expanded: new Set(['A', 'A1']) });
    expect(ids(ix, flat)).toEqual(['A', 'A1', 'A1a', 'A2', 'B']);
    expect(Array.from(flat.depth)).toEqual([0, 1, 2, 1, 0]);
    expect(ids(ix, flattenTree(ix, { expanded: new Set(), expandAll: true }))).toHaveLength(6);
  });
  it('sorts siblings by order, whatever the list order is', () => {
    const ix = buildTreeIndex([n('x', null, 'x', 3), n('y', null, 'y', 1), n('z', null, 'z', 2)]);
    expect(ids(ix, flattenTree(ix, { expanded: new Set() }))).toEqual(['y', 'z', 'x']);
  });
  it('a missing parent becomes a top level folder; a parent loop is cut', () => {
    const ix = buildTreeIndex([n('a', 'zzz'), n('p', 'q'), n('q', 'p'), n('self', 'self')]);
    expect(ix.orphans).toBe(2);
    expect(ix.loops).toBe(1);
    const all = ids(ix, flattenTree(ix, { expanded: new Set(), expandAll: true }));
    expect(all.sort()).toEqual(['a', 'p', 'q', 'self']);
  });
  it('search: matches + their ancestors, opened', () => {
    const ix = buildTreeIndex(sample);
    const { mask, matches } = buildSearchMask(ix, 'deep');
    expect(matches).toBe(1);
    expect(ids(ix, flattenTree(ix, { expanded: new Set(), mask }))).toEqual(['A', 'A1', 'A1a']);
    expect(buildSearchMask(ix, '').matches).toBe(0);
  });
  it('path, subtree', () => {
    const ix = buildTreeIndex(sample);
    expect(pathOf(ix, ix.idToIdx.get('A1a')!)).toEqual(['Alpha', 'Alpha one', 'Deep']);
    expect(subtreeIds(ix, ix.idToIdx.get('A')!).sort()).toEqual(['A', 'A1', 'A1a', 'A2']);
  });
});

describe('counts', () => {
  it('items per folder incl. subfolders', () => {
    const ix = buildTreeIndex(sample);
    const direct = countItemsByFolder([{ f: 'A1a' }, { f: 'A1a' }, { f: 'A2' }, { f: 'B' }, { f: 'empty' }, { f: null }], (x) => x.f);
    expect(direct.get('empty')).toBe(2);
    const t = computeSubtreeTotals(ix, direct);
    const at = (id: string) => t[ix.idToIdx.get(id)!];
    expect([at('A1a'), at('A1'), at('A2'), at('A'), at('B'), at('B1')]).toEqual([2, 2, 1, 3, 1, 0]);
  });
});

describe('moves', () => {
  const ix = buildTreeIndex(sample);
  const I = (id: string) => ix.idToIdx.get(id)!;
  it('drop positions', () => {
    expect(dropPositionAt(2, 28, true, true)).toBe('before');
    expect(dropPositionAt(14, 28, true, true)).toBe('inside');
    expect(dropPositionAt(26, 28, true, true)).toBe('after');
    expect(dropPositionAt(26, 28, true, false)).toBe('inside');
    expect(dropPositionAt(20, 28, false, true)).toBe('after');
  });
  it('never into itself or its own subtree', () => {
    expect(planMove(ix, I('A'), I('A1a'), 'inside')).toMatchObject({ ok: false, reason: 'inside-itself' });
    expect(planMove(ix, I('A'), I('A'), 'before')).toMatchObject({ ok: false, reason: 'self' });
  });
  it('inside = last child of the target', () => {
    const p = planMove(ix, I('B1'), I('A'), 'inside');
    expect(p).toMatchObject({ ok: true, parentId: 'A', order: 3000 });
  });
  it('before / after put the node between its neighbours', () => {
    expect(planMove(ix, I('B'), I('A2'), 'before')).toMatchObject({ ok: true, parentId: 'A', order: 1500 });
    expect(planMove(ix, I('B'), I('A'), 'before')).toMatchObject({ ok: true, parentId: null, order: 0 });
    expect(planMove(ix, I('A1a'), I('A'), 'after', { targetExpanded: false })).toMatchObject({ ok: true, parentId: null, order: 1500 });
    // after an OPEN folder with children = its first child
    expect(planMove(ix, I('B1'), I('A'), 'after', { targetExpanded: true })).toMatchObject({ ok: true, parentId: 'A', order: 0 });
  });
  it('the same slot is no move', () => {
    expect(planMove(ix, I('A2'), I('A1'), 'after')).toMatchObject({ ok: false, reason: 'same-place' });
    expect(planMove(ix, I('A2'), I('A'), 'inside')).toMatchObject({ ok: false, reason: 'same-place' });
  });
  it('step up / down among siblings', () => {
    expect(planStep(ix, I('A2'), -1)).toMatchObject({ ok: true, parentId: 'A', order: 0 });
    expect(planStep(ix, I('A1'), -1)).toBeNull();
    expect(planStep(ix, I('A'), 1)).toMatchObject({ ok: true, parentId: null, order: 3000 });
  });
  it('create + duplicate', () => {
    expect(planCreate(ix, ix.n)).toEqual({ parentId: null, order: 3000 });
    expect(planCreate(ix, I('A'), I('A1'))).toEqual({ parentId: 'A', order: 1500 });
    let k = 0;
    const dup = planDuplicate(ix, I('A'), () => `d${++k}`)!;
    expect(dup).toHaveLength(4);
    expect(dup[0]).toMatchObject({ id: 'd1', parentId: null, title: 'Alpha (copy)', order: 1500 });
    expect(dup.find((d) => d.title === 'Deep')!.parentId).toBe(dup.find((d) => d.title === 'Alpha one')!.id);
    expect(planDuplicate(ix, I('A'), () => 'x', undefined, 2)).toBeNull();
  });
  it('order between keeps room', () => {
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderBetween(undefined, 5)).toBeLessThan(5);
    const m = orderBetween(1, 1 + Number.EPSILON * 4);
    expect(m).toBeGreaterThan(1);
  });
  it('treeOps are immutable', () => {
    const a = treeOps.rename(sample, 'A', 'Z');
    expect(a).not.toBe(sample);
    expect(sample[0].title).toBe('Alpha');
    expect(treeOps.remove(sample, new Set(['A', 'A1'])).map((x) => x.id)).toEqual(['A1a', 'A2', 'B', 'B1']);
    expect(treeOps.move(sample, 'B1', 'A', 7).find((x) => x.id === 'B1')).toMatchObject({ parentId: 'A', order: 7 });
  });
});

describe('big data', () => {
  it('200 000 folders: index + flatten + search + totals are fast', () => {
    const N = 200_000;
    const nodes: FolderTreeNode[] = [];
    for (let i = 0; i < N; i++) nodes.push({ id: `f${i}`, parentId: i < 20 ? null : `f${Math.floor((i - 20) / 4)}`, title: `Folder ${i}`, order: i });
    const t0 = Date.now();
    const ix = buildTreeIndex(nodes);
    const tIndex = Date.now() - t0;
    const flat = flattenTree(ix, { expanded: new Set(['f0', 'f1']) });
    const all = flattenTree(ix, { expanded: new Set(), expandAll: true });
    const { matches } = buildSearchMask(ix, 'folder 19999');
    const totals = computeSubtreeTotals(ix, new Map([['f199999', 5]]));
    const t = Date.now() - t0;
    expect(ix.orphans).toBe(0);
    expect(all.length).toBe(N);
    expect(flat.length).toBeGreaterThan(20);
    expect(matches).toBeGreaterThan(0);
    expect(totals[ix.n]).toBe(5);
    // generous bounds: a CI machine is slower than a laptop
    expect(tIndex).toBeLessThan(1500);
    expect(t).toBeLessThan(4000);
    // eslint-disable-next-line no-console
    console.log(`200k: index ${tIndex} ms, everything ${t} ms`);
  });
  it('a 100 000-level chain does not overflow the stack', () => {
    const nodes: FolderTreeNode[] = [];
    for (let i = 0; i < 100_000; i++) nodes.push({ id: `c${i}`, parentId: i === 0 ? null : `c${i - 1}`, title: `c${i}` });
    const ix = buildTreeIndex(nodes);
    expect(flattenTree(ix, { expanded: new Set(), expandAll: true }).length).toBe(100_000);
    expect(subtreeIds(ix, 0)).toHaveLength(100_000);
    expect(computeSubtreeTotals(ix, new Map([['c99999', 1]]))[0]).toBe(1);
  });
});
