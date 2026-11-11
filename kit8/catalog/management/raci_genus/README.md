# RACI genus

`managementRACIGenusTable` - the four RACI items of PMBOK, ONE level (a linear catalog, no folders). **Read only**, seeded, **no screen and no menu item**.

| rowGUID | title | meaning |
|---|---|---|
| `raciResponsibleGUID` | Responsible | does the work |
| `raciAccountableGUID` | Accountable | owns the result, signs it off |
| `raciConsultedGUID` | Consulted | asked before, two-way |
| `raciInformedGUID` | Informed | told after, one-way |

rowOwnerGUID `managementRACIGenusCatalog` · rowParentGUID `'empty'` · `orderInList` 1000 … 4000 · rowJSON `{ title, description }`.
SQL: PART 44 of `kit8/sql/start` (start1 table, start2 setup + trigger + backfill, start4 / start5 the four rows, delete file). Design: `documentation/PERMISSIONS_WBS.html`, section 3.

## The RACI item of a Time line

* `task_line_table.rowJSON.raciItem` holds one of the four **rowGUIDs** (not a title, not a code). Reports of later rounds join on it.
* Only a **Time line** (`rowParentGUID = 'timeGenus'`, whatever resource it books) has one. The database trigger `trg_task_line_raci`: a missing / empty / JSON-null item becomes
  `raciResponsibleGUID`; a value that is no row of the catalog is refused (`23514`); a line of another genus is not touched.
* **Old lines**: `start2_sql_code.sql` PART 44 sets `raciResponsibleGUID` on every Time line that has none (user triggers off, `updated_at` stays, no "posted and changed" mark; idempotent).
* **The column "RACI"** of the Time tab (`kit8/pm/view/task/finances/taskLineColumns.tsx`): a select of the four titles (translated with `pmT`), a new row starts as **Responsible**
  (`PMProjectTaskInputCRUD` `newRowDefaults`), the cell cannot be emptied.
* PMBOK says one Accountable per task: `raciWarning(lines)` returns a text when there are two (a warning only, never blocks).
* The RACI item does **not** change the plan calculation. It is the source of the task permissions of the next rounds (Responsible -> `permissionTaskResponsible`).

## Code

* `raciGenusModel.ts` - table def, the four GUID constants, `RACI_DEFAULT_GUID`, `raciOptions(rows, pmT)`, `raciItemOf`, `raciWarning`.
* `raciGenusMetaData.ts` - the `SystemMetaData` entry. The Time tab reads the catalog with the other task-line catalogs (`useTaskLineCatalogs`, list `raciGenus`).
* Tests: `__tests__/catalog/management/raciGenus.test.ts`, `kit8/docker/tests/47_raci.sql`.
