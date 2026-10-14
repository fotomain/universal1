# Vendor invoice - `kit8/pm/vendor_invoice`

Source: the Google Doc "W1 Vendor Invoice"; analysis, decisions and what was built: `documentation/PROJECT_STATE_WBS.html`. SQL: **PART 26** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (mirrored in `start2_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

**ONE document = ONE vendor + ONE contract** (or none). The documents are made from a task, posted, and a posted invoice writes the **`invoiced` movements of the project status register** (`project_status_movements`) in the same transaction.

| Where | What |
|---|---|
| context menu **Vendor Invoice** (right after **Facts input**) | the row menu of the task tree (not for stages) and of a line of the Finances table (not Revenue) → the window of the vendors |
| `/pm/project/task/vendor-invoice/new` · `VendorInvoiceChoose` | the vendors (and contracts) of the lines: a check box each → **Create** makes one draft per checked pair |
| `/pm/project/task/vendor-invoice` · `VendorInvoiceDocumentForm` | the form: a **tab for each document** (and, on the web, a browser tab of its own for each); bar Delete · Unpost · Close · **Post / Posted (large, last)**; header; tabs **All · Time · Material · Expenses**; the lines table |
| hamburger menu → **Budgets → Vendor invoices** · `/pm/vendor-invoice/list` · `VendorInvoiceDocumentList` | a `ReusableTable` with folders **legal entity → vendor**, quick filters of every non-number column (one row, a Clear icon in each field), totals **per currency** |

## Where a line's vendor comes from (`vendor_invoice_candidates`)
1. the partner of the contract selected on the line (Time `taskResourceContract`, Material / Expense `taskLinePartnerContract`);
2. else the partner of the line (`taskLinePartnerItem`) - and the main vendor contract when it is the main vendor;
3. else the **main vendor** (+ its main contract) of the equipment (Time line) or the product (Material line): catalogs → *Main vendor* (`kit8/catalog/vendor`).
A line without a vendor is counted ("n lines have no vendor") and left out.

## Rules (SQL: triggers + RLS + RPCs; the TypeScript twins are in `vendorInvoiceModel.ts`)
* `create_vendor_invoices(task, selection, legalEntity)`: one draft per (vendor, contract); the quantity starts as **what is not on a vendor invoice yet** (plan − the quantity of the other invoice lines); nothing left = no document. The legal entity: the one of the contract, else the one chosen in the window.
* The header is written ONLY by the RPCs (`vendor_invoice_set_header`: invoice number, date, legal entity of a draft; post, unpost, delete); the vendor and the contract of a document never change; the organization of the writer is the RLS scope.
* A line of a DRAFT: only **quantity, price, VAT %** change (real columns, saved by `updateOne({ columns })`); the sums are computed by the trigger (`qty × price`, VAT of the sum, the budget / accounting sums at the rate of the plan of the line). No new lines (they come from the task lines). A posted invoice is read only.
* **Post** needs lines, the number printed on the invoice, its date, no zero quantity, and the user must own the projects of the lines; the answer is data `{ status, lines, problems[] }`. Unpost deletes the movements. A draft can be deleted (also directly, by policy); a posted one cannot.
* **0333Effect is not built** (the user said so).

## Files
| File | What |
|---|---|
| `vendorInvoiceModel.ts` | pure: constants, answers, filters, folders, the states and buttons, tabs, totals, the twin of the line sums, routes |
| `vendorInvoiceApi.ts` | the RPC calls (the Supabase client is passed in) |
| `vendorInvoiceMetaData.ts` | the redux entities of the documents (read / realtime / delete) and of the lines (`rootColumns` qtyInvoiced, priceInvoiced, vatRatioInvoiced) |
| `useVendorInvoice.ts` | `useVendorCandidates` · `useVendorInvoiceDocuments` (+ commands) · `useVendorInvoiceList` · `useCreateVendorInvoices` · `useOpenVendorInvoice` |
| `vendorInvoiceColumns.tsx` · `vendorInvoiceListColumns.tsx` | the columns of the two tables |
| `VendorInvoiceChoose.tsx` · `VendorInvoiceDocumentForm.tsx` · `VendorInvoiceDocumentList.tsx` | the three screens |

## Tests
* SQL on a real Postgres 15: `cd kit8/docker && ./test_fact_monitor01.sh 70` (87 checks: catalogs, main vendor guards, vendors of the lines, create, sums, header, post + register, turnover, drill-down, list + filters, RLS of two organizations, unpost / delete).
* Jest: `__tests__/pm/vendor_invoice` (model, hooks, columns, choose window, form, list, SQL mirror), `__tests__/catalog/legal_entity`, `__tests__/catalog/vendor`.
