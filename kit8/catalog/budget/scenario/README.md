# Budget scenarios

`budgetScenarioTable` - a **plain list** of the scenarios a project budgets in: **Plan** (what is planned) and **Fact** (what really happened).

rowGUID = the code (seeds `planScenarioProject1` "Plan scenario-Project #1", `factScenarioProject1` "Fact scenario-Project #1") · rowOwnerGUID `budgetScenarioCatalog` ·
rowParentGUID `'empty'` always (CHECK) · rowJSON `{ title, description, scenarioKind: 'plan' | 'fact', isActive }` (CHECK on `scenarioKind`).

- SQL: `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` PART 19 (mirrored in `start2_sql_code.sql` / `start5_sql_upsert_all.sql`; dropped by PART 16 of `delete_sql_structure.sql`).
- Route `/catalog/budget/scenario/list` → `BudgetScenarioCRUD.tsx` (a `ReusableTable` with CRUD: Scenario, Kind, Code, Description, Active). Drawer: **Budgets → Budget scenarios** (also in Catalogs).
- `project_table.rowJSON.budgetScenarioForPlan` / `budgetScenarioForFact` (`PMProjectJSON`, kit8/pm/model/types.ts) are chosen in **Project settings → Budgets → Main → Budget scenarios**:
  the Plan picker offers the active `plan` scenarios, the Fact picker the active `fact` ones (the one already chosen stays visible); a wrong kind is shown in red (`projectBudgetScenariosError`).
  Empty = no scenario: an old project stays as it is.

| File | What |
|---|---|
| `budgetScenarioModel.ts` | table, route, kinds, `budgetScenariosOfKind`, `projectBudgetScenariosError` |
| `budgetScenarioMetaData.ts` | SystemMetaData entry (spread into `kit8/redux/SystemMetaData.ts`) |
| `useBudgetScenarioData.ts` | rows from redux (read + realtime) for the pickers |
| `BudgetScenarioCRUD.tsx` | the screen |

Not built yet (design: `documentation/BUDGET_PLAN_CALCULATION.html`): SQL guards (a scenario a project uses is not deleted; a project trigger for the kind) and the turnover register.
