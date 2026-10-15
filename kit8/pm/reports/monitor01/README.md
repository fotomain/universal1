# Monitor01 - `kit8/pm/reports/monitor01`

Source: the Google Doc "W1 MONITOR1" and the sheet "W1 1-MONITOR01"; plan and decisions: `documentation/MONITOR01_WBS.html`. SQL: **PART 25** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (mirrored in `start2_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

Per resource role, month and task: **planned · contracted · rest to contract** (Plan) and **delivered · actually used · on-hand** (Fact), live. Every number opens its **source transactions** (`SumExplorerListReusable`).

| Where | How |
|---|---|
| in the project board | toggle **Reports → Monitor01** (`mode="project"`, one project) |
| separately | hamburger menu → **Reports → Monitor01**, route `app/pm/reports/monitor01` (`mode="standalone"`, the FULL data set, Project filter) |

Filters above the table: `startDate` · `finishDate` (**`DateInputApp`**: type or pick; a month is shown when it overlaps the window) · Project · Task · Resource (**`TextInputApp`** "contains", each with a **Clear** button). Tabs: Time · Material · Expense · All.

**Refresh now:** the Refresh button (and the first look at an EMPTY report) calls `monitor01_refresh_now(project)` - the database recomputes the tasks of the user's own projects at once, plan movements AND posted facts, exactly like the worker (`monitor01_apply`) - so the report shows data even when pg_cron is not running; an error of the database is shown under the bar. A report without facts shows its plan data (plan FULL JOIN fact).
**Real time, and the safety net under it:** the rows follow Supabase Realtime (`monitor01_view` is in the realtime publication). Realtime alone can be silent (a closed channel in a second browser, a table missing in the publication, a worker that is late), so while **Auto refresh** is ON the report also asks `monitor01_stamp(project)` every 3 s (`MONITOR01_POLL_INTERVAL_MS`): the number of its rows, the newest `updated_at`, and how many tasks wait in `monitor01_dirty` and for how long. (1) When the stamp differs from the rows on the screen twice in a row (one tick of grace for an event that is just arriving) the rows are read again. (2) When a task waits in the queue longer than `MONITOR01_QUEUE_STALE_SECONDS` (3 x the worker interval = 6 s) the screen calls `monitor01_refresh_now` itself (at most once in 15 s) and reads again - this is what keeps the report fresh when pg_cron does not run. The badge says **Live** (Realtime open), **Live: checked every 3 s** (Realtime silent but the stamp answers), **Offline: the last data** (neither works), **Auto refresh is off: a snapshot**. Auto refresh OFF = no polling at all. Note: editing a task line that is not POSTED changes the plan only after "Post" (the plan register is written by the post); a fact document changes `qtyUsed` when it is Posted.

**Monitor01Toolbar** (right after "Monitor01 · Roles requirements"): **Refresh** (reads the data again) and the **Auto refresh** switch (on by default: the numbers follow the realtime events; off: the table is a snapshot until Refresh is pressed; the filters work in both modes). The filters are **empty at the start** and then all the data is visible. `DateInputApp` turns eight typed digits into the date: `20260101` (YYYYMMDD) and `20122026` (DDMMYYYY = 20 Dec 2026) become `2026-01-01` / `2026-12-20`.

**The table** - headers: Project · Resource role · Month · **Task name** · Unit · Planned · Contracted · Rest to contract · **Sum for budget** · Delivered · Actually used · On-hand (every header starts with a capital letter, is centered and has the background of the header of `ReusableTable`: the `surfaceVariant` of the paper theme). No "requirements dimensions" / "ROW DESCRIPTION" column.
**The tree (collapsible, with subtotals on every level)** - the rows are a tree, one column per level: **Project** ▸ **Resource role** ▸ **Month** (ascending, also across years) ▸ **Task name**. Projects are sorted by name, inside a project by genus (Time, Material, Expense) and role name. Every Project / Resource role / Month line is a **subtotal** of everything below it (one line per unit: hours and pieces are never added; only the first line of a node has the label and the chevron) and **a chevron collapses it** - a collapsed node shows its subtotal only. Everything is open at the start; **Expand all** / **Collapse all** (Monitor01Toolbar) open or close every node; the collapsed nodes are kept while the data changes (a realtime event does not open or close anything). The numbers of a subtotal line open their source transactions, filtered by the node (`drillFilterOfNode`: unit, project, role + genus from the role level, month at the month level). The Total lines on top and the TotalsRow at the bottom stay. The model is `buildMonitor01Items(rows, collapsed)` in `monitor01Model.ts` (node keys `p|<project>`, `…|r|<genus>|<role>`, `…|m|<month>`).
**TotalsRow** at the bottom (always visible): `sumForBudget` and the quantities - one line per unit (hours and pieces are never added), and when there is more than one unit a line "Totals of all units" with the money of all the rows shown. It follows the filters and the tab.

## The data (all in the database, nothing is computed on the screen)
* `monitor01_view` - a real table, one row per **task × genus × role × unit × month**. `qtyPlanned` = Σ `task_line_plan_movements.qtyTaskLine` (`planMovementStatus` true), `sumForBudget` = Σ `task_line_plan_movements.sumForBudget` of the same movements; `qtyUsed` = Σ `qtyForContract` of the lines of the **POSTED fact documents** (also for a role / month that has no plan: such a row has planned 0), `qtyContracted` = the same quantity of the lines that have a **resource contract selected**
  (Time `taskResourceContract`, Material / Expense `taskLinePartnerContract`), else 0; `qtyRestToContract` and `qtyOnHand` are generated columns. **Delivered** is drawn without data for now (a fact line has no "delivered" kind); on-hand = delivered − used, so it is negative where something was used. A draft document is not counted - **Post** it.
* `monitor01_dirty` - the queue (one row per task). Statement-level triggers on the plan movements, the task lines, the fact documents and the renames only write the task key.
* **pg_cron every `MONITOR01_REFRESH_INTERVAL` = 2 s** calls `CALL monitor01_process_dirty()`: batches of 500 tasks, `FOR UPDATE SKIP LOCKED`, one set-based statement per batch, **only changed rows are written** (no realtime noise), a failing task is retried alone and parked after 5 attempts.
  Step 0 of every batch registers the PLAN of its tasks (`project_status_register_plan`: only a task whose plan changed is written); step 1 sums the register (`project_status_movements`) into `project_status_month_turnover`; step 2 fills `monitor01_view` (the turnover + the names + "plan not posted after a change").
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
