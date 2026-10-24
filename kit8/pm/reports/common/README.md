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

Tests: `__tests__/pm/reports/common`.
