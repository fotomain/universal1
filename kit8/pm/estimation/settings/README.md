# Estimation dashboard - the last state per user and work place

The twin of `project_dashboard_user_settings_table` (see `kit8/pm/README.md`). SQL: PART 58, table `estimation_dashboard_user_settings_table`
(start1 = the table, start2 = RLS + the cleanup when a project is deleted, `delete_sql_structure.sql` part 1a-0000...).

| column | value |
|---|---|
| `rowOwnerGUID` | the estimation project (text) or the word `dashboard` = the row of the whole dashboard |
| `rowParentGUID` | the user (`app_user_guid()` as text) |
| `userWorkPlaceGUID` | the work place of the user (`kit8/providers/WithUserWorkPlace`; `empty` = no work place = the starting values) |
| `rowJSON.estimationSettings` | the settings below |

`UNIQUE (rowOwnerGUID, rowParentGUID, userWorkPlaceGUID)`. RLS: own rows only; a project row needs the right to READ that project (`estimation_project_access`).

## What is kept

* row `dashboard`: `lastProjectGUID` (the project opened last), `lastTab`, `tableColumnsWidth` (the norm books table; `normBooks` / `normBooksPicker`)
* row of a project: `lastDocumentGUID` (the estimate opened last), `tasksTreeWidth` (the splitter beside the estimate grid), `layout`, `currencyBasis`, `tableColumnsWidth`

## How it works (fast = zustand)

`estimationUserSettingsStore.ts`: memory (a zustand store, every read is instant) -> the device (AsyncStorage `estimationDashboardUserSettings:<user>:<work place>`, written at
every change: the dashboard opens where it was left even offline) -> the table (one upsert of the changed rows 0.8 s after the last change; `flushEstimationSettings` when the dashboard closes).
Start: the device copy first, then the rows (this work place + `empty`); `ready` turns true when the rows have answered or after 1.5 s. Rows that arrive later only ADD what is unknown
(the project on screen never changes under the user). A database without the table (SQL not run) keeps everything on the device (`tableMissing`).

* `estimationUserSettingsModel.ts` - types, normalizers (unknown keys / wrong values are dropped), rows <-> state, `patchState` (the same object when nothing changed)
* `estimationUserSettingsApi.ts` - read / upsert
* `useEstimationUserSettings.ts` - `useEstimationUserSettingsSession(client, userGUID)` (the dashboard calls it once), `useEstimationDashboardSettings`, `useEstimationProjectSettings(project)`,
  `useEstimationTableColumns(project | null, tableKey)` (`<ReusableTable resizeColumnWidth {...useEstimationTableColumns(null, 'normBooks')} />`)

Tests: `__tests__/pm/estimation/estimationUserSettings.test.ts`, Docker `kit8/docker/tests/110_dashboard_user_settings.sql`.
