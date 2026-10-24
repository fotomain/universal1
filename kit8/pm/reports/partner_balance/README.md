# Monitor07 - partner balance (`kit8/pm/reports/partner_balance`)

What a customer owes us (**Monitor07CustomerBalance**) and what we owe a vendor (**Monitor07VendorBalance**), per partner and contract, for a period. Design, decisions and the Q&A: `documentation/PARTNER_BALANCE.html`. SQL: **PART 39** (`start1` tables, `start2` code). Docker test `kit8/docker/tests/97_partner_balance.sql`.

Routes `app/pm/reports/monitor07/customer` and `.../vendor` (Drawer -> Reports -> Monitor07 Customer balance / Vendor balance). One screen, `PartnerBalanceDashboard`, with the role.

## The data (SQL)
* `partner_balance_movements` - the register: ONE signed row per posted invoice line / payment line. Written only by triggers in the **Post transaction** (vendor / customer invoice header goes to `posted`; a row appears in `cash_account_ledger_movements`), deleted by Unpost. Positive = the partner owes us. vendor invoice -, outbound payment +, customer invoice +, inbound payment - (a credit note flips the sign by itself). Types: `customerDebit` · `customerPayment` · `customerRefund` · `vendorCredit` · `paymentToVendor` · `vendorRefund`. A payment to a **person** writes no row.
* `partner_balance_ledger` - the totals for now (key: legal entity, role, partner, contract, project, task, currencies; NOT the plan line), kept by statement triggers.
* The sums are **with VAT**; the contract sum is the exact balance, the accounting / budget sums are as posted (the exchange rate difference of a settled contract stays there). A rate change does not touch the rows.
* No worker, no pg_cron. An existing database is filled once at the end of `start2` (`partner_balance_register_missing`); a script that writes a POSTED invoice straight into the table (as Railway #1 does) calls it. `partner_balance_verify()` / `partner_balance_rebuild()` are maintenance (SQL editor).
* Reads: `partner_balance_report(role, from, to, filters, sort, group)`, `partner_balance_filter_items`, `partner_balance_movements_list`.

## The screen
* Bar: `dateFrom` `dateTo` (both days included) · Project · Task (waits for the project) · Partner · Contract (waits for the partner) · Legal entity (only with two or more) · **Sum bigger than** / **Sum smaller than** (`sumBiggerThan` / `sumSmallerThan`, borders included, judge the **End** balance of the partner + contract in the first shown sum kind).
* Options: `showSumForContract` (on) / `showSumForAccounting` / `showSumForBudget`, **Hide settled**, **Sort by** partner name | Budget sum (End) | Contract finish date, ascending / descending. Remembered per user and report.
* Columns per shown kind: **Begin · Plus · Minus · End** (End = Begin + Plus - Minus; Minus holds the decreases, a credit note too). The vendor report shows the sign turned round (positive = we owe).
* Tree Partner -> Contract -> Task (the tasks are read when a contract is opened). A press on a number of a contract / task line lists the rows behind it; a press on a row opens the document.
* Sums of two currencies are never added: the group shows `mixed`, the footer has a line per currency.
* New sum kind: one entry in `SUM_KINDS` (`partnerBalanceModel.ts`) + the column in the two tables + the 4 numbers in `partner_balance_report`.

Files: `partnerBalanceModel.ts` (rules, no React), `partnerBalanceApi.ts`, `PartnerBalanceDashboard/Table/Options/MovementsModal.tsx`, `Monitor07CustomerBalance/VendorBalance.tsx`. Shared pieces: `../common`. Tests: `__tests__/pm/reports/partner_balance`.
