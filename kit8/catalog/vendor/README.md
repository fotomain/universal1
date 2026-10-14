# Main vendor - `kit8/catalog/vendor`

Who a partner / a piece of equipment / a product (material) is normally bought from: `rowJSON.mainVendorGUID` (a partner) and `rowJSON.mainVendorContractGUID` (a contract of THAT vendor) in `partnerTable`, `equipmentTable` and `productTable`. Both are optional.

* **Partner item**: `MainVendorFields` in `PartnerEdit` (the contract select is disabled until a vendor is chosen and is cleared when the vendor changes); the partner card shows "Main vendor: Acme · S-1" (`MainVendorLine`).
* **Equipment list/item and Product (material) list/item**: the two columns `mainVendorColumns()` of their `ReusableTable` (the product item card shows every column).
* **Rules** (`mainVendorModel.ts` and the database guard `main_vendor_guard`): a contract needs its vendor and must be a contract of that vendor; a partner is not its own vendor; the vendor must be a partner.
* The vendor invoice window lists the vendors of the lines of a task from them (`documentation/PROJECT_STATE_WBS.html`).
