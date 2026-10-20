# kit8/pm/vat - the VAT basis of every report that shows money

Design and rules: `documentation/VENDOR_INVOICE_DOC.html` (sections 3, 13, 14).

An amount is stored as COMPONENTS - **net**, **VAT**, **VAT that is cost** (not recoverable) - and a report shows ONE of three bases:

| basis | name in the UI | amount |
|---|---|---|
| `cost` (default) | Cost (net + non-recoverable VAT) | net + VAT that is cost - the IFRS / GAAP cost; recoverable VAT is a receivable, not a cost |
| `net` | Net of VAT | net |
| `gross` | With VAT | net + all VAT |

While every VAT rate is fully recoverable (the default; `valueAddedTaxTable.rowJSON.vatRecoverablePercent` missing = 100) `cost` = `net`: no number of an old report changes.
A customer invoice's VAT is never cost (collected for the tax authority): its "in cost" part is always 0.

## Rules for a new report
1. Store / read the three components, never one pre-added total.
2. Compute the shown amount only through `amountOfVatBasis(net, vat, vatInCost, basis)` (SQL: `public.vat_basis_amount(net, vat, vat_in_cost, basis)`).
3. Offer `VatBasisSelect` (default Cost) with `useVatBasis()` - one choice for every report (kept in AsyncStorage).
4. Say the basis in the header tips / the README. A quantity report says nothing about it.

Used by: Monitor01 (`applyMonitor01VatBasis`), the project cost total (`costTotalForBudget` = cost basis, `costTotalForBudgetWithVAT`), the lines of the four documents (`kit8/documents/vat`).
Tests: `__tests__/pm/vat`, `__tests__/pm/reports/monitor01`, `kit8/docker/tests/75_vat_basis.sql`.
