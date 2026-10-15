// columnFooterTotal: the footer of a number column. Plain sum (as always), `total: false` = none, and `totalWhenSame` = the sum only while ALL the rows shown have the SAME value in the guard column
// (a quantity is a sum only in one unit), "mixed" otherwise.
import { columnFooterTotal } from '../../../kit8/ui/components/table/reusable/tableRows';

const row = (qty: any, unit: any, extra: Record<string, any> = {}) => ({ rowGUID: `r${Math.random()}`, rowOwnerGUID: 'o', rowParentGUID: 'p', orderInList: 0, rowJSON: { qty, unit, ...extra } }) as any;
const unitCol: any = { key: 'unit', title: 'Unit', type: 'select', options: [] };
const qty = (over: Record<string, any> = {}): any => ({ key: 'qty', title: 'Qty', type: 'number', ...over });

describe('without totalWhenSame (unchanged)', () => {
  it('sums the column, rounded to 6 decimals', () => {
    expect(columnFooterTotal([row(1.1, 'a'), row(2.2, 'b')], qty(), [qty(), unitCol])).toEqual({ kind: 'sum', value: 3.3, suffix: '' });
  });
  it('total: false = none', () => {
    expect(columnFooterTotal([row(1, 'a')], qty({ total: false }), [qty(), unitCol])).toEqual({ kind: 'none' });
  });
  it('empty and text values count as 0', () => {
    expect(columnFooterTotal([row(null, 'a'), row('', 'a'), row(4, 'a')], qty(), [qty(), unitCol])).toEqual({ kind: 'sum', value: 4, suffix: '' });
  });
});

describe('totalWhenSame: the unit', () => {
  const col = qty({ totalWhenSame: 'unit', totalSuffix: (u: string) => ({ pcs: 'pcs', hour: 'hour' } as any)[u] ?? '' });
  const cols = [col, unitCol];
  it('the same unit in every row: the sum, with the unit after it', () => {
    expect(columnFooterTotal([row(2, 'pcs'), row(3, 'pcs'), row(10, 'pcs')], col, cols)).toEqual({ kind: 'sum', value: 15, suffix: 'pcs' });
  });
  it('different units: mixed (no sum)', () => {
    expect(columnFooterTotal([row(2, 'pcs'), row(3, 'hour')], col, cols)).toEqual({ kind: 'mixed' });
  });
  it('one row is enough to be "the same"', () => {
    expect(columnFooterTotal([row(7, 'hour')], col, cols)).toEqual({ kind: 'sum', value: 7, suffix: 'hour' });
  });
  it('no rows: nothing to show', () => {
    expect(columnFooterTotal([], col, cols)).toEqual({ kind: 'none' });
  });
  it('overrides total: false of the column', () => {
    expect(columnFooterTotal([row(1, 'pcs')], qty({ total: false, totalWhenSame: 'unit' }), [col, unitCol])).toEqual({ kind: 'sum', value: 1, suffix: '' });
  });
  it('an empty unit is a value too: all empty = the same, empty and filled = mixed', () => {
    expect(columnFooterTotal([row(1, null), row(2, undefined), row(3, '')], col, cols)).toEqual({ kind: 'sum', value: 6, suffix: '' });
    expect(columnFooterTotal([row(1, null), row(2, 'pcs')], col, cols)).toEqual({ kind: 'mixed' });
  });
  it('without a suffix function there is no text after the sum', () => {
    expect(columnFooterTotal([row(1, 'pcs')], qty({ totalWhenSame: 'unit' }), [col, unitCol])).toEqual({ kind: 'sum', value: 1, suffix: '' });
  });
  it('a guard column that does not exist: none (a table made wrong shows nothing, not a wrong sum)', () => {
    expect(columnFooterTotal([row(1, 'pcs')], qty({ totalWhenSame: 'nope' }), [col, unitCol])).toEqual({ kind: 'none' });
  });
  it('the guard column may read the stored value through fromStored / field', () => {
    const g: any = { key: 'u', title: 'U', type: 'select', field: 'measureUnitTaskLine', options: [] };
    const rows = [{ rowGUID: 'a', rowJSON: { q: 1, measureUnitTaskLine: 'x' } }, { rowGUID: 'b', rowJSON: { q: 2, measureUnitTaskLine: 'x' } }] as any;
    expect(columnFooterTotal(rows, { key: 'q', title: 'Q', type: 'number', totalWhenSame: 'u' } as any, [g])).toEqual({ kind: 'sum', value: 3, suffix: '' });
  });
});
