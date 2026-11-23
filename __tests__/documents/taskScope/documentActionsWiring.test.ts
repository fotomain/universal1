// Every document has the buttons Actions and Go to (DocumentActionsGoTo): in the BAR of its form (before Close) and in the TOOLBAR of its list (icons, enabled only while exactly ONE document is checked).
// A source scan: the behaviour of the component is in documentActionsGoTo.test.tsx, that of the vendor invoice form / list in their own tests.
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../../', p), 'utf8');

const DOCUMENTS: { name: string; kind: string; form: string; list: string; own?: string }[] = [
  { name: 'vendor invoice', kind: 'vendorInvoice', form: 'kit8/documents/vendor/invoice/VendorInvoiceDocumentForm.tsx', list: 'kit8/documents/vendor/invoice/VendorInvoiceDocumentList.tsx' },
  { name: 'purchase order', kind: 'purchaseOrder', form: 'kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentForm.tsx', list: 'kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentList.tsx' },
  { name: 'product receipt', kind: 'productReceipt', form: 'kit8/documents/vendor/product_receipt/PMProductReceiptDocumentForm.tsx', list: 'kit8/documents/vendor/product_receipt/PMProductReceiptDocumentList.tsx' },
  { name: 'customer invoice', kind: 'customerInvoice', form: 'kit8/documents/customer/invoice/CustomerInvoiceDocumentForm.tsx', list: 'kit8/documents/customer/invoice/CustomerInvoiceDocumentList.tsx' },
  { name: 'payment fact', kind: 'paymentFact', form: 'kit8/documents/payment/fact/PMPaymentFactDocumentForm.tsx', list: 'kit8/documents/payment/fact/PMPaymentFactDocumentList.tsx', own: 'PAYMENT_FACT_LIST_ROUTE' },
  { name: 'time sheet', kind: 'timesheet', form: 'kit8/documents/timesheet/PMTimesheetDocumentForm.tsx', list: 'kit8/documents/timesheet/PMTimesheetDocumentList.tsx', own: 'TIMESHEET_LIST_ROUTE' },
  { name: 'fact input', kind: 'factInput', form: 'kit8/documents/fact/input/PMFactInputDocumentForm.tsx', list: 'kit8/documents/fact/input/PMFactInputDocumentList.tsx' },
];

describe.each(DOCUMENTS)('$name', ({ kind, form, list, own }) => {
  it('the bar of the form has Actions and Go to, right before Close', () => {
    const src = read(form);
    const at = src.indexOf('<DocumentActionsGoTo');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(src.indexOf('testID={`${testID}-close`}'));
    expect(src).toContain("taskScope/DocumentActionsGoTo'");
    expect(src).toContain(`<DocumentActionsGoTo kind="${kind}"`);   // only the items logically related to the document are shown
    if (own) expect(src).toContain(own);
  });
  it('the toolbar of the list has the icons, enabled only for ONE checked document', () => {
    const src = read(list);
    expect(src).toContain('onSelectionChange={setChecked}');
    expect(src).toContain(`<DocumentActionsGoTo kind="${kind}"`);
    expect(src).toContain('checked.length === 1 ? byGuid.get(checked[0]) : undefined');
    expect(src).toMatch(/toolbarExtra=\{<DocumentActionsGoTo kind="\w+" variant="icons" alwaysShow [^\n]*disabled=\{!one\}/);
    if (own) expect(src).toContain(own);
  });
});
