# Task scope of the document lists + the Task submenus "Create based on this" / "Go to"

Two submenus stand **before Delete** (and "Go to" right after "Create based on this") in the **Task context menu** (`kit8/pm/view/task/PMTaskRowMenu.tsx`) and in the **line context menu** of the Task Edit (Finances) table (`extraMenuItems` of `PMProjectTaskFinancesCRUD.tsx`). Both are built by one hook, `kit8/pm/view/task/useTaskRelatedMenu.ts`. A stage has none (no lines, no documents). The flat items "Facts input", "Vendor Invoice", "Purchase Order" stay.

| Submenu | Item | What it does |
|---|---|---|
| **Create based on this** | Fact input | `useOpenFactInput(params, { newWindow: true })` - the fact document of the task (line menu: on the tab of that line) in a **new browser window** on the web (blocked / iOS / Android: this app) |
| | Vendor Invoice | task menu: `useStartVendorInvoice` (creates at once); line menu: asks "this line / all lines" first (`VendorInvoiceScopeModal`); not on a Revenue line |
| | Purchase Order | the twin of Vendor Invoice: task menu: `useStartPurchaseOrder` (creates at once); line menu: asks first (`PurchaseOrderScopeModal`); not on a Revenue line |
| | Subproject | only while the **project switch `subprojectsFunctionalityEnabled`** is on and the row is a **task** (not a stage / milestone); disabled when the task already stands for a subproject. `kit8/pm/subproject/useCreateSubproject.ts`: creates the project **"Subproject of " + task name** (the settings of the origin project: budgets, units, vendor, subprojects, partners, manager), then sets `taskIsSubproject` + `taskSubprojectGUID` on the task (the trigger of PART 29 keeps `project_subproject_link` and the dates), then opens the new project's board in a **new browser window** (web: the window is opened inside the click and pointed at the board when the project exists; blocked / iOS / Android: `router.push`). A refused link (cycle ...) closes the window, deletes the new project and shows the error |
| **Go to** (every item opens a **new browser window** on the web; iOS / Android / a blocked window: `router.push`; lists: `openTaskScopedList.ts`) | Vendor invoices | `/pm/vendor-invoice/list?taskGUID=…[&taskLineGUID=…]` |
| | Purchase orders | `/pm/purchase-order/list?taskGUID=…[&taskLineGUID=…]` (`purchase_order_list`, PART 28: the same keys as `vendor_invoice_list`; chip + x like the invoice list); not on a Revenue line |
| | Product receipts | `/pm/product-receipt/list?taskGUID=…[&taskLineGUID=…]` (`product_receipt_list`, PART 30: the same keys; chip + x); not on a Revenue line |
| | Fact input | `/pm/fact/list?taskGUID=…[&taskLineGUID=…]` |
| | Subproject | only a task that stands for a project: `openProjectBoard` = `/pm/project/dashboard?projectGUID=<subproject>` in a new browser window (the dashboard selects that project: `useDashboardDeepLink`, a link with a project and no task) |

## The filter of the lists (the "scope")
`VendorInvoiceDocumentList` and `PMFactInputDocumentList` take the props `taskGUID` / `taskLineGUID` (the routes `app/pm/vendor-invoice/list`, `app/pm/fact/list` read them from the URL). A **chip** under the title bar says "Task: <name>" or "Task line <id> · Task: <name>" with an **x** that shows all the documents again (`TaskScopeChip`, `useTaskScope`). The scope is not one of the quick filters ("Clear filters" does not touch it); it is sent to the list RPC as `taskGUID` / `taskLineGUID` (`taskScopeToRpc`). A new link opened while the list is mounted replaces the scope.

* `vendor_invoice_list` (PART 26): `taskGUID` = the document has a line of that task (a document without lines: the task it was made from); `taskLineGUID` = the document has a line made from that task line.
* `task_fact_document_list` (PART 24): `taskGUID` was there (the task of the document); `taskLineGUID` = the document has a line with that task line GUID (**strong input**, project switch `factStrongInputByTaskLine`), **or** it is a **free input** document of the task of that line (free lines carry no task line GUID, so every line of the task lists the task's free documents).

## Files
`taskScopeModel.ts` (routes, parse, RPC keys, chip text - pure) · `useTaskScope.ts` · `TaskScopeChip.tsx`; `kit8/pm/view/task/useTaskRelatedMenu.ts`; `kit8/pm/subproject/createSubprojectModel.ts` + `useCreateSubproject.ts`; `kit8/pm/view/project/dashboardDeepLink.ts` (`dashboardProjectPath`, `parseDashboardProjectLink`, `openProjectBoard`).

## Tests
Jest: `__tests__/documents/taskScope`, `__tests__/pm/ui/taskRelatedMenu.test.tsx` (task menu), `__tests__/pm/view/task/finances/taskFinancesUi.test.tsx` (line menu), `__tests__/pm/subproject/createSubprojectModel.test.ts`, `useCreateSubproject.test.tsx`, the scope tests at the end of `vendorInvoiceDocumentList.test.tsx` / `pmFactInputDocumentList.test.tsx`, `dashboardDeepLink.test.tsx` (project-only link). Docker: `tests/70_vendor_invoice.sql` (taskGUID / taskLineGUID of `vendor_invoice_list`), `tests/51_fact_list.sql` (taskLineGUID of `task_fact_document_list`, free and strong).
