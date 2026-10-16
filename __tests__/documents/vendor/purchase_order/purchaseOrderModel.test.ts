// The pure part of the purchase order (kit8/documents/vendor/purchase_order/purchaseOrderModel.ts): the answers of the RPCs, the rules of the buttons, the tabs, the totals, the folders, the route.
import {
  EMPTY_PURCHASE_ORDER_FILTER, PURCHASE_ORDER_ALL_TAB, PURCHASE_ORDER_TABS, VendorCandidate, PurchaseOrderHeaderView, PurchaseOrderListRow, candidateKey, candidateSelection, canDeletePurchaseOrder,
  canEditPurchaseOrder, canPostPurchaseOrder, canUnpostPurchaseOrder, documentsOfRoute, formatMoney, headerOfListRow, needsLegalEntity, parseCandidates, quickPurchaseOrderPlan, purchaseOrderLinesOfScope, DEFAULT_PURCHASE_ORDER_SCOPE, parseCreateAnswer, parseListAnswer,
  parsePostAnswer, purchaseOrderDateErrors, purchaseOrderDocumentPath, purchaseOrderFilterActive, purchaseOrderFilterToRpc, purchaseOrderFolderNodes, purchaseOrderLineSums, purchaseOrderLinesOf,
  purchaseOrderMissing, purchaseOrderProblemText, purchaseOrderRouteParams, purchaseOrderTabOf, purchaseOrderTotals,
} from '../../../../kit8/documents/vendor/purchase_order/purchaseOrderModel';

