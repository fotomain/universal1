# Product receipt - `kit8/documents/vendor/product_receipt`

Source: the user's request of 2026-10-16 ("ProductReceiptDocument ... the same structure as vendor invoice and purchase order: Form, Header, Lines, List ... data must present in the Delivered column of Monitor01"). Design: `documentation/PRODUCT_RECEIPT.html`. SQL: **PART 30** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (dropped by PART 1a of `delete_sql_structure.sql`, BEFORE the purchase order tables).

A product receipt is the **third document of the chain** purchase order → product receipt → vendor invoice. It is the twin of the purchase order (`kit8/documents/vendor/purchase_order`, README there) and of the vendor invoice: ONE document = ONE vendor + ONE contract (or none), Draft → Post, and a posted receipt writes the **`received` movements** of the project status register (`project_status_movements`, registrator type `productReceiptHeader`) in the same transaction → the Monitor01 column **Received** (`monitor01_view.qtyReceived`).

## The chain ("Create based on")
| From | Command | Result |
|---|---|---|
| a task or a task line (Task menu / line menu of the Finances table) | **Create based on this → Purchase Order** (exists since PART 28) | draft purchase order(s) |
| a **posted** purchase order (form bar **Create based on…**, or the row menu of the purchase order list) | **Create based on → Product receipt** (`create_product_receipt_from_order(order)`) | ONE draft receipt in a new browser tab: the vendor / contract / legal entity / Multi Project mode of the order, a line for every order line that still has something to receive (ordered − received on the other receipts of that line) |
| a **posted** product receipt (form bar **Create based on…**, or the row menu of this list) | **Create based on → Vendor invoice** (`create_vendor_invoice_from_receipt(receipt)`) | ONE draft vendor invoice in a new browser tab: a line for every receipt line that is not fully invoiced (received − invoiced from that receipt line; the invoice line keeps `rowJSON.productReceiptLineGUID`, the header `vendorInvoiceProductReceipt`) |

An unposted source is refused by the database ("post the purchase order first" / "post the product receipt first"); when nothing is left the answer is `skipped: [{ reason: nothingLeftToReceive | nothingLeftToInvoice }]` and the form says so. The Task menu "Go to" has a new item **Product receipts** (`/pm/product-receipt/list?taskGUID=…[&taskLineGUID=…]`).

## What differs from the purchase order
| | purchase order | product receipt |
|---|---|---|
| tables | `purchase_order_header / _lines` | `product_receipt_header / _lines` (sequence `product_receipt_document_seq`, numbers `PR-00001`); a line has `purchaseOrderLineGUID` (FK, ON DELETE SET NULL; NULL = an independent line) |
| line numbers | `qtyOrdered · priceOrdered · vatRatioOrdered` | `qtyReceived · priceReceived · vatRatioReceived` |
| header JSON | `purchaseOrder…` | `productReceipt…` (`productReceiptNumber` = the number of the receipt / delivery note, `productReceiptDateTime`, `productReceiptPurchaseOrder` = the order it came from) |
| made from | a task / task line (vendor candidates) | a posted purchase order (no choice window, no scope question) |
| register kind | `ordered` → column Ordered | `received` → column **Received** (`project_status_month_turnover.qtyReceived` → `monitor01_view.qtyReceived`; `qtyOnHand` = received − used) |
| Multi Project | chosen on the document, lines can be moved | copied from the order; the lines show Project · Task · Task line **read only** (no chevron, no `set_line_task`) |
| routes | `/pm/project/task/purchase-order`, `/pm/purchase-order/list` | `/pm/project/task/product-receipt`, `/pm/product-receipt/list` |
| Drawer | Documents → Purchase orders | Documents → **Product receipts** (before Purchase orders: sorted by name) |

Shared on purpose: the project settings of the **Vendor** tab (`independentInvoiceInputAvailable` lets a + add an independent line), the legal entity / vendor / contract catalogs, the route / window helpers of the vendor invoice, `kit8/documents/vendor/lineplace`, `kit8/documents/taskScope`.

## Files
| File | What |
|---|---|
| `productReceiptModel.ts` | pure: constants, the answers of the two "Create based on" RPCs, states and buttons, list rows, filters, folders, lines, totals, routes |
| `productReceiptApi.ts` | the RPC calls (the Supabase client is passed in) |
| `productReceiptMetaData.ts` | the redux entities of the documents and of the lines (`rootColumns` qtyReceived, priceReceived, vatRatioReceived) |
| `useProductReceipt.ts` | `useProductReceiptList` · `useProductReceiptDocuments` (+ commands) · `useProductReceiptLinePlaces` · `useOpenProductReceipt` · **`useCreateProductReceiptFromOrder`** · **`useCreateVendorInvoiceFromReceipt`** |
| `productReceiptNavigation.ts` | where the user goes after "Create based on" (a new browser tab on the web, opened inside the click) |
| `productReceiptColumns.tsx` · `productReceiptListColumns.tsx` | the columns of the two tables |
| `PMProductReceiptDocumentForm.tsx` | the form: a tab for each document, the bar Delete · Unpost · **Create based on…** · Close · **Post / Posted (large, last)** |
| `PMProductReceiptDocumentHeader.tsx` | document · Project · **Purchase order** (read only) · legal entity · vendor · contract · currency · receipt number · receipt date · totals |
| `PMProductReceiptDocumentLines.tsx` | DocumentTabs **All · Time · Material · Expenses** + the lines table |
| `PMProductReceiptDocumentList.tsx` | the list: folders legal entity → vendor, quick filters, totals per currency, row menu **Create based on → Vendor invoice** |

## Monitor01
`monitor01_sum_sources('received')` lists the movements of the posted receipts (column Receipt, action Document → `useOpenProductReceipt`); `project_status_fresh_turnover`, `monitor01_fresh_rows` (both definitions), `monitor01_apply`, `monitor01_verify` carry `qtyReceived` (the register turnover and the view use the same name); on install the tasks with posted receipts are queued once.

## Tests
* SQL on Postgres 15: `cd kit8/docker && ./test_fact_monitor01.sh 73` (63 checks: order → receipt → Post → Received in Monitor01 → vendor invoice from the receipt → Unpost; partial receipts, nothing left, another organization) and the whole `./test_fact_monitor01.sh`, `./test_sql.sh`.
* Jest: `__tests__/documents/vendor/product_receipt` (model, SQL mirror, hooks, columns, form, list), `__tests__/documents/vendor/purchase_order/purchaseOrderCreateBasedOn.test.tsx`, `__tests__/pm/reports/monitor01/monitor01SumSources.test.ts`, `monitor01Sql.test.ts`.

## VAT columns (2026-10-20)
The product receipt lines have the same VAT rate select and accounting columns as the vendor invoice (`kit8/documents/vat/README.md`, `documentation/VENDOR_INVOICE_DOC.html`).
