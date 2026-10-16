# Task finances - `task_line_table`

The finance lines of ONE task: **Time** (a role + a person **or an equipment**), **Material**, **Expenses**, **Revenues** (a role + a product + a partner).
Source: the sheet "W1 TASK LINES". SQL: `kit8/sql/init/create_pm_task_line_table.sql` (+ `delete_pm_task_line_table.sql`); all SQL files in order: `kit8/sql/init/RUN_ORDER.md`.

## Where it is shown

| Where | What |
|---|---|
| Dashboard → **Finances** button (Gantt · Kanban · Network · Versions · Finances · Plan) | tree + the lines of the task selected in the tree (`PMProjectFinancesView`). A stage: "select a task". No budget now |
| Task page (`/pm/project/task`) → section **Finances** | the same lines (`PMProjectTaskFinancesCRUD`) |
| Task window (`PMTaskEditModal`) | **no lines** (it has Save / Cancel; lines are saved row by row) |

The view is remembered per user AND project (`uxuiSettings.ganttVsNetworkView` in `project_user_settings_table`, saved in the database).

## The table

| column | value |
|---|---|
| `rowGUID` | the line |
| `rowProjectGUID` | `project_table.rowGUID` - FK, filled by the trigger `task_line_set_project` from the task (the app never sends it) |
| `rowOwnerGUID` | `project_task_table.rowGUID` - FK, `ON DELETE CASCADE` |
| `rowParentGUID` | the **leaf** management genus: `timeGenus` · `materialGenus` · `expenseGenus` · `revenueGenus` (`managementGenusTable`) |
| `orderInList` | order inside one genus of the task (drag & drop). "rowNumber" is not stored, it is the position |
| `rowJSON` | `TaskLineRowJSON` (`taskLineModel.ts`) |