const cand = (over: Partial<VendorCandidate> = {}): VendorCandidate => ({ partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply', contractCurrency: 'EUR', legalEntityGUID: 'le-1', lineCount: 2, lineGUIDs: ['l1', 'l2'], ...over });
const row = (over: Partial<PurchaseOrderListRow> = {}): PurchaseOrderListRow => ({
  documentGUID: 'd1', documentNumber: 'PO-00001', documentStatus: 'draft', purchaseOrderNumber: 'INV-1', purchaseOrderDateTime: '2026-10-20T00:00:00Z', purchaseOrderDay: '2026-10-20', legalEntityGUID: 'le-1', legalEntityTitle: 'Acme SIA',
  partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1 · Supply', currency: 'EUR', folder: 'le-1:vp-1', authorGUID: 'u1', authorName: 'Anna K', lineCount: 2, sumBeforeVAT: 50, sumVAT: 10.5, sumWithVAT: 60.5, ...over,
});

describe('the vendors of the task lines (candidates)', () => {
  it('parses the answer; a missing field never throws', () => {
    const a = parseCandidates({ rows: [{ partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: 'S-1', contractCurrency: 'EUR', legalEntityGUID: 'le-1', lineCount: '2', lineGUIDs: ['l1', 'l2'] }, { partnerGUID: 'vp-2' }], skipped: 1 });
    expect(a.skipped).toBe(1);
    expect(a.rows[0]).toMatchObject({ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2, lineGUIDs: ['l1', 'l2'] });
    expect(a.rows[1]).toEqual({ partnerGUID: 'vp-2', partnerTitle: 'vp-2', contractGUID: null, contractInfo: null, contractCurrency: null, legalEntityGUID: null, lineCount: 0, lineGUIDs: [] });
    expect(parseCandidates(null)).toEqual({ rows: [], skipped: 0, skippedLineGUIDs: [], noVendorAllowed: true });
    expect(parseCandidates({ rows: [], noVendorAllowed: false }).noVendorAllowed).toBe(false);
    expect(parseCandidates({ rows: [], skipped: 1, skippedLineGUIDs: ['l9'] }).skippedLineGUIDs).toEqual(['l9']);
  });
  it('ONE document per (vendor, contract): the key, the selection of the checked ones', () => {
    const rows = [cand(), cand({ contractGUID: 'vc-2', lineGUIDs: ['l3'] }), cand({ partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l4'] })];
    expect(rows.map(candidateKey)).toEqual(['vp-1|vc-1', 'vp-1|vc-2', 'vp-2|']);
    expect(candidateSelection(rows, new Set(['vp-1|vc-2', 'vp-2|']))).toEqual([
      { partnerGUID: 'vp-1', contractGUID: 'vc-2', lineGUIDs: ['l3'] },
      { partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l4'] },
    ]);
    expect(candidateSelection(rows, new Set())).toEqual([]);
  });
  it('the legal entity is asked only when a CHECKED pair has none', () => {
    const rows = [cand(), cand({ contractGUID: 'vc-2', legalEntityGUID: null })];
    expect(needsLegalEntity(rows, new Set(['vp-1|vc-1']))).toBe(false);
    expect(needsLegalEntity(rows, new Set(['vp-1|vc-1', 'vp-1|vc-2']))).toBe(true);
    expect(needsLegalEntity(rows, new Set())).toBe(false);
  });
  it('the answer of create', () => {
    const a = parseCreateAnswer({ documents: [{ documentGUID: 'd1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }], skipped: [{ partnerGUID: 'vp-2', contractGUID: null, reason: 'nothingLeftToOrder' }] });
    expect(a.documents).toEqual([{ documentGUID: 'd1', partnerGUID: 'vp-1', contractGUID: 'vc-1', lineCount: 2 }]);
    expect(a.skipped[0].reason).toBe('nothingLeftToOrder');
    expect(parseCreateAnswer(undefined)).toEqual({ documents: [], skipped: [] });
    expect(parseCreateAnswer({ documents: [{ documentGUID: 'd2', partnerGUID: null, lineCount: 1 }] }).documents[0].partnerGUID).toBeNull();
  });
});

describe('the list', () => {
  it('numbers arrive as strings and become numbers; the totals are per currency', () => {
    const a = parseListAnswer({
      totalCount: '2', totalsByCurrency: [{ currency: 'EUR', count: 1, sumBeforeVAT: '50.00', sumVAT: '10.50', sumWithVAT: '60.50' }, { currency: 'USD', count: 1, sumBeforeVAT: 100, sumVAT: 0, sumWithVAT: 100 }],
      rows: [{ documentGUID: 'd1', documentStatus: 'posted', sumBeforeVAT: '50.005', sumVAT: '10.5', sumWithVAT: '60.5', lineCount: '2', contractGUID: null }],
    });
    expect(a.totalCount).toBe(2);
    expect(a.totalsByCurrency.map((t) => [t.currency, t.sumWithVAT])).toEqual([['EUR', 60.5], ['USD', 100]]);
    expect(a.rows[0]).toMatchObject({ documentGUID: 'd1', documentStatus: 'posted', sumBeforeVAT: 50.01, lineCount: 2, contractGUID: null });
    expect(parseListAnswer(null)).toEqual({ totalCount: 0, totalsByCurrency: [], rows: [] });
  });
  it('the filter: only what is set and readable goes to the RPC; the dates accept 8 digits', () => {
    expect(purchaseOrderFilterToRpc(EMPTY_PURCHASE_ORDER_FILTER)).toEqual({});
    expect(purchaseOrderFilterToRpc({ ...EMPTY_PURCHASE_ORDER_FILTER, number: ' inv ', fromDay: '20261001', toDay: 'soon', partnerGUID: 'vp-1', currency: 'EUR', status: 'posted', legalEntityGUID: 'le-1', contractGUID: 'vc-1', author: 'anna' }))
      .toEqual({ number: 'inv', fromDay: '2026-10-01', partnerGUID: 'vp-1', currency: 'EUR', status: 'posted', legalEntityGUID: 'le-1', contractGUID: 'vc-1', author: 'anna' });
    expect(purchaseOrderFilterToRpc(EMPTY_PURCHASE_ORDER_FILTER, { documentGUIDs: ['d1'] })).toEqual({ documentGUIDs: ['d1'] });
    expect(purchaseOrderFilterActive(EMPTY_PURCHASE_ORDER_FILTER)).toBe(false);
    expect(purchaseOrderFilterActive({ ...EMPTY_PURCHASE_ORDER_FILTER, author: 'a' })).toBe(true);
    expect(purchaseOrderDateErrors({ ...EMPTY_PURCHASE_ORDER_FILTER, fromDay: 'soon', toDay: '2026-10-01' })).toEqual({ fromDay: true, toDay: false });
  });
  it('the folders: legal entity → vendor, only what the documents have, alphabetical', () => {
    const nodes = purchaseOrderFolderNodes([
      row(), row({ documentGUID: 'd2', partnerGUID: 'vp-2', partnerTitle: 'Beta' }), row({ documentGUID: 'd3', legalEntityGUID: 'le-0', legalEntityTitle: 'Aaa Ltd', folder: 'le-0:vp-1' }), row({ documentGUID: 'd4' }),
    ]);
    expect(nodes.filter((n) => !n.parentId).map((n) => n.title)).toEqual(['Aaa Ltd', 'Acme SIA']);
    expect(nodes.filter((n) => n.parentId === 'le-1').map((n) => [n.id, n.title])).toEqual([['le-1:vp-1', 'Acme'], ['le-1:vp-2', 'Beta']]);
    expect(nodes.find((n) => n.id === 'le-0:vp-1')!.parentId).toBe('le-0');
    expect(purchaseOrderFolderNodes([])).toEqual([]);
  });
});

describe('the document: states and buttons', () => {
  const header = (over: Partial<PurchaseOrderHeaderView> = {}): PurchaseOrderHeaderView => ({ ...headerOfListRow(row()), ...over });
  it('the header of a list row', () => {
    expect(headerOfListRow(row())).toMatchObject({ guid: 'd1', number: 'PO-00001', status: 'draft', purchaseOrderNumber: 'INV-1', day: '2026-10-20', partnerTitle: 'Acme', contractInfo: 'S-1 · Supply', legalEntityTitle: 'Acme SIA', currency: 'EUR' });
    expect(headerOfListRow(row({ purchaseOrderDay: null })).day).toBe('');
  });
  it('a draft is edited, deleted and posted (with lines); a posted one is only unposted', () => {
    const d = header();
    expect([canEditPurchaseOrder(d), canDeletePurchaseOrder(d), canPostPurchaseOrder(d, 1), canPostPurchaseOrder(d, 0), canUnpostPurchaseOrder(d)]).toEqual([true, true, true, false, false]);
    const p = header({ status: 'posted' });
    expect([canEditPurchaseOrder(p), canDeletePurchaseOrder(p), canPostPurchaseOrder(p, 3), canUnpostPurchaseOrder(p)]).toEqual([false, false, false, true]);
  });
  it('what is missing before Post', () => {
    expect(purchaseOrderMissing(header(), 2)).toEqual([]);
    expect(purchaseOrderMissing(header({ purchaseOrderNumber: '  ', day: '' }), 0)).toEqual(['documentHasNoLines', 'orderNumberMissing', 'orderDateMissing']);
  });
  it('the answer of post and the texts of the problems', () => {
    expect(parsePostAnswer({ status: 'refused', lines: 1, problems: [{ lineGUID: 'l1', problem: 'quantityIsZero' }] })).toEqual({ status: 'refused', lines: 1, problems: [{ lineGUID: 'l1', problem: 'quantityIsZero' }] });
    expect(parsePostAnswer({ status: 'posted' }).status).toBe('posted');
    expect(parsePostAnswer(null).status).toBe('refused');
    for (const code of ['documentIsPosted', 'documentIsNotPosted', 'documentHasNoLines', 'orderNumberMissing', 'orderDateMissing', 'quantityIsZero', 'notYourProject']) expect(purchaseOrderProblemText(code)).toMatch(/[a-z]/);
    expect(purchaseOrderProblemText('somethingElse')).toBe('somethingElse');
  });
});

describe('tabs, lines and totals', () => {
  const lines = [
    { rowGUID: 'a', rowHeaderGUID: 'd1', genusGUID: 'timeGenus', sumForContract: '10.10', vatForContract: '2.12' },
    { rowGUID: 'b', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: 20, vatForContract: 4.2 },
    { rowGUID: 'c', rowHeaderGUID: 'd1', genusGUID: 'materialGenus', sumForContract: null, vatForContract: null },
    { rowGUID: 'x', rowHeaderGUID: 'other', genusGUID: 'timeGenus', sumForContract: 999, vatForContract: 999 },
  ];
  it('All (the default) · Time · Material · Expenses, in this order', () => {
    expect(PURCHASE_ORDER_TABS.map((t) => t.title)).toEqual(['All', 'Time', 'Material', 'Expenses']);
    expect(PURCHASE_ORDER_TABS[0].id).toBe(PURCHASE_ORDER_ALL_TAB);
    expect(purchaseOrderTabOf('materialGenus')).toBe('materialGenus');
    expect(purchaseOrderTabOf('revenueGenus')).toBe(PURCHASE_ORDER_ALL_TAB);
    expect(purchaseOrderTabOf(undefined)).toBe(PURCHASE_ORDER_ALL_TAB);
  });
  it('the lines of ONE document, all or of a genus', () => {
    expect(purchaseOrderLinesOf(lines, 'd1').map((l) => l.rowGUID)).toEqual(['a', 'b', 'c']);
    expect(purchaseOrderLinesOf(lines, 'd1', 'materialGenus').map((l) => l.rowGUID)).toEqual(['b', 'c']);
    expect(purchaseOrderLinesOf(lines, null)).toEqual([]);
  });
  it('the totals: before VAT, VAT, with VAT (a missing sum is 0, rounded to the cent)', () => {
    expect(purchaseOrderTotals(purchaseOrderLinesOf(lines, 'd1'))).toEqual({ lineCount: 3, sumBeforeVAT: 30.1, sumVAT: 6.32, sumWithVAT: 36.42 });
    expect(purchaseOrderTotals([])).toEqual({ lineCount: 0, sumBeforeVAT: 0, sumVAT: 0, sumWithVAT: 0 });
  });
  it('the sums of a line: the twin of the database trigger (qty x price, VAT of the sum)', () => {
    expect(purchaseOrderLineSums(4, 6, 10)).toEqual({ sumForContract: 24, vatForContract: 2.4 });
    expect(purchaseOrderLineSums(10, 5, 21)).toEqual({ sumForContract: 50, vatForContract: 10.5 });
    expect(purchaseOrderLineSums(3, 3.333, 21)).toEqual({ sumForContract: 10, vatForContract: 2.1 });
  });
  it('money is shown with two decimals', () => {
    expect(formatMoney(1234.5)).toMatch(/^1.?234[.,]50$/);
    expect(formatMoney(null)).toBe('');
  });
});

describe('opening the form', () => {
  it('route params: only what is set; the lines and the documents as lists', () => {
    expect(purchaseOrderRouteParams({ taskGUID: 't1' })).toEqual({ taskGUID: 't1' });
    expect(purchaseOrderRouteParams({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: ['l1', 'l2'], documentGUID: 'd1', documents: ['d1', 'd2'] })).toEqual({ taskGUID: 't1', projectGUID: 'p1', lineGUIDs: 'l1,l2', documentGUID: 'd1', documents: 'd1,d2' });
  });
  it('the documents of the route: the named one first, no duplicates', () => {
    expect(documentsOfRoute('d1', null)).toEqual(['d1']);
    expect(documentsOfRoute('d1', 'd1,d2, d3')).toEqual(['d1', 'd2', 'd3']);
    expect(documentsOfRoute('d2', 'd1,d3')).toEqual(['d2', 'd1', 'd3']);
    expect(documentsOfRoute(null, 'd1,d2')).toEqual(['d1', 'd2']);
    expect(documentsOfRoute(null, null)).toEqual([]);
  });
  it('a browser tab of its own: the same route with that single document', () => {
    expect(purchaseOrderDocumentPath('d 1')).toBe('/pm/project/task/purchase-order?documentGUID=d%201');
  });
});

describe('the project of the document', () => {
  it('the list row and the header view carry the project (name) and its independent input switch', () => {
    const a = parseListAnswer({ rows: [{ documentGUID: 'd1', projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: true, taskGUID: 't1' }, { documentGUID: 'd2' }] });
    expect(a.rows[0]).toMatchObject({ projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: true, taskGUID: 't1' });
    expect(a.rows[1]).toMatchObject({ projectGUID: '', projectName: '', independentInputAvailable: false });
    expect(headerOfListRow(a.rows[0])).toMatchObject({ projectGUID: 'p1', projectName: 'Alpha', independentInputAvailable: true });
  });
});

describe('the context menu: quick create and its scope', () => {
  const row = (over: Record<string, any> = {}) => ({ partnerGUID: 'vp-1', partnerTitle: 'Acme', contractGUID: 'vc-1', contractInfo: null, contractCurrency: null, legalEntityGUID: 'le-1', lineCount: 1, lineGUIDs: ['l1'], ...over });
  it('every vendor + contract is taken; a person is needed when there is none or a contract has no legal entity', () => {
    expect(quickPurchaseOrderPlan([row(), row({ partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l2'] })])).toEqual({ kind: 'create', selection: [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineGUIDs: ['l1'] }, { partnerGUID: 'vp-2', contractGUID: null, lineGUIDs: ['l2'] }] });
    expect(quickPurchaseOrderPlan([])).toEqual({ kind: 'choose' });
    // the lines without a vendor make ONE document without a vendor (no legal entity needed)
    expect(quickPurchaseOrderPlan([], ['l7', 'l8'])).toEqual({ kind: 'create', selection: [{ partnerGUID: null, contractGUID: null, lineGUIDs: ['l7', 'l8'] }] });
    expect(quickPurchaseOrderPlan([row()], ['l7'])).toEqual({ kind: 'create', selection: [{ partnerGUID: 'vp-1', contractGUID: 'vc-1', lineGUIDs: ['l1'] }, { partnerGUID: null, contractGUID: null, lineGUIDs: ['l7'] }] });
    expect(quickPurchaseOrderPlan([row({ legalEntityGUID: null })], ['l7'])).toEqual({ kind: 'choose' });
    expect(quickPurchaseOrderPlan([row(), row({ legalEntityGUID: null, contractGUID: 'vc-2' })])).toEqual({ kind: 'choose' });
  });
  it('the scope of a line of the Finances table: the current line is the default; the whole task = no line filter', () => {
    expect(DEFAULT_PURCHASE_ORDER_SCOPE).toBe('line');
    expect(purchaseOrderLinesOfScope('line', 'l9')).toEqual(['l9']);
    expect(purchaseOrderLinesOfScope('task', 'l9')).toBeUndefined();
  });
});
