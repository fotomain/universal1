// The columns of the lines table and of the list table of the vendor invoice.
// the cell of the place columns (multi project) pulls the design system in: its render is tested with the form
jest.mock('../../../../kit8/documents/vendor/lineplace/LinePlaceCell', () => ({ __esModule: true, default: () => null }));
import { buildVendorInvoiceColumns } from '../../../../kit8/documents/vendor/invoice/vendorInvoiceColumns';
import { vendorInvoiceListColumns } from '../../../../kit8/documents/vendor/invoice/vendorInvoiceListColumns';
import { emptyTaskLineCatalogs } from '../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { VendorInvoiceListRow } from '../../../../kit8/documents/vendor/invoice/vendorInvoiceModel';

describe('the lines of a document', () => {
  const data = emptyTaskLineCatalogs();
  const cols = (tab: string, editable: boolean) => buildVendorInvoiceColumns({ data, tab, editable });
  it('the All tab has the Kind column; a genus tab does not', () => {
    expect(cols('all', true).map((c) => c.key)).toEqual(['n', 'genus', 'role', 'resource', 'unit', 'qty', 'price', 'vat', 'sumForContract', 'vatForContract', 'sumWithVAT', 'sumForBudget', 'vatForBudget', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT', 'sumForAccounting']);
    expect(cols('timeGenus', true).map((c) => c.key)).not.toContain('genus');
  });
  it('a DRAFT edits the quantity, the price, the VAT rate (catalog) and the two accounting sums; the other sums are read only', () => {
    const c = cols('all', true);
    expect(c.filter((x: any) => x.editable === true).map((x) => x.key)).toEqual(['qty', 'price', 'vat', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT']);
    expect(c.find((x) => x.key === 'qty')).toMatchObject({ target: 'qtyInvoiced', type: 'number' });
    expect(c.find((x) => x.key === 'price')).toMatchObject({ target: 'priceInvoiced' });
    expect(c.find((x) => x.key === 'vat')).toMatchObject({ type: 'select', field: 'vatRateGUID', allowEmpty: false });
    expect(c.find((x) => x.key === 'sumForAccountingBeforeVAT')).toMatchObject({ target: 'sumForAccountingBeforeVAT', type: 'number' });
  });
  it('a POSTED document edits nothing', () => {
    expect(cols('all', false).filter((x: any) => x.type !== 'rowNumber').every((x: any) => x.editable === false)).toBe(true);
  });
  it('the sums are root columns computed by the database; with VAT = before + VAT, to the cent', () => {
    const c = cols('all', true);
    expect(c.find((x) => x.key === 'sumForContract')).toMatchObject({ target: 'sumForContract', editable: false });
    const withVat = c.find((x) => x.key === 'sumWithVAT') as any;
    expect(withVat.fromStored(null, { sumForContract: '10.10', vatForContract: '2.12' })).toBe(12.22);
    expect(withVat.fromStored(null, { sumForContract: null, vatForContract: null })).toBe(0);
  });
  it('the Kind cell names the genus', () => {
    const kind = cols('all', true).find((x) => x.key === 'genus') as any;
    expect(['timeGenus', 'materialGenus', 'expenseGenus'].map((g) => kind.fromStored(null, { genusGUID: g }))).toEqual(['Time', 'Material', 'Expenses']);
  });
  it('the resource cell reads the catalog of the line: person / equipment (Time), product (Material)', () => {
    const res = cols('all', true).find((x) => x.key === 'resource') as any;
    expect(res.catalogEntityNameOf({ genusGUID: 'timeGenus', rowJSON: {} })).toBe('personReusable');
    expect(res.catalogEntityNameOf({ genusGUID: 'timeGenus', rowJSON: { taskResourceKind: 'equipment' } })).toBe('equipmentReusable');
    expect(res.catalogEntityNameOf({ genusGUID: 'materialGenus', rowJSON: {} })).toMatch(/product/i);
  });
});

describe('the list', () => {
  const row = (over: Partial<VendorInvoiceListRow> = {}): VendorInvoiceListRow => ({
    documentGUID: 'd1', documentNumber: 'VI-00001', documentStatus: 'posted', vendorInvoiceNumber: 'INV-1', vendorInvoiceDateTime: '2026-10-20T00:00:00Z', vendorInvoiceDay: '2026-10-20', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA',
    partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply', currency: 'EUR', folder: 'le-1:vp-1', authorGUID: 'u1', authorName: 'Anna K', lineCount: 2, sumBeforeVAT: 50, sumVAT: 10.5, sumWithVAT: 60.5, ...over,
  });
  const cols = vendorInvoiceListColumns((r) => (r.rowGUID === 'd1' ? row() : undefined));
  const read = (key: string, guid = 'd1') => (cols.find((c) => c.key === key) as any).fromStored(null, { rowGUID: guid });
  it('the columns of the doc, in order', () => {
    expect(cols.map((c) => c.key)).toEqual(['n', 'vendorInvoiceNumber', 'document', 'vendorInvoiceDate', 'vendorInvoicePartner', 'sumBeforeVAT', 'currency', 'sumVAT', 'sumWithVAT', 'contractInfo', 'vendorInvoiceLegalEntity', 'status', 'author', 'lines']);
  });
  it('every cell reads the list row by GUID; a row that is not read yet is blank / 0', () => {
    expect([read('vendorInvoiceNumber'), read('vendorInvoiceDate'), read('vendorInvoicePartner'), read('currency'), read('contractInfo'), read('vendorInvoiceLegalEntity'), read('status'), read('author')])
      .toEqual(['INV-1', '2026-10-20', 'Acme', 'EUR', 'S-1 · Supply', 'Acme SIA', 'Posted', 'Anna K']);
    expect([read('sumBeforeVAT'), read('sumVAT'), read('sumWithVAT'), read('lines')]).toEqual([50, 10.5, 60.5, 2]);
    expect([read('vendorInvoicePartner', 'zz'), read('sumWithVAT', 'zz'), read('lines', 'zz')]).toEqual(['', 0, 0]);
  });
  it('all read only; the money has NO footer sum (the totals are per currency)', () => {
    expect(cols.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
    ['sumBeforeVAT', 'sumVAT', 'sumWithVAT'].forEach((k) => expect(cols.find((c) => c.key === k)).toMatchObject({ type: 'number', total: false }));
  });
});
