# kit8/permissions - who may do what (W1 PERMISSIONS)

Design: `documentation/PERMISSIONS_WBS.html` (sections 5-7). SQL: PART 46 (profiles, `perm_can`) and PART 47 (enforcement) of `kit8/sql/start`. Tests: Docker `tests/49`, `53`; Jest `__tests__/permissions`, `__tests__/sql/permissionsSql.test.ts`.

## The model in one paragraph
A user holds **profiles** (11, `project_permission_profile_catalog`): administrator of the organization, project manager, read only / sponsor / curator / investor, project member, task responsible, task manager, financial manager (plan), financial manager (fact). He gets them from: being the **owner** of a project (= project manager), the **members screen** (administrator), the **assignment table** `project_permission_profile_user_table` (rowOwnerGUID = project, or the organization = "may create projects"), and **RACI** (a person on a Time line: Responsible -> task responsible, Accountable / Consulted / Informed -> project member; `task_user_permission_table`, a trigger writes it). Several profiles ADD UP. Each profile has letters **C R U D** per table (`project_permission_profile_crud_table`, 135 tables, the owner's Google Sheet) and per screen (`..._uxui_table`); an organization may override a cell with its own row. The database is the law; the interface only hides or disables.

## The SQL functions (PART 46 / 47)
| function | use |
|---|---|
| `perm_can(table, 'C'\|'R'\|'U'\|'D', project, task)` | true when a profile gives the letter; no project = the profiles held anywhere in the active organization (catalogs) |
| `perm_require(...)` | the same, refusing with SQLSTATE 42501 `No permission: <table>, <letter>` |
| `perm_can_in(table, letter, project)` | the test inside RPCs (false for a NULL project, like the old owner test) |
| `perm_projects(table, letter)` / `perm_tasks(table, letter)` | the SET of projects / tasks the letter is held in: used by the policies as `col IN (SELECT ...)` = ONE evaluation per statement |
| `perm_my_matrix(project, task)` | what the interface needs in ONE call |
| `perm_field_check` + triggers `zz_perm_task_lock`, `zz_perm_line_lock` | the field locks: responsible = progress only; task manager = six disabled actions; financial manager (plan) cannot change the person / RACI item of a Time line; nobody below the project manager deletes himself from a Responsible line |

Enforcement keeps the **owner policies as the floor** (an owner can never lose his project) and adds `<table>_perm_select / _insert / _update / _delete` policies next to them. Catalogs: everybody reads, the administrator writes, the project manager inserts. A new table that is in no row of the matrix is "generic" (administrator CRUD, project manager RC, others R). A new write RPC must call `perm_can_in` / `perm_require` - Docker test 53 lists the ones that do not.

## Interface
- `usePermissions(projectGUID?, taskGUID?)` - `can(table, letter)`, `canUi(object, letter)`, `canCreateProject`, `isAdmin`, `profiles`. **Open until the answer is there** (no Supabase / tests / the first second): the database refuses what is not allowed. `useDocumentRights(headerTable)` gives `canChange / canDelete / canCreate` to the document forms (Post, Unpost, Delete).
- `ReusableTable` got `readOnly` and `deleteEnabled`; `PMProjectTaskInputCRUD` (the Finances lines) passes the letters of `task_line_table`.
- `AssignmentsEditor` - the assignment rows: **Project settings -> Members** (tab `TabMembers`, a saved project) and **Organization members -> May create projects**.
- `PermissionsScreen` (route `/user/permissions`, Drawer: System settings -> Permissions): **My permissions** (profiles + letters of the selected project) and **Matrix** (the administrator edits the cells of the ORGANIZATION; a cell set back to the delivered letters removes the own row).
- A refusal is worded for people by `permissionText.ts` (`ErrorModalWindow` calls it): "You have no permission to change in project_task_table. Locked: taskDescription".

## The matrix is data
`kit8/sql/permissions/permission_matrix.py` holds the CRUD matrix of the sheet and the interface matrix. After an edit: `python3 kit8/sql/permissions/build_permission_seed.py` rewrites the generated blocks of `start4` / `start5` PART 46; run `start4` (or `start5` to overwrite). `rewrite_owner_checks.py` and `guard_document_rpcs.py` are the one-time edits of the RPCs (they list the function -> table / letter map).

## Known limits
- Documents (invoices, orders, receipts, payment facts, time sheets) are visible to the whole organization as before; their header RPCs ask for the letter "anywhere", their lines for the project of each line.
- Catalogs are shared by all organizations (risk R3 of the plan): the administrator of ANY organization writes them.
- How a person becomes `permissionTaskManager` is not decided (Q27): the profile can be assigned by hand at project level; nothing derives it.
- The race test "Post while a permission changes" (E5) is not written; `bench_permissions.sh` measures the reads.
