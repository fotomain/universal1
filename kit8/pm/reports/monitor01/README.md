# Monitor01 - `kit8/pm/reports/monitor01`

Source: the Google Doc "W1 MONITOR1" and the sheet "W1 1-MONITOR01"; plan and decisions: `documentation/MONITOR01_WBS.html`. SQL: **PART 25** of `kit8/sql/start/start1_sql_structure.sql` (mirrored in `start2_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

Per resource role, month and task: **planned · contracted · rest to contract** (Plan) and **delivered · actually used · on-hand** (Fact), live. Every number opens its **source transactions** (`SumExplorerListReusable`).

| Where | How |
|---|---|
| in the project board | toggle **Reports → Monitor01** (`mode="project"`, one project) |
| separately | hamburger menu → **Reports → Monitor01**, route `app/pm/reports/monitor01` (`mode="standalone"`, the FULL data set, Project filter) |

Filters above the table: `startDate` · `finishDate` (**`DateInputApp`**: type or pick; a month is shown when it overlaps the window) · Project · Task · Resource (**`TextInputApp`** "contains", each with a **Clear** button). Tabs: Time · Material · Expense · All.

**Refresh now:** the Refresh button (and the first look at an EMPTY report) calls `monitor01_refresh_now(project)` - the database recomputes the tasks of the user's own projects at once, plan movements AND posted facts, exactly like the worker (`monitor01_apply`) - so the report shows data even when pg_cron is not running; an error of the database is shown under the bar. A report without facts shows its plan data (plan FULL JOIN fact).
**Monitor01Toolbar** (right after "Monitor01 · Roles requirements"): **Refresh** (reads the data again) and the **Auto refresh** switch (on by default: the numbers follow the realtime events; off: the table is a snapshot until Refresh is pressed; the filters work in both modes). The filters are **empty at the start** and then all the data is visible. `DateInputApp` turns eight typed digits into the date: `20260101` (YYYYMMDD) and `20122026` (DDMMYYYY = 20 Dec 2026) become `2026-01-01` / `2026-12-20`.

**The table** - headers: Resource role · Month · **Task name** · Unit · Planned · Contracted · Rest to contract · **Sum for budget** · Delivered · Actually used · On-hand (every header starts with a capital letter, is centered and has the background of the header of `ReusableTable`: the `surfaceVariant` of the paper theme). No "requirements dimensions" / "ROW DESCRIPTION" column.
**TotalsRow** at the bottom (always visible): `sumForBudget` and the quantities - one line per unit (hours and pieces are never added), and when there is more than one unit a line "Totals of all units" with the money of all the rows shown. It follows the filters and the tab.

## The data (all in the database, nothing is computed on the screen)
* `monitor01_view` - a real table, one row per **task × genus × role × unit × month**. `qtyPlanned` = Σ `task_line_plan_movements.qtyTaskLine` (`planMovementStatus` true), `sumForBudget` = Σ `task_line_plan_movements.sumForBudget` of the same movements; `qtyUsed` = Σ `qtyForContract` of the lines of the **POSTED fact documents** (also for a role / month that has no plan: such a row has planned 0), `qtyContracted` = the same quantity of the lines that have a **resource contract selected**
  (Time `taskResourceContract`, Material / Expense `taskLinePartnerContract`), else 0; `qtyRestToContract` and `qtyOnHand` are generated columns. **Delivered** is drawn without data for now (a fact line has no "delivered" kind); on-hand = delivered − used, so it is negative where something was used. A draft document is not counted - **Post** it.
* `monitor01_dirty` - the queue (one row per task). Statement-level triggers on the plan movements, the task lines, the fact documents and the renames only write the task key.
* **pg_cron every `MONITOR01_REFRESH_INTERVAL` = 2 s** calls `CALL monitor01_process_dirty()`: batches of 500 tasks, `FOR UPDATE SKIP LOCKED`, one set-based statement per batch, **only changed rows are written** (no realtime noise), a failing task is retried alone and parked after 5 attempts.
  Step 1 of every batch sums the posted fact documents into `task_line_fact_for_monitor01`; step 2 fills `monitor01_view`.
* `monitor01_verify` / `monitor01_rebuild` are the safety net; `monitor01_sum_sources` returns the source transactions of any sum (planned, contracted, used = the lines of the posted fact documents - the list shows the document number and **Open** shows the document; delivered is empty).
* Read policy of the view: `rowOwnerUserGUID = current user` (one column, no join per event - the fastest realtime).

## Files
| File | What |
|---|---|
| `monitor01Constants.ts` | `MONITOR01_REFRESH_INTERVAL = 2` and the rest (tested against the SQL) |
| `monitor01Model.ts` | pure: keys, **patch of a realtime event**, filters, tabs, totals per unit, the TotalsRow (`monitor01Totals`), table items, drill-down filters |
| `monitor01Colors.ts` | the critical cells (rest > 0 amber, < 0 red, = 0 green; on-hand < 0 red) - change the rules here |
| `useMonitor01Rows.ts` | paged first load + Realtime: events patched by key, batched 100 ms, read again after a reconnect |
| `Monitor01Table.tsx` · `Monitor01Filters.tsx` · `Monitor01Toolbar.tsx` · `Monitor01Dashboard.tsx` | the screen |
| `monitor01Api.ts` · `monitor01SumSources.ts` | the drill-down calls and the lists (planned, contracted; rest = planned − contracted; on-hand = delivered − used) |
| `kit8/ui/components/common/SumExplorerListReusable.tsx` | the reusable window: lists, subtotals, check line "list total = number ✓" |

## Tests and speed
* SQL: `cd kit8/docker && ./test_fact_monitor01.sh 60` (85 checks: the numbers of the sheet, only changed rows written, renames, parking, policies, drill-down = the cell, verify) and the procedure with COMMIT (1200 tasks in 3 batches).
* Speed: `./bench_monitor01.sh 2000` (120 000 movements): empty tick 0.17 ms · one task 4 ms · 500 tasks ~130 ms.
* Jest: `__tests__/pm/reports/monitor01`, `__tests__/ui/sumExplorerListReusable`, `__tests__/drawer-catalogs`.
