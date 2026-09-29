# Currency catalog (`kit8/catalog/currency`)

Hamburger menu → **Catalogs** (accordion, compact sub-rows) → **Currencies** → `/currency/list` · add / edit → `/currency/edit` (`?rowGUID=…` for an existing one).

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

`currencyModel.ts` (table, entity, routes, validation, card mapping) · `CurrencyList.tsx` (web: `ListWebCardsComponent`, phones:
FlatList) · `CurrencyCard.tsx` · `CurrencyEdit.tsx` · `CurrencyRealtimeBadge.tsx` · routes `app/currency/list`, `app/currency/edit`.
Tests: `__tests__/catalog/currency/*`, `__tests__/redux/reusableRealtime.test.ts`.
