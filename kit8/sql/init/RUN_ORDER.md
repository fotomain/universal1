# SQL files - what to run, in which order

**One file instead of twelve: `kit8/sql/run_fresh_data.sql`** (about 780 KB) = steps 0-8 below (with 0a, 0b) + `create_user_calendar_tables.sql`, in this order, in ONE file (paste it into the
Supabase SQL Editor and Run). It is GENERATED: the files in `kit8/sql/init` stay the source (one file per feature, as before); after you add or change one,
run `node kit8/sql/tools/build_run_fresh_data.js` (the list of files and their order is `FILES` in that script). The steps below remain for running ONE part only.

Supabase → **SQL Editor** → paste the whole file → **Run**. Every file is **idempotent and non-destructive** (safe to run twice) except the
`delete_*.sql` files. Each file stops with a clear message if something it needs is missing, so a wrong order never half-installs anything.

## Install (a database that already has `done/create_tables.sql`: start at step 1)

| # | File | What it adds | Needs | Check after (SQL editor) |
|---|---|---|---|---|
| 0 | `done/create_tables.sql` | base tables, personTable, contractTable, the PM project / task tables, `kit8_setup_def_table`, `pm_touch_updated_at`, `pm_owns_project` | – | `select count(*) from public."personTable";` |
| 0a | `update_currency_exchange_rate_types.sql` | exchange rate **types** (Default \| Budget, as D365 FO): the key of a rate = `day` or `day\|Budget` | 0 | `select pg_get_constraintdef(oid) from pg_constraint where conname = 'currencyExchangeRateTable_day_chk';` |
| 0b | `insert_currency_exchange_rates_2025_2026.sql` | ECB rates 2025 → 2026 for USD GBP CHF JPY CNY SEK NOK DKK PLN: Default = every working day (4086 rows), Budget = the planned rate of the year (18 rows). GENERATED: `node kit8/sql/tools/build_currency_rates_sql.js` | 0, 0a | `select "rowJSON"->>'rateType', count(*) from public."currencyExchangeRateTable" group by 1;` → 4086 / 18 |
| 1 | `create_product_tables.sql` | product catalog + the shared descriptor / variant / price tables | 0 | `select count(*) from public."productTable";` → 106 |
| 2 | `create_resource_role_tables.sql` | role types, roles, role rates, descriptors seniority / workLanguage / certification | 1 | `select count(*) from public."resourceRoleTable";` → 8 |
| 3 | `create_management_genus_table.sql` | management genus: costs (time / material / expense), revenue, payments | – (independent) | `select count(*) from public."managementGenusTable";` → 9 |
| 4 | `insert_rows_resource_table.sql` | demo human / material / expense / revenue roles; sets `managementGenus` on the role types (the **Time / Material / Expenses / Revenues** role pickers need it) | 1, 2, 3 | `select "rowGUID", "rowJSON"->>'managementGenus' from public."resourceRoleTypeTable";` – no null |
| 5 | `create_person_type_table.sql` | `personTypeTable` (Employee, Contractor) + **50 % Employee / 50 % Contractor** of all persons (+ 6 demo persons when fewer than 8) | 0, 1 | `select "rowJSON"->>'personType', count(*) from public."personTable" group by 1;` → half / half |
| 6 | `create_person_descriptors.sql` | person Properties + Variants on the descriptors: sets, plan lines, experience, **separate row per certificate**, variants (Seniority × Language), a **contract for every person** without an active one | 2, 5 | `select count(*) from public."contractTable" where "rowParentGUID" = 'person';` ≥ number of persons |
| 7 | `create_template_resource_contract_table.sql` | `templateResourceContractTable` (rowOwnerGUID = management genus) + 5 demo templates | 3 | `select "rowOwnerGUID", count(*) from public."templateResourceContractTable" group by 1;` |
| 8 | `create_pm_task_line_table.sql` | `task_line_table` (the lines of a task) + RPC `pm_set_task_last_edit_place` (rowJSON.lastEditPlace) | 0 | `select count(*) from public.task_line_table;` → 0 (empty is right) |

Then sign in to the app. Screens:

| Step | Screen (drawer) |
|---|---|
| 1 | Products |
| 2, 4 | Resource roles |
| 3 | Management genus |
| 5, 6 | **Persons (properties and variants)** – `/catalog/person/dashboard` |
| 7 | **Resource contract templates** – `/catalog/management/templateresourcecontract/list` |
| 8 | Project Dashboard → **Finances** button; the task page → **Finances** section |

## Quick path (nothing installed yet)

`done/create_tables.sql` → `create_product_tables.sql` → `create_resource_role_tables.sql` → `create_management_genus_table.sql` → `insert_rows_resource_table.sql`
→ `create_person_type_table.sql` → `create_person_descriptors.sql` → `create_template_resource_contract_table.sql` → `create_pm_task_line_table.sql`

## If a file stops with a message

| Message | Run first |
|---|---|
| `Run kit8/sql/init/create_product_tables.sql first` | step 1 |
| `Run kit8/sql/init/create_resource_role_tables.sql first` | step 2 |
| `Run kit8/sql/init/create_management_genus_table.sql first` | step 3 |
| `Run kit8/sql/init/create_person_type_table.sql first` | step 5 |
| `Run kit8/sql/init/done/create_tables.sql first` | step 0 |

## Remove (reverse order; **deletes data**)

`run_fresh_data.sql` carries all the delete scripts too, as a **RESET section at the top, commented out** (every line starts with `-- `), in this order:
`delete_pm_task_line_table` → `delete_template_resource_contract_table` → `delete_person_descriptors` → `delete_person_type_table` → `delete_resource_role_tables`
→ `delete_product_tables` → `delete_management_genus_table` → `done/delete_tables` (the last one wipes the data of ALL users). Back up, remove the `-- ` signs
of the parts you want, run (= delete, then create everything again), and put the signs back (or run `node kit8/sql/tools/build_run_fresh_data.js`, which writes the file commented out again). The separate files:

`delete_pm_task_line_table.sql` → `delete_template_resource_contract_table.sql` → `delete_person_descriptors.sql` → `delete_person_type_table.sql`
→ `delete_resource_role_tables.sql` → `delete_product_tables.sql` (the management genus: `delete_management_genus_table.sql`).
`delete_person_descriptors.sql` also removes the demo contracts `contract_<person>` it created; `personTable` itself is never dropped.

## Not needed any more

`create_task_expense_input_table.sql` was the table of the removed `/demo/reusabletable` example; `task_line_table` (step 8) replaces it.
