# Currency exchange rates (`kit8/catalog/currency/exchange`)

Currencies → a currency card's **Rates** link (or **Rates** on the edit screen of a saved currency) →
`/currency/exchange/list?currencyGUID=…` · add / edit → `/currency/exchange/edit?currencyGUID=…` (`&rowGUID=…` for an existing rate).

## Setup

Run `kit8/sql/init/create_currency_exchange_rate_table.sql` in the Supabase SQL editor (non-destructive): creates
`public."currencyExchangeRateTable"` (`defTable.md` columns), checks, the **one rate per currency per day** unique index,
RLS (read: everybody, write: signed-in users) and adds the table to the `supabase_realtime` publication (REPLICA IDENTITY FULL).

## Rate types and conversion (D365 FO style)

* **Rate types**: `Default` (the daily rate: accounting) and `Budget` (the planned rate of a budget). A currency has one rate per **day and type**:
  `rowParentGUID` is the key - `2026-01-01` for a Default rate, `2026-01-01|Budget` for a Budget rate; `rowJSON.rateType` says the same (a missing one is
  Default). The unique index (`rowOwnerGUID`, `rowParentGUID`) is unchanged, so the refresh of the rates keeps working. SQL: `kit8/sql/init/update_currency_exchange_rate_types.sql`.
* **Ratio** = units of the currency for **1 unit of the base currency** (EUR, `EXPO_PUBLIC_CURRENCY_RATES_BASE`); the base has no rows (its ratio is 1).
* **Conversion** (`currencyConvert.ts`, pure, tested): `rate(from → to) = ratio(to) / ratio(from)` (triangulation through the base; the reverse pair is the inverse);
  `amount in to = amount in from × rate`, rounded to the decimals of `to`. Example (USD 1.08, GBP 0.85): 1000 USD → EUR 925.93 · 500 EUR → USD 540.00 · 1000 USD → GBP 787.04.
* **Which rate**: the one with the latest `startingDate` on or before the day (weekends / holidays use the last working day); a rate that starts later is never used.
  **Strict**: no rate of the asked type = nothing is converted and the reason is reported (`rateMissMessage`); a Budget lookup never falls back to a Default rate.
* Used by the task lines (`kit8/pm/view/task/finances/taskLineFx.ts`): the sums in the accounting and the budget currency of the project.
* **Data 2025 → 2026**: `kit8/sql/init/insert_currency_exchange_rates_2025_2026.sql`, generated from the Frankfurter API (ECB) by `node kit8/sql/tools/build_currency_rates_sql.js [from] [to]`.

## Data

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `currencyTable.rowGUID` (the currency) |
| `rowParentGUID` | the key: the day `'YYYY-MM-DD'` (Default) or `'YYYY-MM-DD\|Budget'` → unique (`rowOwnerGUID`, `rowParentGUID`) = one rate per currency, day and rate type |
| `orderInList` | `-(days since 1970-01-01)` → ascending = newest day first (no drag & drop: the order is the date) |
| `rowJSON` | `{ startingDate: 'YYYY-MM-DD' (the first 10 characters of rowParentGUID), currencyRatio: number > 0, rateType?: 'Default' \| 'Budget' }` |

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
