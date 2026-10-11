# Task line plan - Post, `task_line_plan`, the Plan view

Source: the documents "W1 Post Task" (Part 1 task posting, Part 2 Correct033) and "0333 Effect"; the plan page `documentation/TASK_LINE_PLAN_CALCULATION.html`.
A task line has totals (`qtyTaskLine`, `sumForBudget`, `sumForContract`) and a distribution (`distributionForBudgetTaskLine`) but no dates. **Post** spreads them over the
working days of the task and saves one row per line and day in `task_line_plan`. The **Plan** view shows these rows (read-only).

## Post (the button of the Finances table)

* The **Post button** is the first button of the bar of the line table (`ReusableTable postDataNeeded`, `kit8/ui/components/table/reusable/ReusableTablePostButton.tsx`).
  Icon always, text only on a wide window (>= 900 px). It posts the **whole task** (all genus tabs), not only the visible tab.

  | text | when |
  |---|---|
  | **Post** | nothing was ever posted (the first edit) |
  | **Posted** | the post finished and every line with a budget item is posted |
  | **Post needed** | something was posted before and the data changed since (a line edited / added, or the dates of the task moved) |

  (`taskPostState`, `taskLinePlanModel.ts`.) Background = `project.uxuiSettings.postButtonBackgroundColor` (light fuchsia `#F0ABFC` by default; Gantt settings → Task tab).
* A line is posted only with a **budget item** (`budgetItemTaskLine`, the first column; a new line gets the item of its genus). Lines without one are skipped.
* `rowJSON.taskIsPosted` is false for a new / duplicated line and set **false by ANY change of the line** (`taskLineCompute.ts`, "Recalculate" too). Only the SQL procedure sets it true
  (and writes `baseOfDistribution` = 1, the sign that the line was posted once). A SQL trigger also unposts the lines of a task when its start / finish DAY changes.
* `useTaskPost.ts` collects the task (start / finish from the scheduler, finish exclusive), reads the days of `project.calendarForTaskPlan` (default `workingDaysCalendar`,
  `kit8/catalog/management/calendar`), runs `calculateTaskLinePlan` and calls `create_task_line_plan` (`taskLinePlanApi.ts`). Lines with a problem are left out and named in the message; a problem of the
  task itself (no dates, a year the calendar does not have, no active day) stops everything. **Manual distribution is not used for posting.**

## `calculateTaskLinePlan` (pure)

periods = the active calendar days between the first and the last day of the task (an excluded day divides the timeline; the shape is stretched over the active days) →
weights `distributionShares(code, n)` → **coefficients** normalized to `baseOfDistribution = 1`, 10 digits, the rest on the last day with a non-zero coefficient →
`taskLinePlanJSON` = the minimum the procedure needs: per line its guid, the three totals (null stays null), the base and `[{ d: 'YYYY-MM-DD', c }]`.
`distributeCorrect033` is the TypeScript twin of the SQL rule (integer cents) for previews and tests.

## `task_line_plan` and `create_task_line_plan(taskLinePlanJSON)` (`kit8/sql/init/create_task_line_plan_table.sql`)

`rowProjectGUID` = the project of the task · `rowOwnerGUID` = the task · `rowParentGUID` = the **line** · `rowPeriodDatetime` (the start of the day) · `rowCoefficient` ·
`qtyTaskLine` · `sumForBudget` · `sumForContract` (2 digits) · `orderInList` (line position × 100000 + day) · `rowJSON { budgetItemTaskLine, taskManagementGenusLine }`.
The app only reads the table; ONE call of the procedure = ONE transaction: lock the task, check the owner, validate, delete the earlier rows of the task, insert `round(total × c, 2)` per day,
**Correct033**, verify, set `taskIsPosted`. Any error rolls everything back.

**Correct033** ("0333 Effect"): every row is rounded on its own, so 100.00 on 3 equal days = 33.33 + 33.33 + 33.33 = 99.99. The difference (original − distributed = +0.01) is added to the LAST row of the distribution
(the last day with a non-zero coefficient): 33.33 + 33.33 + 33.34. The same for the coefficients against `baseOfDistribution`. A difference above `n × 0.005` is a bug and raises.
(100.00 on 7 days: 14.29 × 6 + **14.26**.)

## The Plan view

`PMTaskLinePlanView.tsx` = the **Plan** button after Finances on the Gantt bar (`ganttVsNetworkView = 'showPlanView'`) → the bar + `PMProjectTaskPlanCRUD.tsx` for the selected task.
`PMProjectTaskPlanCRUD.tsx` = ONE table with the days of all the lines of the task (`ReusableTable` on `taskLinePlanReusable`, all-rows mode on the parent), **no CRUD** (no panel, no menu, no check boxes, no reorder, no edit),
columns `# · Budget item · Genus · Line · Period · Coefficient · Qty · Sum for budget · Sum for contract` (the amounts are the root columns, so the footer adds them up); above it one line per posted line with its
days and sums against the line (✓ when equal). Route `/pm/project/task/plan?taskGUID=…` (`app/pm/project/task/plan`).

| File | What |
|---|---|
| `taskLinePlanModel.ts` | table / entity names, row types, `taskPostState`, `postableLines`, `defaultBudgetItemOfGenus`, `summarizeTaskLinePlan` |
| `taskLinePlanMetaData.ts` | SystemMetaData entry (spread into `kit8/redux/SystemMetaData.ts`) |
| `calculateTaskLinePlan.ts` | the calculation, `normalizedCoefficients`, `distributeCorrect033` |
| `taskLinePlanApi.ts` | the RPC call |
| `useTaskPost.ts` | Post of one task (reads the calendar, calculates, calls the RPC, tells the user) |
| `planColumns.tsx` · `PMProjectTaskPlanCRUD.tsx` · `PMTaskLinePlanView.tsx` | the Plan view |

Tests: `__tests__/pm/view/task/plan` (calculation, Correct033, Post state, Plan view, SQL text), `__tests__/ui/table/reusableTablePost.test.tsx` (the button), `taskFinancesUi.test.tsx` (the column, Post).
