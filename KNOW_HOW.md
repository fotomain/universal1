# Universal 1 — project knowledge (KNOW_HOW)

The one reference for AI agents (Claude Code, Claude Projects, Gemini ...) and developers. Claude Code loads it by itself: `CLAUDE.md` imports it with `@KNOW_HOW.md`.
Rule for the keeper of this file: it is a MAP, not a manual. Say where a thing lives and the rule that is not visible in the code; the details are in the README next to the code and in `documentation/`. Keep it short - it is read at the start of every session.

---

## 0. Read this first (for Claude)

1. Find the feature in **section 6** (feature index) → open its README / design doc → open the code. Do not search the whole repo first.
2. SQL: tables → `start1_sql_tables.sql`, everything else → `start2_sql_code.sql`, seeds → `start3_sql_insert_missing.sql` (+ `start5_sql_upsert_all.sql`), drops → `delete_sql_structure.sql`. Test on Docker Postgres (section 2.4) BEFORE handing SQL to the user. `start1_sql_structure.sql` no longer exists.
3. The user pastes SQL into the Supabase SQL Editor by hand and edits `.env` by hand: every report ends with the paragraph **UPDATE STEP-BY-STEP** (section 8).
4. Check the list of pitfalls (section 7) before debugging something that "should work".

---

## 1. Overview & technology stack

Universal 1 is a cross-platform ERP and Project Management application:
- **Client**: Expo (React Native) for Web, iOS and Android; file-based routes in `app/` (expo-router), the code in `kit8/`.
- **State**: Redux Toolkit + Redux-Saga (optimistic CRUD of the generic tables, `kit8/redux/SystemMetaData.ts`), TanStack React Query (cached reads, PM), `usePMStore` (zustand, PM UI state).
- **Backend**: Supabase (PostgreSQL 15) - Realtime, Row-Level Security, JSONB documents, RPC functions, pg_cron.
- **UI**: design system provider `WithDesignSystem` (native, Material Design 3 `googlemd3web`, dark mode), Skia Gantt (`kit8/pm/skia`).
- **Language texts of the PM screens**: `pmT('text {{n}}', { n })` (`kit8/pm/i18n/pmT.ts`) - the placeholder is `{{n}}`, NOT `{n}`.

### 1.1 Folders

| Folder | What is in it |
|---|---|
| `app/` | routes (expo-router). `_layout.tsx` = the Drawer screens. `app/pm/…` PM screens (+ `kanbanstage`), `app/catalog/…` catalogs (+ `currency`, `budget`, `raci`), `app/user/…` sign in / sign up / forgotpassword / userprofile / historyofactivity, `app/media/{record,play}/{audio,video}` |
| `kit8/documents/` | documents (filled in, then posted): `fact/input` (fact input), `vendor/invoice` (vendor invoice), `vendor/purchase_order` (purchase order, the twin of the invoice), `vendor/lineplace` (the task / task line fields of a Multi Project line); tests in `__tests__/documents/…` (same paths) |
| `kit8/catalog/<name>/` | one catalog: model (`xxxModel.ts`), metadata for redux, CRUD / dashboard, README. e.g. `equipment`, `business_unit`, `legal_entity`, `vendor`, `partner`, `contract`, `organization`, `management/{genus,calendar}` |
| `kit8/pm/` | project management: `crud` (React Query + realtime), `view` (gantt, task, tree, kanban), `model`, `reports/monitor01`, `version`, `i18n`, `store` |
| `kit8/ui/components/` | shared components: `table/reusable` (ReusableTable), `common` (inputs: `DateInputApp`, `TextInputApp`, `SelectItemFromListApp`, `ErrorModalWindow`, `ModalAskComponent`), `app_bottom_tabs` (`ApplicationBottomTabsApp`, README), `CustomDrawerContent.tsx` |
| `kit8/redux/` | `SystemMetaData.ts` registers every redux entity (table name, columns, realtime) |
| `kit8/sql/start/` | ALL SQL (section 2) |
| `kit8/docker/` | local Postgres 15 + the SQL test scripts (section 2.4) |
| `__tests__/` | Jest (section 5); mirrors the code folders |
| `documentation/`, `recommendation/` | design documents (HTML) - the WHY behind the features |
| `scratchpad` | not in the repo: temporary files of a Claude session |

### 1.2 Run and build
```bash
npm run web                  # Expo web bundler, port 8088 (npm run ios / android also)
npx expo start --web -c      # with a cleared cache (after .env / app.config.js changes)
./save_to_github.command     # saves the work to a timestamped branch expo-YYYY-MM-DD-HH-MM of github.com/fotomain/universal1
```
`.env`: Supabase URL / key, `APP_NAME`, `ENVIRONMENT_NAME=DEV_ENVIRONMENT` (developer helpers: the three dots menu of ReusableTable shows the table name and copies it; `kit8/ui/environment.ts`).

---

## 2. Database & SQL (`kit8/sql/start/`)

### 2.1 The files and their order
| Order | File | Content |
|---|---|---|
| 1 | `start1_sql_tables.sql` | the TABLES only: extensions (ltree, pgcrypto, pg_cron - guarded), `CREATE TABLE`, `ALTER TABLE … ADD COLUMN / CHECK`, indexes, sequences, renames of tables. No function / trigger / policy / grant / view / data. One exception: the helper `pm_ltree_label` (four CHECKs call it; start2 has the same copy, a test keeps both equal) |
| 2 | `start2_sql_code.sql` | everything else of the structure: functions / RPC, triggers, RLS + policies, grants, views, realtime publication, pg_cron job, `kit8_setup_def_table(...)` calls, backfills of data that already exists. Refuses to run without the tables |
| 3 | `start3_sql_insert_missing.sql` | the seed rows (countries, currencies, ECB rates, catalogs, roles, calendars, units …), `INSERT … ON CONFLICT DO NOTHING`. Needs 1 + 2 |
| (opt.) | `start5_sql_upsert_all.sql` | the same seeds as UPSERTS (`ON CONFLICT DO UPDATE`): refreshes seed rows to the repository values; user rows are untouched |
| (undo) | `delete_sql_structure.sql` | drops everything the app created, tables WITH data. Numbered parts, reverse order |
| (demo) | `equipment_sql_roles_and_more.sql` | demo equipment / roles for one named project (paste and run, on request) |

