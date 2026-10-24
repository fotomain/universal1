# Payment fact - `kit8/documents/payment/fact`

Source: the Google Doc "W1 FACT Payments" (owner answers of 2026-10-23); analysis, decisions and what was built: `documentation/PAYMENTS_FACT_WBS.html`. SQL: **PART 38** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (dropped by PART 1a-000000 of `delete_sql_structure.sql`, the worker scheduled by `start3_sql_pg_cron.sql`).

**ONE document = ONE bank transaction**: one money account, one payee (a partner OR a person), one direction (Outbound | Inbound), one date. **The RULE: one bank transaction pays N contracts of the payee, with N budget items, business units, tasks and projects** (many projects of one organization). The lines come from **"Get from plan"** = the POSTED payments of the payment plan (W1 PLAN PAYMENTS, PART 37); a line can also be added by hand (`+`, an unplanned payment, on a task).

| Where | What |
|---|---|
| context menu **Create based on this → Payment fact** (Task menu and the toolbar icons of the Finances view; not in the menu of one line) | makes a NEW draft for the task (`useStartPaymentFact`) and opens the form (a new browser tab on the web); **Go to → Payment facts** = the list filtered for the task |
| task window → **Fact** → 2nd level tab **Payments** (`kit8/pm/view/task/edit/TabPaymentFact`) | sub-tabs **Outbound · Inbound**: the list of the task, one direction each; the `+` makes a draft for the task and the direction |
| **Create based on → Payment fact** in the bar of a POSTED **vendor invoice** / **customer invoice** (`PaymentFactBasedOn`) and in the row menu of their lists | makes ONE draft that pays what is still open on the invoice and opens it in a new window: payee + contract of the invoice, direction Outbound (vendor) / Inbound (customer), one line per invoice line (sum + VAT − what posted facts paid), the project, task and business unit of the line, the budget item the contract names (else the standard "Payments to vendors" / "Receipts from customers"); the bank number, the date and the money account are filled in by the accountant. RPCs `create_payment_fact_from_vendor_invoice / _customer_invoice` (`payment_fact_from_invoice`); nothing left to pay = a snackbar, no document |
| Drawer → **Documents → Payment facts** · `/pm/payment-fact/list` | the list (folders **money account → payee**, quick filters of every non-number column, totals per currency of the accounts) |
| `/pm/project/task/payment-fact?documentGUID=…[&documents=…]` | the form: a tab per document (a browser tab each on the web); bar **Get from plan · Delete · Unpost · Close · Post** (large, last) |
| Drawer → **Catalogs → Money accounts** | the catalog (`kit8/catalog/money_account`): bank accounts and cash desks, their rests |

## The form
* Header (`PMPaymentFactDocumentHeader`): document no. · date (the day of the exchange rate) · **bank transaction no.** · money account (the currency follows) · direction · payee (partner / person; fixed once the document has lines) · optional **bank amount** (a control: the form tells the difference to the lines, Post does not refuse) · totals (the amount of the money account, the contract sums per currency, lines without an amount).
* Lines (`PMPaymentFactDocumentLines`, a `ReusableTable` on `paymentFactLinesReusable`): project · task (an unplanned line of a draft: paste / select in the project tree / clear) · contract (of the payee) · budget item (payments genus of the direction, editable) · business unit · currency (of the contract) · plan (what the plan payment had open) · **Sum with VAT** (typed) · accounting / budget sums (converted by the database at the rate of the date, read only) · **Amount of the money account** (the real bank amount: converted, or TYPED - it stays; clear the cell to convert again) · Amount is (typed / converted). All sums are WITH VAT.
* **Get from plan** (`PMPaymentFactGetFromPlan`): the posted plan payments of my projects with something open (open = plan sum − posted facts − this draft). The first one checked fixes the payee and the direction. `Only this task` is on for a document made for a task. Add copies contract, budget item, business unit, currency, task and project and starts the sum at what is open; paying more is allowed (the Plan column turns red).

