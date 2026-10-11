# Currency catalog (`kit8/catalog/currency`)

Hamburger menu → **Catalogs** (accordion, compact sub-rows) → **Currencies** → `/currency/list` · add / edit → `/currency/edit` (`?rowGUID=…` for an existing one).

**Exchange rates** of a currency: the **Rates** link on its card / on its edit screen (saved currencies) →
`/currency/exchange/list?currencyGUID=…` — see [`exchange/README.md`](exchange/README.md).

## Setup

Run `kit8/sql/init/create_currency_table.sql` in the Supabase SQL editor (non-destructive): creates `public."currencyTable"`
(`defTable.md` columns), RLS (read: everybody, write: signed-in users), a unique index on the ISO code, adds the table to the
`supabase_realtime` publication (REPLICA IDENTITY FULL) and seeds EUR, USD, GBP, CHF, JPY, CNY, SEK, NOK, DKK, PLN.

## Data

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `'currencyCatalog'` (shared catalog, `CURRENCY_CATALOG_OWNER`) |
| `rowParentGUID` | `'empty'` |
| `orderInList` | list order (drag & drop on web) |
| `rowJSON` | `{ currencyCode, currencyName, currencySymbol, currencyNumericCode, decimalDigits, isActive }` |

React: `export const currenciesTable = "currencyTable"` (`currencyModel.ts`), redux entity `currencyReusable`
(`kit8/redux/SystemMetaData.ts` → `reusableCrudSlice` + `reusableRootSaga`).

## Auto refresh (several browsers / devices)

```
Supabase postgres_changes ─► createSupabaseTableChannel (redux-saga eventChannel)
      INSERT / UPDATE / DELETE     └─► reusableRootSaga realtimeWorker ─► applyRealtimeChange (reusableCrudSlice)
      SUBSCRIBED (connect / reconnect) ─► catch-up readData (nothing is lost while offline)
```

* `useRealtimeEntity(entityKey, { readParams })` starts it while a screen needs it (ref-counted: list + edit share one channel)
  and returns the status shown by `CurrencyRealtimeBadge` (Live / Connecting… / Offline - retrying).
* Any reusable entity gets it for free: `ListWebCardsComponent realtime` or `useRealtimeEntity(...)`.
* Edit screen: a change from another window updates a clean form; with unsaved edits a banner offers **Reload / Keep mine**;
  a deletion elsewhere is shown and saving is blocked.

## Files

`currencyModel.ts` (table, entity, routes, validation) · `CurrencyList.tsx` (a `ReusableTable` on every platform: one row per currency as a PAIR
`BASE/CODE` with all its ratios - Default and Budget, the inverse ratios and their dates, the number of rates; row menu: Edit, Rates, Refresh rates,
Upload all data from a date) · `currencyTableColumns.tsx` (the columns) · `currencyPairs.ts` (pure: pair labels, inverse, latest ratios) ·
`useCurrencyPairRatios.ts` (one small request per currency: its newest rate rows + their count) · `CurrencyCard.tsx` (the card of the old list, kept) ·
`CurrencyEdit.tsx` · `CurrencyRealtimeBadge.tsx` · routes `app/currency/list`, `app/currency/edit`.
Tests: `__tests__/catalog/currency/*`, `__tests__/redux/reusableRealtime.test.ts`.
