# Common layer of the money reports (`kit8/pm/reports/common`)

The pieces every live report needs. Written for **Monitor07** (partner balance, `../partner_balance`); Monitor01-03 have the same loops inline and can move to these later (they were NOT changed).

| File | What it is |
|---|---|
| `useReportData.ts` | one hook: `load(client)` on every change of `deps`; while `watch`, a Realtime channel on `realtimeTable` re-reads (debounced 400 ms); a reconnect reads again; `enabled` false = no read. Returns `{ data, isLoading, error, live, changedAt, reload }` |
| `reportFilterModel.ts` | a filter bar as **data**: descriptors `date` · `select` (with `clears`: the ids emptied when this one changes) · `amount` · `period`; `reportFilterErrors`, `applyFilterChange` |
| `ReportFilterBar.tsx` | ONE scrolling row built from descriptors (DateInputApp / SelectItemFromListApp clearable / TextInputApp), 150 ms debounce, a red field for an unreadable date / amount |
| `ReportAgeBadge.tsx` | "Live · changed 5 s ago" / "Offline: the last data" / "Auto refresh is off: a snapshot" |
| `reportFormat.ts` | `formatReportMoney` (`1 234.50`), `parseReportAmount` (`-12,5` -> -12.5, `''` -> no filter, junk -> `'invalid'`) |
| `useStoredChoice.ts` | a per-user choice (the switches, the sort) in AsyncStorage; a failure only means "not remembered" |

| `useReportOrganizationScope.ts` | the **organization cut** of the reports (2026-11-20): a user of TWO OR MORE organizations picks the active one with the `OrganizationFilter` in the bar (Monitor01 standalone, 02, 03, 07, 08); `scoped` / `ready` / `projectGUIDs` (the projects of the active organization, read from `project_table.rowParentGUID`) / `filter(rows, projectOf)`; not scoped (one organization) = the same array, no extra read. Monitor01, 02, 03 and 08 cut their rows with it; Monitor07's SQL (`partner_balance_report`) already reads the active organization, so it only re-reads (the active organization is in its deps) and clears the choices of the other organization |

Tests: `__tests__/pm/reports/common` (`reportOrganizationScope.test.tsx`).
