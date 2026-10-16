# Subprojects - `kit8/pm/subproject`

A task of a project (the **origin task**) can stand for **another project** (the **subproject**). The subproject is an ordinary project: nothing new is stored for its content, so the Gantt, Finances, Fact input, vendor documents and Monitor01 work in it as always. Everything is OFF by default, so no existing project changes.
Source: the Google Doc "W1 SUBPROJECTS". Requirements (BRD + TRD): `documentation/SUBPROJECTS_BRD_TRD.html`. SQL: **PART 29** of `kit8/sql/start/start1_sql_tables.sql` + `start2_sql_code.sql` (dropped by PART 1a-0 of `delete_sql_structure.sql`). Docker test: `kit8/docker/tests/90_subprojects.sql`.

## The settings (Project settings → **Subprojects**, `PMProjectSubprojectsTab`) - keys of `project_table.rowJSON`
| Key | Default | Meaning |
|---|---|---|
| `subprojectsFunctionalityEnabled` | **false** | the master switch; everything below is shown / used only while it is on |
| `autoChangeOriginTaskBasedOnSubprojects` | true | the origin task follows its subproject; the four switches below are shown / used only while it is on |
| `autoChangeStartAndFinishDatesForOriginTask` | true | the origin task takes the start and the finish of the subproject |
| `aggregateTimeFromSubprojectToTheOriginTask` | false | Monitor01 shows the **Time** plan / fact of the subproject on the origin task too |
| `aggregateMaterialFromSubprojectToTheOriginTask` | false | ... **Material** |
| `aggregateExpenceFromSubprojectToTheOriginTask` | false | ... **Expenses** (the spelling of the key is the owner's) |

A missing key reads as its default (`subprojectValuesOf`, `subprojectEffectiveOf` here; `subproject_enabled`, `subproject_setting` in SQL - the two must agree, `__tests__/pm/subproject/subprojectSql.test.ts` checks the defaults).
The master switch cannot be switched off while a task of the project uses a subproject (`SUBPROJECT_IN_USE`).

## The task (`PMTaskEditModal` + `PMTaskSubprojectField`) - keys of `project_task_table.rowJSON`
`taskIsSubproject` (the flag; only a **task** - not a stage or milestone - of a project with the functionality on) and `taskSubprojectGUID` (the project, from the picker = RPC `subproject_candidates`: projects of the same organization the user can see, not the project itself, none that would close a cycle). A flag set to false clears the subproject. One project may be the subproject of many tasks, also of the same project.
The database keeps the table `project_subproject_link` (one row per origin task) by the trigger of `project_task_table`; the app only reads it.

## No recursion
`subproject_creates_cycle(origin, sub)` refuses the save (`SUBPROJECT_CYCLE: A -> B -> A`, shown by `subprojectErrorText`); the picker does not offer such a project; `create_task_line_plan` calls `subproject_assert_no_cycle` and refuses to Post a project that is part of a cycle (a cycle that got in through an import or a restore). A project that is a subproject cannot be deleted (`SUBPROJECT_IN_USE`, the message names the tasks).

## The dates
The schedule is computed on the client (CPM) and written back by `pm_apply_schedule`; at its end `subproject_propagate_dates(project)` copies the dates to every origin task of the links that point at that project, and then (when a task changed) to the next level up - **immediately, in the same transaction**, so a chain B → A → D is consistent at once.
The subproject's dates: **start = the earliest `startAt`, finish = the latest `rowDuration` of its tasks and milestones** (stages are summaries); nothing is copied while it has no schedule. The origin task gets `manualStartAt` + `durationDays` (what the client CPM reads; the days are counted in the calendar of the ORIGIN project, at least 1) and `startAt` + `rowDuration` (so SQL has the dates at once). Only a changed value is written (no loop, no needless unpost of the posted lines). Switching a dependent switch on resynchronises at once. The task window keeps the dates of a following task unchanged on Save.
A predecessor link can still push the origin task later than the subproject start (a "no earlier than" constraint of the CPM); `project_subproject_link.linkStartAt / linkFinishAt` keep what the subproject had.

## In the tree and on the Gantt chart (marks of an origin task)
`useProjectSubprojectMarks` (called once in `PMProjectDashboard`) reads `project_subproject_link` of the open project + the names of the subprojects (only when a task of the project is a subproject; Realtime on the link table) and fills `store_subproject.ts`; `subprojectMarks.ts` is the pure part.
* **Tree**: a narrow column `PM_TREE_SUBPROJECT_WIDTH` (24 px) BEFORE the posted column, only while the project has such a task (no origin task = no column, nothing changes): the icon `account_tree` (`PMTreeSubprojectIcon`), a dark orange `warning` sign while the dates differ; the tip says "Subproject: B (2026-11-02 - 2026-11-09)". The task name in the grid reads `Task 111  [Project B]`, with ` !` after it on a conflict.
* **Gantt**: the same label after the task name; the bar gets a dark orange outline on a conflict (a selected bar keeps its selection outline).
* **Date conflict** = the project makes the task follow the dates (`autoChange…` + dates switch on), the subproject is scheduled, and the CLIENT schedule of the task (a predecessor can push it later; the project start can clamp it) gives another start day or finish day than the subproject (`subprojectDatesConflict`, day = UTC day).

## Monitor01
* **Aggregation**: with `aggregateTime... / Material... / Expence...` on, the row of the origin task in `monitor01_view` also holds the numbers of the subproject for that genus (`subproject_agg_sources` finds the tasks - through several levels, each level by its own switches; `monitor01_fresh_rows` sums them from the REGISTER, so nothing is counted twice). When a task of the subproject changes, `monitor01_apply` queues the origin tasks (`subproject_queue_origins`; one level per worker run). The drill-down of such a row (`monitor01_sum_sources`, `subproject_drill_match`) shows the movements of the subproject. The tree column "Cost" (PART 27) is NOT aggregated.
* **Radio Projects | Subprojects | All** (`Monitor01ProjectKindRadio`, `RadioSetApp`): shown only in the full data set (standalone) and only when a project of the organization has the functionality on (`organization_has_subprojects_enabled`). **Projects** (default) = projects that are not the subproject of any task; **Subprojects** = projects that are; **All** = both (`filterMonitor01RowsByProjectKind`). The default view therefore shows each plan once: the origin task with its aggregate, not the subproject again. Radio hidden = no row is cut.

## Files
`subprojectModel.ts` (keys, defaults, errors) · `subprojectMarks.ts` (label, tip, date conflict) · `store_subproject.ts` · `useProjectSubprojectMarks.ts` · tree icon `view/tree/columns/PMTreeSubprojectIcon.tsx` · `subprojectApi.ts` (RPC / table reads) · `useSubprojectCandidates.ts` · `useMonitor01SubprojectKind.ts` · `index.ts`; the tab `kit8/pm/view/project/settings/PMProjectSubprojectsTab.tsx`; the task field `kit8/pm/view/task/PMTaskSubprojectField.tsx`; Monitor01 `Monitor01ProjectKindRadio.tsx`, `monitor01Model.ts` (`filterMonitor01RowsByProjectKind`).

## Tests
`__tests__/pm/subproject/*` (model, SQL files, settings tab, task field, radio) · Docker: `kit8/docker/test_fact_monitor01.sh 90` (80 checks: defaults, flag rules, cycles, Post refusal, dates through two levels, switches, guards, aggregation, drill-down, Refresh now, rebuild).

## Not built (decided / open)
Server-side CPM for a project nobody opens (the chain completes as each level's schedule is written); CRM processes as subprojects (an ordinary project works as one); aggregation into the tree "Cost" column; the aggregate in the Finances tabs of the origin task (only Monitor01 shows it); templates and versions copy the two task keys as they are; the conflict is shown, not resolved (no button "move the predecessor").
