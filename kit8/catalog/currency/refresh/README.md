# Currency rates refresh (`kit8/catalog/currency/refresh`)

Currencies list: **Refresh rates** (all active currencies) and the refresh icon on every line (that currency).
`refreshCurrencyRatio` reads the last months from the [Frankfurter API v2](https://frankfurter.dev/javascript/) (no key, plain `fetch`) and adds the days that have **no rate yet** to `currencyExchangeRateTable`. Existing rates are never changed.

* `currencyRatio` = units of the currency for 1 base currency. `rowJSON` also gets `rateSource: 'frankfurter'`, `rateBase`.
* Rates are the blend of all providers (about 250 currencies). `EXPO_PUBLIC_CURRENCY_RATES_PROVIDERS=ECB` pins the
  ECB reference rates only (~30 currencies, working days only).
* A currency the service has no rates for is reported and left alone.
* The base currency itself is skipped (its ratio is always 1).
* The service answer of a day is kept in memory (no second call for the same range on the same day).
* The user must be signed in (RLS: only signed-in users write rates).

`.env`: `EXPO_PUBLIC_CURRENCY_RATES_API_URL` (https://api.frankfurter.dev/v2) · `EXPO_PUBLIC_CURRENCY_RATES_PROVIDERS` (empty) · `EXPO_PUBLIC_CURRENCY_RATES_BASE` (EUR) ·
`EXPO_PUBLIC_CURRENCY_RATES_MONTHS` (2). Restart the dev server after changing them.

Files: `refreshCurrencyRatio.ts` (logic) · `frankfurterApi.ts` · `currencyRefreshConfig.ts` · `useRefreshCurrencyRatio.ts` (UI hook).
Tests: `__tests__/catalog/currency/refresh`.


## Upload all data from a date (button on every currency card)

`uploadAllDataFromDate.ts` + `CurrencyUploadFromDateModal.tsx` (a `DateInputApp` and Upload). The cloud icon on a card asks for a date; Upload adds **every missing day from that date up to today**
(Default rate type) for **all active currencies of the catalog** (all crosses; the card's own currency too even when inactive), against the base currency, asked from the service in pieces of 92 days.
Days that exist are never changed. The other ratios (any pair) are made when a sum is converted: `ratio(to) / ratio(from)` (`exchange/currencyConvert.ts`). Rows quoted against another base
(for instance the SQL rates, which are against EUR, while `EXPO_PUBLIC_CURRENCY_RATES_BASE=USD`) are re-based on the day by the rate book, so changing the base never makes rates useless.
