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


## Payment plan keys (optional, `contractPaymentModel.ts`)
For the payment plan of a task (`kit8/pm/view/task/payments`), on the contract of a **partner** and of a **person**; kept by `normalizeContract`, a key that is empty is not written:
- `paymentTimelineShiftDays` - days after the start / end of a task this contract pays (>= 0; 0 is a value): the default shift of a payment of this contract.
- `paymentBudgetItemOutbound` / `paymentBudgetItemInbound` - the budget item of the **payments genus** of a payment TO / FROM the payee. A person is only paid (outbound); a partner by its role flags (`supplierRole` -> outbound, `customerRole` -> inbound; no flag = both). The payment takes the item from its contract and the user can change it on the payment line.