All of them are idempotent (run twice = no change, also on an existing database: it is upgraded). The numbered **PARTs 1..32** have the same number and title in start1 and start2 (a part without tables is not in start1): 17 equipment, 18 business units, 19 budget scenario, 20 organization scope, 21 resource calendar, 22 resource busy check, 23 calendar lock, 24 fact input, 25 Monitor01 + project status register, 26 legal entity / main vendor / vendor invoice (+ Multi Project lines), 27 project cost total, 28 purchase order (+ the column Ordered of Monitor01), 29 subprojects, 30 product receipt (+ the column Received of Monitor01, the chain purchase order → product receipt → vendor invoice), 31 customer invoice, 32 activity genus (operating / investing / financing) + the budget item key activity × genus + direction.

### 2.2 How a change is made
- new table or column → `start1_sql_tables.sql` (inside its PART); function / trigger / policy / grant / RLS / realtime → `start2_sql_code.sql` (same PART);
- a unique index or NOT NULL that needs a data fix right before it stays in start2 after the fix;
- seed row → start3 (+ start5); the drop of anything new → `delete_sql_structure.sql` (its numbering test scans `^-- PART (\d+):`, do not write that pattern in a comment);
- a `RAISE` message: a placeholder is `%`, a percent sign is `%%` (a lone `%` breaks the install: "too few parameters");
- never put a function call in a table definition (it would not exist yet) - add it later in start2 with `ALTER TABLE`.

### 2.3 Universal table schema (the generic catalogs)
```sql
CREATE TABLE IF NOT EXISTS public."<entityName>Table" (
  "rowGUID"       TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'empty',   -- partition / tenant / owner entity
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',   -- folder / parent
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- all domain fields
  "created_at" / "updated_at" TIMESTAMPTZ
);
```
`kit8_setup_def_table('xTable')` (start2) turns on RLS, REPLICA IDENTITY FULL, the touch trigger and the standard indexes. The PM tables (`project_table`, `project_task_table`, `task_line_table`, …) use UUID ids, an `ltree` path `treePath` and `rowOwnerGUID` = the user (RLS by `app_user_guid()` / `pm_owns_project(project)`); the organization of a user is `userTable.rowJSON.userOrganization` and a project's `rowParentGUID` is that organization.
Row-level rules: documents (fact, vendor invoice) are written ONLY by RPCs (`SECURITY DEFINER`), the client has SELECT (+ delete of a draft); sums are computed by triggers; "Post" writes the movements in the SAME transaction.

### 2.4 Test the SQL before handing it over (Docker, Postgres 15)
```bash
cd kit8/docker && docker compose up -d        # first time; the image postgres:15 is local
./test_sql.sh                  # fresh db: install twice (same objects + rows), tables alone = only tables, code refuses an empty db, 0 seed rows, delete leaves nothing, install again
./test_fact_monitor01.sh [NN]  # tests/5N, 6N, 7N, 8N, 9N only (fact input, Monitor01 + register, vendor invoice 70 / purchase order 71 / both together 72 / product receipt 73, customer invoice 74, project cost total, 90 subprojects, 91 activity genus): "-> N checks passed"
./test_time_genus.sh [NN]      # EVERY tests/NN_*.sql (organization 1N, resource calendar 20, busy check 30, calendar lock 40, fact 5N, Monitor01 6N, vendor invoice 7N) or only NN
./test_time_genus_race.sh      # two sessions: Post vs a calendar change (locks)
./test_cron.sh                 # pg_cron for real (image = postgres:15 + pg_cron, kit8/docker/Dockerfile; database sqlcron): jobs monitor01_tick (2 s) / housekeeping, the scheduler drains the queue by itself, delete unschedules
./bench_monitor01.sh 2000      # speed of the Monitor01 worker with 2000 tasks
./bench_project_cost.sh 10000 # speed of the project cost total (batch, one task, rebuild, verify)
```
A new SQL test is a file `kit8/docker/tests/NN_name.sql` (one transaction, rolled back; helpers in `00_helpers.sql`). The Docker image has pg_cron (Dockerfile) but the extension can live in ONE database only (`cron.database_name=sqlcron`, `docker-compose.yml`): `test_cron.sh` uses it; every other test database prints the NOTICE and goes on. After a change of the Dockerfile / compose: `docker compose down -v && docker compose build && docker compose up -d`.
After a big SQL change compare the schema: `pg_dump -s` of a database made the old way and the new way must be identical.

### 2.5 pg_cron (the Monitor01 worker)
The worker `monitor01_tick` runs `CALL public.monitor01_process_dirty()` every 2 s. `start1_sql_tables.sql` tries `CREATE EXTENSION pg_cron` (a failure is only a NOTICE); `start2_sql_code.sql` schedules the job when the schema `cron` exists. Check: `select jobname, schedule, active from cron.job;`. Without pg_cron the open report still refreshes itself (section 6, Monitor01). Locally `./test_cron.sh` proves the schedule (2026-10-19; the real Supabase tick is still only checked there).

