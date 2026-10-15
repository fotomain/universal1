# Project cost total (`kit8/pm/cost`)

`costTotalForBudget` of every **task** and **stage** of the tree: the **plan** in the budget currency, **Time + Material + Expense**; a stage = its own cost + everything below it.
Design, decisions, measured numbers: `documentation/UPDATE_PROJECT_COST.html`. SQL: PART 27 of `start1_sql_tables.sql` (tables) + `start2_sql_code.sql` (code).

## The rule: when does the server work?
Only while a **cost budget is on**: the master `projectExpenseBudgetNeeded` AND one of **Time** (`projectTimeCostsNeeded` with person or equipment) / **Material** (`projectMaterialCostsNeeded`) / **Expense** (`projectExpenseCostsNeeded`).
`projectCostBudgetOn()` (`../model/taskInputScope.ts`) and `project_cost_budget_on()` (SQL) are one rule; `__tests__/pm/cost/projectCostSql.test.ts` keeps the defaults equal, `kit8/docker/tests/80_project_cost.sql` runs the same cases.
All off = the rows are deleted. A genus whose switch is off later but that still has plan lines is still summed (a switch never hides data).

## Where the numbers come from
`project_status_month_turnover.sumForBudgetPlan` (Monitor01's table), so the cost can never disagree with Monitor01. The plan of an **unposted** task line is not there (as in Monitor01).

| Piece | What |
|---|---|
| `project_task_cost_total` | one row per task / stage that has a cost (sparse): `costOwnForBudget`, `costTotalForBudget`. Read policy by `rowOwnerUserGUID`; written only by the functions; in the realtime publication |
| step 3 of `monitor01_apply` → `project_cost_apply(tasks)` | the **delta** (`newOwn − storedOwn`) is added to the task and to every stage above it; the stages are read from the **labels of `treePath`** (a label = the GUID with `-` → `_`): no join, no subtree scan |
| `project_cost_rebuild(project)` | the same numbers from scratch (one pass); used by the command, when a budget is turned on, when a stage is moved / deleted (queue `project_cost_dirty`, worked off by the Monitor01 worker) |
| `update_project_cost_total(project)` | RPC of the toolbar command: flushes the queued tasks of the project, rebuilds, answers `{ tasks, rows, projectTotal, changedRows, ms, flushed }` (`changedRows > 0` = a drift was healed) |
| `project_cost_verify(project)` | read only, empty = the stored totals are right |

## App
| File | What |
|---|---|
| `costTotalModel.ts` | pure: the switch rules (`costSwitchUsable`, `costColumnShown`), rows, `applyCostEvents` (realtime patch), `formatCost`, the "stale" bus |
| `costTotalApi.ts` | `readProjectCostRows` (pages of 1000), `updateProjectCostTotal` (the RPC) |
| `useProjectCostTotals.ts` | read once, then Realtime (filter `rowProjectGUID=eq.<project>`) patches the map - **no refetch** of the project; reconnect and the stale bus read again; off while the Cost column is not shown |
| tree column | `costTotalForBudget` in `view/tree/columns/treeColumns.ts` (not in the default order; placed after "%" while `showCostColumn`), cell drawn in `PMProjectTasksTree.tsx` (stages bold) |
| switch | Project settings → Budgets → Main, under "Expense budget needed": `showTotalCostOnTheGanttChart` (project `rowJSON`); usable only while a cost budget is on, offered switched on when the budget becomes on; display only |
| after Post | the Post hooks call `useCostRefreshDebounce()`; `costRefreshScheduler.ts` **debounces per project** (500 ms after the last Post), runs ONE `update_project_cost_total` (`refreshCostAfterPost.ts`), never two in parallel (a Post during a running call = exactly one more afterwards), only while a cost budget is on, not awaited, an error is only logged; the command "Update project cost" cancels the pending call. Merging other browsers is the server's job (queue row per task, 2 s batch, advisory lock) |
| command | Actions menu of the project bar: **Update project cost**, directly before "Refresh the project", only while a cost budget is on |

## Not built (decided later, see the design doc section 11)
Used / invoiced totals (the table and the delta take another column pair), a text with the total on the Gantt bars.

## Tests
`npm test -- __tests__/pm/cost` · Docker: `kit8/docker/test_fact_monitor01.sh 80` · speed: `kit8/docker/bench_project_cost.sh 10000` · the roll-up comparison behind the design: `kit8/docker/bench_project_cost_rollup.sql`.
