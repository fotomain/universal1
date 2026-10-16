# Purchase order - `kit8/documents/vendor/purchase_order`

Source: the Google Doc "IMPROVE IT" (round of 2026-10-16: "create PurchaseOrder functionality ... must work completely the same logic as VendorInvoice"). Design: `documentation/PURCHASE_ORDER.html`. SQL: **PART 28** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (dropped by PART 1a of `delete_sql_structure.sql`).

A purchase order is the **twin of the vendor invoice** (`kit8/documents/vendor/invoice`, README there): ONE document = ONE vendor + ONE contract (or none), made from a task (all its lines / one line), Draft → Post; a posted purchase order writes the **`ordered` movements** of the project status register (`project_status_movements`, registrator type `purchaseOrderHeader`) in the same transaction. The differences:

| | vendor invoice | purchase order |
|---|---|---|
| tables | `vendor_invoice_header / _lines` | `purchase_order_header / _lines` (sequence `purchase_order_document_seq`, numbers `PO-00001`) |
| line numbers | `qtyInvoiced · priceInvoiced · vatRatioInvoiced` | `qtyOrdered · priceOrdered · vatRatioOrdered` |
| header JSON | `vendorInvoice…` (`vendorInvoiceNumber` = the number printed on the invoice) | `purchaseOrder…` (`purchaseOrderNumber` = the number of the order, `purchaseOrderDateTime` = its date) |
| register kind | `invoiced` | `ordered` → Monitor01 column **Ordered** (`qtyOrdered`) |
| quantity of a new line | plan − what is on other **vendor invoices** | plan − what is on other **purchase orders** (the two documents never count against each other) |
| routes | `/pm/project/task/vendor-invoice`, `…/new`, `/pm/vendor-invoice/list` | `/pm/project/task/purchase-order`, `…/new`, `/pm/purchase-order/list` |
| menus | Drawer → Documents → Vendor invoices; row menu **Vendor Invoice** | Drawer → Documents → **Purchase orders**; row menu **Purchase Order** (right AFTER Vendor Invoice) in the task tree and in a Finances line |

Shared on purpose: the vendors of the lines (`purchase_order_candidates` = `vendor_invoice_candidates`), the project settings of the **Vendor** tab (`userCanCreateVendorInvoicesFromTasksWithEmptyVendors`, `independentInvoiceInputAvailable`, `multiProjectVendorInvoceNeeded`), the legal entity / vendor / contract catalogs, the candidate and route helpers of `vendorInvoiceModel.ts` (re-exported by `purchaseOrderModel.ts`), and the Multi Project machinery (`kit8/documents/vendor/lineplace`, `kit8/pm/view/project/pick`).

## Files
| File | What |
|---|---|
| `purchaseOrderModel.ts` | pure: constants, answers, filters, folders, the states and buttons, tabs, totals, the twin of the line sums, routes, the project modes |
| `purchaseOrderApi.ts` | the RPC calls (the Supabase client is passed in) |
| `purchaseOrderMetaData.ts` | the redux entities of the documents and of the lines (`rootColumns` qtyOrdered, priceOrdered, vatRatioOrdered) |
| `usePurchaseOrder.ts` | `usePurchaseOrderCandidates` · `usePurchaseOrderDocuments` (+ commands, `setLineTask`) · `usePurchaseOrderLinePlaces` · `usePurchaseOrderList` · `useCreatePurchaseOrders` · `useOpenPurchaseOrder` · `useStartPurchaseOrder` |
| `purchaseOrderColumns.tsx` · `purchaseOrderListColumns.tsx` | the columns of the two tables (the lines table gets the three place columns in Multi Project) |
| `PMPurchaseOrderDocumentForm.tsx` | the form: a tab for each document (a browser tab of its own on the web), the bar Delete · Unpost · Close · **Post / Posted (large, last)**, the Single / Multi Project menu and the project tree window |
| `PMPurchaseOrderDocumentHeader.tsx` | the header fields: document · Project (chevron) · legal entity · vendor · contract · currency · order number · order date · totals |
| `PMPurchaseOrderDocumentLines.tsx` | DocumentTabs **All · Time · Material · Expenses** + the lines table |
| `PMPurchaseOrderDocumentChoose.tsx` · `PurchaseOrderScopeModal.tsx` | the choice of the vendors (only when a person is needed) and the question "this line / the whole task" |
| `PMPurchaseOrderDocumentList.tsx` | the list: folders legal entity → vendor, quick filters, totals per currency |

## Multi Project
Project settings → **Vendor** → `multiProjectVendorInvoceNeeded` (OFF while never saved; the spelling is the one of the spec). A draft then has a **chevron** at the left of its Project field: **Single Project | Multi Project** (saved at once; back to Single only when every line is in the project of the document). In Multi Project the lines table gets **Project** (read only), **Task** (`purchaseOrderTaskGUID`) and **Task line** (`purchaseOrderTaskLineGUID`) with Paste · Select · Clear (a DRAFT only):
* **variant 1 - Paste**: the GUID from the clipboard - "Copy GUID" of the task tree row menu, **"Copy line GUID"** of a Finances line;
* **variant 2 - Select**: the project tree window (`PMProjectPickerModal` = the project dashboard with the Finances view; a task: "Select this task", a line: row menu "Select this line" or a click on a read only cell);
* **Clear**: the line goes back to the task and project of the document, without a task line (an independent line).
SQL: `purchase_order_set_line_task(line, task, task line)`, `purchase_order_line_places(header)`; the register takes the project of the LINE.

## Tests
* SQL on Postgres 15: `cd kit8/docker && ./test_fact_monitor01.sh 71` (155 checks: the whole life of a purchase order, Multi Project) and `./test_fact_monitor01.sh 72` (a purchase order and a vendor invoice of the same lines; the Monitor01 columns Ordered and Invoiced; unpost / rebuild).
* Jest: `__tests__/documents/vendor/purchase_order` (model, API / hooks, columns, choose window, form, header, lines, list, SQL mirror), `__tests__/pm/reports/monitor01` (the column), `__tests__/documents/vendor/lineplace`.

**Task menus**: the submenus "Create based on this → Purchase Order" and "Go to → Purchase orders" (Task menu and line menu of the Finances table; not on a Revenue line). "Go to" opens `/pm/purchase-order/list?taskGUID=…[&taskLineGUID=…]` in a new browser window: the list shows a chip (Task: …, x clears it) and `purchase_order_list` takes the keys `taskGUID` / `taskLineGUID` (PART 28, test `tests/71`). See `kit8/documents/taskScope/README.md`.
