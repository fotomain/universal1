// productReceiptModel: the pure rules of the product receipt - answers, states, list, filters, lines, folders, routes.
import {
  EMPTY_PRODUCT_RECEIPT_FILTER, PRODUCT_RECEIPT_ALL_TAB, PRODUCT_RECEIPT_ROUTE, ProductReceiptHeaderView, canCreateInvoiceFromReceipt, canCreateReceiptFromOrder, canDeleteProductReceipt, canEditProductReceipt, canPostProductReceipt,
  canUnpostProductReceipt, createFromSkippedText, documentsOfRoute, headerOfListRow, parseCreateFromAnswer, parseListAnswer, parsePostAnswer, productReceiptDateErrors, productReceiptDocumentPath, productReceiptFilterActive,
  productReceiptFilterToRpc, productReceiptFolderNodes, productReceiptLineSums, productReceiptLinesOf, productReceiptMissing, productReceiptProblemText, productReceiptRouteParams, productReceiptShowsPlaces,
  productReceiptTabOf, productReceiptTotals,
} from '../../../../kit8/documents/vendor/product_receipt/productReceiptModel';

const view = (over: Partial<ProductReceiptHeaderView> = {}): ProductReceiptHeaderView => ({
  guid: 'd1', number: 'PR-00001', status: 'draft', productReceiptNumber: 'GRN-1', day: '2026-10-20', legalEntityGUID: 'le-1', partnerGUID: 'vp-1', contractGUID: 'vc-1', currency: 'EUR', authorName: 'Anna', partnerTitle: 'Acme', contractInfo: 'S-1', legalEntityTitle: 'Acme SIA', ...over,
});

describe('"Create based on"', () => {
  it('the answer of the RPC is typed; a document needs its GUID; garbage is an empty answer', () => {
    expect(parseCreateFromAnswer({ documents: [{ documentGUID: 'g1', lineCount: '2' }], skipped: [{ reason: 'nothingLeftToReceive' }] })).toEqual({ documents: [{ documentGUID: 'g1', lineCount: 2 }], skipped: [{ reason: 'nothingLeftToReceive' }] });
    expect(parseCreateFromAnswer(null)).toEqual({ documents: [], skipped: [] });
  });
  it('why nothing was made', () => {
    expect(createFromSkippedText('nothingLeftToReceive')).toMatch(/already on a product receipt/);
    expect(createFromSkippedText('nothingLeftToInvoice')).toMatch(/already on a vendor invoice/);
    expect(createFromSkippedText('x')).toBe('x');
  });
  it('a receipt is made from a POSTED purchase order, an invoice from a POSTED receipt', () => {
    expect(canCreateReceiptFromOrder('posted')).toBe(true);
    expect(canCreateReceiptFromOrder('draft')).toBe(false);
    expect(canCreateReceiptFromOrder(undefined)).toBe(false);
    expect(canCreateInvoiceFromReceipt({ status: 'posted' })).toBe(true);
    expect(canCreateInvoiceFromReceipt({ status: 'draft' })).toBe(false);
  });
});

describe('states and what is missing before Post', () => {
  it('a draft can be edited, deleted and posted (with lines); a posted one can only be unposted', () => {
    expect([canEditProductReceipt(view()), canDeleteProductReceipt(view()), canPostProductReceipt(view(), 1), canPostProductReceipt(view(), 0), canUnpostProductReceipt(view())]).toEqual([true, true, true, false, false]);
    const p = view({ status: 'posted' });
    expect([canEditProductReceipt(p), canDeleteProductReceipt(p), canPostProductReceipt(p, 1), canUnpostProductReceipt(p)]).toEqual([false, false, false, true]);
  });
  it('the same list as the database: lines, vendor, legal entity, number of the receipt, date', () => {
    expect(productReceiptMissing(view(), 1)).toEqual([]);
    expect(productReceiptMissing(view({ partnerGUID: '', legalEntityGUID: '', productReceiptNumber: ' ', day: '' }), 0)).toEqual(['documentHasNoLines', 'vendorMissing', 'legalEntityMissing', 'receiptNumberMissing', 'receiptDateMissing']);
  });
  it('the texts of the problems; the post answer is typed', () => {
    expect(productReceiptProblemText('receiptNumberMissing')).toMatch(/number of the product receipt/);
    expect(productReceiptProblemText('receiptDateMissing')).toMatch(/date of the product receipt/);
    expect(productReceiptProblemText('vendorMissing')).toMatch(/product receipt/);
    expect(productReceiptProblemText('weird')).toBe('weird');
    expect(parsePostAnswer({ status: 'refused', lines: '3', problems: [{ lineGUID: 'l1', problem: 'quantityIsZero' }] })).toEqual({ status: 'refused', lines: 3, problems: [{ lineGUID: 'l1', problem: 'quantityIsZero' }] });
    expect(parsePostAnswer({ status: 'posted' }).status).toBe('posted');
    expect(parsePostAnswer(null).status).toBe('refused');
  });
});

