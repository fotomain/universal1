# Activity genus

`managementActivityGenusTable` - the three activities of the cash flow statement (IAS 7), ONE level (a linear catalog, no folders):

```
operatingActivity   Core revenue generation and day-to-day OpEx (also the default bucket)      IAS 7.6, 7.14
investingActivity   Long-term assets, CapEx, acquisitions and disposals                          IAS 7.6, 7.16
financingActivity   Equity issues and buy-backs, loans drawn and repaid, lease principal, dividends   IAS 7.6, 7.17
```

rowGUID = the code · rowOwnerGUID `managementActivityGenusCatalog` · rowParentGUID `'empty'` · rowJSON `{ title, description, webIfrsName, d365foName, sapName }`
(`webIfrsName` = the Web + IFRS name with the IAS 7 paragraph, `d365foName` / `sapName` = the matching object in Dynamics 365 FO / SAP; indicative texts of `documentation/ACTIVITY_GENUS.html`).

## The key = activity × management genus

A **budget item** has an obligatory `rowJSON.budgetItemGenericKey` = `'<activity>.<management genus>'` (e.g. `investingActivity.materialGenus`) and a `rowJSON.direction`
(`inbound` | `outbound`). Only 14 of the 18 cells are allowed: operating and investing have all six management genus, financing only the two payments genus.

| | time | material | expense | revenue | inbound payment | outbound payment |
|---|---|---|---|---|---|---|
| operating | ✓ | ✓ | ✓ | ✓ | ✓ tax refund | ✓ tax paid |
| investing | ✓ capitalised labor | ✓ CapEx | ✓ capitalised costs | ✓ disposal proceeds | ✓ loan repaid to us, shares sold | ✓ loan granted, shares bought |
| financing | - | - | - | - | ✓ equity issue, borrowing | ✓ repayment, buy-back, lease, dividends |

- **The rule** is the SQL function `kit8_budget_item_key_matrix()` (start2_sql_code.sql PART 32) and `BUDGET_ITEM_KEY_MATRIX` (`kit8/catalog/budget/item/budgetItemKeyModel.ts`); a Jest test keeps the two equal.
  `budgetItemGenericKeyTable` (14 rows: `rowGUID` = the key, `rowJSON` `{ title, activityGenus, managementGenusItem, directionDefault, d365foName, sapName }`) carries the texts for the screens.
- **Direction**: the default is the direction of the key (costs outbound, revenue inbound, payments as named). Only an item marked `rowJSON.isCorrection` (credit note, refund) may go the other way.
- **The activity is chosen on the item, never derived from the genus**: interest and dividends are *policy items* (IAS 7 lets the company choose; `isPolicyItem`).
- **Old budget items** get `operatingActivity.<genus>` and the default direction (the trigger / the backfill of PART 32), so old projects stay unchanged.
- Both catalogs are **read only** for a signed-in user (SELECT policy only); the seed rows come from `start3_sql_insert_missing.sql` (3 activities, 14 keys, 36 possible budget items), `start5` refreshes them.

## Screen

Route `/catalog/management/activity_genus/list` (drawer: Catalogs > **Activity genus**, also in Budgets) → `ManagementActivityGenusCRUD.tsx`: two read-only `ReusableTable`s.
1. *Activities*: Activity · Code · Description · Web + IFRS · D365 FO · SAP · Keys · Budget items (count).
2. *Budget item keys*: Key · Code · Activity · Management genus · Direction · D365 FO · SAP · Budget items (count).

The budget items themselves (Activity, Direction, Correction, Web + IFRS, D365 FO, SAP, Policy columns) are edited in **Budget Items** (`kit8/catalog/budget/item`).

| File | What |
|---|---|
| `managementActivityGenusModel.ts` | table, route, the three codes, `managementActivityGenusTitle` / `ShortTitle` / `Rows` |
| `managementActivityGenusMetaData.ts` | SystemMetaData entry (spread into `kit8/redux/SystemMetaData.ts`) |
| `useManagementActivityGenusData.ts` | activity, key and budget item rows from redux (read + realtime) and the counts |
| `ManagementActivityGenusCRUD.tsx` | the screen |
| `../../budget/item/budgetItemKeyModel.ts` | the matrix, the key / direction checks, `budgetItemKeyPatch` (derived fields), the Activity options of a genus |
| `../../budget/item/budgetItemKeyMetaData.ts` | SystemMetaData entry of `budgetItemGenericKeyTable` |

SQL: `kit8/sql/start` start1_sql_tables.sql + start2_sql_code.sql **PART 32** (`create_activity_genus.sql`), seeds start3 / start5, drop in `delete_sql_structure.sql`.
Docker test: `kit8/docker/tests/91_activity_genus.sql` (`./test_fact_monitor01.sh 91`). Jest: `__tests__/catalog/budget/budgetItemKey.test.ts`, `__tests__/catalog/management/activityGenus*.test.ts(x)`.
Design: `documentation/ACTIVITY_GENUS.html` (matrix, ER waterfall, the tree of 36 possible budget items with the Web + IFRS / D365 FO / SAP columns).
