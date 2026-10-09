# Resource role catalog

Built from the Google Sheet **"W1 V3 ER DESCRIPTORS PLAN"**, the work-resource twin of the product catalog (`kit8/catalog/product`):

| Product side | Role side | |
|---|---|---|
| `productTypeTable` | `resourceRoleTypeTable` | a kind of work resource (Project manager, Data analyst); decides the descriptor sets and who owns the variants |
| `productFolderTable` | `resourceRoleFolderTable` | the role tree (Engineering › Frontend) |
| `productTable` | `resourceRoleTable` | a concrete bookable role (BI data analyst, React Native developer) |
| `productPriceTable` | `rolePriceTable` | the hourly rates - **the same shape as the product prices** |
| Properties, Variants | the SAME tables | `propertyValueTable` (owner = role: min. experience, certification), `variantTable` / `variantValueTable` (owner = role type: Senior, English) |

Four tables are new; everything descriptor-related is shared with the products (descriptors, values, sets, plan lines, price lists, units, VAT).

## Run it

1. Supabase SQL editor: `kit8/sql/init/create_product_tables.sql` (the shared tables), then `kit8/sql/init/create_resource_role_tables.sql`
   (4 tables, rules, RLS for signed-in users, realtime, demo data = the sheet: 5 role types, 8 roles, 9 variants, 11 property values, 32 rates,
   Bill / Cost price lists, a folder tree). Idempotent; `delete_resource_role_tables.sql` removes the role side again (the products stay).
2. App: drawer → **Resource roles** (`/catalog/resourcerole/dashboard`). Sign in first (RLS: authenticated only).

## Screen

`dashboard/ResourceRoleDashboard.tsx` (route `?tab=<table key>|overview|rolesTree &focusRowGUID=<rowGUID>`):

- **Overview** - numbers, roles per type / folder, the Checks (rules R1-R14) with one-click fixes.
- **Roles & folders** (`dashboard/ResourceRolesWithTree.tsx`) - `FolderTreeReusable` beside the Roles `ReusableTable`: pick a folder = its roles (with
  subfolders), "Add" inside a folder creates the role in it, drag the ⠿ of a role (or of all checked roles) onto a folder, folder CRUD (saved to
  `resourceRoleFolderTable`; deleting a folder keeps its roles). Right-click a role → **Edit** = the role card (`card/ResourceRoleEditModalCard.tsx`):
  **Main** · **Rates** · **Variants** · **Properties**.
- **15 tables** with full CRUD (`dashboard/resourceRoleDashboardTables.tsx`): Roles, Role types, Folders, VAT rates, Units, Descriptors, Descriptor values,
  Descriptor sets, Plan lines, Description modes, Property values, Variants, Variant values, Rates, Price types. Filters above the tables
  (master → detail), row menus (a role → Property values / Rates / Variants, with a back arrow), Generate variants (cartesian product of descriptor values),
  Rebuild variant titles / keys.

## Folders

| Path | What |
|---|---|
| `resourceRoleModel.ts` | the 4 own tables (Supabase table, redux entity, purpose, new-row rowJSON), the shared product tables, row shapes |
| `resourceRoleMetaData.ts` | SystemMetaData entries of the 4 tables (spread into `kit8/redux/SystemMetaData.ts`) |
| `crud/resourceRoleCatalogTools.ts` | `roleAsProductData` (the adapter), variants of a role (R6), valid rate (R13), VAT of a role |
| `crud/resourceRoleLabels.ts` | titles and pick lists (`buildResourceRoleLabels`: the product labels with role wording, rate price lists, role descriptors) |
| `crud/resourceRoleValidation.ts` | the Checks: the product rules on the role data (`ROLE_KIND`) + base unit + R14 |
| `dashboard/` | the screen, its tables, overview, commands, `useResourceRoleCatalogData` |
| `tree/` | `useResourceRoleFolderTree` (nodes + CRUD saved to the folder table), `resourceRoleFolderTreeActions` |
| `card/ResourceRoleEditModalCard.tsx` | the role card |

## Model

| Table | rowOwnerGUID | rowParentGUID |
|---|---|---|
| resourceRoleTypeTable, resourceRoleFolderTable | `resourceRoleTypeCatalog` / `resourceRoleFolderCatalog` | 'empty' (folder: parent folder) |
| resourceRoleTable | role type | folder |
| rolePriceTable | role | variant or 'empty' (= all variants) |
| descriptorDestinationTable (set) | role type | mode (property / variant) |
| propertyValueTable | role | plan line (property set) |
| variantTable | role type (perType) or role (perProduct) | — |

A rate is the price of ONE unit (`measureUnit`, default `unit_hour`), per price list (`priceTypeTable.appliesTo` must contain `resourceRoleType`: Bill rate,
Cost rate, Customer A), variant and start date - exactly the fields of `productPriceTable`. The valid rate = the latest `validFrom` ≤ day; a variant row beats
the "all variants" row (`currentRate`). Rates are stored ONLY there (rule R14); a task line keeps a snapshot of the rate it used.

VAT is the analog of the products': `resourceRoleTypeTable.roleVATDefaultRate` and `resourceRoleTable.roleVATRate` (null = the type default); the seed uses 21 %.

## One set of rules for both sides

`roleAsProductData()` shows the role catalog as the product catalog the rules are written for (role type = product type, role = product, rate = price), so the
descriptor tools (`product/crud/productCatalogTools.ts`), labels, variant generation and the validation (`product/crud/productValidation.ts` with a `CatalogKind`)
exist once. The shared tables hold the rows of both sides; each dashboard hides the other side's rows (`product/crud/catalogSides.ts`).

## Tests

`__tests__/catalog/resourcerole`: `resourceRoleCatalog.test.ts` (sides, rules, labels, Checks, the SQL file against the model) and `resourceRoleDashboard.test.tsx`
(overview, tables, folder tree, role card, commands, and the ProductDashboard next to role rows). `resourceRoleSeed.json` is the data of
`create_resource_role_tables.sql`; `resourceRoleTestKit.ts` puts it on top of the product seed as the tables are in the database.
