import { DOCUMENT_RELATED, DocumentKind, onlyRelated } from '../../../kit8/documents/taskScope/documentRelatedModel';

const items = (keys: string[], prefix: string) => keys.map((k) => ({ testID: `x-task${prefix}${k}` }));
const GOTO = ['timeline', 'vendor-invoices', 'customer-invoices', 'payment-facts', 'purchase-orders', 'product-receipts', 'fact-input', 'timesheets', 'subproject'];
const CREATE = ['fact', 'vendor-invoice', 'purchase-order', 'payment-fact', 'customer-invoice', 'timesheet', 'chat', 'subproject'];
const goto = (k: DocumentKind) => onlyRelated(items(GOTO, '-goto-'), '-goto-', DOCUMENT_RELATED[k].goTo).map((i) => i.testID.split('-goto-')[1]);
const create = (k: DocumentKind) => onlyRelated(items(CREATE, '-create-'), '-create-', DOCUMENT_RELATED[k].actions).map((i) => i.testID.split('-create-')[1]);

describe('only the logically related items are shown', () => {
  it('no list of keys = everything', () => { expect(onlyRelated(items(GOTO, '-goto-'), '-goto-', undefined)).toHaveLength(GOTO.length); });
  it('the purchase chain: a vendor invoice sees its order, receipts, payments and the fact input - not customer invoices, time sheets or subprojects', () => {
    expect(goto('vendorInvoice')).toEqual(['timeline', 'vendor-invoices', 'payment-facts', 'purchase-orders', 'product-receipts', 'fact-input']);
  });
  it('a purchase order / product receipt: the chain order -> receipt -> invoice only', () => {
    expect(goto('purchaseOrder')).toEqual(['timeline', 'vendor-invoices', 'purchase-orders', 'product-receipts']);
    expect(goto('productReceipt')).toEqual(goto('purchaseOrder'));
  });
  it('the revenue side: a customer invoice sees fact input and payments, not vendor documents', () => {
    expect(goto('customerInvoice')).toEqual(['timeline', 'customer-invoices', 'payment-facts', 'fact-input']);
  });
  it('a payment fact sees the invoices it pays; a time sheet has no task items', () => {
    expect(goto('paymentFact')).toEqual(['timeline', 'vendor-invoices', 'customer-invoices', 'payment-facts']);
    expect(goto('timesheet')).toEqual([]);
  });
  it('Actions: only the fact input makes invoices from the task; the others make their successor through their OWN items', () => {
    expect(create('factInput')).toEqual(['vendor-invoice', 'customer-invoice']);
    for (const k of ['vendorInvoice', 'purchaseOrder', 'productReceipt', 'customerInvoice', 'paymentFact', 'timesheet'] as DocumentKind[]) expect(create(k)).toEqual([]);
  });
  it('no kind shows Subproject, Chat or a task time sheet under any document', () => {
    for (const r of Object.values(DOCUMENT_RELATED)) { expect(r.goTo).not.toContain('subproject'); expect(r.actions).not.toContain('chat'); expect(r.actions).not.toContain('subproject'); }
  });
});
