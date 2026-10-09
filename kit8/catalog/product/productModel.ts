// Product catalog - tables, redux entities and row shapes (pure).
// Source: Google Sheet "W1 V3 ER DESCRIPTORS PLAN" (product type -> product -> Properties + Variants,
// both built on Descriptors). Product side only: no resource-role tables yet.
//   SQL: kit8/sql/init/create_product_tables.sql (+ delete_product_tables.sql), defTable.md pattern:
//   rowGUID · rowOwnerGUID · rowParentGUID ('empty' = none) · orderInList · rowJSON
//   Screen: ProductDashboardCRUD (./dashboard), route PRODUCT_ROUTES.dashboard

export const PRODUCT_ROUTES = { dashboard: '/catalog/product/dashboard' } as const;

/** one table of the product catalog */
export interface ProductTableDef {
  /** Supabase table */
  table: string;
  /** SystemMetaData / redux entity key */
  entity: string;
  /** "Product", "Variant" ... in user messages */
  itemLabel: string;
  /** rowOwnerGUID of every row of a plain catalog (null = the owner is another row) */
  catalogOwner: string | null;
  /** what the table is for (Business destination of the sheet) */
  purpose: string;
  /** rowJSON of a new row */
  emptyRowJSON: () => Record<string, any>;
}

const def = (d: ProductTableDef) => d;

