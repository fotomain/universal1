# Business units

Design: `documents/BUSINESS_UNIT_CFR_STRUCTURE.html` (document "W1 businessUnit"). SQL: `kit8/sql/start/start_sql_structure.sql` **PART 18** (mirrored in `start_sql_code.sql` / `start_sql_data.sql`; `delete_sql_structure.sql` PART 15).

## `cfrTypeTable` - the enumeration "Centers Of Financial Responsibility"

Works like a 1C enumeration: a flat table of 4 FIXED values, written by the SQL files only (an app user can only READ it; a trigger refuses any other write).

| rowGUID (the code) | accepts costs | accepts revenues |
|---|---|---|
| `costCenter` | yes | no |
| `revenueCenter` | no | yes |
| `profitCenter` | yes | yes |
| `investmentCenter` | yes | yes (capex lines later) |

`rowJSON { title, description, acceptsCosts, acceptsRevenues }` - the rule "which center takes which budget kind" is DATA, SQL (`kit8_cfr_accepts`) and the app (`cfrAccepts`) read the same flags.
`CFR_TYPE` names the values in code. No screen, no drawer item: the values are picked in the CFR column of the units.

## `businessUnitTable` - a tree of any depth in ONE table

`rowGUID` · `rowOwnerGUID 'businessUnitCatalog'` · `rowParentGUID` = the parent unit | `'empty'` (a root = an enterprise) · `orderInList` · `rowJSON { title, code, description, cfrAssigned, isActive }`.
`cfrAssigned` is optional; the **effective CFR** of a unit = its own, else the nearest ancestor's, else none (`effectiveCfr`, SQL `kit8_business_unit_cfr`). A unit with none up the tree takes every kind.
SQL guards: the parent exists, no loop, `cfrAssigned` exists, a unit with sub-units or in use (a line, the posted days, a project, a catalog) is not deleted (deactivate it: `isActive` false),
a CFR that no longer takes the kind of days already posted on the unit is refused. The seed = the 29 units of the document (4 levels, 9 with a CFR).

**`selectFromTree: true`** (the SystemMetaData entry of the entity): a unit of ANY level can be chosen, the first level too. Absent / false = the units without sub-units only (`selectableBusinessUnits`).

## Where a unit is used

| Where | Key | |
|---|---|---|
| the six catalogs: budget item, resource role, contract, person, equipment, product | `rowJSON.businessUnitAssigned` | the default unit of a line that uses it (a "Business unit" column / field) |
| `project_table.rowJSON` | `projectCostCenter` · `projectRevenueCenter` · `projectProfitCenter` · `projectInvestmentCenter` | Project settings → Finances → *Business units*. **Obligatory on every NEW project** (`projectBusinessUnitsRequired`): a new project gets the first unit that fits each field and cannot be saved without them; a project made before has none and is never refused |
| `task_line_table.rowJSON` | `businessUnitTaskLine` (+ `businessUnitSourceTaskLine`, `businessUnitAutoTaskLine`) | the column right after the budget item; `kit8/pm/view/task/finances/taskLineBusinessUnit.ts` |
| `task_line_plan_movements.rowJSON` | `businessUnitAssigned` + `budgetKind` | the unit is kept ON THE POSTED DAYS (a "Business unit" column in the Budgets view) |

**The unit of a line** (pure, `resolveLineBusinessUnit`): while the line follows the sources it takes the FIRST source whose unit takes the kind of the line (a cost line skips a revenue center, a revenue line a cost center):
resource (person / equipment / product) › role › budget item › contract (the person's, else the partner's) › project (cost line: cost center, revenue line: revenue center; then profit, then investment center).
A unit the user typed stays (source `line`). The kind of a line = the genus folder of its budget item (`costsGenus` → cost, `revenuesGenus` → revenue), else of the line's genus. A project without units / a line without a unit = exactly as before.

**The Post CHECK** (a cost on a revenue center, a revenue on a cost center) in three layers: the unit select of the line offers only the units that take its kind (and the Errors column marks a wrong one) ·
`calculateTaskLinePlan` leaves the line out with the message (`useBusinessUnitPostCheck`, Post button and project actions) · the SQL procedure `create_task_line_plan` refuses it. The same rule everywhere (`cfrTypeTable` flags).

## Files

| File | What |
|---|---|
| `cfrTypeModel.ts` | `CFR_TYPE`, the seed, `cfrAccepts`, `cfrTypeOptions` |
| `businessUnitModel.ts` | table def, `businessUnitNodes / Path / Descendants / Leaves`, `effectiveCfr`, `businessUnitAccepts / Problem`, `selectableBusinessUnits`, `businessUnitOptions`, the four project centers (`PROJECT_CENTER_FIELDS`, `unitFitsProjectCenter`, `defaultProjectCenters`, `projectCentersError`) |
| `businessUnitMetaData.ts` | SystemMetaData entries (`selectFromTree`) |
| `useBusinessUnitData.ts` · `useBusinessUnitColumn.ts` | rows from redux (read + realtime) · the shared "Business unit" select column of the catalog tables |
| `BusinessUnitCRUD.tsx` | the screen: `CatalogTreeReusableCRUD` (kit8/ui/components/tree) with the unit columns. Route `/catalog/business/unit` (drawer: Catalogs → Business units) |
| `BusinessUnitPickerField.tsx` | a field + `CatalogTreePicker` (a modal with the tree) - the four project centers, the contract |

The Departments catalog (`departamentTable`) was removed: the business units replace it.
Tests: `__tests__/catalog/business_unit`, `__tests__/pm/view/task/finances/taskLineBusinessUnit.test.ts`.
