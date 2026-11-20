# Project copy (menu of a project card)

Screen `/catalog/project` (`ProjectList` + `ProjectCard`). Every card has a menu:

- **right click** on the card (web), **long press** (phone), the **three dots** at the right corner of the card;
- items: **Copy** · **Copy with Tasks** · **Copy with BIM** (only on a BIM project: `rowJSON.projectIsBIMBased`) · **Delete** (the same delete as the red trash button).

## What a copy is

| | Copy | Copy with Tasks | Copy with BIM |
|---|---|---|---|
| project row | new `rowGUID` + `treePath`, settings of the source, name `X (copy)` / `X (copy 2)` ... | the same | the same |
| tasks / stages / milestones | no | yes, every one with a NEW id, tree paths rebuilt | yes |
| links between tasks | no | yes (on the new ids) | yes |
| task lines (Time / Material / Expense / Revenue) | no | yes, new ids, **UNPOSTED** (press "Post unposted tasks") | yes, unposted |
| BIM model (storeys, chunk rows, elements, IFC properties, the chunk files) | no | no | yes: the elements point at the NEW tasks, the stages of the storeys are the NEW stages, the chunk files are copied in Storage into the folder of the copy (the copy owns its files: deleting the source never breaks it), the copy is BIM based and ready |

The copy appears in the list right behind its source (`copyOrderAfter`); it is not selected or opened.

Not copied (on purpose): the read-only switch (a new project is never read-only), the posting / plan registers, documents
(fact input, invoices, orders, payments, time sheets), the per-user Gantt settings, the subproject marks of the tasks
(`taskIsSubproject`, `taskSubprojectGUID`: the link rows belong to the source). `rowParentGUID` (the organization) is set by the database.

## Code

- `projectCopy.ts` - pure planning (`copyProjectName`, `copyOrderAfter`, `planProjectCopy`) + `copyProject(api, source, owner, opts)`.
  Copy with Tasks reuses `planProjectImport` of the file import (`kit8/pm/crud/exchange/project`) and its chunk sizes
  (500 tasks, 250 links, 250 lines). Everything is read and planned BEFORE the project row is made; if a write fails afterwards the
  half-made copy is deleted again.
- `useCopyProject.ts` - hook: one copy at a time, refreshes the project list, snackbar on success, `ErrorModalWindow` on failure.
- `ProjectCardActionsContext.tsx` - `ProjectList` provides `onCopy` / `onCopyWithTasks`, `ProjectCard` reads them (the web list builds
  its cards itself, so extra props cannot be passed).
- the menu is `PMContextMenu` (`kit8/pm/inner/menu`); the task lines are read by `readProjectTaskLines` (`kit8/pm/crud/api/taskApi.ts`, paged).

**Copy with BIM** (2026-11-20): `kit8/pm/bim/copy/copyBimModel.ts` runs after the tasks - `bim_copy_begin(source, target, idMap)` (SQL PART 55: copies the rows inside the database, answers the files, leaves the model `importing`), Storage copy of each chunk file (4 at a time), `bim_import_commit`. A failure calls `bim_import_fail` (files queued for removal) and the half-made project is deleted. A source without a ready model copies like Copy with Tasks. Rights: read of the BIM model in the source, create in the target. SQL: `bim_copy_begin` is in `start2_sql_code.sql` PART 55 (no new table); Docker `kit8/docker/test_bim_copy.sh` (44 checks with the real Duplex). The Storage copy itself is not run against a real Supabase yet.

Tests: `__tests__/catalog/project/projectCopy.test.ts`, `projectCard.test.tsx`, `__tests__/bim/copyBimModel.test.ts`.
Not built: copy of the documents / posted plan, copy into another organization, a name prompt before the copy.