export const PRODUCT_TABLES = {
  valueAddedTax: def({ table: 'valueAddedTaxTable', entity: 'valueAddedTaxReusable', itemLabel: 'VAT rate', catalogOwner: 'valueAddedTaxCatalog',
    purpose: 'VAT rates (21 %, 12 %, 0 % ...) a product type or a product can point to, so a rate is changed in one place.',
    emptyRowJSON: () => ({ vatTableTitle: null, vatTablePercent: 0 }) }),
  measureUnit: def({ table: 'measureUnitTable', entity: 'measureUnitReusable', itemLabel: 'Unit', catalogOwner: 'measureUnitCatalog',
    purpose: 'The units of measure (pcs, portion, kg ...). A product picks TWO of them: measureUnitForInventory (counted and stocked in) and measureUnitDefault (offered, ordered and reported in).',
    emptyRowJSON: () => ({ title: null, code: null }) }),
  descriptorGenus: def({ table: 'descriptorGenusTable', entity: 'descriptorGenusReusable', itemLabel: 'Descriptor', catalogOwner: 'descriptorGenusCatalog',
    purpose: 'Every descriptor defined ONCE (Color, Memory, Brand…) so any product type can reuse it as a Property or a Variant.',
    emptyRowJSON: () => ({ title: null, valueType: 'ref', unit: null, allowedDescriptionModes: ['property', 'variant'], targetKinds: ['productType'], isActive: true }) }),
  descriptorValue: def({ table: 'descriptorValueTable', entity: 'descriptorValueReusable', itemLabel: 'Descriptor value', catalogOwner: null,
    purpose: 'The possible values of each descriptor (Red, 256 GB, Apple…) so users pick from a list instead of typing.',
    emptyRowJSON: () => ({ code: null, title: null, hex: null, num: null, sort: null }) }),
  descriptorMode: def({ table: 'descriptorModeTable', entity: 'descriptorModeReusable', itemLabel: 'Description mode', catalogOwner: 'descriptorModeCatalog',
    purpose: 'Fixed list: Property (describes the product) or Variant (creates sellable variants).',
    emptyRowJSON: () => ({ title: null, createsVariant: false, sort: null }) }),
  descriptorDestination: def({ table: 'descriptorDestinationTable', entity: 'descriptorDestinationReusable', itemLabel: 'Descriptor set', catalogOwner: null,
    purpose: 'The descriptor set of a product type per description mode (max one Property set and one Variant set per type).',
    emptyRowJSON: () => ({ title: null }) }),
  descriptorPlan: def({ table: 'descriptorPlanTable', entity: 'descriptorPlanReusable', itemLabel: 'Plan line', catalogOwner: null,
    purpose: 'Which descriptors are in each set, which are required, and their order on the card and in the variant title.',
    emptyRowJSON: () => ({ required: false, sort: null, inVariantTitle: false, showInCard: true }) }),
  productType: def({ table: 'productTypeTable', entity: 'productTypeReusable', itemLabel: 'Product type', catalogOwner: 'productTypeCatalog',
    purpose: 'Groups products of the same kind; decides which descriptor sets they use and who owns their variants.',
    emptyRowJSON: () => ({ title: null, baseUnit: 'unit_pcs', productVATDefaultRate: null, propertySet: null, variantSet: null, variantMode: 'none', variantSharedTypeGUID: null, uniqueVariants: true, variantTitleTemplate: null, useSerialNumbers: false, usePackaging: false, useSeries: false, isActive: true }) }),
  productFolder: def({ table: 'productFolderTable', entity: 'productFolderReusable', itemLabel: 'Folder', catalogOwner: 'productFolderCatalog',
    purpose: 'The catalog tree (Electronics → Mobile devices) for navigation and reports.',
    emptyRowJSON: () => ({ title: null }) }),
  product: def({ table: 'productTable', entity: 'productReusable', itemLabel: 'Product', catalogOwner: null,
    purpose: 'The catalog item customers see and order (iPhone 11, Chicken nuggets).',
    emptyRowJSON: () => ({ title: null, sku: null, measureUnitForInventory: 'unit_pcs', measureUnitDefault: 'unit_pcs', productVATRate: null, description: null, isActive: true }) }),
  propertyValue: def({ table: 'propertyValueTable', entity: 'propertyValueReusable', itemLabel: 'Property value', catalogOwner: null,
    purpose: 'The Property values of each product (Brand = Apple, Calories = 290) for cards, filters and search.',
    emptyRowJSON: () => ({ descriptorValueGUID: null, value: null }) }),
  variant: def({ table: 'variantTable', entity: 'variantReusable', itemLabel: 'Variant', catalogOwner: null,
    purpose: 'Each sellable Variant (Red / 256 GB) with its own price, barcode and stock.',
    emptyRowJSON: () => ({ title: null, descriptorKey: null, isActive: true }) }),
  variantValue: def({ table: 'variantValueTable', entity: 'variantValueReusable', itemLabel: 'Variant value', catalogOwner: null,
    purpose: 'Which descriptor values make up each Variant; source of the variant title and descriptorKey.',
    emptyRowJSON: () => ({ descriptorValueGUID: null }) }),
  productPackage: def({ table: 'productPackageTable', entity: 'productPackageReusable', itemLabel: 'Pack', catalogOwner: null,
    purpose: 'Packs (Box of 10, Family box) and how many base units each contains.',
    emptyRowJSON: () => ({ title: null, ratio: 1 }) }),
  productSeries: def({ table: 'productSeriesTable', entity: 'productSeriesReusable', itemLabel: 'Series', catalogOwner: null,
    purpose: 'Batches, serial numbers and expiry dates for traceability and recalls.',
    emptyRowJSON: () => ({ number: null, serialNumber: null, producedAt: null, expiresAt: null }) }),
  productBarcode: def({ table: 'productBarcodeTable', entity: 'productBarcodeReusable', itemLabel: 'Barcode', catalogOwner: null,
    purpose: 'Maps a scanned barcode to product + variant + pack for POS and warehouse.',
    emptyRowJSON: () => ({ barcode: null, packagingGUID: null }) }),
  priceType: def({ table: 'priceTypeTable', entity: 'priceTypeReusable', itemLabel: 'Price type', catalogOwner: 'priceTypeCatalog',
    purpose: 'Price lists (Retail, Wholesale, Customer A…) with currency and VAT rule.',
    emptyRowJSON: () => ({ title: null, currency: 'EUR', vatIncluded: true, appliesTo: ['product'] }) }),
  productPrice: def({ table: 'productPriceTable', entity: 'productPriceReusable', itemLabel: 'Price', catalogOwner: null,
    purpose: 'Prices per product / variant, price list and unit of measure (the price of ONE unit: 1 pcs, 1 kg ...), with a start date to keep price history.',
    emptyRowJSON: () => ({ priceTypeGUID: null, price: null, measureUnit: 'unit_pcs', validFrom: todayISO() }) }),
} as const;

export type ProductTableKey = keyof typeof PRODUCT_TABLES;
export const PRODUCT_TABLE_KEYS = Object.keys(PRODUCT_TABLES) as ProductTableKey[];

