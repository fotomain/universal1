# kit8/documents/vat - the VAT columns of the lines of the four documents

Vendor invoice, purchase order, product receipt, customer invoice (`documentation/VENDOR_INVOICE_DOC.html`).

- `vatRateColumn`: the VAT rate is chosen from `valueAddedTaxTable` (a select, saved as `rowJSON.vatRateGUID`). The database copies its percent into the line and freezes its recoverable share (`vat_rate_lookup`). A legacy line shows the catalog rate with the same percent, else its own percent as the current option.
- `accountingColumns`: Sum for budget (NET) · VAT for budget · **Accounting before VAT** and **VAT for accounting** (both TYPED by the user in a draft; the trigger calculates the PRICE back from the first, the VAT % from the second, `vat_line_calc`) · **Sum for accounting (with VAT)** = the total. Typing needs a plan rate on the line (a plan price and a unit sum); a change of the quantity, the price or the VAT rate drops what was typed.
- On a LINE `sumForAccounting` is the total with VAT; in the register, the turnover and the plan it keeps its old meaning (net), the VAT is beside it (`vatForAccounting`, `vatInCostForAccounting`).
- Tests: `__tests__/documents/vat`, the four `…Columns.test.tsx`, `kit8/docker/tests/70,71,74,75`.
