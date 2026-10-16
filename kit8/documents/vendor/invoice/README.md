# Vendor invoice - `kit8/documents/vendor/invoice`

Source: the Google Doc "W1 Vendor Invoice"; analysis, decisions and what was built: `documentation/PROJECT_STATE_WBS.html`. SQL: **PART 26** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (mirrored in `start2_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

**ONE document = ONE vendor + ONE contract** (or none). The documents are made from a task, posted, and a posted invoice writes the **`invoiced` movements of the project status register** (`project_status_movements`) in the same transaction.

| Where | What |
|---|---|
| context menu **Vendor Invoice** (right after **Facts input**) | **creates the invoice(s) at once** (`useStartVendorInvoice`: candidates → one draft per vendor + contract → the form; no choice window). Task tree (not for stages): every line of the task. A line of the Finances table (not Revenue): `VendorInvoiceScopeModal` asks first - **the current line (default)** / **all the lines of the task**. Lines that have **no vendor** (no contract, partner or main vendor) become ONE draft **without a vendor** (and without a legal entity; project switch `userCanCreateVendorInvoicesFromTasksWithEmptyVendors`, Project settings → **Vendor**, true by default - false leaves such lines out, also in the database): the form has a Vendor + Contract select (a `TextInputApp` look, `SelectElementFromCatalog asInput`) that **saves AT ONCE** when a vendor / contract is chosen (no button); **any UNPOSTED document can change its vendor and contract** (a new vendor drops the old contract; the folder and the currency follow; a posted one: Unpost first), the legal entity select is there as before (a contract that names one fills it); **Post is refused** (`vendorMissing`, `legalEntityMissing`) until both are set. The choice window (`VendorInvoiceChoose`) opens only when a person is needed: a vendor's contract without a legal entity, nothing to invoice, nothing left to invoice, or a failed call (it lists the lines without a vendor as a "No vendor" row) |
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
* The header is written ONLY by the RPCs (`vendor_invoice_set_header`: invoice number, date, legal entity, vendor and contract of an UNPOSTED document; post, unpost, delete); the organization of the writer is the RLS scope.
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
* Jest: `__tests__/documents/vendor/invoice` (model, hooks, columns, choose window, form, list, SQL mirror), `__tests__/catalog/legal_entity`, `__tests__/catalog/vendor`.

## Independent lines (project setting `independentInvoiceInputAvailable`, Project settings → Vendor, true by default)
A DRAFT shows the CRUD panel of the table with **+**: the RPC `vendor_invoice_add_line(header, genus)` adds a line of the kind of the tab (All: Time) WITHOUT a task line (`taskLineGUID` null) in the task the document was made from (`vendorInvoiceTask`). Its role, resource and unit are editable (the validate of the columns refuses a line that came from a task line), as are quantity, price and VAT %; the sums are computed by the database (no plan: no budget / accounting sum). Post writes its 'invoiced' movement as the others (no task line GUID). The switch off: no +, the three columns read only, the RPC refuses. The list RPC says it per document (`projectGUID`, `projectName`, `independentInputAvailable`, `taskGUID`). The form fields are all `TextInputApp` (`compact`, no outer margin, centered on one line).

The **project of a document** is a header field (`vendorInvoiceProject`, made with the document from the task's project; an older document gets it from its first line on the next start2 run) and is shown read only in the form header; `independentInvoiceInputAvailable` is read from THAT project, so the CRUD panel with + shows in the lines table when the project allows independent lines.

**New browser tab (web).** "Vendor Invoice" of the menus opens the invoice in a NEW browser tab: `useStartVendorInvoice` opens a blank tab INSIDE the click (`openBlankWindow`, so a pop-up blocker allows it) and points it at the form (`sendWindowTo`) once the document is made - a second, third ... document gets a tab of its own; the choice window, when needed, opens in the same tab. `useOpenVendorInvoice` with a document (Monitor01 → Invoiced → Open) opens a new tab too. A blocked tab, iOS and Android: the router in the same window.