/** 'YYYY-MM-DD' of today (local time) */
export function todayISO(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ───────────── fixed lists ─────────────
export type DescriptionMode = 'property' | 'variant';
export type DescriptorValueType = 'ref' | 'string' | 'number' | 'boolean' | 'date';
export type VariantMode = 'none' | 'perType' | 'perProduct' | 'sharedWithType';
export type TargetKind = 'productType' | 'resourceRoleType' | 'personType';
export type PriceAppliesTo = 'product' | 'resourceRoleType';

export const DESCRIPTION_MODES: { value: DescriptionMode; label: string }[] = [
  { value: 'property', label: 'Property' },
  { value: 'variant', label: 'Variant' },
];
export const VALUE_TYPES: { value: DescriptorValueType; label: string; hint: string }[] = [
  { value: 'ref', label: 'List value', hint: 'picked from descriptor values' },
  { value: 'string', label: 'Text', hint: 'typed text' },
  { value: 'number', label: 'Number', hint: 'typed number' },
  { value: 'boolean', label: 'Yes / No', hint: 'check box' },
  { value: 'date', label: 'Date', hint: 'YYYY-MM-DD' },
];
export const VARIANT_MODES: { value: VariantMode; label: string; hint: string }[] = [
  { value: 'none', label: 'No variants', hint: 'the product itself is sold' },
  { value: 'perType', label: 'Per type', hint: 'variants owned by the product type, shared by its products' },
  { value: 'perProduct', label: 'Per product', hint: 'every product has its own variants' },
  { value: 'sharedWithType', label: 'Shared with type', hint: 'uses the variants of another product type' },
];
export const TARGET_KINDS: { value: TargetKind; label: string }[] = [
  { value: 'productType', label: 'Product type' },
  { value: 'resourceRoleType', label: 'Resource role type' },
  { value: 'personType', label: 'Person type' },
];
export const PRICE_APPLIES_TO: { value: PriceAppliesTo; label: string }[] = [
  { value: 'product', label: 'Products' },
  { value: 'resourceRoleType', label: 'Resource roles' },
];

// ───────────── row shapes ─────────────
export interface DefRow<J = Record<string, any>> {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: J;
  created_at?: string;
  updated_at?: string;
}
/** one VAT rate; vatTablePercent e.g. 21 */
export interface ValueAddedTaxJSON { vatTableTitle: string; vatTablePercent: number }
export interface DescriptorGenusJSON {
  title: string; valueType: DescriptorValueType; unit?: string | null; allowedDescriptionModes: DescriptionMode[]; targetKinds: TargetKind[]; isActive?: boolean;
  /** the owner may have SEVERAL values of this descriptor (a person's certifications): one propertyValue row each; rule R8 is relaxed */
  multiple?: boolean;
  /** person side: this descriptor answers the requirement of that role descriptor (experienceYears satisfies minExperienceYears) */
  satisfies?: string | null;
  /** how a person's value is compared with the requirement of the role: 'atLeast' (numbers, default) | 'equals' | 'includes' (lists, default) */
  matchRule?: 'atLeast' | 'equals' | 'includes';
}
export interface DescriptorValueJSON { code: string; title: string; hex?: string | null; num?: number | null; sort?: number | null }
export interface DescriptorPlanJSON { required: boolean; sort: number | null; inVariantTitle?: boolean; showInCard?: boolean }
export interface ProductTypeJSON {
  title: string; baseUnit: string; /** valueAddedTaxTable rowGUID: default VAT rate of the products of this type */ productVATDefaultRate?: string | null; propertySet?: string | null; variantSet?: string | null; variantMode: VariantMode;
  variantSharedTypeGUID?: string | null; uniqueVariants?: boolean; variantTitleTemplate?: string | null;
  useSerialNumbers?: boolean; usePackaging?: boolean; useSeries?: boolean; isActive?: boolean;
}
export interface ProductJSON { title: string; sku?: string | null; /** measureUnitTable rowGUID (required): the unit the product is counted and stocked in */ measureUnitForInventory: string; /** measureUnitTable rowGUID (required): the unit the product is offered, ordered and reported in */ measureUnitDefault: string; /** valueAddedTaxTable rowGUID; null = the product type default */ productVATRate?: string | null; description?: string | null; isActive?: boolean }
/** ref genus -> descriptorValueGUID; scalar genus -> value */
export interface PropertyValueJSON { descriptorValueGUID?: string | null; value?: string | number | boolean | null }
export interface VariantJSON { title: string; descriptorKey: string; isActive?: boolean }
export interface PriceTypeJSON { title: string; currency: string; vatIncluded: boolean; appliesTo: PriceAppliesTo[] }
/** price = the price of ONE `measureUnit` (measureUnitTable rowGUID, required; default unit_pcs) */
export interface ProductPriceJSON { priceTypeGUID: string; price: number; measureUnit: string; validFrom: string }

/** GUIDs of the fixed description-mode rows */
export const MODE_PROPERTY = 'property';
export const MODE_VARIANT = 'variant';