---

## 3. UI framework & component system

### 3.1 `ReusableTable` (`kit8/ui/components/table/reusable/`, README there)
The data grid of the catalogs, task finances, fact / invoice lines and the lists.
- **Optimistic CRUD** by `useReusableTableCrud` → redux saga (`createOne`, `updateOne`, `deleteOne`) on a redux entity registered in `SystemMetaData` (`rootColumns` = whitelist of real columns that are saved, the rest goes to `rowJSON`; `fromStored`, `addEnabled`, `onAdd`, `onRowOpen` + `openLabel` for a list whose row opens a document, `foldersTree` with `folderTarget` / `folderField`).
- **Column header menu "Fill all lines"** (right-click on web, long press on touch): `ReusableTableFillColumnModal`; catalog columns use `SelectElementFromCatalog`, others a numeric / text input; Cancel / Fill.
- **Post button** (`postDataNeeded`): visible only while there are unposted changes.
- **Row-aware catalog column**: `catalogEntityNameOf(row)` + `catalogEntityNames` - one column whose catalog depends on the row (a person OR an equipment); "Fill all lines" fills only the rows of the column's own catalog.
- **Three dots menu**: with `ENVIRONMENT_NAME=DEV_ENVIRONMENT` its last item is the table name (copied on press). Date cells are centered.
- Dates: `DateInputApp` accepts 8 digits (`20260101` = YYYYMMDD, `20122026` = DDMMYYYY → `2026-12-20`); filters use `DateInputApp` / `TextInputApp` / `SelectItemFromListApp clearable` with a Clear button inside the field, all in ONE row.

### 3.2 Other shared UI
`ScrollableTabBar` (`kit8/ui/components/tabs`): EVERY row of top tabs is one (it scrolls sideways: swipe, wheel, chevrons while the tabs overflow) - a new tab bar uses it, never a wrapping / fixed row.
`ErrorModalWindow` (errors of Post etc. - not an ephemeral snackbar), `ModalAskComponent`, the Drawer (`CustomDrawerContent.tsx` + `app/_layout.tsx`), in this order after Home / Developer 1 / Media Posts / Record / Play: **Catalogs** (… Legal entities, Products, Users (RACI)) · **Documents** (Fact input, Product receipts, Purchase orders, Vendor invoices) · **Project Dashboard** · **Reports** (Monitor01) · **Budgets** (catalogs).

---

## 4. Project Management (PM) & Gantt module (`kit8/pm/`, README there)

- **Task tree (`PMProjectTasksTree`)**: WBS with synchronized scrollbars. Posted-status column before the name: nothing = unposted, green check (`#16a34a`) = posted, dark orange check (`#c2410c`) = posted and changed.
- **Project actions (`PMProjectActionsButton`)** on `PMRecentProjectsToolbar`: Post unposted tasks · Repost all · Refresh the project.
- **Posting (`useTaskPost` / `runTaskPost`)**: calculates the plan movements (`create_task_line_plan`, one transaction) and the task status; no budget item on a line → `ErrorModalWindow`. The plan of an UNPOSTED task line is not in the reports (a task-line edit changes Monitor01 only after Post).
- **Task input switches** (`kit8/pm/model/taskInputScope.ts`): project settings → Finances → Budgets; with `projectExpenseBudgetNeeded` on: `projectTimeCostsNeeded` > `projectTimeOfPersonNeeded` / `projectTimeOfEquipmentNeeded`, `projectMaterialCostsNeeded`, `projectExpenseCostsNeeded`. A tab that has lines is never hidden.
- **Time line of an equipment** (`taskResourceKind` person | equipment): see Equipment below. **Descriptor sides**: products, roles, persons and equipment share the descriptor tables (`kit8/catalog/product/crud/descriptorSides.ts`).
- **Text of a row**: a TASK row (`project_task_table`, `templates_project_task_table`, `version_project_task_table`; stage / task / milestone) keeps its text in `rowJSON.taskDescription` (type `PMTaskJSON`, `kit8/pm/model/types.ts`); a PROJECT row keeps `rowJSON.name`. Renamed 2026-10-18: the one-time DO block at the end of `start2_sql_code.sql` renames the key in existing rows (user triggers off, `updated_at` stays); `taskJSONOfFile` reads old project files. A new task literal typed `any` hides a wrong `name:` from `tsc` - grep for it.
- **Number input of the lines** (task lines + all document lines): `PMNumberInputApp` in `kit8/pm/components` (README there; props `positiveOnly` default true, `tableName`, `tableFieldName` = information only). A ReusableTable number column opts in with `...pmNumberColumn(table, field)` (`NumberColumn.renderNumber`); the column files load it lazily (they are imported by node tests without the design system).
- Realtime of the PM tables: `kit8/pm/crud/realtime`; the setup text of `kit8/pm/README.md` about `kit8/sql/init` is OLD - use section 2.

---

## 5. Tests

```bash
npm test                                  # all Jest tests (jest-expo, jsdom, react-native-web)
npm test -- path/or/name                  # one file
npx tsc -p <narrow tsconfig> --noEmit     # the project-wide tsc crashes (stack overflow) already at baseline: check with a tsconfig that lists only the new files
```
- A helper in `__tests__` must be named `*TestKit.ts(x)` (jest ignores those); otherwise jest runs it as a test and fails "must contain at least one test". UI kit: `__tests__/pm/ui/pmUiTestKit.tsx` (mocks of expo-router, TextInputApp …: to override one use `jest.doMock` + `require` AFTER importing the kit). SQL file helper: `__tests__/sql/sqlFilesTestKit.ts`.
- SQL is tested twice: Jest reads the .sql files (names, parts, mirrors, the delete file: `__tests__/sql`, `__tests__/**/…Sql.test.ts`) and Docker runs it (2.4).
- **Baseline**: about 29 suites / 31 tests fail since before the feature work (e.g. partnerCard, currencyEdit, modals, taskFinancesUi "Posted", SwipeableCard, iconapp-web-fallback). A new failure = a suite not in that list; compare the `FAIL` lines of two full runs. `search-opportunistic-saga` is flaky under load (passes alone).
- Write the test for new code in the same round; when a test and the SQL disagree, run the Docker script - it is the truth.

