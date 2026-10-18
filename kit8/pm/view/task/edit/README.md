# Task window (`/pm/project/task/edit`)

Source: the user's request of 2026-10-18 ("on Gantt - on double click on the task - a new browser window with PMTaskEditView mode must be opened; 1st level tabs TabTaskEditMain, TabTaskEditPlan").

A **double click on a task of the Gantt chart** (`PMProjectGanttChart.onDoubleTap`) opens the task in a NEW browser window (web; a blocked pop-up uses this window) or in this app (iOS / Android): `openTaskEditWindow` → `/pm/project/task/edit?taskGUID=…&projectGUID=…&tab=…` (`app/pm/project/task/edit/index.tsx`, hidden Drawer screen).

| 1st level tab | Content |
|---|---|
| `TabTaskEditMain` (default) | the task form of `PMTaskEditModal`, embedded (`<PMTaskEditModal embedded guid closeOnSave={false} onClose />`): its own 2nd level tabs Main · UX/UI, Delete · Details · Cancel · Save. Save keeps the window open; Cancel / X close the window (`window.close()`, else the dashboard); Delete / Details do not close it first |
| `TabTaskEditPlan` | `PMTaskEditView` (`view/task/finances`): the lines of the task (Time · Material · Expense · Revenue), the title can be typed over; the task is the selected one of the store |
| `TabTaskEditFact` | 2nd level tabs (`TabTaskEditFact.tsx`): `TabFactInput` = the fact input documents of the task (`PMFactInputDocumentList` with `taskGUID`), `TabProductReceipt` = its product receipts (`PMProductReceiptDocumentList`), `TabVendorInvoice` = its vendor invoices (`VendorInvoiceDocumentList`); each list is built on the first visit of its tab. Fact input: (the scope chip of the list can show all documents); created on the first visit, then kept; a click on a row opens the document form in this window |

Both tabs stay mounted (an unsaved form survives a visit of the other tab). `PMTaskEditWindow` finds the project of the task like the task page (`useReadTaskQuery`, `selectProject`, `useReadProjectDataQuery`, Realtime).

## The other windows of a task
* `PMTaskEditModal` - the full form as a Modal, opened by the edit buttons, a double click on the tree / network / Kanban card (`crud.edit`).
* `PMTaskEditOptions` - the context menu item **Options** (right before Delete): title "Edit options", the UX/UI of the task ONLY (bar color `rowJSON.taskColor`). `crud.editOptions` → `store.editingOptionsGUID`; mounted next to the modal in `PMProjectDashboard` and `PMProjectTaskInfo`.

Tests: `__tests__/pm/ui/taskEditWindow.test.tsx` (link + window), `taskEditOptions.test.tsx`, `taskRelatedMenu.test.tsx` (Options before Delete). No SQL.
