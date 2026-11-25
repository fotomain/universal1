# Project estimation (Project settings -> Estimation)

BUILT 2026-11-24. Design document: `documentation/ESTIMATION/PROJECT_ESTIMATION.html`.

A project (**project1**) can name another, ordinary project (**project2**) as its **estimation**:
`project_table.rowJSON.projectEstimationGUID`. The tab **Estimation** of the Project settings window (right after ROI) shows what the task
lines of project2 add up to per budget item and copies project2 into project1.

| Piece | File | What it does |
|---|---|---|
| `ProjectEstimationGUIDInput` | `ProjectEstimationGUIDInput.tsx` | the project select field: search by name, list in the flow under the field, Clear, Open (new window). **Always enabled** (no switch behind it); only a read-only project locks it. Never offers the project itself. |
| `ProjectEstimationTable` | `ProjectEstimationTable.tsx` | a read only `ReusableTable` in **local rows** mode: one row per budget item (Kind, Lines, Estimate net in the budget currency of project2, VAT; with a saved project: Project now, Estimate - now; with other budget currencies: the estimate converted at today's rate). Under it cost, revenue, profit, ROI1. Warnings: lines with no budget sum / no budget item. |
| `FillProjectFromEstimationButton` + `FillProjectFromEstimationWindow` | `FillProjectFromEstimationButton.tsx`, `FillProjectFromEstimationWindow.tsx` | the button (disabled with the reason written under it) and its window: what is copied, **the question Append or Replace** (asked, never preselected, only while project1 has rows of its own), progress bar + steps, Cancel fill, **the question "Recalculate the task lines now? Yes / No"** after a fill between projects with different currencies. |
| tab | `PMProjectEstimationTab.tsx` | composes the three; wired in `PMRecentProjectsToolbar.tsx` (`TabEstimation`, draft key, saved with the rest of rowJSON). NOT in Organization edit -> Projects -> Settings: the link belongs to ONE project. |
| rules | `estimationModel.ts` (pure) | the link (`estimationLinkOf`), the summary, the rows / totals, why Fill is disabled (`fillBlockReason`), the two modes, `planEstimationFill`. |
| calls | `estimationApi.ts`, `useProjectEstimation.ts` | `project_estimation_summary`, `project_delete_task_roots`, `fx_convert` (the rate); React Query hooks. |
| the fill | `fillProjectFromEstimation.ts` | the sequence below (plain async function, fake-API tested). |

## What Fill copies

Stages / tasks / milestones, the links between them and the task lines (Time / Material / Expense / Revenue) of project2, with new ids, the lines **UNPOSTED**
(`planProjectImport`, the planner of Copy with Tasks). NOT copied: the project settings of project2 (project1 keeps its currencies, calendar, scenarios ...), postings, documents,
subproject marks, chat, files, BIM. Custom column *values* travel with the tasks and show only if project1 has a column with the same id.
When the budget or accounting currency of the two projects differ, the sums of the copied lines that are in the currencies of project2
(`sumForBudget`, `sumVATForBudget`, `sumForAccounting`, `sumVATForAccounting`, `fxSnapshotTaskLine`) are removed; after the copy the user is asked
"Recalculate the task lines now?": **Yes** = `recalculateSingleProject` (the Recalculate of the currency change of a project: every line again with the rates of its day), **No** = the lines stay without sums until the user presses Recalculate.

## Order of the writes (nothing of project1 is lost)

1. read project2, plan with new ids (nothing written);
2. write the new rows: tasks (`project_import_tasks`, 500 a chunk), links (250), lines (250); the new top-level rows go **behind** the ones project1 has. A failure or a cancel: the new top-level rows are deleted (`project_delete_task_roots`), project1 is as before;
3. Replace only: the OLD top-level rows are deleted (`project_delete_task_roots`). A failure here leaves old + new rows and says so (`EstimationFillPartialError`);
4. the note `projectEstimationLastFill` = `{ at, sourceGUID, mode, tasks, lines }` is written on project1 (the fresh row is read first: `updateProject` replaces rowJSON).

**Replace** is offered only while no task of project1 is posted and it has no document (`postedTasks = 0`, `documents = 0` of the summary). The user is asked Append or Replace only when project1 has tasks.

## Rules

- The link key is never an organization default, is not taken from a file (`planProjectImport` strips it), is not in a project template (`templateApi`), and a copy of a project keeps the link but not the note of the last fill (`planProjectCopy`).
- Fill needs: project1 saved, its draft equal to the saved row (else "save the settings first"), not read-only, the right to create tasks (`perm_can_in('project_task_table', 'C', project1)` = `canCreate` of the summary), an estimation with tasks.
- A read-only project cannot change the key (PART 51 guard runs first); the tab shows the input locked.
- The list of the input is the one of the project bar (`useProjectSearchQuery`: the projects the user OWNS in the active organization).
- Project2 deleted / not readable: the key stays, the tab says "not found", Clear removes it.

## The Estimation view (2026-11-24)

The dashboard's view switch has the button **Estimation** (`showEstimationView`, icon `calculate`) right BEFORE Reports (also in an order the user saved before: `viewButtonsOrderOf`). It opens the right pane
`PMProjectEstimationView` (task tree stays on the left): the SAME `ProjectEstimationTable` as the settings tab, read through `useEstimationSummary(project, projectEstimationGUID)`; no link = a hint to pick it in
Project settings -> Estimation. Read only, writes nothing (the link and Fill stay in Project settings). Test `__tests__/pm/view/project/estimation/estimationView.test.tsx`.

## SQL (PART 57, `start2_sql_code.sql` only, no table)

`project_estimation_project(project)`, `project_estimation_summary(target, source)` (both SECURITY INVOKER: the policies decide), `project_delete_task_roots(project, roots[])`
(bulk delete of top-level rows with their subtrees, `app.task_bulk = on`), trigger `trg_project_estimation_guard` (a changed key must be another project of the same organization the writer can read; clearing is free).
`delete_sql_structure.sql` part `1a-000000000000000000000000`. Docker test `kit8/docker/tests/107_project_estimation.sql` (63 checks).

## Tests

`__tests__/pm/view/project/estimation/` (`estimationModel`, `fillProjectFromEstimation`, `fillWindow`, `estimationTab`, `estimationTable`, `estimationExclusions`), `__tests__/sql/projectEstimationSql.test.ts`,
the tab order / save in `__tests__/pm/ui/projectSettingsTopTabs.test.tsx`.

## Not built

A button that creates project2 for the user; a mark "this project is an estimation"; estimate vs plan vs fact over time; shifting the dates of the copied tasks to the start of project1 (they keep the dates of project2, as in Copy with Tasks);
the picker lists only the projects the user owns; Fill of selected stages only. Not seen in a browser or on a phone; the SQL and the chunked write were run on a local Postgres only, not on the owner's Supabase.
