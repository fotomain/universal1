// documentRelatedModel - WHICH items of the Task menu the buttons Actions / Go to of a document show (DocumentActionsGoTo): only the ones that are LOGICALLY related to that document.
// The business order of a task is: plan -> purchase order -> product receipt -> time sheet -> fact input -> vendor invoice -> customer invoice -> payment (appPM80 home, PM80_STAGES).
//   Actions   = what can be made FROM this document: its successor in the chain (the document's own items: Product receipt, Vendor Invoice, Payment fact of THIS invoice) + the Task menu "Create based on this"
//               items listed in `actions` (fact input -> the invoices). A payment fact, a time sheet and an invoice have no other successor: nothing else is offered.
//   Go to     = the documents around it: its predecessors, its siblings of the same task and its successors, plus Timeline data and Open task - the ones in `goTo`.
// The keys are the end of the testID of the Task menu items (useTaskRelatedMenu): `<prefix>-create-<key>` / `<prefix>-goto-<key>`. Pure TypeScript, unit-tested.
export type DocumentKind = 'vendorInvoice' | 'purchaseOrder' | 'productReceipt' | 'customerInvoice' | 'paymentFact' | 'timesheet' | 'factInput';

export interface DocumentRelated {
  /** keys of the Task menu "Create based on this" items shown under Actions (the own items of the document come first) */
  actions: string[];
  /** keys of the Task menu "Go to" items shown under Go to (Open task is always there when the document has a task) */
  goTo: string[];
}

export const DOCUMENT_RELATED: Record<DocumentKind, DocumentRelated> = {
  // purchase order -> product receipt -> VENDOR INVOICE -> payment
  vendorInvoice: { actions: [], goTo: ['timeline', 'purchase-orders', 'product-receipts', 'vendor-invoices', 'payment-facts', 'fact-input'] },
  purchaseOrder: { actions: [], goTo: ['timeline', 'purchase-orders', 'product-receipts', 'vendor-invoices'] },
  productReceipt: { actions: [], goTo: ['timeline', 'purchase-orders', 'product-receipts', 'vendor-invoices'] },
  // the revenue side: fact input -> CUSTOMER INVOICE -> payment
  customerInvoice: { actions: [], goTo: ['timeline', 'fact-input', 'customer-invoices', 'payment-facts'] },
  // a payment pays an invoice (vendor: outbound, customer: inbound)
  paymentFact: { actions: [], goTo: ['timeline', 'vendor-invoices', 'customer-invoices', 'payment-facts'] },
  // hours of a work center: no ONE task; the fact input / invoices come from the tasks of its lines
  timesheet: { actions: [], goTo: [] },
  // the actuals of a task are what the invoices are made from
  factInput: { actions: ['vendor-invoice', 'customer-invoice'], goTo: ['timeline', 'timesheets', 'fact-input', 'vendor-invoices', 'customer-invoices'] },
};

/** the items of a Task submenu whose key is listed (`prefix` = '-create-' or '-goto-'); no kind = all of them */
export function onlyRelated<T extends { testID: string }>(items: T[], prefix: '-create-' | '-goto-', keys: string[] | undefined): T[] {
  if (!keys) return items;
  return items.filter((it) => keys.some((k) => it.testID.endsWith(`${prefix}${k}`)));
}
