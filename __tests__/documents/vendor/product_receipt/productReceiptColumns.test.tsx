/** @jest-environment jsdom */
// productReceiptColumns: the columns of the lines table (qty / price / VAT % are editable in a draft only; the place columns of a Multi Project receipt are read only).
// the cell of the place columns pulls the design system in: its render is tested with the form
jest.mock('../../../../kit8/documents/vendor/lineplace/LinePlaceCell', () => ({ __esModule: true, default: () => null }));
import { emptyTaskLineCatalogs } from '../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { buildProductReceiptColumns } from '../../../../kit8/documents/vendor/product_receipt/productReceiptColumns';
import { productReceiptListColumns } from '../../../../kit8/documents/vendor/product_receipt/productReceiptListColumns';

const data = emptyTaskLineCatalogs();
const build = (over: Record<string, any> = {}) => buildProductReceiptColumns({ data, tab: 'all', editable: true, ...over });
const keys = (cols: any[]) => cols.map((c) => c.key);

it('the columns of the All tab: # · Kind · Role · Resource · Unit · Qty · Price · VAT % · the sums', () => {
  expect(keys(build())).toEqual(['n', 'genus', 'role', 'resource', 'unit', 'qty', 'price', 'vat', 'sumForContract', 'vatForContract', 'sumWithVAT', 'sumForBudget', 'sumForAccounting']);
  expect(keys(build({ tab: 'timeGenus' }))).not.toContain('genus');
});
it('qty, price and VAT % are the real columns of the receipt and editable only in a draft', () => {
  const cols = build();
  const by = (k: string) => cols.find((c: any) => c.key === k) as any;
  expect([by('qty').target, by('price').target, by('vat').target]).toEqual(['qtyReceived', 'priceReceived', 'vatRatioReceived']);
  expect([by('qty').editable, by('price').editable, by('vat').editable]).toEqual([true, true, true]);
  const ro = build({ editable: false }) as any[];
  expect(ro.filter((c) => ['qty', 'price', 'vat'].includes(c.key)).map((c) => c.editable)).toEqual([false, false, false]);
});
it('the description of a line (role, resource, unit) is read only unless the line is independent', () => {
  const cols = build() as any[];
  expect(cols.filter((c) => ['role', 'resource', 'unit'].includes(c.key)).map((c) => c.editable)).toEqual([false, false, false]);
  const ind = build({ independent: true }) as any[];
  expect(ind.filter((c) => ['role', 'resource', 'unit'].includes(c.key)).map((c) => c.editable)).toEqual([true, true, true]);
  expect(ind[2].validate(null, { taskLineGUID: 'tl1' })).toMatch(/only the quantity/);
  expect(ind[2].validate(null, {})).toBeNull();
});
it('Multi Project: Project · Task · Task line after # - all read only', () => {
  const cols = build({ multiProject: true, places: { r1: { projectName: 'Alpha', taskName: 'Task 1', taskLineGUID: 'tl1' } } }) as any[];
  expect(keys(cols).slice(0, 4)).toEqual(['n', 'productReceiptLineProject', 'productReceiptTaskGUID', 'productReceiptTaskLineGUID']);
  expect(cols.slice(1, 4).map((c) => c.editable)).toEqual([false, false, false]);
  expect(cols[1].searchText({ rowGUID: 'r1' })).toBe('Alpha');
  expect(cols[2].searchText({ rowGUID: 'r1' })).toBe('Task 1');
});
it('Sum with VAT = sum before VAT + VAT', () => {
  const c = build().find((x: any) => x.key === 'sumWithVAT') as any;
  expect(c.fromStored(null, { sumForContract: '25', vatForContract: '5.25' })).toBe(30.25);
});
it('the list columns: the purchase order the receipt came from is one of them', () => {
  const cols = productReceiptListColumns(() => undefined) as any[];
  expect(keys(cols)).toEqual(expect.arrayContaining(['productReceiptNumber', 'document', 'productReceiptDate', 'purchaseOrder', 'productReceiptPartner', 'sumBeforeVAT', 'currency', 'sumWithVAT', 'status', 'lines']));
  expect(cols.find((c) => c.key === 'purchaseOrder').fromStored(null, { rowGUID: 'x' })).toBe('');
});
