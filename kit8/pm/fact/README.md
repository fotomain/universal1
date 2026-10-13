# Fact input - `kit8/pm/fact`

Source: the Google Doc "W1 FACT INPUT"; plan and decisions: `documentation/FACT_INPUT.html`. SQL: **PART 24** of `kit8/sql/start/start_sql_structure.sql` (mirrored in `start_sql_code.sql`, dropped by PART 1a of `delete_sql_structure.sql`).

The user records what really happened on a task in a **document**. Right button on a line of the Finances table (or on a task of the tree) → **Facts input** → `PMFactInputDocument` opens on the tab of that line.

| Table | What |
|---|---|
| `task_fact_header` | the document: `rowJSON.documentHeader` { `projectTaskGUID` (read only) · `activeUser` · `created_at` · `documentNumber` · `documentStatus` draft/posted · `strongInput` · `postedAt` · `postedBy` · `unpostedAt` }. Written only by the RPCs |
| `task_fact_timeline` | its lines: the fields of `task_line_plan_timeline` + `rowHeaderGUID` · `genusGUID` · **`qtyForContract`** · `periodDay` · `rowJSON` (role, resource, unit, price ... copied from the task line). `rowPeriodDatetime` is editable in every line |
| `task_line_fact_for_monitor01` | the sums of the POSTED documents per task × genus × role × unit × month, made by the Monitor01 worker (pg_cron) - read only |

## Rules (SQL: triggers + RLS; the TypeScript twins are in `factInputModel.ts`)
* `task_fact_document_create(task)`: **all the lines of `task_line_table` of the task go to the new document**. `qtyForContract` starts as the quantity of the task line.
* Project setting **`factStrongInputByTaskLine`** (Project settings → Budgets → Main; false by default), copied into the header when the document is made:
  * **true** (strong): the lines keep their `taskLineGUID`; users **cannot add lines, only delete and update** (the date and `qtyForContract`; the genus / description / task line are frozen).
  * **false** (free): the lines are **disconnected from the task line GUIDs** (`taskLineGUID` NULL); users add lines freely ("+ Add line": role, unit, date, qty, price).
* Users change **only** `rowPeriodDatetime` and `qtyForContract`; `qtyForBudget` is frozen and `sumForContract` / `sumForBudget` are computed (qty × price).
* **Post** (`post_task_fact_document`): the whole document is checked (it has lines; no date after tomorrow; strong: every line still has its task line); the answer is data `{ status, lines, problems[] }`, never an exception. Posted = read only (RLS).
  **Unpost** takes it back to a draft. Only posted documents count in `task_line_fact_for_monitor01`.
* Not a unique (line, day): several facts of a day are allowed.

## Files
| File | What |
|---|---|
| `factInputModel.ts` | pure: types, the setting, states (`Post` / `Posted` / `Post needed`), what the user may do, the sums (twin of the trigger), totals per unit, day / quantity parsing, the answers of Post |
| `factInputApi.ts` | the calls (Supabase client passed in) |
| `useFactInputDocument.ts` | React Query: documents of a task, the selected one (latest draft), its lines, the commands; a task without a document gets one on the first open |
| `useOpenFactInput.ts` | **open the document from anywhere a task GUID or task line GUID is known** |
| `PMFactInputDocument.tsx` | the screen: header, DocumentTabs (Time · Material · Expenses · Revenues), Post / Unpost, the problems of a refused Post |
| `FactLinesTable.tsx` | the lines of one tab |

Route: `app/pm/project/task/fact?taskGUID=…&taskLineGUID=…&genus=…&documentGUID=…`.

## Tests
* SQL on a real Postgres 15: `cd kit8/docker && docker compose up -d && ./test_sql.sh && ./test_fact_monitor01.sh 50` (54 checks: free / strong, posted = frozen, Post problems, Unpost, policies).
* Jest: `__tests__/pm/fact` (model, table, screen, data hook, entry points, the setting) and `monitor01Sql.test.ts` (the SQL files carry the same parts).
