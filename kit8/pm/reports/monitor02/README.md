# Monitor02_ROINow - ROI as the data stands now

Route `app/pm/reports/monitor02` (drawer: Reports -> Monitor02 ROI now). Model, rules and the SQL: `../roi/README.md`, `documentation/ROI_DOC.html` section 7.2.

* **Which projects**: mine with the project switch `roiForTasksFunctionalityEnabled` ON (`roi_report_projects`). A project with it OFF is not here.
* **Lines**: one per project (the month totals of the period, under the project's own tax switches), under it one per task (`roi_task_lines`); the footer adds the project lines (the values are added, the ratios are of the sums). Columns: Cost plan · Revenue plan · Revenue fact input · Cost fact (vendor invoices + the cost that is never invoiced) · Customer invoiced · ROI1 · ROI2 · ROI3 · ROI4; every header has a tip with its formula.
* **Bar**: startDate · finishDate · the period button (a range of MONTHS: any day of a month counts for the whole month) · Project · Task (shows only that task's line; the project line stays: it is the total). Refresh computes the numbers NOW (`monitor01_refresh_now`, works without pg_cron) and reads again; Auto refresh = Realtime on `project_status_month_totals` (OFF = a snapshot); the badge shows Live / Offline and the age.
* ROI >= 0 green, < 0 red, "-" (no cost) grey. A double click on a task opens it in the dashboard.

Files: `useMonitor02Data.ts` (reads + Realtime), `Monitor02Filters.tsx`, `Monitor02Table.tsx`, `Monitor02Dashboard.tsx`. Tests: `__tests__/pm/reports/monitor02`.
