# Currency exchange rates (`kit8/catalog/currency/exchange`)

Currencies → a currency card's **Rates** link (or **Rates** on the edit screen of a saved currency) →
`/currency/exchange/list?currencyGUID=…` · add / edit → `/currency/exchange/edit?currencyGUID=…` (`&rowGUID=…` for an existing rate).

## Setup

Run `kit8/sql/init/create_currency_exchange_rate_table.sql` in the Supabase SQL editor (non-destructive): creates
`public."currencyExchangeRateTable"` (`defTable.md` columns), checks, the **one rate per currency per day** unique index,
RLS (read: everybody, write: signed-in users) and adds the table to the `supabase_realtime` publication (REPLICA IDENTITY FULL).

## Data

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `currencyTable.rowGUID` (the currency) |
| `rowParentGUID` | the day entered by the user, `'YYYY-MM-DD'` → unique (`rowOwnerGUID`, `rowParentGUID`) |
| `orderInList` | `-(days since 1970-01-01)` → ascending = newest day first (no drag & drop: the order is the date) |
| `rowJSON` | `{ startingDate: 'YYYY-MM-DD' (= rowParentGUID), currencyRatio: number > 0 }` |

React: `export const currencyExchangeRateTable = "currencyExchangeRateTable"` (`currencyExchangeModel.ts`), redux entity
`currencyExchangeRateReusable` (`kit8/redux/SystemMetaData.ts` → `reusableCrudSlice` + `reusableRootSaga`).

## Auto refresh, scoped to one currency

`exchangeReadParams(currencyGUID)` = `{ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID } }` is used by
the list, the edit screen and the realtime subscription. `match`:

* `readAll` → `.match(match)` (server side: only this currency's rates),
* `realtimeWorker` → `scopeRealtimeChange` (changes of other currencies are ignored; a row moved out is removed),
* `ListWebCardsComponent` → rows of another scope are not rendered (e.g. the previous currency until the new read ends).

`useRealtimeEntity` registers every mounted user; the most recently mounted scope drives the channel and the catch-up read,
so opening the rates of another currency re-subscribes, and the list + edit of the same currency share one channel.

## Edit screen

* Starting date `YYYY-MM-DD` with **− 1 day / Today / + 1 day**; a second rate on the same day is refused with a link to
  **open the rate of that day** (the SQL unique index also refuses it; the saga shows a snackbar for server errors).
* Changing the date of a saved rate updates `rowParentGUID` and `orderInList` too (`updateOne({ …, columns: { rowParentGUID } })`).
* Another window changed the rate: clean form → new values; unsaved edits → **Reload / Keep mine**; deleted → shown, saving blocked.

## Files

`currencyExchangeModel.ts` (table, entity, routes, dates, validation, card mapping) · `CurrencyExchangeList.tsx` (web:
`ListWebCardsComponent` with `reorderEnabled={false}`, phones: FlatList) · `CurrencyRateCard.tsx` (day, ratio, ▲ / ▼ % against the
previous rate) · `CurrencyExchangeEdit.tsx` · routes `app/currency/exchange/list`, `app/currency/exchange/edit`.
Tests: `__tests__/catalog/currency/exchange/*`.
