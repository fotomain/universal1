# Task finances - `task_line_table`

The finance lines of ONE task: **Time** (a role + a person), **Material**, **Expenses**, **Revenues** (a role + a product + a partner).
Source: the sheet "W1 TASK LINES". SQL: `kit8/sql/init/create_pm_task_line_table.sql` (+ `delete_pm_task_line_table.sql`); all SQL files in order: `kit8/sql/init/RUN_ORDER.md`.

## Where it is shown

| Where | What |
|---|---|
| Dashboard → **Finances** button (the last of Gantt · Kanban · Network · Versions · Finances) | tree + the lines of the task selected in the tree (`PMProjectFinancesView`). A stage: "select a task". No budget now |
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

`rowJSON`: `taskManagementGenusLine` · `resourceRoleItem` (resourceRoleTable) · `resourceRoleAttributeSetKey` (descriptorKey of a variant of the role) · `taskResourceItem` (Time: personTable,
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

## Not in this version (on purpose)

* **Budget**: the sums in the accounting / budget currency (`sumForAccounting`, `sumForBudget`, their VAT) and any roll-up of a stage or the project.
* Translations of the new texts (`pmT` shows the English text until `kit8/pm/i18n/locales` has them).

## lastEditPlace

`PMProjectTaskFinancesCRUD` reports `{ genus, lineGUID }` (only for the user's own create / change / move / delete, `ReusableTable.onRowEdit`) and opens at
`initialPlace` (the tab + the line, marked with `ReusableTable.focusRowGUID`). The parents add the surface and save it: see `kit8/pm/README.md`.

## Files

`PMProjectTaskFinancesCRUD.tsx` the lines (tabs + table) · `PMProjectFinancesView.tsx` the dashboard view · `taskLineModel.ts` table, genus tabs, row shape ·
`taskLineMoney.ts` · `taskLineCatalogs.ts` · `taskLinePersonMatch.ts` (person vs role) · `taskLineContractCost.ts` (cost from a contract) · `taskLineCompute.ts` · `taskLineColumns.tsx` columns of a genus · `useTaskLineCatalogs.ts` the catalog rows from redux ·
`taskLineMetaData.ts` the redux entity (spread into `kit8/redux/SystemMetaData.ts`).