describe('the list', () => {
  const raw = { documentGUID: 'd1', documentNumber: 'PR-00001', documentStatus: 'posted', productReceiptNumber: 'GRN-1', productReceiptDay: '2026-10-20', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA', partnerGUID: 'vp-1', partnerTitle: 'Acme',
    contractGUID: 'vc-1', contractInfo: 'S-1', currency: 'EUR', folder: 'le-1:vp-1', taskGUID: 't1', projectGUID: 'p1', projectName: 'Alpha', purchaseOrderGUID: 'po1', purchaseOrderDocument: 'PO-00001', purchaseOrderNumber: 'ORD-5',
    lineCount: 2, sumBeforeVAT: '33', sumVAT: 6.934, sumWithVAT: '39.93' };
  it('every field is typed; the purchase order it came from is part of the row', () => {
    const a = parseListAnswer({ totalCount: '1', totalsByCurrency: [{ currency: 'EUR', count: 1, sumBeforeVAT: 33, sumVAT: 6.93, sumWithVAT: 39.93 }], rows: [raw] });
    expect(a.totalCount).toBe(1);
    expect(a.rows[0]).toMatchObject({ documentStatus: 'posted', sumBeforeVAT: 33, sumVAT: 6.93, purchaseOrderGUID: 'po1', purchaseOrderDocument: 'PO-00001', purchaseOrderNumber: 'ORD-5', multiProject: false });
    expect(a.totalsByCurrency[0].sumWithVAT).toBe(39.93);
    expect(parseListAnswer(undefined)).toEqual({ totalCount: 0, totalsByCurrency: [], rows: [] });
  });
  it('the header of the form is made from a list row', () => {
    const h = headerOfListRow(parseListAnswer({ rows: [raw] }).rows[0]);
    expect(h).toMatchObject({ guid: 'd1', number: 'PR-00001', status: 'posted', productReceiptNumber: 'GRN-1', day: '2026-10-20', purchaseOrderGUID: 'po1', purchaseOrderNumber: 'ORD-5', taskGUID: 't1' });
  });
  it('the filters: only what is set goes to the database; a bad date is an error of the field', () => {
    expect(productReceiptFilterActive(EMPTY_PRODUCT_RECEIPT_FILTER)).toBe(false);
    const f = { ...EMPTY_PRODUCT_RECEIPT_FILTER, number: ' GRN ', fromDay: '20261001', toDay: 'x', status: 'posted' };
    expect(productReceiptFilterActive(f)).toBe(true);
    expect(productReceiptFilterToRpc(f, { purchaseOrderGUID: 'po1' })).toEqual({ purchaseOrderGUID: 'po1', fromDay: '2026-10-01', number: 'GRN', status: 'posted' });
    expect(productReceiptDateErrors(f)).toEqual({ fromDay: false, toDay: true });
  });
  it('the folders: legal entity → vendor, sorted by title', () => {
    const nodes = productReceiptFolderNodes([
      { legalEntityGUID: 'le-2', legalEntityTitle: 'Zeta', partnerGUID: 'vp-1', partnerTitle: 'Acme' },
      { legalEntityGUID: 'le-1', legalEntityTitle: 'Alpha', partnerGUID: 'vp-2', partnerTitle: 'Beta' },
      { legalEntityGUID: '', legalEntityTitle: '', partnerGUID: 'vp-3', partnerTitle: 'No entity' },
    ]);
    expect(nodes.map((n) => [n.id, n.parentId])).toEqual([['le-1', null], ['le-2', null], ['le-2:vp-1', 'le-2'], ['le-1:vp-2', 'le-1']]);   // (a row without a legal entity has no folder)
    expect(nodes.filter((n) => n.parentId === null).map((n) => n.title)).toEqual(['Alpha', 'Zeta']);
    expect(nodes.find((n) => n.id === 'le-1:vp-2')!.title).toBe('Beta');
    expect(nodes).toHaveLength(4);
  });
});

describe('the lines', () => {
  const rows = [
    { rowHeaderGUID: 'd1', genusGUID: 'timeGenus', sumForContract: '10.10', vatForContract: '2.12' },
    { rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: 20, vatForContract: 4.2 },
    { rowHeaderGUID: 'd2', genusGUID: 'materialGenus', sumForContract: 1000, vatForContract: 1000 },
  ];
  it('the rows of ONE document and of a tab', () => {
    expect(productReceiptLinesOf(rows, 'd1')).toHaveLength(2);
    expect(productReceiptLinesOf(rows, 'd1', 'materialGenus')).toHaveLength(1);
    expect(productReceiptLinesOf(rows, null)).toEqual([]);
    expect(productReceiptTabOf('nonsense')).toBe(PRODUCT_RECEIPT_ALL_TAB);
    expect(productReceiptTabOf('timeGenus')).toBe('timeGenus');
  });
  it('the totals and the sums of a line (the twin of the trigger)', () => {
    expect(productReceiptTotals(productReceiptLinesOf(rows, 'd1'))).toEqual({ lineCount: 2, sumBeforeVAT: 30.1, sumVAT: 6.32, sumWithVAT: 36.42 });
    expect(productReceiptLineSums(5, 5, 21)).toEqual({ sumForContract: 25, vatForContract: 5.25 });
    expect(productReceiptLineSums(4, 2, 21)).toEqual({ sumForContract: 8, vatForContract: 1.68 });
  });
});

describe('routes', () => {
  it('the form route and its params', () => {
    expect(PRODUCT_RECEIPT_ROUTE).toBe('/pm/project/task/product-receipt');
    expect(productReceiptRouteParams({ documentGUID: 'd1', documents: ['d1', 'd2'], taskGUID: 't1', projectGUID: 'p1' })).toEqual({ taskGUID: 't1', projectGUID: 'p1', documentGUID: 'd1', documents: 'd1,d2' });
    expect(productReceiptRouteParams({})).toEqual({});
    expect(productReceiptDocumentPath('a b')).toBe('/pm/project/task/product-receipt?documentGUID=a%20b');
    expect(documentsOfRoute('d1', 'd2,d1')).toEqual(['d2', 'd1']);
  });
  it('the project / task / task line of the lines are shown only for a Multi Project receipt', () => {
    expect(productReceiptShowsPlaces({ multiProject: true })).toBe(true);
    expect(productReceiptShowsPlaces({ multiProject: false })).toBe(false);
    expect(productReceiptShowsPlaces(null)).toBe(false);
  });
});
