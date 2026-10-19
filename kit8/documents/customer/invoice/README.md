# Customer invoice - `kit8/documents/customer/invoice`

Source: the user's request of 2026-10-18 ("TabCustomer in Project settings … customerInvoiceFunctionalityEnabled: true by default … must work like vendor invoice functionality but Monitor01 will have other columns … Customer Invoice item of the Task 'Create based on' menu based on Revenues genus lines … TabCustomerInvoice"). SQL: **PART 31** of `kit8/sql/start/start1_sql_tables.sql` + `start2_sql_code.sql`.

The customer invoice is the **twin of the vendor invoice** (`kit8/documents/vendor/invoice`), made from the **Deliverable (Revenue genus) lines** of a task. **ONE document = ONE customer + ONE contract** (or none); `rowOwnerGUID` of the header = the legal entity. A posted invoice writes the **`sold` movements** of the project status register (the kind existed in the check since PART 25; registrator type `customerInvoiceHeader`), which feed the group **Customer Invoice (Qty, Sum)** of Monitor01.

| Where | What |
|---|---|
| Project settings → **Customer** (`TabCustomer`, `view/project/settings/PMProjectCustomerTab.tsx`) | the switch `customerInvoiceFunctionalityEnabled` (project_table.rowJSON; **true while never saved**, also in the organization defaults) |
| Task menu → **Create based on this → Customer Invoice** (after Purchase Order; only while the switch is on) | `useStartCustomerInvoice`: candidates → one draft per customer + contract (+ ONE draft without a customer of the lines that have none) → the form in a NEW browser tab. The line menu of a **Deliverable** line makes the invoice of THAT line (`lineGUIDs`); the line menu of another genus has no such item |
| Task menu → **Go to → Customer invoices** (right after Vendor invoices; only while the switch is on) | `/pm/customer-invoice/list?taskGUID=…[&taskLineGUID=…]` in a new window, with the chip "Task: …" |
| Task window → Fact → **TabCustomerInvoice** (after Vendor invoice; only while the switch is on) | `kit8/pm/view/task/edit/TabCustomerInvoice.tsx`: this list scoped to the task |
| hamburger menu → **Documents → Customer invoices** | `/pm/customer-invoice/list` · `CustomerInvoiceDocumentList` (folders legal entity → customer, quick filters) |
| `/pm/project/task/customer-invoice` · `CustomerInvoiceDocumentForm` | the form: a tab for each document; bar Delete · Unpost · Close · **Post**; tabs All · Deliverable |
| `/pm/project/task/customer-invoice/new` · `CustomerInvoiceChoose` | the customers of the lines, a check box each → Create |

## Where a line's customer comes from (`customer_invoice_candidates`)
1. the partner of the contract selected on the line (`taskLinePartnerContract`);
2. else the partner of the line (`taskLinePartnerItem`);
3. else the **main customer of the project** (`project_table.rowJSON.mainCustomerGUID`, Project settings → Partners) with its main contract.
A Revenue line without a customer is counted ("skipped") and made into ONE draft without a customer: the customer is chosen in the form before Post.

## Rules (SQL: triggers + RLS + RPCs; the TypeScript twins are in `customerInvoiceModel.ts`)
* `create_customer_invoices(task, selection, legalEntity)`: only `revenueGenus` lines; the quantity starts as what is not on a customer invoice yet; refused with "switched off in the project settings (Customer)" when the switch is false. The same switch guards `customer_invoice_add_line` (an independent Revenue line of a draft).
* The header is written ONLY by the RPCs; a line of a DRAFT changes quantity, price and VAT % only; the sums by trigger (as the vendor invoice); RLS by the organization.
* **Post** needs lines, the number printed on the invoice, its date, the customer and the legal entity, no zero quantity, own projects. Unpost deletes the movements. Delete only a draft.
* Not built (the vendor invoice has them): Multi Project, the main-vendor fallback, the "empty vendors" switch, `independentInvoiceInputAvailable` (the one switch decides).

## Monitor01 (`kit8/pm/reports/monitor01`)
The LAST 1st level group **Customer Invoice** with the 2nd level columns **Qty** (`qtyCustomerInvoiced`, a button: the drill-down measure `customerInvoiced` lists the sold movements, Open = this form) and **Sum** (`sumCustomerInvoiced` = Σ `sumForBudget` of the sold movements). The Revenue genus is in the report **only through the customer invoices** (no plan, no Budget): a row of the genus `revenueGenus` has only these two numbers; the tab **Deliverable** shows those rows, All has them too.

## Files
`customerInvoiceModel.ts` (pure) · `customerInvoiceApi.ts` · `customerInvoiceMetaData.ts` (redux entities) · `useCustomerInvoice.ts` · `customerInvoiceColumns.tsx` · `customerInvoiceListColumns.tsx` · `CustomerInvoiceChoose.tsx` · `CustomerInvoiceDocumentForm.tsx` · `CustomerInvoiceDocumentList.tsx` · `CustomerInvoiceScopeModal.tsx` · `customerInvoiceNavigation.ts`.

## Tests
* SQL on Postgres 15: `cd kit8/docker && ./test_fact_monitor01.sh 74` (49 checks: customers of the Revenue lines, create, sums, post + register, Monitor01 turnover / view / fresh rows / verify / drill-down, unpost, delete, list, the project switch).
* Jest: `__tests__/documents/customer/invoice` (model, hooks, columns, choose window, form, list, settings, SQL mirror), `__tests__/pm/reports/monitor01`, `__tests__/pm/ui/taskRelatedMenu.test.tsx`, `taskEditWindow.test.tsx`.
