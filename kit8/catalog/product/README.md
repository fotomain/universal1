# Product catalog

Built from the Google Sheet **"W1 V3 ER DESCRIPTORS PLAN"** (product type → product → **Properties** +
**Variants**, both built on **Descriptors**). This is the product side; the resource-role side of the sheet
(resourceRoleTypeTable, resourceRoleTable, rolePriceTable) is `kit8/catalog/resourcerole` and shares the descriptor tables
(see **Shared with the resource roles** below). The finance lines of a task (`task_line_table`) are built: `kit8/pm/view/task/finances`.

## Run it

1. Supabase SQL editor: run `kit8/sql/init/create_product_tables.sql` (18 tables, rules, RLS for signed-in users,
   realtime, demo data: the sheet rows + 100 more products = 106 products in 11 types, 185 variants, 385 prices,
   332 barcodes). Idempotent; `delete_product_tables.sql` removes it again.
2. App: drawer → **Products** (`/catalog/product/dashboard`). Sign in first (RLS: authenticated only).

## Folders

| Path | What |
|---|---|
| `productModel.ts` | the 18 tables (Supabase table, redux entity, purpose, new-row rowJSON), fixed lists, row shapes |
| `productMetaData.ts` | SystemMetaData entries (spread into `kit8/redux/SystemMetaData.ts`) |
| `crud/productCatalogTools.ts` | rules: variant owner (R6), descriptorKey + title (R9/R10), generate variants, valid price (R13), GTIN / next EAN-13 |
| `crud/productValidation.ts` | the Checks report: rules R1–R13 + barcode check digits, with fixes |
| `crud/productLabels.ts` | titles and pick lists (folder paths, "Type · Smartphone", variant labels …) |
| `dashboard/ProductDashboardCRUD.tsx` | the screen: Overview, Product card, 18 CRUD tables (ReusableTable all-rows mode) |
| `dashboard/productDashboardTables.tsx` | columns, filters and row commands of every table |
| `dashboard/ProductsWithTree.tsx` | tab **Products & folders**: the folders tree (FolderTreeReusable) beside the Products table; pick a folder, drag products onto folders, folder CRUD |
| `tree/` | `useProductFolderTree` (nodes + CRUD saved to productFolderTable), `ProductFolderTree` (stand-alone tree), `productFolderTreeActions` (folder delete keeps its products: they get no folder) |
| `dashboard/ProductDashboardOverview.tsx` | numbers, products per type / folder, Checks with fixes |
| `dashboard/GenerateVariantsWindow.tsx` | cartesian product of descriptor values → variants + variant values |
| `dashboard/DescriptorValueCell.tsx` | property value input by the descriptor's value type |
| `dashboard/useProductCatalogData.ts` | all tables from redux, read + realtime |
| `card/ProductCardView.tsx` | one product: properties, variants with today's prices, barcodes, packs, series |

**Back arrow**: a table opened from a row menu (Prices, Barcodes, Property values, Variant values, Values, Plan lines ...) or from the Overview / Product card shows a
back arrow left of its title; it returns to where the user came from and marks the row (`focusRowGUID`). In **Products & folders** the picked folder is kept.

## Model

| Table | rowOwnerGUID | rowParentGUID |
|---|---|---|
| valueAddedTaxTable, measureUnitTable, descriptorGenusTable, descriptorModeTable, productTypeTable, productFolderTable, priceTypeTable | `<name>Catalog` | 'empty' (folder: parent folder) |
| descriptorValueTable | descriptor | — |
| descriptorDestinationTable (set) | product type | mode (property / variant) |
| descriptorPlanTable (set line) | set | descriptor |
| productTable | product type | folder |
| propertyValueTable | product | plan line (property set) |
| variantTable | type (perType) or product (perProduct) | — |
| variantValueTable | variant | plan line (variant set) |
| productPackageTable | type or product | unit |
| productSeriesTable | product type | — |
| productBarcodeTable | product | variant or 'empty' |
| productPriceTable | product | variant or 'empty' (= all variants) |

SQL enforces what an index / check can (one set per type + mode, one value per owner + line, unique descriptorKey per
owner, unique barcode / SKU, one price per product + variant + type + day, fixed lists). Everything else is in the
dashboard **Checks** panel. No foreign keys: owners are polymorphic and Undo of a delete re-creates the row.

## Tests

`__tests__/catalog/product` (tools, validation, dashboard + `productsWithTree` on the SQL seed), `__tests__/ui/table` (ReusableTable), `__tests__/ui/tree` (folder tree).
The seed fixture `__tests__/catalog/product/productSeed.json` is the data of `create_product_tables.sql`.

## VAT rates

`valueAddedTaxTable` (owner `valueAddedTaxCatalog`) holds the rates; `rowJSON`: `vatTableTitle`, `vatTablePercent`.
Seed: 21 / 18 / 15 / 12 / 10 / 5 / 0 % (GUIDs `vat_21` ... `vat_0`).

- `productTypeTable.rowJSON.productVATDefaultRate` - rowGUID of the default rate of the products of the type.
- `productTable.rowJSON.productVATRate` - own rate of a product; `null` = use the type default.
- `vatRateOfProduct(data, product)` (`crud/productCatalogTools.ts`) resolves `productVATRate ?? type.productVATDefaultRate`.
- Rule R1 reports a rate GUID that does not exist.

