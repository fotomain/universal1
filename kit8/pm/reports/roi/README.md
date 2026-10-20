# kit8/pm/reports/roi - ROI of the four kinds (pure model + reads)

Design and the reasons: `documentation/ROI_DOC.html`. SQL: PARTs 33 (ROI) and 34 (history) of `start1_sql_tables.sql` + `start2_sql_code.sql`. Screens: `../monitor02` (ROI now), `../monitor03` (ROI history), the strip of `../monitor01/Monitor01ProjectStrip.tsx`. Tests: `__tests__/pm/reports/roi`, `__tests__/pm/reports/monitor02`, `monitor03`, `kit8/docker/tests/92_roi.sql`.

## The four kinds
| | cost C | revenue R |
|---|---|---|
| ROI1 plan - plan | plan of Time + Material + Expense | plan of the Revenue lines |
| ROI2 plan - fact | plan cost | **fact input** of the Revenue lines (posted fact documents) |
| ROI3 plan - invoiced | plan cost | posted customer invoices |
| ROI4 fact - fact | posted vendor invoices **+ the cost that is never invoiced** | posted customer invoices |

`ROI = (R - C) / C`; no cost = `null` (shown "-"), never 0 and never infinity. **The money is added first (tasks, months, projects, lines), the ratio is taken last** - never the average of ratios.

"The cost that is never invoiced" = the posted fact input of a cost line that has NO vendor (the rule of `vendor_invoice_candidates`: the partner of the line's contract, else the partner of the line, else the main vendor of its equipment / product). Own staff, own equipment, own material, a line typed by hand. A cost line WITH a vendor counts when its vendor invoice is posted (not before). The flag is `rowJSON.ownCost` of the `used` movement, set at Post by `project_status_register_fact` from the JSON the fact line copied from its task line (`pm_line_has_vendor`).

## What is stored (money only, never a ratio)
15 additive components (`ROI_MONEY_KEYS`): `costPlan` · `revenuePlan` · `revenueUsed` · `costOwn` · `costInvoiced` · `revenueInvoiced`, each as `Net` / `Vat` (+ `VatInCost` for the costs). Same names in the three tables and in `RoiMoney`:
* `project_status_roi_task_month` - task x month, written by step 5 of `monitor01_apply` (`roi_apply`, changed rows only) from `project_status_movements`;
* `project_status_month_totals` - project x month, the sum of the task rows, written by statement triggers on the table above (also when a task is deleted by a cascade);
* `project_status_roi_history` - the log (PART 34), at most one row per project per day, only for a project with `roiHistoryFunctionalityEnabled`, written when the totals change; **the one table that cannot be rebuilt**.
The register learns the Revenue lines (their plan and their fact input) for ROI only: `project_status_fresh_turnover` still keeps a revenue movement only when it is a `sold` one, so no number of Monitor01 changes.

## The files
| file | what |
|---|---|
| `roiSettings.ts` | the five project keys (`roiValuesOf`: every key OFF while never saved; SQL: `vendor_project_setting_on`), `roiTaxOf` (the master turns both VAT switches on) |
| `roiModel.ts` | `RoiMoney`, `roiOfMoney(money, tax)` (the five values + ROI1-4), `roiRatio`, `sumMoney`, the formats and the tone |
| `roiReportModel.ts` | the lines of Monitor02 (`buildRoiNowLines`: a project line, a task line only while the project switch is ON), the footer (`roiFooterOf`: the values are added, the ratios are of the sums), the select options |
| `roiHistoryModel.ts` | the points of Monitor03 (`pointsOfMonthCurve`, `pointsOfHistory`) and the chart data (`roiChartData`, `roiSeriesSegments`: a step line, a gap is not 0) |
| `roiStripModel.ts` | the numbers of the strip above Monitor01 (Budget, Vendor Invoice Amount, Customer Invoice Amount on the VAT basis of the screen) |
| `roiApi.ts` | the reads (`project_status_month_totals`, `roi_task_lines`, `roi_report_projects`, the curve view, the history table) |

## The same rule in SQL
`roi_ratio` / `roi_cost` / `roi_revenue` / `roi_include_vat`, the views `project_status_totals` (one line per project), `project_status_month_roi` (the cumulative curve in business time) and `project_status_roi_history_v`, and `roi_project(project, from, to)` / `roi_task_lines(project, from, to)` (task lines ONLY while the task switch is ON). `roi_verify` (maintenance) and `roi_rebuild(project)` heal the stored tables. `tests/92_roi.sql` and `roiModel.test.ts` use the same numbers (the fixture of the page: plan cost 1000, revenue plan 1500, fact input 1100, vendor invoices 900, customer invoices 1200 -> 50 % / 10 % / 20 % / 33.3 %).

## The project switches (Project settings -> ROI, also Organization edit -> Projects -> Settings)
`roiForTasksFunctionalityEnabled` (Monitor02 shows the project, with a line per task; OFF: the project is not in Monitor02 and no task is calculated) · `roiHistoryFunctionalityEnabled` (the log is written from the day it is switched on; the rows stay when it is switched off) · `projectROIIncludeAllTaxes` (master) · `projectROIIncludeSaleVAT` · `projectROIIncludePurchaseVAT`. The tax switches choose components (net / VAT / VAT that is cost) of stored money: a change of a switch changes no stored number, it redraws every curve.

## Speed (local Postgres 15, the 2000-task bench database, measured by hand with `roi_apply`)
`roi_apply` of 500 NEW tasks (60 000 movements) 69 ms · the same 500 tasks again (nothing changed, nothing written) 55 ms · one unchanged task 1.3 ms · one changed task (its month row and the project month re-summed) 3.2 ms. The Monitor01 worker (`bench_monitor01.sh 2000`) is otherwise as before; `roi_apply` is a small part of one batch. A failure of the step is a WARNING (it never stops Monitor01).

## Known limits
* ROI4 does not count a cost line that has a vendor until its vendor invoice is posted (a fact input that is waiting for its invoice is not in ROI4).
* Monitor02 has no drill-down into the source documents yet.
* The history has the project level only (no task level) and starts on the day the switch is turned on.
* A subproject's cost is not added to its origin task (the month totals count the project's own tasks).
