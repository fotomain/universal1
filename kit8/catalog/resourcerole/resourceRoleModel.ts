// Resource role catalog - tables, redux entities and row shapes (pure).
// Source: Google Sheet "W1 V3 ER DESCRIPTORS PLAN": resourceRoleTypeTable / resourceRoleTable are the work-resource twins of
// productTypeTable / productTable and use the SAME descriptor tables:
//   Property = what the role requires (min. experience, certification)      propertyValueTable   owner = role
//   Variant  = a bookable level of the role (Senior, English)               variantTable         owner = role type (perType)
//   Rate     = the hourly price of a role / variant per price list          rolePriceTable       owner = role (like productPriceTable)
//   SQL: kit8/sql/init/create_resource_role_tables.sql (needs create_product_tables.sql first), defTable.md pattern:
//   rowGUID · rowOwnerGUID · rowParentGUID ('empty' = none) · orderInList · rowJSON
//   Screen: ResourceRoleDashboard (./dashboard), route RESOURCE_ROLE_ROUTES.dashboard
import { PRODUCT_TABLES, todayISO } from '../product/productModel';
import type { ProductTableDef, ProductTableKey } from '../product/productModel';

export const RESOURCE_ROLE_ROUTES = { dashboard: '/catalog/resourcerole/dashboard' } as const;

const def = (d: ProductTableDef) => d;

/** the four tables only the role side owns */
export const RESOURCE_ROLE_OWN_TABLES = {
  resourceRoleType: def({ table: 'resourceRoleTypeTable', entity: 'resourceRoleTypeReusable', itemLabel: 'Role type', catalogOwner: 'resourceRoleTypeCatalog',
    purpose: 'Groups roles of the same kind (Project manager, Data analyst); decides which descriptor sets they use and who owns their variants - like a product type.',
    emptyRowJSON: () => ({ title: null, description: null, baseUnit: 'unit_hour', roleVATDefaultRate: null, propertySet: null, variantSet: null, variantMode: 'perType', variantSharedTypeGUID: null, uniqueVariants: true, variantTitleTemplate: null, isActive: true }) }),
  resourceRoleFolder: def({ table: 'resourceRoleFolderTable', entity: 'resourceRoleFolderReusable', itemLabel: 'Folder', catalogOwner: 'resourceRoleFolderCatalog',
    purpose: 'The role tree (Engineering → Frontend) for navigation and reports.',
    emptyRowJSON: () => ({ title: null }) }),
  resourceRole: def({ table: 'resourceRoleTable', entity: 'resourceRoleReusable', itemLabel: 'Role', catalogOwner: null,
    purpose: 'The concrete role a project books (BI data analyst, React Native developer): owns its requirements (Properties) and rates; its Variants come from the role type - like a product.',
    emptyRowJSON: () => ({ title: null, description: null, roleVATRate: null, isActive: true }) }),
  rolePrice: def({ table: 'rolePriceTable', entity: 'rolePriceReusable', itemLabel: 'Rate', catalogOwner: null,
    purpose: 'Hourly rates of a role per variant (empty = all variants), price list and unit of measure (the price of ONE unit: 1 hour), with a start date to keep rate history - the same shape as the product prices.',
    emptyRowJSON: () => ({ priceTypeGUID: null, price: null, measureUnit: 'unit_hour', validFrom: todayISO() }) }),
} as const;

export type ResourceRoleOwnKey = keyof typeof RESOURCE_ROLE_OWN_TABLES;
export const RESOURCE_ROLE_OWN_KEYS = Object.keys(RESOURCE_ROLE_OWN_TABLES) as ResourceRoleOwnKey[];

/** the product-catalog tables the role side shares (descriptors are defined ONCE for both sides) */
const tuple = <T extends ProductTableKey[]>(...keys: T): T => keys;
export const RESOURCE_ROLE_SHARED_KEYS = tuple(
  'valueAddedTax', 'measureUnit', 'descriptorGenus', 'descriptorValue', 'descriptorMode', 'descriptorDestination', 'descriptorPlan',
  'propertyValue', 'variant', 'variantValue', 'priceType',
);
export type ResourceRoleSharedKey = typeof RESOURCE_ROLE_SHARED_KEYS[number];

export type ResourceRoleTableKey = ResourceRoleSharedKey | ResourceRoleOwnKey;
export const RESOURCE_ROLE_TABLE_KEYS: ResourceRoleTableKey[] = [...RESOURCE_ROLE_SHARED_KEYS, ...RESOURCE_ROLE_OWN_KEYS];

const sharedDefs = Object.fromEntries(RESOURCE_ROLE_SHARED_KEYS.map((k) => [k, PRODUCT_TABLES[k]])) as Record<ResourceRoleSharedKey, ProductTableDef>;
/** every table of the role dashboard: Supabase table, redux entity, purpose, new-row rowJSON */
export const RESOURCE_ROLE_TABLES: Record<ResourceRoleTableKey, ProductTableDef> = { ...sharedDefs, ...RESOURCE_ROLE_OWN_TABLES };

/**
 * The role side seen as the product side: the descriptor rules, labels and validation are written once for the product
 * catalog, the role catalog feeds them through this mapping (see roleAsProductData).
 */
export const ROLE_AS_PRODUCT_SLOT: Record<ResourceRoleOwnKey, ProductTableKey> = {
  resourceRoleType: 'productType',
  resourceRoleFolder: 'productFolder',
  resourceRole: 'product',
  rolePrice: 'productPrice',
};

/** the role-side table key of a product-catalog slot (and the other way round) */
export const PRODUCT_SLOT_AS_ROLE: Partial<Record<ProductTableKey, ResourceRoleOwnKey>> = {
  productType: 'resourceRoleType', productFolder: 'resourceRoleFolder', product: 'resourceRole', productPrice: 'rolePrice',
};

// ───────────── row shapes ─────────────
/** a role type; the descriptor / variant fields are those of ProductTypeJSON */
export interface ResourceRoleTypeJSON {
  title: string; description?: string | null; /** measureUnitTable rowGUID - 'unit_hour' */ baseUnit: string;
  /** valueAddedTaxTable rowGUID: default VAT rate of the roles of this type */ roleVATDefaultRate?: string | null;
  propertySet?: string | null; variantSet?: string | null; variantMode: 'none' | 'perType' | 'perProduct' | 'sharedWithType';
  variantSharedTypeGUID?: string | null; uniqueVariants?: boolean; variantTitleTemplate?: string | null; isActive?: boolean;
}
export interface ResourceRoleJSON { title: string; description?: string | null; /** valueAddedTaxTable rowGUID; null = the role type default */ roleVATRate?: string | null; isActive?: boolean }
/** rate = the price of ONE `measureUnit` (hour), same fields as ProductPriceJSON */
export interface RolePriceJSON { priceTypeGUID: string; price: number; measureUnit: string; validFrom: string }