`rowJSON`: `taskManagementGenusLine` · `budgetItemTaskLine` (budgetItemTable) · `taskIsPosted` · `baseOfDistribution` (written by Post) · `resourceRoleItem` (resourceRoleTable) · `resourceRoleAttributeSetKey` (descriptorKey of a variant of the role) · `taskResourceItem` (Time: personTable,
else productTable) · `taskResourceAttributesKey` (Time: the descriptorKey of the VARIANT OF THE PERSON the line books; else of a variant of the product) · `taskResourceContract` (Time: the person's contract) · `resourceContractTemplateTaskLine` ·
`taskLinePartnerItem` · `taskLinePartnerContract` · `qtyTaskLine` · `priceTaskLine` · `measureUnitTaskLine` · `vatRatioTaskLine` (%) ·
`priceSourceTaskLine` ('role' | 'product' | 'manual') · `priceAutoTaskLine` · `sumForContract` · `sumVATForContract`.
Titles are never copied: the app reads them from the catalogs.

## Rules (all pure, tested: `taskLineMoney.ts`, `taskLineCatalogs.ts`, `taskLineCompute.ts`)

* **Genus** - stored once, in `rowParentGUID`. The role picker of a tab offers the roles whose role type has that `managementGenus`; a role of another genus
  is marked ⚠ (the data is never refused).
* **Sums** - `sumForContract = round(qty * price, 2)`, `sumVATForContract = round(sum * vat / 100, 2)`, computed on every change by the table's
  `computeRowJSON` and saved with it, so SQL can total a task.
* **Defaults from the catalogs** (only while empty): unit, VAT %, price. Product (Material / Expense / Revenue): its price now, default unit, VAT (own, else
  the product type's). Otherwise the role: its rate now (the variant chosen in "Role attributes" beats "all variants"), the base unit of its role type, its VAT.
  The price list is the first fitting one of the Price lists catalog.
* **The price follows the catalog until the user types another one**: `priceAutoTaskLine` is the last suggestion; while `priceTaskLine` equals it (or is empty)
  a new role / attribute / product re-prices the line; a typed price stays (`priceSourceTaskLine = 'manual'`).
* **Attributes** - a role attribute / product attribute the new role / product does not have is cleared.
* **Contracts** - Time: `taskResourceContract` = a contract of the chosen PERSON (Employee: Employment per Month, Contractor: Service per Day). Material / Expense /
  Revenue: `resourceContractTemplateTaskLine` = a TEMPLATE of the contract asked for (`templateResourceContractTable`, owner = management genus), picked from the
  templates of the line's genus - `taskManagementGenusLine`, kept equal to the genus of the tab - before any partner is known (`kit8/catalog/management/
  templateresourcecontract`). The supplier / customer and the partner contract are picked as before; changing the partner clears the partner contract.
* **Cost of a person = his contract** (`taskLineContractCost.ts`): the price per hour is the contract's sum of the period / the working hours of the period
  (Day 8 h, Week 40 h, Month 168 h, Quarter 504 h, Year 2016 h; OneTime has none). **No contract on the line (or one without an hourly price) = the rate of the
  resource role.** `priceSourceTaskLine` is 'contract' | 'role' | 'product' | 'manual'. A person has no rates of his own: the role's rate does not depend on the
  variant of the person, only on the variant the role asks for.
* **Person Properties and Variants are the PERSON's own** (`kit8/catalog/person`, `taskLinePersonMatch.ts`), separate from the ones of the role, on the same
  descriptor tables. The role asks (a variant "Senior, English" + property values: Min. experience 5, Certification PMP); the person has (variants Senior·English,
  Middle·Latvian + properties: Experience 7 years, several certificates - each its own row). They meet on the DESCRIPTOR (genus + value), never on the plan line.
  The "Person variant" cell lists the variants of the person on the line (each marked "covers the role" or not); EMPTY = automatic = the first variant that covers
  the role. A mark ⚠ names what does not match: a variant that does not cover the role, a missing certificate, "needs at least 5, has 3 years" (a descriptor with
  `satisfies` answers the requirement of another one; numbers "at least", lists "includes"; a requirement the person's type has no descriptor for is skipped).
  Nothing is refused.
* **Sums in the accounting and the budget currency** (`taskLineFx.ts`, D365 style rates: `kit8/catalog/currency/exchange/README.md`). When the project has a
  `currencyForAccounting` / `currencyForBudget` (project settings → Finances, with the rate type of each: Default / Budget), a line also has `sumForAccounting`,
  `sumVATForAccounting`, `sumForBudget`, `sumVATForBudget` (the VAT is converted too) = `sumForContract` / `sumVATForContract` × the pair rate `line currency → target`,
  rounded to the target currency's decimals; columns appear when the project has such a currency. **Which day**: 1. the date of the contract of the line (signed date,
  else start date), when one is selected - strict; 2. the start of the task, if the rates exist on it; 3. today. **Snapshot**: the rate, its type, the day and what the
  day came from are saved in `fxSnapshotTaskLine`; changing a quantity or a price converts with the SAME rate, and a rate edited later never moves a saved sum. A new
  snapshot is made only when its inputs change (the currency, the target or its rate type, the contract date, the start of the task). **Recalculate** (row menu, and the
  bar button for the whole tab) is the separate algorithm: it ignores the snapshot and takes the rates again. No rate = no sum and a ⚠ with the reason (strict).
* **Currency** - visible only (not stored): the partner contract's, else the resource contract's, else the project's `currencyForContract`.

## Equipment on a Time line (`taskResourceKind`, `taskLineResource.ts`; the design: `recommendation/EQUIPMENT_TIME.html`)

A Time line books a **person** or an **equipment** (`kit8/catalog/equipment`: a machine with its own Properties and Variants, the analog of the person). The kind is the line's own
`rowJSON.taskResourceKind`; **empty = person**, so every Time line made before equipment stays valid. ONE helper (`lineResourceKind(genus, json)`) answers who the line books
- the places that asked `genus.resource === 'person'` use it. Material / Expense / Revenue lines always book a product.

* **Input switches** (project settings → Finances → Budgets, `kit8/pm/model/taskInputScope.ts`): while "Expense budget needed" is on, **Time input needed** (with **Time of person input needed** /
  **Time of equipment input needed**), **Material input needed**, **Expense input needed** decide what this view offers. **Master off = exactly as before** (person Time lines, all four tabs).
  An EMPTY tab whose input is off is hidden; a tab that has lines is never hidden (`tabVisible`). Defaults of a missing key: Time / Person / Material / Expense on, Equipment off.
* **The menu "Resource: Person | Equipment"** is a column of the Time table, BEFORE the role and the resource (`resourceKind`), only while both kinds are offered (`timeKindsOffered`: the kinds in scope plus
  a kind the task already has lines of). Then there is ONE resource column (the catalog follows the Resource of the row: `ReusableTable` `catalogEntityNameOf`) and ONE variant column. One kind only = no menu:
  person only = the columns as before; equipment only = Equipment · Equipment variant, no Contract.
* **Role**: the role picker offers the roles of the genus AND of the kind of the line (`resourceRoleTypeTable.rowJSON.resourceKind`, missing = person). A role of the other kind is marked ⚠.
* **Changing the kind** clears what depended on it (`taskLineCompute.ts`): the resource of the other kind, its variant, the person's contract, a role of the other kind - the price then follows the new role.
* **Cost of an hour of equipment = the rate of the role** (`rolePriceTable`): an equipment has no contract and no rates of its own. (`contractPeriodHours` is for persons: 8 h a day.)
* **Match**: `taskLinePersonMatch.ts` serves both kinds (it looks a resource up by its GUID); the ⚠ texts say "The equipment has no variant that covers the role", "Engine power, kW: needs at least 100, has 60 kW".
* **Plan view / Post**: nothing changes in the calculation; `create_task_line_plan` copies `taskResourceKind` into the plan rows; the Plan view shows the equipment title.
* New lines of a project that offers equipment carry their kind (`person` first, or `equipment` when that is the only kind); a project without equipment leaves it empty.

## Budget item, Post and the plan (`kit8/pm/view/task/plan`, see its README)

* **Budget item** (`budgetItemTaskLine`, the first column, `kit8/catalog/budget/item`): what the line is budgeted as - the items of the genus of the tab; a new line gets the item of its genus. A line without one is not posted. The cell opens `SelectCatalogItemWithFolders` (`kit8/catalog/select/with_folders`): a window with a RadioSetApp **Tree | List** - Tree = the folders and the items (a tree-table), List = the items with title + description as before; a small screen opens the List. It is a `renderPicker` of the catalog column, so title / search / fill column stay as they were. The **Product** column of Material / Expense / Revenue lines works the same way (the product folders + the products, columns Description + SKU; `data.productFolder`).
* **Post** (the first button of the bar; texts **Post** · **Posted** · **Post needed**): spreads `sumForBudget`, `sumForContract` and `qtyTaskLine` of the lines of the WHOLE task over the active days of
  `project.calendarForTaskPlan` by the distribution of the line and saves them in `task_line_plan` (one SQL transaction, Correct033). `taskIsPosted` is false for a new / duplicated line and after ANY change of a line.
* The posted days are shown by the **Plan** view (Plan button after Finances).

## Business unit (`taskLineBusinessUnit.ts`; the design: `documents/BUSINESS_UNIT_CFR_STRUCTURE.html`, `kit8/catalog/business_unit/README.md`)

`businessUnitTaskLine` (businessUnitTable; chosen in `SelectCatalogItemFromTreeReusable`, `kit8/catalog/select/from_tree`) is the column RIGHT AFTER the budget item (with "Unit from" = where it came from); shown only while there are business units. It follows the sources until the user chooses:
the first of resource › role › budget item › contract › project whose unit TAKES the kind of the line (cost / revenue, from the budget item's genus) - a cost line skips a revenue center, a revenue line a cost center
(`resolveLineBusinessUnit`, `businessUnitPatch` from `computeTaskLineRowJSON`; keys `businessUnitSourceTaskLine`, `businessUnitAutoTaskLine`). The unit select offers only the units that take the kind;
`lineProblems` marks a wrong one. Post refuses it (`kit8/pm/view/task/plan`). A line without a unit / a project without units behaves exactly as before.

## Not in this version (on purpose)

* Any roll-up of a stage or the project (the Plan is per task).
* Translations of the new texts (`pmT` shows the English text until `kit8/pm/i18n/locales` has them).

## lastEditPlace

`PMProjectTaskFinancesCRUD` reports `{ genus, lineGUID }` (only for the user's own create / change / move / delete, `ReusableTable.onRowEdit`) and opens at
`initialPlace` (the tab + the line, marked with `ReusableTable.focusRowGUID`). The parents add the surface and save it: see `kit8/pm/README.md`.

## Files

`PMProjectTaskFinancesCRUD.tsx` the lines (tabs + table) · `PMProjectFinancesView.tsx` the dashboard view · `taskLineModel.ts` table, genus tabs, row shape ·
`taskLineMoney.ts` · `taskLineCatalogs.ts` · `taskLineResource.ts` (who a line books: person | equipment | product) · `taskLinePersonMatch.ts` (person / equipment vs role) · `taskLineContractCost.ts` (cost from a contract) · `taskLineCompute.ts` · `taskLineColumns.tsx` columns of a genus (the **Errors** column - the message text + the ⚠ - is the FIRST one, before `#`, and only there while a line of the tab has an error) · `useTaskLineCatalogs.ts` the catalog rows from redux ·
`taskLineMetaData.ts` the redux entity (spread into `kit8/redux/SystemMetaData.ts`).

## Footer of a tab
Every tab (Time, Material, Expenses, Revenues) is a `ReusableTable` with the footer: the count of lines and the **Qty total** - shown only while ALL the lines of THAT tab have the same unit (`totalWhenSame: 'unit'`): `12 hour`, `5 pcs`; `—` when the units differ; the lines of the other tabs are not in it. Price, VAT % and the other non-sum columns have no total.

## Title = the name of the task (editable)
The title of the Finances view (`PMProjectFinancesView`) is `view/task/EditTaskNameFast.tsx`: a `TextInputApp` in **`mode="flat"`** (no background, no border / underline, no outer margin; the label and the placeholder "Task name" still work). Enter or leaving the field saves (`crud.updateTask`, undo step "Rename task", only the name is written, saved once); Escape or an empty name puts the old name back; a name changed elsewhere follows unless you are typing. **Clear icon:** while you are editing the name (the field is focused) an (x) icon is shown at the LEFT of the field and empties the text; when you are not editing there is no icon in front of the name (the payments icon of the toolbar is shown only in the "Finances" title of a view with no task). `TextInputApp` `mode` = `'outlined'` (default) | `'flat'`, implemented in every design system (paper, native, ant, expo, tamagui, googlemd3web, applemacui).


## Row menu (right button on a line)
Facts input · Vendor Invoice · Purchase Order (the last two ask first: this line / all the lines of the task) · **Copy line GUID** (`copyLineGuid.ts`: the `rowGUID` of the `task_line_table` line on the clipboard + a snackbar; paste it anywhere, e.g. into the task line field of a line of a **Multi Project** vendor invoice / purchase order) · Recalculate currency sums (only with a budget / accounting currency).

## Picker mode
The same table is the "select a line" window of the Multi Project documents: `PMProjectDashboard picker={…}` (`kit8/pm/view/project/pick`) provides `PMPickerContext`; with `mode: 'line'` the row menu starts with **Select this line** (and a click on a read only cell does the same), and the Finances toolbar has **Select this task**. Outside a picker nothing changes.
