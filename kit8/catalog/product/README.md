# Product catalog

Built from the Google Sheet **"W1 V3 ER DESCRIPTORS PLAN"** (1C:ERP style: product type → product → **Properties** +
**Variants**, both built on **Descriptors**). Product side only: the resource-role tables of the sheet
(resourceRoleTypeTable, resourceRoleTable, rolePriceTable) and task_line_table are not built yet.

## Run it

1. Supabase SQL editor: run `kit8/sql/init/create_product_tables.sql` (18 tables, rules, RLS for signed-in users,
   realtime, demo data: the sheet rows + 100 more products = 106 products in 11 types, 185 variants, 385 prices,
   332 barcodes). Idempotent; `delete_product_tables.sql` removes it again.
2. App: drawer → **Products** (`/catalog/product/dashboard`). Sign in first (RLS: authenticated only).

## Folders

| Path | What |
|---|---|
| `productModel.ts` | the 18 tables (Supabase table, redux entity, purpose, 1C analog, new-row rowJSON), fixed lists, row shapes |
| `productMetaData.ts` | SystemMetaData entries (spread into `kit8/redux/SystemMetaData.ts`) |
| `crud/productCatalogTools.ts` | rules: variant owner (R6), descriptorKey + title (R9/R10), generate variants, valid price (R13), GTIN / next EAN-13 |
| `crud/productValidation.ts` | the Checks report: rules R1–R13 + barcode check digits, with fixes |
| `crud/productLabels.ts` | titles and pick lists (folder paths, "Type · Smartphone", variant labels …) |
| `dashboard/ProductDashboard.tsx` | the screen: Overview, Product card, 18 CRUD tables (ReusableTable all-rows mode) |
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
| productPackagingTable | type or product | unit |
| productSeriesTable | product type | — |
| productBarcodeTable | product | variant or 'empty' |
| productPriceTable | product | variant or 'empty' (= all variants) |

SQL enforces what an index / check can (one set per type + mode, one value per owner + line, unique descriptorKey per
owner, unique barcode / SKU, one price per product + variant + type + day, fixed lists). Everything else is in the
dashboard **Checks** panel. No foreign keys: owners are polymorphic and Undo of a delete re-creates the row.

## Tests

`__tests__/catalog/product` (tools, validation, dashboard + `productsWithTree` on the SQL seed), `__tests__/ui/table` (ReusableTable), `__tests__/ui/tree` (folder tree).
The seed fixture `__tests__/catalog/product/productSeed.json` is the data of `create_product_tables.sql`.

## VAT rates (1C:ERP: СтавкиНДС)

`valueAddedTaxTable` (owner `valueAddedTaxCatalog`) holds the rates; `rowJSON`: `vatTableTitle`, `vatTablePercent`.
Seed: 21 / 18 / 15 / 12 / 10 / 5 / 0 % (GUIDs `vat_21` ... `vat_0`).

- `productTypeTable.rowJSON.productVATDefaultRate` - rowGUID of the default rate of the products of the type (1C: ВидыНоменклатуры).
- `productTable.rowJSON.productVATRate` - own rate of a product; `null` = use the type default (1C: Номенклатура.СтавкаНДС).
- `vatRateOfProduct(data, product)` (`crud/productCatalogTools.ts`) resolves `productVATRate ?? type.productVATDefaultRate`.
- Rule R1 reports a rate GUID that does not exist.