## The database (PART 38)
`project_payment_fact_header` / `_lines` (RLS by organization; the header is written ONLY by RPCs, the cells of a draft line by the app's table; the line trigger converts the sums) · `cash_account_ledger_movements` (one SIGNED row per posted line: inbound +, outbound −) · `cash_account_ledger_rests` (the rest of an account per day, per sum kind `account | contract | accounting | budget` and currency; rebuilt by the database under a lock of the account) · `cash_account_ledger_dirty` (the queue of exchange rate changes).

* RPCs: `payment_fact_create / set_header / add_from_plan / add_line / set_line_task / plan_candidates / list`, `post_payment_fact / unpost_payment_fact / delete_payment_fact`, `task_payment_paid` (the columns **Paid / Open** of the payment plan), `cash_ledger_refresh_now` (button "Refresh rests").
* **Post** needs number, date, money account (with a currency; the date not before its opening date), payee, direction and ≥ 1 line; every line: budget item of the payments genus, contract, currency, sum > 0, the converted sums (a missing rate refuses), my project. One transaction; the rests are rebuilt from the date.
* **A rate change** (trigger on `currencyExchangeRateTable`) queues `[its day, the next rate of the same currency / type / base)`; the worker (`cash_ledger_process_dirty`, pg_cron job `cash_ledger_tick` every 10 s, or the button "Refresh rests") recalculates the accounting / budget / money-account sums of the movements of those days, then rebuilds the rests from the first changed day. `sumForContract` and a TYPED amount of the account never change; the lines of the document keep the sums they were posted with (only the register follows the rates).
* The payee and the direction cannot change while the document has lines; a posted document, its lines, its account's currency / opening date / opening balance cannot change; a task or project with a posted fact cannot be deleted (unpost first).

## Files
| File | What |
|---|---|
| `paymentFactModel.ts` | pure: constants, answers, filters, header, missing fields, totals, candidates, folders, routes |
| `paymentFactApi.ts` | the RPC calls (the Supabase client is passed in) |
| `paymentFactMetaData.ts` | the redux entities of the documents and of the lines |
| `usePaymentFact.ts` | `usePaymentFactList` · `usePaymentFactDocuments` (+ commands) · `usePlanCandidates` · `useTaskPaymentPaid` · `useStartPaymentFact` · `useOpenPaymentFact` · `useRefreshCashLedger` |
| `usePaymentFactPlaces.ts` | the project / task names of the lines |
| `paymentFactColumns.tsx` · `paymentFactListColumns.tsx` | the columns of the two tables |
| `PMPaymentFactDocumentForm / Header / Lines / List / GetFromPlan.tsx` | the screens |
| `PaymentFactBasedOn.tsx` | the button + window "Create based on → Payment fact" of an invoice form and `usePaymentFactBasedOnRowMenu` (the row menu of the invoice lists); the hook is `useCreatePaymentFactFromInvoice` |

## Tests
* SQL on a real Postgres 15: `cd kit8/docker && ./test_fact_monitor01.sh 96` (166 checks: money account guards, get from plan, guards of a line, sums and the typed amount, Post, rests, back-dated Post, the rate changes, RLS, unpost); speed: `./bench_cash_ledger.sh 10000`.
* Jest: `__tests__/documents/payment/fact` (model, api, hooks, columns, form, list, get from plan, create based on, SQL mirror), `__tests__/catalog/money_account`, `__tests__/pm/view/task/payments/paymentPlanPaid.test.tsx`.

## Partner balance (PART 39)
* A posted payment line also writes a row of the **partner balance** (`kit8/pm/reports/partner_balance`): outbound +, inbound - (the cash movement turned round), a payment to a **person** none. The header field **Settles in the balance of** (`paymentFactBalanceRole`: By direction | Customer | Vendor) is for a refund (we pay a customer back = Customer; a vendor pays us back = Vendor); a payment made from an invoice takes the role of that invoice.
* A payment made from an invoice needs the **contract** of the invoice (unpost the invoice, choose the contract, post it again); every payment line needs its contract at Post anyway.
* Project setting **paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled** (Project settings -> Payments, TRUE unless stored false): when a project of the lines has it OFF, Post refuses a document whose business units belong to different first level roots of the business unit tree (`businessUnitsOfDifferentRoots`).

## Known limits
* A typed amount of the account is recognised by its difference from the stored one: edit a line twice before the first save came back and the older amount may be taken for a typed one (clear the cell: it is converted again).
* The rest of an account in the contract / accounting / budget currency is kept per currency code; only the kind `account` is the real bank balance.
* The worker converts with the base currency of the rate book `EUR` unless the organization of the CALLING user says otherwise (`fx_base_currency`): a rate change of an organization with another base currency is recalculated with `EUR` by pg_cron (the button of the app uses the user's organization).
* Out of scope: bank statement import and matching, transfers between accounts, bank fees, FX gain / loss, the Cash flow report (plan vs fact).
