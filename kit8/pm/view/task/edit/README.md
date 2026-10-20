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

## Dates and the tips of the Fact tabs (2026-10-20)
* **Start date – Finish date · Select period** stand RIGHT of the task name in the toolbar of the Plan tab (`PMTaskEditView`, also the Finances view of the Gantt surface): `TaskDatesBar`. The dates are the ones of the schedule, shown as TEXT in the project's date format (no input boxes). A press / touch on a date or on the icon opens **Select period** (`SelectPeriodModal` of Monitor01) and the input of the pressed date is active there (`focusField`; the icon activates none). In the window the two dates are inputs with a calendar picker (typed / shown in the project format, fields wide enough for the whole date) and the month grid; **Select** writes `manualStartAt` ("start no earlier than") + `durationDays` (working days) as the task form does. **Replan**: when the dates of a task that is posted (or was posted and changed since) are changed, that task is posted again (`useProjectPostActions.postTask`) `REPLAN_DELAY_MS` after the schedule shows the new days; a task that was never posted is not posted by this; the same dates again write nothing. Read only (a press does nothing; the tip says why) for a stage / a task with children, a task that follows its subproject and while hours / minutes / seconds are on; a milestone has one date. Pure part: `taskDatesModel.ts`. Tests: `__tests__/pm/view/taskDatesModel.test.ts`, `__tests__/pm/ui/taskDatesBar.test.tsx`, `__tests__/pm/reports/monitor01/selectPeriod.test.tsx`.
* The 2nd level tabs of the **Fact** tab (Fact input · Product receipt · Vendor invoice · Customer invoice) have a **tip with the number of documents of the task** ("Vendor invoice - 3 documents", "No documents"): `useTaskDocumentCounts` asks the list RPC of each kind with `p_limit: 1` (`totalCount`) when the tab opens and after each change of tab. Test: `__tests__/pm/ui/taskEditFactTabTips.test.tsx`.
