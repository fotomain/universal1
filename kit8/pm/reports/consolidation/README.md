# kit8/pm/reports/consolidation - Monitor08 Consolidation

Design: `documentation/CONSOLIDATION_WBS.html` (section 5). SQL PART 52, RPC `consolidation_report(projects, from, to, by_month)` (SECURITY INVOKER: the policies of the register and of
`project_table` decide which projects the user sees - a member sees his own projects, the administrator those of the organization; no new permission profile).

Drawer -> Reports -> **Monitor08 Consolidation** (`/pm/reports/monitor08`): a line per project (and month), the columns Budget (plan) · Ordered · Received · Used · Vendor invoice · Customer invoice
(`MONITOR08_COLUMNS`), the footer. The revenue of the plan / of the fact input has no column (the sale side is shown through the customer invoices only, like Monitor01).

- **Currency basis** (`CurrencyBasisSelect` + `useCurrencyBasis` in `reports/common`, remembered like the VAT basis): **Consolidation** (default) = `sumForConsolidation` of the movements in the
  currency of the organization, with the two organization VAT switches (`consolidationIncludePurchaseVAT / SaleVAT`, Organization edit -> Consolidation; the VAT basis selector is hidden and the header
  says "set by the organization"); **Project** = each project in its own budget currency on the VAT basis of the report. Lines in different currencies are NEVER added (the footer says so).
- The status (Ready / Recalculating / N movements without a rate) and **Refresh now** (`consolidation_refresh_now`, works without pg_cron) come from `catalog/organization/consolidation`.
- A snapshot: it reads when the period changes and on Refresh; the worker changes the register rarely.

NOT built (phase 2, see the WBS): the currency basis switch in Monitor01 / Monitor02 / Monitor03 / Monitor07, the ROI twins, a drill-down of a number, saved Views of Monitor08.

Tests: `__tests__/pm/reports/consolidation`.
