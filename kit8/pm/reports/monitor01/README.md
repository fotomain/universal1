# Monitor01 - `kit8/pm/reports/monitor01`

Source: the Google Doc "W1 MONITOR1" and the sheet "W1 1-MONITOR01"; plan and decisions: `documentation/MONITOR01_WBS.html`. SQL: **PART 25** of `kit8/sql/start/start_sql_structure.sql` (mirrored in `start_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

Per resource role, month and task: **planned · contracted · rest to contract** (Plan) and **delivered · actually used · on-hand** (Fact), live. Every number opens its **source transactions** (`SumExplorerListReusable`).

| Where | How |
|---|---|
| in the project board | toggle **Reports → Monitor01** (`mode="project"`, one project) |
| separately | hamburger menu → **Reports → Monitor01**, route `app/pm/reports/monitor01` (`mode="standalone"`, the FULL data set, Project filter) |

Filters above the table (`TextInputApp`): `startDate` · `finishDate` (a month is shown when it overlaps the window) · Project · Task · Resource ("contains"). Tabs: Time · Material · Expense · All.

## The data (all in the database, nothing is computed on the screen)
* `monitor01_view` - a real table, one row per **task × genus × role × unit × month**. `qtyPlanned` = Σ `task_line_plan_movements.qtyTaskLine` (`planMovementStatus` true); `qtyContracted` = the same quantity of the lines that have a **resource contract selected**
  (Time `taskResourceContract`, Material / Expense `taskLinePartnerContract`), else 0; `qtyRestToContract` and `qtyOnHand` are generated columns. Delivered / used are drawn **without data** for now.
* `monitor01_dirty` - the queue (one row per task). Statement-level triggers on the plan movements, the task lines, the fact documents and the renames only write the task key.
* **pg_cron every `MONITOR01_REFRESH_INTERVAL` = 2 s** calls `CALL monitor01_process_dirty()`: batches of 500 tasks, `FOR UPDATE SKIP LOCKED`, one set-based statement per batch, **only changed rows are written** (no realtime noise), a failing task is retried alone and parked after 5 attempts.
  Step 1 of every batch sums the posted fact documents into `task_line_fact_for_monitor01`; step 2 fills `monitor01_view`.
* `monitor01_verify` / `monitor01_rebuild` are the safety net; `monitor01_sum_sources` returns the source transactions of any sum (planned, contracted, fact; delivered / used are empty).
* Read policy of the view: `rowOwnerUserGUID = current user` (one column, no join per event - the fastest realtime).

## Files
| File | What |
|---|---|
| `monitor01Constants.ts` | `MONITOR01_REFRESH_INTERVAL = 2` and the rest (tested against the SQL) |
| `monitor01Model.ts` | pure: keys, **patch of a realtime event**, filters, tabs, totals per unit, table items, drill-down filters |
| `monitor01Colors.ts` | the critical cells (rest > 0 amber, < 0 red, = 0 green; on-hand < 0 red) - change the rules here |
| `useMonitor01Rows.ts` | paged first load + Realtime: events patched by key, batched 100 ms, read again after a reconnect |
| `Monitor01Table.tsx` · `Monitor01Filters.tsx` · `Monitor01Dashboard.tsx` | the screen |
| `monitor01Api.ts` · `monitor01SumSources.ts` | the drill-down calls and the lists (planned, contracted; rest = planned − contracted; on-hand = delivered − used) |
| `kit8/ui/components/common/SumExplorerListReusable.tsx` | the reusable window: lists, subtotals, check line "list total = number ✓" |

## Tests and speed
* SQL: `cd kit8/docker && ./test_fact_monitor01.sh 60` (72 checks: the numbers of the sheet, only changed rows written, renames, parking, policies, drill-down = the cell, verify) and the procedure with COMMIT (1200 tasks in 3 batches).
* Speed: `./bench_monitor01.sh 2000` (120 000 movements): empty tick 0.17 ms · one task 4 ms · 500 tasks ~130 ms.
* Jest: `__tests__/pm/reports/monitor01`, `__tests__/ui/sumExplorerListReusable`, `__tests__/drawer-catalogs`.
