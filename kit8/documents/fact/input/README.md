# Fact input - `kit8/documents/fact/input`

Source: the Google Doc "W1 FACT INPUT"; plan and decisions: `documentation/FACT_INPUT.html`. SQL: **PART 24** of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (mirrored in `start2_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

The user records what really happened on a task in a **document**. Right button on a line of the Finances table (or on a task of the tree) → **Facts input** → `PMFactInputDocumentForm` opens on the tab of that line. All the documents are in the **list** `PMFactInputDocumentList` (hamburger menu → Budgets → … → divider → **Actuals**, route `app/pm/fact/list`).

| Table | What |
|---|---|
| `task_fact_header` | the document: `rowJSON.documentHeader` { `projectTaskGUID` (read only) · `activeUser` · `created_at` · `documentNumber` · `documentStatus` draft/posted · `strongInput` · `postedAt` · `postedBy` · `unpostedAt` }. Written only by the RPCs |
| `task_fact_usage_timeline` | its lines: the fields of `task_line_plan_timeline` (**`sumForBudget` · `sumForContract` · `sumForAccounting`**, each computed from the quantity) + `rowHeaderGUID` · `genusGUID` · **`qtyForContract`** · `periodDay` · `rowJSON` (role, resource, unit, price ... copied from the task line). `rowPeriodDatetime` is editable in every line |
| `project_status_movements` | the **register**: a posted document writes its lines as `used` movements (post / unpost: the same transaction); `qtyProjectStatus` is the quantity |
| `project_status_month_turnover` | (was `task_line_fact_for_monitor01`) the register summed per task × genus × role × unit × month, made by the Monitor01 worker (pg_cron) - read only |

## Rules (SQL: triggers + RLS; the TypeScript twins are in `factInputModel.ts`)
* `task_fact_document_create(task)`: **all the lines of `task_line_table` of the task go to the new document**. `qtyForContract` starts as the quantity of the task line.
* Project setting **`factStrongInputByTaskLine`** (Project settings → Budgets → Main; false by default), copied into the header when the document is made:
  * **true** (strong): the lines keep their `taskLineGUID`; users **cannot add lines, only delete and update** (the date and `qtyForContract`; the genus / description / task line are frozen).
  * **false** (free): the lines are **disconnected from the task line GUIDs** (`taskLineGUID` NULL); users add lines freely ("+ Add line": role, unit, date, qty, price).
* Users change **only** `rowPeriodDatetime` and `qtyForContract`; `qtyForBudget` is frozen and `sumForContract` / `sumForBudget` / `sumForAccounting` are computed (qty × price, qty × unit budget sum, qty × unit accounting sum - `unitSumForBudget` / `unitSumForAccounting` are copied from the task line).
* **Post** (`post_task_fact_document`): the whole document is checked (it has lines; no date after tomorrow; strong: every line still has its task line); the answer is data `{ status, lines, problems[] }`, never an exception. Posted = read only (RLS).
  **Unpost** takes it back to a draft. Only posted documents are in the register (`project_status_movements`) and so in `project_status_month_turnover`.
* Not a unique (line, day): several facts of a day are allowed.

## Files
| File | What |
|---|---|
| `factInputModel.ts` | pure: types, the setting, states (`Post` / `Posted` / `Post needed`), what the user may do, the sums (twin of the trigger), totals per unit, day / quantity parsing, the answers of Post, the filter of the list (`factListFilterToRpc`), the keys of a new row |
| `factInputApi.ts` | the calls (Supabase client passed in): `task_fact_document_list`, create, post, unpost, delete the draft, the task info |
| `factMetaData.ts` | the redux entities `taskFactUsageTimeline` (the lines) and `taskFactHeader` (the documents: read / realtime / delete only) (realtime, optimistic, the root columns `qtyForContract` / `rowPeriodDatetime` are saved by `updateOne`) - the lines are read and written by `ReusableTable`, not by the hook |
| `factColumns.tsx` | the columns of the table of the lines (`ReusableTable` def-table) per mode: free draft · strong draft · posted (read only); role / resource by genus |
| `useFactInputDocument.ts` | React Query: the documents of a task (the list RPC with `taskGUID`, newest first), the selected one (latest draft), the commands (new, post, unpost, delete); a task without a document gets one on the first open |
| `useFactDocumentList.ts` | the rows + totals of the list for the fast filters; `useFactProjects` |
| `useOpenFactInput.ts` | **open the document from anywhere a task GUID or task line GUID is known** |
| `PMFactInputDocumentForm.tsx` | the form: the bar (New · Delete · Close · Unpost/Posted · **Post is the LAST button**), the inputs (`TextInputApp`, `DateInputApp`), DocumentTabs (Time · Material · Expenses · Revenues) and the `ReusableTable` of the lines (`addEnabled` false for a strong or posted document, the panel / menu / selection off for a posted one) |
| `PMFactInputDocumentList.tsx` | the Actuals list = a **`ReusableTable` with CRUD** (redux entity `taskFactHeader`, realtime): Document · Status · Input · Task · Project · Period · Lines · **sumForBudget · sumForContract · sumForAccounting** (the totals of the document) · Author · Created, the footer adds up the listed documents. **Create** = the `PMFactNewDocumentModal` (project, task → `task_fact_document_create`, the form opens) · **Open** = a click on a row / the row menu · **Delete** = the selected drafts (a posted one is refused by RLS). Fast filters in ONE row, each with a Clear icon inside its field: **factTimelinePeriod · factProjectFilter · factBusinessUnitFilter · factRoleFilter · factResourceFilter · authorFilter** (applied by the RPC; the table shows exactly the documents it lists) |
| `factListColumns.tsx` · `PMFactNewDocumentModal.tsx` · `useFactTasks.ts` | the columns of that table (cells read from the list rows by GUID) · the New-document window · the leaf tasks of a project |

Routes: the form `app/pm/project/task/fact?taskGUID=…&taskLineGUID=…&genus=…&documentGUID=…`, the list `app/pm/fact/list`.

## Tests
* SQL on a real Postgres 15: `cd kit8/docker && docker compose up -d && ./test_sql.sh && ./test_fact_monitor01.sh 50` (free / strong, posted = frozen, Post problems, Unpost, policies, sumForAccounting), `51` (the list RPC and its filters), `52` (sumForAccounting in the plan algorithms).
* Jest: `__tests__/documents/fact/input` (model, columns, form, list, both data hooks, entry points, the setting) and `monitor01Sql.test.ts` (the SQL files carry the same parts).
