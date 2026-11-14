// ReusableList - selection and drag stores
import { createDragStore, createSelectionStore } from '../../../kit8/ui/components/list/reusable/listStores';

const view = ['a', 'b', 'c', 'd'].map((id) => ({ rowGUID: id }));

describe('selection store', () => {
  it('toggle / set / clear / count / idsOf in view order', () => {
    const s = createSelectionStore();
    s.toggle('c'); s.toggle('a');
    expect(s.isSelected('a')).toBe(true);
    expect(s.count(4)).toBe(2);
    expect(s.idsOf(view)).toEqual(['a', 'c']);
    s.toggle('a');
    expect(s.idsOf(view)).toEqual(['c']);
    s.set(['b', 'd']);
    expect(s.idsOf(view)).toEqual(['b', 'd']);
    s.clear();
    expect(s.count(4)).toBe(0);
  });
  it('select all is "all except": instant for any size, a tap unselects one row', () => {
    const s = createSelectionStore();
    s.selectAll();
    expect(s.isAll()).toBe(true);
    expect(s.isSelected('anything')).toBe(true);
    expect(s.count(500_000)).toBe(500_000);
    s.toggle('b');
    expect(s.isSelected('b')).toBe(false);
    expect(s.count(500_000)).toBe(499_999);
    expect(s.idsOf(view)).toEqual(['a', 'c', 'd']);
    s.toggle('b');
    expect(s.idsOf(view)).toEqual(['a', 'b', 'c', 'd']);
    s.clear();
    expect(s.isAll()).toBe(false);
    expect(s.count(4)).toBe(0);
  });
  it('notifies subscribers, version changes, clear of an empty selection is silent', () => {
    const s = createSelectionStore();
    const l = jest.fn();
    const off = s.subscribe(l);
    const v0 = s.version();
    s.clear();
    expect(l).not.toHaveBeenCalled();
    s.toggle('a');
    expect(l).toHaveBeenCalledTimes(1);
    expect(s.version()).toBeGreaterThan(v0);
    off();
    s.toggle('b');
    expect(l).toHaveBeenCalledTimes(1);
  });
  it('100 000 select all + idsOf is fast', () => {
    const big = Array.from({ length: 100_000 }, (_, i) => ({ rowGUID: `g${i}` }));
    const s = createSelectionStore();
    const t0 = Date.now();
    s.selectAll();
    s.toggle('g5');
    expect(s.idsOf(big).length).toBe(99_999);
    expect(Date.now() - t0).toBeLessThan(200);
  });
});

describe('drag store', () => {
  it('holds the dragged row and tells only on a change', () => {
    const d = createDragStore();
    const l = jest.fn();
    d.subscribe(l);
    d.set('a'); d.set('a');
    expect(d.get()).toBe('a');
    expect(l).toHaveBeenCalledTimes(1);
    d.set(null);
    expect(d.get()).toBeNull();
    expect(l).toHaveBeenCalledTimes(2);
  });
});
