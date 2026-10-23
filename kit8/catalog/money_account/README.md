# Money accounts - `kit8/catalog/money_account`

`moneyAccountTable` - the bank accounts and cash desks the payment facts (`kit8/documents/payment/fact`) move money on. A plain def-table catalog: rowOwnerGUID `moneyAccountCatalog` · **rowParentGUID = the folder = the GUID of a legal entity (`legalEntityTable`) or `'empty'`** · rowJSON `{ moneyAccountTitle, moneyAccountKind ('bank' | 'cash'), moneyAccountCurrency (ISO), moneyAccountNumber, moneyAccountBank, moneyAccountOpeningDate, moneyAccountOpeningBalance, isActive }`. SQL: PART 38 (`start1_sql_tables.sql` + `start2_sql_code.sql`). Design: `documentation/PAYMENTS_FACT_WBS.html`.

* Route `/catalog/money/account` (Drawer: **Catalogs → Money accounts**) → `MoneyAccountCRUD.tsx`: a `ReusableTable` with CRUD and the folders tree (legal entities that have an account; the button shows all), and under it the **rests** of the account picked (`MoneyAccountRests.tsx`: what it holds now per kind and currency, the days, the button **Refresh rests**).
* **Rest of an account on a day** = its opening balance + all the posted movements up to that day (`cash_account_ledger_rests`, rebuilt by the database, never typed; `restOnDay` / `latestRests` in `moneyAccountModel.ts`). A Post before the opening date is refused.
* Once the account has posted movements its **currency, opening date and opening balance cannot change**; an account a payment fact uses is **not deleted** (set `isActive` false); the currency is needed for Post.

| File | What |
|---|---|
| `moneyAccountModel.ts` | table, route, titles, folders, checks, the rests (`parseRests`, `restOnDay`, `latestRests`) |
| `moneyAccountMetaData.ts` | SystemMetaData entry |
| `useMoneyAccountData.ts` | rows + legal entities from redux (read + realtime) |
| `MoneyAccountCRUD.tsx` · `MoneyAccountRests.tsx` | the screens |

Tests: `__tests__/catalog/money_account`, Docker `./test_fact_monitor01.sh 96`.
