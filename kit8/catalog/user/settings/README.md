# User settings (userSettingsTable)

How the interface looks for ONE user on ONE kind of device, common for all his work places. Plan, decisions and what is not done: `documentation/USER_SETTINGS_TABLE_WBS.html`.

| Piece | File |
|---|---|
| Table, column `rowFolderGUID` of the universal schema | `kit8/sql/start` PART 59 (start1 table, start2 policies / RPCs), Docker `tests/111` |
| Model: types, defaults (Rule 1), normalizers, expiry rule | `userSettingsModel.ts` |
| Device key (desktop / phone / tablet + OS) | `deviceKey.ts` |
| SystemMetaData entity `userSetting` (Realtime, list of the user's rows) | `userSettingsMetaData.ts` |
| RPC calls | `userSettingsApi.ts` |
| redux ↔ row sync, `lastUsedAt` touch, sign-out reset | `UserSettingsHost.tsx` (mounted in `app/_layout.tsx`), `userSettingsSyncCore.ts` |
| Rows + actions for the screen (Copy from my other device, Reset) | `useUserSettings.ts` |
| Background saga `deleteNotUsedUserSettings` (a month unused) | `kit8/redux/deleteNotUsedUserSettings.ts`, run by `storePrepared.ts` |
| Screen `/settings` (tabs + search) | `kit8/ui/settings` |
| Fonts (registry, files, Paper mapping, loader, `useThemeFont`) | `kit8/ui/fonts`, files in `assets/fonts` + `public/fonts` |
| Expo UI theme on `@expo/ui` | `kit8/ui/expoui/ExpoUI.tsx` |
| Fonts / cell background of a dashboard table | `ReusableTable` prop `dashboard` (`tableStyleContext.ts`) |

Rules
- The row of the user: `rowOwnerGUID` = `app_user_guid()`, `rowParentGUID` = `desktop | phone | tablet`, `rowFolderGUID` = `macos | windows | android | ios | ipados | linux | other`; unique key = the three. RLS: own rows only.
- `rowJSON = { lastUsedAt, uxuiState }`. `uxuiState` = the preferences of the redux slice `uxuiState` (design system, dark mode, icons, FAB animation, bottom tabs, ask before delete, play / record video settings) + `themeSettings` (font name / size, per-element fonts, the colors the user changed, FAB color) + `extendedSettings` (`fontForEstimationDashboardHeader`, `fontForEstimationDashboardDataCell`, `estimationDashboardTable.cellBackground`, and the same three for the Project dashboard). Unknown keys of a newer app are kept.
- Rule 1: the default design system is `expo` (Expo UI on `@expo/ui`) on Apple (ios, ipados, macos), `paper` elsewhere. It is the first value of a state that has none; a persisted choice wins.
- Signed in: the row of this device is read (+ Realtime), applied to the slice, made from the local state when missing, every change is written back after 0.8 s; `lastUsedAt` is touched once a day; a row not used for 31 days is deleted by the saga (never the row of this device). Guest: the local (redux-persist) state only. Sign out: the defaults of the device again.
- A selector of the settings returns a STORED reference (`selectThemeSettings`, `selectExtendedSettings`), never a new object per call.
- San Francisco / New York may NOT be shipped as files: `system` asks the device (`system-ui`). Open fonts in `assets/fonts` (Roboto Apache 2.0, Inter and Selawik SIL OFL, licenses next to them).
- A new key of `uxuiState` that must be saved: add it to `UxuiSettingsJSON`, `normalizeUxuiSettings`, `extractUxuiSettings` (`userSettingsSyncCore.ts`) and the `applyUserSettings` reducer.

Tests: `__tests__/catalog/user/settings`, `__tests__/ui/fonts`, `__tests__/sql/userSettingsSql.test.ts`, Docker `tests/111_user_settings.sql`.
