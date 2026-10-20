// The VAT columns of the lines of the four documents (kit8/documents/vat): the rate from the catalog, the typed accounting sums.
import { accountingColumns, lineHasPlanRate, vatRateColumn, vatRateLabel, vatRateOfLine } from '../../../kit8/documents/vat/documentVatColumns';

const rates = [
  { rowGUID: 'vat_0', orderInList: 7000, rowJSON: { vatTableTitle: '0 %', vatTablePercent: 0 } },
  { rowGUID: 'vat_21', orderInList: 1000, rowJSON: { vatTableTitle: '21 %', vatTablePercent: 21 } },
  { rowGUID: 'vat_nd10', orderInList: 9000, rowJSON: { vatTableTitle: '10 % not deductible', vatTablePercent: 10, vatRecoverablePercent: 0 } },
];
const line = (over: Record<string, any> = {}) => ({ rowGUID: 'l1', vatRatioInvoiced: 21, rowJSON: {}, ...over } as any);

describe('the VAT rate column', () => {
  const col = vatRateColumn({ data: { valueAddedTax: rates }, editable: true, ratioKey: 'vatRatioInvoiced' }) as any;
  it('is a select of the catalog, saved in rowJSON.vatRateGUID, never empty', () => {
    expect(col).toMatchObject({ key: 'vat', type: 'select', field: 'vatRateGUID', editable: true, allowEmpty: false });
    expect(col.options(line()).map((o: any) => o.value)).toEqual(['vat_21', 'vat_0', 'vat_nd10']);          // by orderInList
    expect(col.options(line()).map((o: any) => o.label)).toEqual(['21 %', '0 %', '10 % not deductible']);
  });
  it('a line with a rate GUID shows it; a legacy line shows the catalog rate with the same percent', () => {
    expect(col.fromStored(null, line({ rowJSON: { vatRateGUID: 'vat_nd10' } }))).toBe('vat_nd10');
    expect(col.fromStored(null, line({ vatRatioInvoiced: 21 }))).toBe('vat_21');
    expect(col.fromStored(null, line({ vatRatioInvoiced: 0 }))).toBe('vat_0');
  });
  it('a percent that is in no catalog row is a rate of its own: shown, offered as the current option, refused if chosen', () => {
    expect(col.fromStored(null, line({ vatRatioInvoiced: 7.5 }))).toBe('custom:7.5');
    expect(col.options(line({ vatRatioInvoiced: 7.5 })).map((o: any) => o.label)).toContain('7.5 %');
    expect(col.validate('custom:7.5')).toMatch(/catalog/);
    expect(col.validate('vat_21')).toBeNull();
  });
  it('a posted document edits nothing', () => {
    expect((vatRateColumn({ data: { valueAddedTax: rates }, editable: false, ratioKey: 'vatRatioInvoiced' }) as any).editable).toBe(false);
  });
  it('labels', () => {
    expect(vatRateLabel(rates[1])).toBe('21 %');
    expect(vatRateLabel({ rowJSON: { vatTablePercent: 5 } })).toBe('5 %');
    expect(vatRateOfLine(rates, line({ vatRatioInvoiced: null }), 'vatRatioInvoiced')).toBe('');
  });
});

describe('the accounting columns', () => {
  const cols = accountingColumns({ editable: true, tableName: 'vendor_invoice_lines' }) as any[];
  it('in order: budget (net), budget VAT, accounting before VAT, VAT for accounting, the TOTAL with VAT', () => {
    expect(cols.map((c) => c.key)).toEqual(['sumForBudget', 'vatForBudget', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT', 'sumForAccounting']);
  });
  it('the two typed columns are editable in a draft; the others are read only; a posted document edits none', () => {
    expect(cols.filter((c) => c.editable === true).map((c) => c.key)).toEqual(['sumForAccountingBeforeVAT', 'sumForAccountingVAT']);
    expect(accountingColumns({ editable: false, tableName: 't' }).every((c: any) => c.editable === false)).toBe(true);
    expect(cols.find((c) => c.key === 'sumForAccounting').title).toMatch(/with VAT/);
  });
  it('a typed sum needs a plan rate on the line (a plan price and a unit sum)', () => {
    expect(lineHasPlanRate(line({ rowJSON: { priceTaskLine: 5, unitSumForAccounting: 8 } }))).toBe(true);
    expect(lineHasPlanRate(line({ rowJSON: { priceTaskLine: 5 } }))).toBe(false);
    expect(lineHasPlanRate(line({ rowJSON: {} }))).toBe(false);
    const typed = cols.find((c) => c.key === 'sumForAccountingBeforeVAT');
    expect(typed.validate(100, line({ rowJSON: { priceTaskLine: 5, unitSumForAccounting: 8 } }))).toBeNull();
    expect(typed.validate(100, line())).toMatch(/no plan rate/);
  });
});
