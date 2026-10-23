# Partner catalog (`kit8/catalog/partner`)

Hamburger menu → **Catalogs** → **Partners** → `/catalog/partner/list` · add / edit → `/catalog/partner/edit` (`?rowGUID=…` for an existing partner).

## Setup

Run `kit8/sql/init/create_partner_table.sql` in the Supabase SQL editor: creates `public."partnerTable"`, RLS policies (authenticated only), unique indexes on `vatNo` and `registrationNo`, and adds the table to `supabase_realtime` publication.

## Data

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `'partnerCatalog'` (shared catalog, `PARTNER_CATALOG_OWNER`) |
| `rowParentGUID` | `'empty'` |
| `orderInList` | list order (drag & drop on web) |
| `rowJSON` | `{ partnerTitle, partnerLegalName, partnerKind, isActive, partnerIsSupplier, partnerIsCustomer, legalData, supplierData, customerData }` |

React: `export const partnersTable = "partnerTable"` (`partnerModel.ts`), redux entity `partnerReusable` (`kit8/redux/SystemMetaData.ts`).

## Features

* **Multi-role support**: A partner can be a Supplier, a Customer, or both.
* **Shared Legal Data**: Reg No, VAT No, and IBAN are shared between supplier/customer roles.
* **Embedded Contracts**: Automatically displays contracts associated with this partner.
* **Deletion Protection**: A partner with associated contracts cannot be hard deleted — users are prompted to set `isActive = false` instead.


## Payment terms: `paymentTimelineShiftDays` (optional)
Next to `paymentTermsDays` in `supplierData` and `customerData`: the days after the start / end of a task a payment to this supplier (from this customer) is planned - the project manager's value for his forecast, not the legal term. Empty = not set (0 is a value). The contract of the payment wins; this is the second step of the default (contract -> partner -> 0). See `kit8/pm/view/task/payments/README.md`.
