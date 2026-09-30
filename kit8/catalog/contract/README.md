# Contract catalog (`kit8/catalog/contract`)

Embedded contract subsystem attached to **Person** and **Partner** records. Contracts are accessed exclusively through `PersonEdit` and `PartnerEdit` when viewing/editing a saved record (`rowGUID`).

## Data Model

Follows `kit8/sql/defTable.md`:

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `personTable.rowGUID` or `partnerTable.rowGUID` |
| `rowParentGUID` | `'person'` or `'partner'` (matches `contractPartyType`) |
| `orderInList` | `-(days since 1970-01-01)` of `contractStartDate` (newest first) |
| `rowJSON` | `{ contractPartyType, contractNumber, contractTitle, contractType, contractStatus, contractSignedDate, contractStartDate, contractFinishDate, contractPaymentsPeriod, contractCurrency, contractSumBeforeVAT, contractVATRate, contractVAT, contractTotal, notes }` |

## Payment Periods

`CONTRACT_PERIODS`:
* `OneTime`
* `Day`
* `Week`
* `Month`
* `Quarter`
* `Year`

## Calculations

* `contractVAT = round(contractSumBeforeVAT * contractVATRate / 100, decimalDigits)`
* `contractTotal = round(contractSumBeforeVAT + contractVAT, decimalDigits)`
* For person / employment contracts, VAT rate is 0 / hidden.

## Components

* `ContractList`: Embedded realtime list scoped to `{ rowOwnerGUID: ownerGUID }`.
* `ContractCard`: Visual summary card with status badge, dates, period amounts.
* `ContractEdit`: Modal dialog for creating and updating contract records with live totals calculation.