---

## 6. Feature index (where to look)

| Feature | Code | SQL | Design doc / README | Docker test |
|---|---|---|---|---|
| Organization scope (user = 1 organization, projects belong to it, invitations; **default project settings** `rowJSON.defaultProjectSettings`: Organization edit → Projects → Settings, Project settings window ⋮ "Save settings to organization", a new project starts from them - no SQL) | `kit8/catalog/organization` | PART 20 | README there | `tests/10,11,12` |
| Resource calendar = capacity (hours/day), busy check at Post, calendar lock | `kit8/catalog/management/calendar`, `kit8/pm/view/task/plan` | PARTS 21-23 | `documentation/TIME_GENUS_CONTROL_WBS.html` | `tests/20,30,40` |
| Equipment (a machine like a person; own Properties/Variants; hour costed by the rate of its role) | `kit8/catalog/equipment` | PART 17 | `recommendation/EQUIPMENT_TIME.html` | `test_sql.sh` |
| Business unit + CFR (cost / revenue / profit / investment centers) | `kit8/catalog/business_unit` | PART 18 | `documentation/BUSINESS_UNIT_CFR_STRUCTURE.html` | `test_sql.sh` |
| Budget scenarios (plan / fact) | `kit8/catalog/budget/scenario` | PART 19 | README | `test_sql.sh` |
| Plan calculation of a task line | `kit8/pm/view/task/plan`, `finances` | `create_task_line_plan` (PARTs 15, 22) | `documentation/TASK_LINE_PLAN_CALCULATION.html` | `tests/30,52` |
| **Fact input** (Actuals): a document per task, Draft → Post; lines of used quantities | `kit8/documents/fact/input` (Form, List, New document) · routes `app/pm/fact/list`, `app/pm/project/task/fact` | PART 24: `task_fact_header`, `task_fact_usage_timeline`, RPC `task_fact_document_create / post / unpost / list` | `documentation/FACT_INPUT.html`, README | `tests/50,51` |
| **Project status register** (1C-style accumulation register) | - (SQL only) | PART 25: `project_status_movements` (narrow, kinds plan/ordered/received/invoiced/used/sold, `qtyProjectStatus`), `project_status_month_turnover` (wide, realtime) | `documentation/PROJECT_STATE_WBS.html` | `tests/60` |
| **Monitor01** report (plan vs contracted vs used vs invoiced per task × genus × role × unit × month; columns "Budget", "Ordered" (first of Fact), "Received" (= posted product receipts, PART 30) and the 1st level group "Vendor Invoice" after Fact with the 2nd level columns "Quantity" (`qtyVendorInvoiced`) and "Amount" (`sumVendorInvoiced`, the money of the posted invoices = `sumForBudgetInvoiced`); the LAST group "Customer Invoice" has "Quantity" (`qtyCustomerInvoiced`) and "Amount" (`sumCustomerInvoiced` = `sumForBudgetSold`; the Revenue genus is in the report only through it, tab "Deliverable"); the tip of a header cell = its title; a double click on a Task name opens it in the dashboard: task + genus tab + line) | `kit8/pm/reports/monitor01` · route `app/pm/reports/monitor01` | PART 25: `monitor01_view`, worker `monitor01_apply` / `monitor01_process_dirty` (pg_cron 2 s, queue `monitor01_dirty`), RPC `monitor01_refresh_now`, `monitor01_stamp`, `monitor01_sum_sources`, `monitor01_verify` | `documentation/MONITOR01_WBS.html`, README | `tests/60`, `bench_monitor01.sh` |
| **Vendor invoice** (1 vendor + 1 contract per document; Draft → Post writes the 'invoiced' movements) | `kit8/documents/vendor/invoice` · routes `app/pm/project/task/vendor-invoice`, `app/pm/vendor-invoice/list` | PART 26: `vendor_invoice_header / lines`, RPC `vendor_invoice_candidates`, `create_vendor_invoices`, `post / unpost / delete_vendor_invoice`, `vendor_invoice_list` | `documentation/PROJECT_STATE_WBS.html`, README | `tests/70` |
| **Project cost total** per task / stage (tree column `costTotalForBudget` = plan Time + Material + Expense; only while a cost budget is on) | `kit8/pm/cost` (model, API, hook), tree column in `view/tree/columns`, switch in `PMProjectBudgetsTab`, Actions menu item "Update project cost" | PART 27: table `project_task_cost_total`, step 3 of `monitor01_apply` (`project_cost_apply`: delta on the ancestors read from the `treePath` labels), `project_cost_rebuild`, RPC `update_project_cost_total`, `project_cost_verify` | `documentation/UPDATE_PROJECT_COST.html`, README | `tests/80`, `bench_project_cost.sh` |
| **Multi Project** vendor invoice / purchase order (project setting `multiProjectVendorInvoceNeeded`, OFF by default; chevron next to the Project field: Single \| Multi; lines get project · task GUID · task line GUID with Paste / Select / Clear) | `kit8/documents/vendor/lineplace` (`LinePlaceCell` icons have tips; `useDocumentLineMenu` = the Task menu items on a line / document row of the invoice and the order), `kit8/pm/view/project/pick` (buttons "Select this task" / "Select this line" = `PM_WIDE_ACTION_WIDTH` x `PM_WIDE_ACTION_HEIGHT`, the size of "+ Project") (the dashboard as a picker: `PMProjectDashboard picker`), "Copy line GUID" of the Finances line menu (`kit8/pm/view/task/finances/copyLineGuid.ts`) | PART 26 / 28: `*_set_header` (`…MultiProject`), `*_set_line_task`, `*_line_places`, `vendor_project_setting_on` | `documentation/PURCHASE_ORDER.html`, READMEs of the two document folders | `tests/70` (section 9), `71` |
| **Purchase order** (twin of the vendor invoice; Draft → Post writes the `ordered` movements; Monitor01 column **Ordered**) | `kit8/documents/vendor/purchase_order` (`PMPurchaseOrderDocumentForm / Header / Lines / List / Choose`) · routes `app/pm/project/task/purchase-order`, `app/pm/purchase-order/list` | PART 28: `purchase_order_header / lines`, RPC `purchase_order_candidates`, `create_purchase_orders`, `post / unpost / delete_purchase_order`, `purchase_order_list` | `documentation/PURCHASE_ORDER.html`, README | `tests/71`, `72` |
| **Product receipt** (third document of the chain purchase order → product receipt → vendor invoice; Draft → Post writes the `received` movements; Monitor01 column **Received** = `qtyReceived`; made ONLY from a POSTED purchase order: form bar / list row menu "Create based on → Product receipt"; a POSTED receipt gives "Create based on → Vendor invoice"; Task menu Go to → Product receipts) | `kit8/documents/vendor/product_receipt` (`PMProductReceiptDocumentForm / Header / Lines / List`, `useCreateProductReceiptFromOrder`, `useCreateVendorInvoiceFromReceipt`) · routes `app/pm/project/task/product-receipt`, `app/pm/product-receipt/list` | PART 30: `product_receipt_header / lines`, `project_status_register_receipt`, `create_product_receipt_from_order`, `create_vendor_invoice_from_receipt`, `post / unpost / delete_product_receipt`, `product_receipt_list`; the turnover columns `…Received` feed `monitor01_view.qtyReceived` (PART 25 functions changed in place; `monitor01_fresh_rows` is defined twice - PART 25 and PART 29, change both) | `documentation/PRODUCT_RECEIPT.html`, README | `tests/73` |
| **Subprojects** (a task of a project stands for another project; the origin task follows the subproject dates; no recursion; Monitor01 aggregates Time / Material / Expense of the subproject into the origin task and has the radio Projects / Subprojects / All; project switches `subprojectsFunctionalityEnabled` > `autoChangeOriginTaskBasedOnSubprojects` > `autoChangeStartAndFinishDatesForOriginTask`, `aggregateTime/Material/ExpenceFrom…`; task keys `taskIsSubproject`, `taskSubprojectGUID`) | `kit8/pm/subproject`, tab `view/project/settings/PMProjectSubprojectsTab.tsx`, `view/task/PMTaskSubprojectField.tsx`, `reports/monitor01/Monitor01ProjectKindRadio.tsx`, tree column + Gantt label via `store_subproject` (`subprojectMarks.ts`) | PART 29: table `project_subproject_link`, `subproject_*` functions + triggers; hooks in `pm_apply_schedule`, `create_task_line_plan`, `monitor01_apply`, `monitor01_refresh_now`, `monitor01_sum_sources`; `monitor01_fresh_rows` REPLACED in PART 29 | `documentation/SUBPROJECTS_BRD_TRD.html` (BRD + TRD), README there | `tests/90` |
| **Task menu submenus** "Create based on this" (Fact input · Vendor Invoice · Purchase Order · Subproject - the last only while `subprojectsFunctionalityEnabled`: creates the project "Subproject of <task>", links it, opens its board in a new window) and "Go to" (Vendor invoices · Purchase orders · Fact input lists, each in a NEW browser window, filtered for the task / task line by route params `taskGUID` / `taskLineGUID` with a chip + x · Subproject board); before Delete, in the Task menu and in the line menu of the Finances table | `kit8/documents/taskScope` (model, `useTaskScope`, `TaskScopeChip`), `kit8/pm/view/task/useTaskRelatedMenu.ts`, `kit8/pm/subproject/useCreateSubproject.ts`, `dashboardDeepLink.ts` (`openProjectBoard`), routes `app/pm/vendor-invoice/list`, `app/pm/purchase-order/list`, `app/pm/fact/list` | `vendor_invoice_list` (PART 26) and `purchase_order_list` (PART 28) keys `taskGUID` / `taskLineGUID`; `task_fact_document_list` (PART 24) key `taskLineGUID` (strong line GUID, or the free documents of the task) | README of `kit8/documents/taskScope` | `tests/70`, `tests/71`, `tests/51` |
| **Task window** (double click on a task of the Gantt chart → NEW browser window `/pm/project/task/edit`; 1st level tabs `TabTaskEditMain` = the form of `PMTaskEditModal` embedded, `TabTaskEditPlan` = `PMTaskEditView`, `TabTaskEditFact` = 2nd level tabs `TabFactInput` · `TabProductReceipt` · `TabVendorInvoice` (the lists of the task); the context menu item **Options** (before Delete) opens `PMTaskEditOptions` = UX/UI only, title "Edit options") | `kit8/pm/view/task/edit` (`PMTaskEditWindow`, `taskEditWindowLink.ts`), `PMTaskEditOptions.tsx`, route `app/pm/project/task/edit` | - | README in `kit8/pm/view/task/edit` | `__tests__/pm/ui/taskEditWindow*`, `taskEditOptions*` |
| **Customer invoice** (the twin of the vendor invoice, made from the Deliverable = Revenue lines; project switch `customerInvoiceFunctionalityEnabled`, TRUE by default, Project settings → Customer; Task menu "Create based on this → Customer Invoice" + "Go to → Customer invoices" only while it is on; the task window Fact tab has `TabCustomerInvoice`; Monitor01 has the LAST group "Customer Invoice" with the columns "Quantity" and "Amount", the Revenue genus appears there ONLY through the customer invoices, tab "Deliverable") | `kit8/documents/customer/invoice`, `view/project/settings/PMProjectCustomerTab.tsx`, `view/task/useTaskRelatedMenu.ts`, `view/task/edit/TabCustomerInvoice.tsx`, routes `app/pm/project/task/customer-invoice`, `app/pm/customer-invoice/list` | PART 31: `customer_invoice_header / lines`, RPC `customer_invoice_candidates`, `create_customer_invoices`, `post / unpost / delete_customer_invoice`, `customer_invoice_list`; register kind `sold` (turnover `qtySold`, `sumForBudgetSold`), `monitor01_view.qtyCustomerInvoiced / sumCustomerInvoiced`, drill-down measure `customerInvoiced` | README there | `tests/74` |
| **Activity genus + budget item key** (IAS 7 activities `operatingActivity` / `investingActivity` / `financingActivity` = linear catalog `managementActivityGenusTable`; a budget item has an obligatory `rowJSON.budgetItemGenericKey` = `<activity>.<management genus>` (14 of 18 cells allowed: financing only the two payments genus) and `direction` inbound / outbound (default = the key's; `isCorrection` reverses it); `webIfrsName` / `d365foName` / `sapName` + `isPolicyItem` on the item; 36 possible budget items seeded; old items become operating; both catalogs read only) | `kit8/catalog/management/activity_genus` (screen `ManagementActivityGenusCRUD`, route `app/catalog/management/activity_genus/list`), `kit8/catalog/budget/item` (`budgetItemKeyModel.ts` = the matrix + checks, columns Activity / Direction / Correction / Web + IFRS / D365 FO / SAP / Policy of `PMBudgetItemCRUD`) | PART 32: `managementActivityGenusTable`, `budgetItemGenericKeyTable`, function `kit8_budget_item_key_matrix()` (THE rule; `BUDGET_ITEM_KEY_MATRIX` copies it, a Jest test compares), trigger `trg_budgetItemTable_key` (after `trg_budgetItemTable_genus`), CHECK `budgetItemTable_key_chk` (start2, after the backfill); seeds start3 / start5 PART 32 | `documentation/ACTIVITY_GENUS.html`, READMEs there | `tests/91` |
| **VAT basis** (every money report; IFRS / GAAP: recoverable VAT is no cost). Amounts are stored as COMPONENTS net · VAT · VAT that is cost (`vatInCost…`); a report shows **Cost** (default = net + VAT that is cost) \| **Net** \| **With VAT** through `amountOfVatBasis` / SQL `vat_basis_amount`, one switch `VatBasisSelect` + `useVatBasis` (AsyncStorage) for ALL reports. Document lines: VAT rate chosen from `valueAddedTaxTable` (`rowJSON.vatRateGUID`; `vatRecoverablePercent` of the row, missing = 100), columns Accounting before VAT / VAT for accounting (TYPED by the user: the price / the VAT % are calculated back by `vat_line_calc`) / Sum for accounting (the TOTAL with VAT - on a LINE only); `sumForBudget` and the register's `sumForAccounting` stay NET. Customer invoice: VAT is never cost. Monitor01 has the switch; project cost total = cost basis + `costTotalForBudgetWithVAT` (setting `showTotalCostWithVATOnTheGanttChart`); fact lines (STRONG only) take the VAT of their task line | `kit8/pm/vat`, `kit8/documents/vat`, the four `…Columns.tsx`, `monitor01Model.ts` (`applyMonitor01VatBasis`), `kit8/pm/cost` | PARTs 15, 24-31: `vat_basis_amount`, `vat_rate_lookup`, `vat_line_calc` (PART 26 helpers; the four line triggers call it), plan `vatForBudget` / `vatInCostForBudget`, backfill at the end of start2 | `documentation/VENDOR_INVOICE_DOC.html`, `kit8/pm/vat/README.md` | `tests/75`, `52`, `70`, `71`, `74` |
| **Bottom tabs** (`ApplicationBottomTabsApp`: expo-router, look by design system; the FAB stands above it) | `kit8/ui/components/app_bottom_tabs`, `navigation/bottomTabsLayout.ts` | - | README there | `__tests__/ui/appBottomTabs*` |
| **Media** record + play audio / video, web + iOS + Android (Drawer: Record → Audio, Video · Play → Audio, Video); recordings become `mediaPostReusable` posts; video buttons like YouTube, settings in `uxuiState.PlayVideoSettings` | `kit8/ui/components/media` (vision-camera, expo-video, expo-audio; `X.web.tsx` = web) · routes `app/media/…` | - (table `mediaPostTable` exists) | README there | `__tests__/media` |
| Legal entity catalog (folders by country) and the **main vendor** of a partner / equipment / product | `kit8/catalog/legal_entity`, `kit8/catalog/vendor` | PART 26 | READMEs | `tests/70` |
| Project versions (read-only copies of a plan) | `kit8/pm/version` | `version_*` tables (PART 1, 5b) | `documentation/PM_VERSION_STRUCTURE.html` | `test_sql.sh` |
| Products / descriptors | `kit8/catalog/product` | PART 4 | `documentation/PRODUCT_*` | `test_sql.sh` |
| **Product ItemNumber / SearchName** (optional text fields `rowJSON.itemNumber` / `searchName`; project settings tab **Product** (`TabProduct`, also in Organization edit → Projects → Settings), ALL FALSE by default: `itemNumberFunctionalityEnabled` / `…VisibleInProjects`, `searchNameFunctionalityEnabled` / `…VisibleInProjects`; Enabled = searched; Enabled AND Visible = a column BEFORE the SKU in the Products list (Item number, then Search name) + card field + shown in the product windows of a project. The Products list reads the ORGANIZATION defaults (`useProductFields`), a project screen reads ITS project (`productFieldsOfProject`)) | `kit8/catalog/product/productFieldsModel.ts`, `useProductFields.ts`, `productSelectModel.ts` (`productSelectColumns`; `WithFoldersColumn.searchOnly`), `kit8/pm/view/project/settings/PMProjectProductTab.tsx` | - (no SQL: JSONB keys) | README of `kit8/catalog/product` | `__tests__/catalog/product/productFields*.test.tsx` |

**Deep link into the dashboard** (`kit8/pm/view/project/dashboardDeepLink.ts`): `/pm/project/dashboard?projectGUID&taskGUID&view=finances&genus&lineGUID` selects the project, opens the Finances ("Edit") view at that task, tab and line (not saved as the project's view); a click on a row of a source window (SumExplorerListReusable `onRowPress`) opens it in a new browser tab.

**Monitor01 in one paragraph.** Posting a plan or a fact / invoice document writes movements into the register (same transaction) and queues the task in `monitor01_dirty`; the worker sums the register into the turnover and fills `monitor01_view` (changed rows only); the screen listens to Realtime. Safety net while **Auto refresh** is ON: every 3 s the hook calls `monitor01_stamp(project)` (row count, newest `updated_at`, queue length and age): a difference twice in a row re-reads the rows; a queue older than 6 s makes the screen call `monitor01_refresh_now` (at most once in 15 s). So the report follows even when Realtime is silent or pg_cron is not enabled. Badge: Live / Live: checked every 3 s / Offline / Auto refresh is off.

**Vendor invoice rules.** The context menu "Vendor Invoice" CREATES the documents at once (`useStartVendorInvoice`): task tree = all lines of the task; a line of the Finances table asks first (`VendorInvoiceScopeModal`: current line - default - / all lines of the task); lines with no vendor make ONE draft WITHOUT a vendor (and no legal entity; project settings → Vendor: `userCanCreateVendorInvoicesFromTasksWithEmptyVendors`, true by default): the form saves the vendor / contract AT ONCE when chosen (`vendor_invoice_set_header`; any UNPOSTED invoice can change them, a posted one not), Post needs vendor + legal entity; `independentInvoiceInputAvailable` (true by default) = the + of a draft adds independent lines (`vendor_invoice_add_line`, no task line); the choice window opens only when a person is needed (a contract without a legal entity, nothing to invoice). Candidates of a line: the partner of its contract, else the line's partner (with its main contract), else the main vendor of the equipment / product. A draft line edits only qty / price / VAT %; sums by trigger; RLS by the organization; Post needs the number and date and the ownership of every line's project. The 0333Effect rounding correction is NOT built (user decision).

---

## 7. Pitfalls and lessons (read before debugging)

- `StyleSheet.absoluteFillObject` is removed in RN 0.86 (undefined at runtime → wrong positioning): use `StyleSheet.absoluteFill`.
- `pmT` placeholders are `{{n}}`. A missing translation key shows the English text.
- React Native Web `TextInput`: `editable={false}` becomes `readOnly` in jsdom (not `disabled`).
- Supabase has no pg_cron until it is enabled (Database → Extensions): `relation "cron.job" does not exist` = not enabled. The code works without it.
- A statement `ALTER TABLE … SET NOT NULL` / a unique index placed BEFORE the data fix that makes it valid breaks an existing database: keep them together.
- The `delete_sql_structure.sql` numbering test and the "PART n" scans: a comment line that starts with `-- PART <n>:` outside a banner confuses them.
- zsh does not split an unquoted variable into words: use shell functions in the Docker scripts.
- macOS `sed -i ''` with `#` delimiters and `[0-9]` classes is fragile: edit with a small Python script.
- A trigger on the plan movements must NOT queue the Monitor01 dirty queue for the 'plan' kind (the worker rewrites them: loop).
- Running `start2_sql_code.sql` (or `run_sql_cli.command`) on a LIVE database drops / creates triggers (`DROP TRIGGER IF EXISTS` = ACCESS EXCLUSIVE lock) for a few seconds: an edit made in the app at that moment can fail with `deadlock detected` (40P01, the app's statement is the victim and is NOT saved; the install itself succeeds). Run it when nobody edits; the edit is simply repeated.
- A Postgres trigger with transition tables (`REFERENCING … TABLE`) cannot have a column list (`UPDATE OF …`): use a row trigger with `WHEN`, or a statement trigger that compares the tables.
- `pmUiTestKit` mocks `react-redux` and `WithSupabase` itself, and a later `jest.mock` of yours loses: override with `jest.doMock` + `require` AFTER importing the kit (see `__tests__/pm/cost`).
- `tsc` resolves `.web` first (`moduleSuffixes`), so `expo-audio` / `expo-file-system` get their WEB typings (e.g. `setAudioModeAsync` wants the full `AudioMode`, `File.copy` is missing): wrap such calls (`media/audioMode.ts`, `mediaFileStore.ts`).
- `expo-camera` and `react-native-vision-camera` 4.x must NOT both be installed: expo-camera pins CameraX 1.6.0, vision-camera needs 1.5.0-alpha03 -> Android crash `NoClassDefFoundError ... Camera2CameraInfoImpl` ("Exception in HostObject::get for prop 'CameraDevices'"). expo-camera was removed (2026-10-15).
- `react-native-video` 6.19 and `expo-audio` / `expo-video` (media3 1.9.0) must NOT be installed together: Android crash `NoSuchMethodError ... DefaultLoadControl.<init>` the moment a video starts (the app closes, the dev client shows its error screen). Video is played by `expo-video`.
- Vision Camera, expo-video and expo-audio are native code: a dev build (`expo run:android|ios`) is needed after installing or after a change of their plugin in `app.config.js`; Expo Go cannot run them.
- Android "clean": `cd android && ./gradlew clean` FAILS after a prebuild (CMake wants the codegen folders it just deleted: "add_subdirectory given source … codegen/jni … not an existing directory"). Clean with `rm -rf android/app/.cxx android/app/build android/build` (all git-ignored build output) and build again.
- `vendor_project_setting(project, key)` is TRUE unless the key is stored false (the Vendor switches); `vendor_project_setting_on(project, key)` is FALSE unless stored true (`multiProjectVendorInvoceNeeded`): pick the one that matches the default of the switch.
- The line of a vendor invoice / purchase order is frozen by a trigger (only qty / price / VAT %); `*_set_line_task` opens the gate with `set_config('app.<doc>_line_move', 'on', true)` for its own UPDATE only. A new document type that copies these RPCs copies the flag name too.
- A test that renders `PMTaskRowMenu` or `PMProjectTaskInputCRUD` and mocks `useStartVendorInvoice` must mock `useStartPurchaseOrder` too (both hooks need the Supabase / react-query providers). The Monitor01 table has the divider Plan | Fact at the left edge of its first Fact column (`FIRST_FACT_COLUMN`), not at a fixed column id.
- Jest cannot run `import()` ("dynamic import callback without --experimental-vm-modules"): a lazily loaded window is `React.lazy(() => Promise.resolve(require('…')))` (the project picker, so Skia is not loaded by the invoice form's tests).
- A `LANGUAGE sql` function is checked when it is created, so it cannot call a function that PART n+1 creates later (a plpgsql body is not). `monitor01_fresh_rows` (PART 25) is therefore REPLACED in PART 29 (subprojects) - the last definition in `start2_sql_code.sql` is the real one; change that copy.
- `sumForAccounting` means TWO things: on a document LINE (vendor / customer invoice, purchase order, product receipt) it is the TOTAL with VAT (= `sumForAccountingBeforeVAT` + `sumForAccountingVAT`); in the register, the turnover, the plan and the fact lines it is NET (the VAT is `vatForAccounting`). `sumForBudget` is NET everywhere. A new money report must use the VAT basis (`kit8/pm/vat/README.md`), never add the columns itself. The line trigger skips its calculation while `app.vat_backfill` is `on` (the backfill of start2 only).
- Drawer screens STAY MOUNTED after the first visit. A screen that redirects by itself on an auth event (`app/user/signin`: `router.replace(returnTo)` on SIGNED_IN) must check `navigation.isFocused()` first, or supabase-js re-sending SIGNED_IN (token refresh, tab back to front) throws the user from the project dashboard to `/user/userprofile`.
- `IconApp`, Skia and expo-modules log "An error occurred while requiring the '…' module" in Jest: noise, not a failure.
- `react-native-paper-dates` is GLOBALLY mocked for every test (`__mocks__/react-native-paper-dates.js`, mapped in `jest.config.js`): the real `DatePickerModal` / `DatePickerModalContent` never renders in Jest, so `useTheme()` (also mocked, `{colors:{}}`) never crashes on a missing MD3 token. A component that reads a NESTED theme field (e.g. `theme.colors.elevation.level3`, as `DateQuickPickModal.tsx` does) must still guard it (`theme.colors.elevation?.level3 ?? fallback`) - the real app has a full theme, but a NEW component under test may call the real `useTheme()` directly. Adding a piece of `react-native-paper-dates` your component uses (e.g. `DatePickerModalContent`) means adding it to the mock file too, with its own testIDs.

---

## 8. Working agreement with the owner

- **Every report ends with a last paragraph `UPDATE STEP-BY-STEP`**: numbered steps in the order to do them - which SQL file(s) to run in the Supabase SQL Editor (start1 then start2, start3 only if seeds changed), the `.env` lines, the Expo restart command, what to click to verify, what is NOT needed. Nothing after it. When nothing has to be run or edited, the paragraph is only `UPDATE STEP-BY-STEP: reload app`.
- **Every command the owner has to run goes in its OWN fenced ```bash block** (one command per block, no `$`, no output inside): the app shows a copy / Run button on such a block, like the copy buttons of Google. Never put a command inline inside a sentence. Inside UPDATE STEP-BY-STEP: the numbered step is one sentence, the command block follows it.
- The owner edits `.env` (tell the lines, do not edit). No commit unless asked (the owner uses `save_to_github.command`). No subagents unless asked.
- Say in a few words what you are doing during a long run. Reports are honest: what was tested, what was not, what is unknown (e.g. you cannot see the owner's Supabase or browsers).
- Code placement: fact code in `kit8/documents/fact/input`, Monitor01 in `kit8/pm/reports/monitor01`, vendor invoice in `kit8/documents/vendor/invoice`, a catalog in `kit8/catalog/<name>`. Write the tests and the README of a feature in the same round.
- Specifications often come as Google Docs / screenshots: read the doc again when the owner says so, answer questions in the doc's terms.
