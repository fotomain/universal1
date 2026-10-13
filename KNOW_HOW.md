# Universal 1 — Knowledge Base & Architecture Guide (KNOW_HOW)

This document serves as the primary system reference for AI coding agents (Claude Projects, Gemini, etc.) and developers working on the Universal 1 application.

---

## 1. Overview & Technology Stack

Universal 1 is a cross-platform ERP and Project Management application built on:
- **Client**: Expo (React Native) targeting Web, iOS, and Android.
- **State Management**: Redux Toolkit + Redux-Saga for side-effects and optimistic CRUD mutations, plus TanStack React Query for cached reads.
- **Backend / Database**: Supabase (PostgreSQL) with Realtime replication, Row-Level Security (RLS), and JSONB-based document storage.
- **Design System**: Flexible design system provider (`WithDesignSystem`) supporting native, Material Design 3 (`googlemd3web`), and dark mode.

---

## 2. Database Architecture & SQL Structure

All database scripts reside in `kit8/sql/start/`. The SQL is cleanly separated into DDL code and DML seed data:

### 2.1 `start_sql_code.sql`
- Contains all **DDL and database schema definitions**:
  - PostgreSQL extensions (`uuid-ossp`, `pgcrypto`).
  - Table schemas (`CREATE TABLE IF NOT EXISTS`).
  - Custom functions and stored procedures (e.g. `pm_rebuild_dependency_closure`, triggers for date recalculations, user calendar event sync).
  - Row Level Security (RLS) policies and role permissions (`GRANT`/`REVOKE`).
  - Supabase Realtime publication setup (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`).
  - Schema reload notification (`NOTIFY pgrst, 'reload schema'`).

### 2.2 `start_sql_data.sql`
- Contains all **authoritative seed and catalog data**:
  - Reference data: Countries, currencies, European Central Bank (ECB) exchange rates, roles, VAT rates, units of measurement.
  - Demo catalogs: Products, resource roles, price types, descriptors, budget items, and management calendars.
- **Upsert Semantics**:
  - All inserts use real upsert logic (`ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON", "orderInList" = EXCLUDED."orderInList", "updated_at" = now()`).
  - Running this script repeatedly is 100% idempotent and safe.
  - Seed rows are updated to the latest repository values; rows created by users remain untouched; nothing is deleted.

### 2.2b `start_sql_structure.sql` + `start_sql_insert.sql` / `delete_sql_structure.sql`
- `start_sql_structure.sql` is the STRUCTURE in ONE file (numbered PARTs; 17 = equipment, 18 = business units, 24 = fact input, 25 = Monitor01) and has **no seed rows**.
  **`start_sql_insert.sql`** (extracted from it, same order, same PART names) holds the seed rows: countries, currencies, ECB rates, catalogs, roles, calendars (and their days), units ... - plain `INSERT ... ON CONFLICT DO NOTHING`.
  Install = run `start_sql_structure.sql`, then `start_sql_insert.sql` (both idempotent). The backfills of data that already exists in a database (userTable from auth.users, project_user_settings_table,
  the timeline of posted days, the first fill of the Monitor01 queue, the project / task / organization migrations) stay in the structure file next to the table they repair.
- `delete_sql_structure.sql` is the opposite (it drops the tables with their seed rows); `kit8/docker/test_sql.sh` runs all three on Postgres 15: install twice (same objects, same row counts), the structure alone has 0 seed rows, delete leaves nothing, install again.
- A change of the structure goes into `start_sql_structure.sql` and `start_sql_code.sql` (DDL); a change of a seed goes into `start_sql_insert.sql` and `start_sql_data.sql` (upserts). `__tests__/catalog/equipment/equipmentSql.test.ts` checks that the equipment part is in all of them.

### 2.3 Universal Table Schema Convention
Almost all entity tables in Universal 1 adhere to the standardized schema:
```sql
CREATE TABLE IF NOT EXISTS public."<entityName>Table" (
  "rowGUID"       TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL DEFAULT 'empty',
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "orderInList"   INTEGER     NOT NULL DEFAULT 0,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- **`rowGUID`**: Unique identifier (UUID string).
- **`rowOwnerGUID`**: Partitioning key / tenant / project / entity owner.
- **`rowParentGUID`**: Hierarchy / grouping key (e.g. parent task or parent folder).
- **`orderInList`**: Custom ordering / manual sort rank.
- **`rowJSON`**: Document attributes and domain fields stored as JSONB.

---

## 3. UI Framework & Table Component System

### 3.1 `ReusableTable` (`kit8/ui/components/table/reusable/`)
The core data grid component used across catalog dashboards, task finance views, and management panels.
- **Optimistic CRUD**: Managed by `useReusableTableCrud`. Changes are reflected in local state instantly and dispatched via Redux-Saga (`createOne`, `updateOne`, `deleteOne`).
- **Column Header Context Menu ("Fill all lines")**:
  - Right-click (Web) or long-press (touch/mobile) on column headers opens `PMContextMenu`.
  - Item "Fill all lines" opens `ReusableTableFillColumnModal`.
  - For `catalog` columns: renders `SelectElementFromCatalog` to choose catalog elements.
  - For primitive columns: renders input with numeric or text keyboard.
  - Includes **Cancel** and **Fill** buttons to update all rows across the active scope.
- **Post Button Behavior**:
  - When `postDataNeeded` is enabled, the Post button appears only while unposted changes exist.
  - Once posted, the button becomes invisible until subsequent edits require reposting.

---

## 4. Project Management (PM) & Gantt Module

Located in `kit8/pm/`:
- **Task Hierarchy Tree (`PMProjectTasksTree`)**:
  - Renders project task WBS hierarchy with synchronized scrollbars.
  - **Posted Status Column**:
    - Precedes the task name column.
    - Icons:
      - *Unposted*: Empty space.
      - *Posted*: Green checkmark (`#16a34a`).
      - *Posted & Changed*: Dark orange checkmark (`#c2410c`).
    - Tooltips explain the state; accessible on mobile/touch devices on tap.
- **Project Actions Toolbar (`PMProjectActionsButton`)**:
  - Positioned on `PMRecentProjectsToolbar` right before the project settings icon.
  - Menu actions:
    1. **Post unposted tasks**: Posts all tasks with unposted changes.
    2. **Repost all tasks**: Force re-posts every task in the project.
    3. **Refresh the project**: Triggers a manual refresh of the project tree and realtime state.
- **Task Posting Logic (`useTaskPost` & `runTaskPost`)**:
  - Calculates movement records and updates task status.
  - If a task has no budget item selected across its lines, posting halts and opens `ErrorModalWindow` with an explicit error message instead of an ephemeral snackbar.

- **Task input switches** (`kit8/pm/model/taskInputScope.ts`): project settings → Finances → Budgets. With `projectExpenseBudgetNeeded` on: `projectTimeCostsNeeded` ("Time input needed") >
  `projectTimeOfPersonNeeded` / `projectTimeOfEquipmentNeeded`, `projectMaterialCostsNeeded`, `projectExpenseCostsNeeded`. Master off = as before. A tab that has lines is never hidden.
- **Equipment on a Time line**: `kit8/catalog/equipment` (a machine with its own Properties and Variants, the analog of the person); a Time line has `rowJSON.taskResourceKind` (`person` | `equipment`,
  empty = person) and, when the project offers both, the menu "Resource: Person | Equipment" before the resource. The hour of an equipment is costed by the rate of its resource role
  (`resourceRoleTypeTable.rowJSON.resourceKind`). The design: `recommendation/EQUIPMENT_TIME.html`.
- **Descriptor sides**: products, roles, persons and equipment share the descriptor tables; the list of the sides is `kit8/catalog/product/crud/descriptorSides.ts` (every dashboard hides the other three).
- **Row-aware catalog column** (`ReusableTable`): `catalogEntityNameOf(row)` + `catalogEntityNames` - one column whose catalog depends on the row (a person OR an equipment); "Fill all lines" fills only the rows of
  the column's own `catalogEntityName`.

---

## 5. Development Workflows & Conventions

### 5.1 Local Execution
```bash
# Start Web bundler
npm run web
# Or with cache clear
npx expo start --web -c
```

### 5.2 Running Tests
```bash
# Run Jest test suites
npm test
# Run specific test file
npm test -- reusableTableHeaderContextMenu.test.tsx
```

### 5.3 Git Sync Script
```bash
# Save progress to GitHub on a timestamped branch
./save_to_github.command
```