## Product card in a modal (`card/ProductItemEditModalCard.tsx`)

"Products & folders": right-click a product (or ⋮) -> **Edit** opens `ProductItemEditModalCard` through the table's `EditRowModalCard` prop
(see `kit8/ui/components/table/reusable/README.md`). Tabs: **Main** (the editable columns of the Products table as a form) · **Prices**
(`productPriceTable` of the product) · **Variants** (`variantTable` of `variantOwnerOfProduct`: its type or the product itself) · **Properties**
(`propertyValueTable`). The three tabs are ReusableTables built from the dashboard column definitions (`buildDashboardTables`), filtered by owner.

SQL `kit8/sql/init/update_product_vat.sql`: every product type gets `productVATDefaultRate = 'vat_21'` and the products lose their own
`productVATRate` (= all products 21 %).

The card follows the active design system: its controls are the app's own components (`TextInputApp`, `SwitchApp`, `SelectorFromApp`, `SegmentButtonsApp`
for the tabs, `ButtonApp`, `TextApp`), and the window (corners, border, shadow, header band, backdrop) comes from `productModalLook(system)`.
Text fields save ~0.6 s after typing stops and when the card closes.

## Units

ONE units catalog, `measureUnitTable` (owner `measureUnitCatalog`, rowJSON `{ title, code }`). A product has exactly two unit fields, both chosen from it:

- `productTable.rowJSON.measureUnitForInventory` - the unit it is counted and stocked in.
- `productTable.rowJSON.measureUnitDefault` - the unit it is offered, ordered and reported in; it may be the same unit.

Both are required: the Products table and the card offer no "none", a new product starts with `unit_pcs` / `unit_pcs`, SQL has the check
`productTable_units_chk` (NOT VALID, so an older row is only checked when it changes), and rule R1 of the Checks panel reports a product with a
missing or unknown unit. `productTypeTable.rowJSON.baseUnit` and the unit of a pack are also rows of `measureUnitTable`.
An existing database: run `kit8/sql/init/update_product_units.sql` (fills both fields from the old `unit`, renames / drops the tables of the short-lived
two-catalog version) and then `create_product_tables.sql`. The card's Main tab has a **Units** section with both fields.

## Prices per unit, packages

- `productPriceTable.rowJSON.measureUnit` (rowGUID of `measureUnitTable`, required, default `unit_pcs`): the price is the price of ONE unit of it
  (1 pcs, 1 kg ...). Prices table column "Per 1 unit"; "one price per day" is per product + variant + price list + unit; rule R1 reports a price
  without / with an unknown unit. `currentPrice(..., measureUnit?)` filters by unit, `currentPriceOfProduct` prefers the product's default unit,
  then its unit for inventory, then any (the "price now" column and the card show `12.00 EUR / pcs`).
- `productPackagingTable` is now `productPackageTable` (entity `productPackageReusable`, key `productPackage`).
- SQL for an existing database, in this order: `rename_product_package_table.sql` (the rename) -> `update_prices.sql` (every current price becomes the
  price of 1 `unit_pcs`, the index and check) -> `create_product_tables.sql` -> `create_prices_for_all_products_and_variants.sql` (creates the missing
  prices: every product and every variant in every product price list, for 1 `unit_pcs`; the amount is copied from the product's own price, else 0.00).
  On the seed it would create ~3100 prices (3 500 rows in all): the dashboard reads each table in ONE request of 1000 rows (`PRODUCT_READ_PARAMS`,
  Supabase returns at most 1000), so set `v_price_types` in the script to fewer price lists (even `pt_retail` alone gives ~1050 rows) - the script prints
  a WARNING above 1000 rows.

## Shared with the resource roles

The descriptor tables (`descriptorGenusTable`, `descriptorValueTable`, `descriptorModeTable`, `priceTypeTable`, `measureUnitTable`,
`valueAddedTaxTable`) are used by `kit8/catalog/resourcerole` as they are. Five tables hold the rows of both sides - the owner tells the side:
`descriptorDestinationTable`, `descriptorPlanTable`, `propertyValueTable`, `variantTable`, `variantValueTable`
(`crud/catalogSides.ts`: `sideOf`, `sideOwnedRows`).

- `useProductCatalogData` also reads the role types and roles and returns `data` WITHOUT the role-owned rows (so the Checks and the pick lists see
  products only) and `roleOwned` (the rowGUIDs, which `ProductDashboardCRUD` hides in the five tables, as they read the whole entity).
- A row whose owner is not (yet) a type / product - just added in a table - stays visible on both sides.
- The validation (`crud/productValidation.ts`) takes a `CatalogKind`: the same rules run for products (`PRODUCT_KIND`) and, on the role data, for roles
  (`ROLE_KIND`); `dashboard/CatalogChecksPanel.tsx` is the shared Checks panel.
- `card/ProductItemEditModalCard.tsx` exports its parts (`MainField`, `OwnerRowsTable`, `productModalLook`, `modalCardStyles`) for the role card.
