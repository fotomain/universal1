# Vendor invoice - `kit8/documents/vendor/invoice`

Source: the Google Doc "W1 Vendor Invoice"; analysis, decisions and what was built: `documentation/PROJECT_STATE_WBS.html`. SQL: **PART 26** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (mirrored in `start2_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

**ONE document = ONE vendor + ONE contract** (or none). The documents are made from a task, posted, and a posted invoice writes the **`invoiced` movements of the project status register** (`project_status_movements`) in the same transaction.

| Where | What |
|---|---|
| context menu **Vendor Invoice** (right after **Facts input**) | **creates the invoice(s) at once** (`useStartVendorInvoice`: candidates → one draft per vendor + contract → the form; no choice window). Task tree (not for stages): every line of the task. A line of the Finances table (not Revenue): `VendorInvoiceScopeModal` asks first - **the current line (default)** / **all the lines of the task**. Lines that have **no vendor** (no contract, partner or main vendor) become ONE draft **without a vendor** (and without a legal entity; project switch `userCanCreateVendorInvoicesFromTasksWithEmptyVendors`, Project settings → **Vendor**, true by default - false leaves such lines out, also in the database): the form has a Vendor + Contract select (a `TextInputApp` look, `SelectElementFromCatalog asInput`) that **saves AT ONCE** when a vendor / contract is chosen (no button); **any UNPOSTED document can change its vendor and contract** (a new vendor drops the old contract; the folder and the currency follow; a posted one: Unpost first), the legal entity select is there as before (a contract that names one fills it); **Post is refused** (`vendorMissing`, `legalEntityMissing`) until both are set. The choice window (`VendorInvoiceChoose`) opens only when a person is needed: a vendor's contract without a legal entity, nothing to invoice, nothing left to invoice, or a failed call (it lists the lines without a vendor as a "No vendor" row) |
| `/pm/project/task/vendor-invoice/new` · `VendorInvoiceChoose` | the vendors (and contracts) of the lines: a check box each → **Create** makes one draft per checked pair |
| `/pm/project/task/vendor-invoice` · `VendorInvoiceDocumentForm` | the form: a **tab for each document** (and, on the web, a browser tab of its own for each); bar Delete · Unpost · Close · **Post / Posted (large, last)**; header; tabs **All · Time · Material · Expenses**; the lines table |
| hamburger menu → **Budgets → Vendor invoices** · `/pm/vendor-invoice/list` · `VendorInvoiceDocumentList` | a `ReusableTable` with folders **legal entity → vendor**, quick filters of every non-number column (one row, a Clear icon in each field), totals **per currency** |

**Task menus**: the submenus "Create based on this" and "Go to" (before Delete) of the Task menu and of the line menu of the Finances table; "Go to → Vendor invoices" opens `/pm/vendor-invoice/list?taskGUID=…[&taskLineGUID=…]` - the list shows a chip (Task: …, x clears it) and `vendor_invoice_list` takes the keys `taskGUID` / `taskLineGUID`. See `kit8/documents/taskScope/README.md`.

**Create based on → Payment fact** (a POSTED invoice): the button "Create based on" in the bar of the form (before Close) and the row menu of the list make ONE draft payment fact (OUTBOUND, to the vendor, what is still open on each line) and open it in a new window - `kit8/documents/payment/fact` (`PaymentFactBasedOn`, SQL `create_payment_fact_from_vendor_invoice`).

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


## Multi Project (project setting `multiProjectVendorInvoceNeeded`, Project settings → **Vendor**, OFF while never saved)
A DRAFT invoice of a project that has the setting on shows a **chevron (expand_more)** at the left of its Project field: **Single Project | Multi Project** (`ModalWindowListToSelect`; saved at once by `vendor_invoice_set_header({ vendorInvoiceMultiProject })`; back to Single is refused while a line belongs to another project). In **Multi Project** the lines table gets three fields after `#` (`VENDOR_INVOICE_LINE_PLACE_FIELDS`):

| field | what |
|---|---|
| `vendorInvoiceLineProject` | the project of the line's task (read only) |
| `vendorInvoiceTaskGUID` | the task of the line; Paste · Select · Clear (a DRAFT) |
| `vendorInvoiceTaskLineGUID` | the task line (`task_line_table`); Paste · Select · Clear |

**Variant 1 - Paste.** The context menus give the GUIDs: the task tree row menu **Copy GUID** (task) and the Finances line row menu **Copy line GUID** (line, `kit8/pm/view/task/finances/copyLineGuid.ts`). Paste reads the clipboard, takes the first GUID of the text (`extractGUID`) and calls `vendor_invoice_set_line_task`: a task GUID sets the task (an independent line of that task), a line GUID sets the task line (its task and project follow); no GUID = a message, nothing changes.
**Variant 2 - Select.** `PMProjectPickerModal` (`kit8/pm/view/project/pick`): the project dashboard - recent projects, the task tree, the Finances view of the selected task (full data, like Edit) - in a window that returns what is pressed: **Select this task** (Finances toolbar) or **Select this line** (row menu of a line, or a click on a read only cell). The dashboard is the same `PMProjectDashboard`, with `picker` it forces the Finances pane and turns the deep link, the FAB commands and the keyboard shortcuts off (the project the user had open is not changed: the picker only reads the project it shows). The window is loaded when it is opened (`React.lazy`).
**Clear.** Both null: the line goes back to the task and project of the document, without a task line.
SQL (PART 26): `vendor_invoice_set_line_task(line, task, task line)` (a DRAFT of a Multi Project invoice; the user must own the project of the new task; a task line copies its description, price and VAT %, the quantity the user typed stays), `vendor_invoice_line_places(header)` (project / task names for the table), `vendor_project_setting_on(project, key)` (the switch that is OFF by default), `vendor_task_line_snapshot(line)`. The identity of a line is still frozen for a plain UPDATE: only the RPC opens the gate (session flag `app.vendor_invoice_line_move`). **Post writes the movement with the project of the LINE.** Docker: `tests/70_vendor_invoice.sql` section 9. The shared code is `kit8/documents/vendor/lineplace` (model + `LinePlaceCell`).

## Purchase order
`kit8/documents/vendor/purchase_order` is the twin of this folder (README there): the same logic, `ordered` movements, the Monitor01 column Ordered.

## From a product receipt
A vendor invoice can also be made from a POSTED product receipt (`kit8/documents/vendor/product_receipt`, SQL PART 30): receipt form / receipt list row menu **Create based on → Vendor invoice** → `create_vendor_invoice_from_receipt(receipt)`. The draft takes the vendor / contract / legal entity of the receipt and a line for every receipt line that is not fully invoiced (received − the quantity of the other invoice lines with the same `rowJSON.productReceiptLineGUID`); the header keeps `vendorInvoiceProductReceipt`. From there it is an ordinary vendor invoice.

## VAT columns (2026-10-20)
The VAT rate of a line is chosen from `valueAddedTaxTable`; the line has **Accounting before VAT** and **VAT for accounting** (typed by the user in a draft: the price / the VAT % are calculated back) and **Sum for accounting (with VAT)**; `sumForBudget` stays NET beside `vatForBudget`. Posting writes the net sums and the VAT parts into the register. See `kit8/documents/vat/README.md` and `documentation/VENDOR_INVOICE_DOC.html`. Test: `kit8/docker/tests/75_vat_basis.sql`.
