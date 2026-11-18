# kit8/catalog/organization/consolidation - the consolidation settings of an organization

Design: `documentation/CONSOLIDATION_WBS.html`. SQL: PART 52 (`kit8/sql/start`, Docker test `kit8/docker/tests/100_consolidation.sql`).

The money of ALL projects of an organization is added in ONE currency. Each project keeps its own currencies (editable per project); the database converts every movement
of the register / ledgers into the consolidation currency (`sumForConsolidation`, the twin of `sumForBudget`) and the reports show it. It is never on a document or a task line.

| key of `organizationTable.rowJSON` (top level, NOT `defaultProjectSettings`) | meaning |
|---|---|
| `currencyForConsolidation` | **obligatory** ISO code; the form has no Clear, the database refuses an empty / malformed code; a missing key = the old value (a form that does not know the key never drops it); a new / old organization gets a default (budget currency of the default project settings, else `baseCurrency`, else EUR) |
| `exchangeRateTypeForConsolidation` | rate type of the conversion, default `Default` |
| `consolidationIncludePurchaseVAT` | purchase side: ON = net + all VAT, OFF = net + the VAT that is cost (Cost basis) |
| `consolidationIncludeSaleVAT` | sale side: ON = net + VAT, OFF = net |
| `consolidationState` | `ready` / `recalculating` / `gaps` - written by the database only |

- `consolidationModel.ts` - pure rules (settings of a row, change detection, the words, `consolidationAmount` = the TS twin of the SQL `consolidation_amount`).
- `useConsolidationStatus.ts` - `consolidation_status()` + "Refresh now" (`consolidation_refresh_now()`, works without pg_cron).
- `OrganizationConsolidationSection.tsx` - the tab **Consolidation** of Organization edit (administrator only; the VAT switches act at read time: no recalculation).
- A change of the currency or the rate type asks an approval window (Yes = the database recalculates every project, Cancel = nothing).

Tests: `__tests__/catalog/organization/consolidation`.
