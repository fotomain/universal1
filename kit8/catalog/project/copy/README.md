# Project copy (menu of a project card)

Screen `/catalog/project` (`ProjectList` + `ProjectCard`). Every card has a menu:

- **right click** on the card (web), **long press** (phone), the **three dots** at the right corner of the card;
- items: **Copy** · **Copy with Tasks** · **Delete** (the same delete as the red trash button).

## What a copy is

| | Copy | Copy with Tasks |
|---|---|---|
| project row | new `rowGUID` + `treePath`, settings of the source, name `X (copy)` / `X (copy 2)` ... | the same |
| tasks / stages / milestones | no | yes, every one with a NEW id, tree paths rebuilt |
| links between tasks | no | yes (on the new ids) |
| task lines (Time / Material / Expense / Revenue) | no | yes, new ids, **UNPOSTED** (press "Post unposted tasks") |

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

No SQL. Tests: `__tests__/catalog/project/projectCopy.test.ts`, `projectCard.test.tsx`.
Not built: copy of the documents / posted plan, copy into another organization, a name prompt before the copy.
