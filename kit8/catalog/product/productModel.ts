// Product catalog - tables, redux entities and row shapes (pure).
// Source: Google Sheet "W1 V3 ER DESCRIPTORS PLAN" (1C:ERP style: product type -> product -> Properties + Variants,
// both built on Descriptors). Product side only: no resource-role tables yet.
//   SQL: kit8/sql/init/create_product_tables.sql (+ delete_product_tables.sql), defTable.md pattern:
//   rowGUID · rowOwnerGUID · rowParentGUID ('empty' = none) · orderInList · rowJSON
//   Screen: ProductDashboard (./dashboard), route PRODUCT_ROUTES.dashboard

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
  /** 1C analog */
  analog1C: string;
  /** rowJSON of a new row */
  emptyRowJSON: () => Record<string, any>;
}

const def = (d: ProductTableDef) => d;

export const PRODUCT_TABLES = {
  valueAddedTax: def({ table: 'valueAddedTaxTable', entity: 'valueAddedTaxReusable', itemLabel: 'VAT rate', catalogOwner: 'valueAddedTaxCatalog',
    purpose: 'VAT rates (21 %, 12 %, 0 % ...) a product type or a product can point to, so a rate is changed in one place.', analog1C: 'Справочник СтавкиНДС',
    emptyRowJSON: () => ({ vatTableTitle: null, vatTablePercent: 0 }) }),
  measureUnit: def({ table: 'measureUnitTable', entity: 'measureUnitReusable', itemLabel: 'Unit', catalogOwner: 'measureUnitCatalog',
    purpose: 'Base units in which products are counted, stocked and sold (pcs, portion, kg).', analog1C: 'Base units of measure',
    emptyRowJSON: () => ({ title: null, code: null }) }),
  descriptorGenus: def({ table: 'descriptorGenusTable', entity: 'descriptorGenusReusable', itemLabel: 'Descriptor', catalogOwner: 'descriptorGenusCatalog',
    purpose: 'Every descriptor defined ONCE (Color, Memory, Brand…) so any product type can reuse it as a Property or a Variant.', analog1C: 'ПВХ ДополнительныеРеквизитыИСведения',
    emptyRowJSON: () => ({ title: null, valueType: 'ref', unit: null, allowedDescriptionModes: ['property', 'variant'], targetKinds: ['productType'], isActive: true }) }),
  descriptorValue: def({ table: 'descriptorValueTable', entity: 'descriptorValueReusable', itemLabel: 'Descriptor value', catalogOwner: null,
    purpose: 'The possible values of each descriptor (Red, 256 GB, Apple…) so users pick from a list instead of typing.', analog1C: 'Справочник ЗначенияСвойствОбъектов',
    emptyRowJSON: () => ({ code: null, title: null, hex: null, num: null, sort: null }) }),
  descriptorMode: def({ table: 'descriptorModeTable', entity: 'descriptorModeReusable', itemLabel: 'Description mode', catalogOwner: 'descriptorModeCatalog',
    purpose: 'Fixed list: Property (describes the product) or Variant (creates sellable variants).', analog1C: 'Enum',
    emptyRowJSON: () => ({ title: null, createsVariant: false, sort: null }) }),
  descriptorDestination: def({ table: 'descriptorDestinationTable', entity: 'descriptorDestinationReusable', itemLabel: 'Descriptor set', catalogOwner: null,
    purpose: 'The descriptor set of a product type per description mode (max one Property set and one Variant set per type).', analog1C: 'НаборыДополнительныхРеквизитовИСведений',
    emptyRowJSON: () => ({ title: null }) }),
  descriptorPlan: def({ table: 'descriptorPlanTable', entity: 'descriptorPlanReusable', itemLabel: 'Plan line', catalogOwner: null,
    purpose: 'Which descriptors are in each set, which are required, and their order on the card and in the variant title.', analog1C: 'Tabular section ДополнительныеРеквизиты of the set',
    emptyRowJSON: () => ({ required: false, sort: null, inVariantTitle: false, showInCard: true }) }),
  productType: def({ table: 'productTypeTable', entity: 'productTypeReusable', itemLabel: 'Product type', catalogOwner: 'productTypeCatalog',
    purpose: 'Groups products of the same kind; decides which descriptor sets they use and who owns their variants.', analog1C: 'Справочник ВидыНоменклатуры',
    emptyRowJSON: () => ({ title: null, baseUnit: 'unit_pcs', productVATDefaultRate: null, propertySet: null, variantSet: null, variantMode: 'none', variantSharedTypeGUID: null, uniqueVariants: true, variantTitleTemplate: null, useSerialNumbers: false, usePackaging: false, useSeries: false, isActive: true }) }),
  productFolder: def({ table: 'productFolderTable', entity: 'productFolderReusable', itemLabel: 'Folder', catalogOwner: 'productFolderCatalog',
    purpose: 'The catalog tree (Electronics → Mobile devices) for navigation and reports.', analog1C: 'Groups of Справочник Номенклатура',
    emptyRowJSON: () => ({ title: null }) }),
  product: def({ table: 'productTable', entity: 'productReusable', itemLabel: 'Product', catalogOwner: null,
    purpose: 'The catalog item customers see and order (iPhone 11, Chicken nuggets).', analog1C: 'Справочник Номенклатура',
    emptyRowJSON: () => ({ title: null, sku: null, unit: 'unit_pcs', productVATRate: null, description: null, isActive: true }) }),
  propertyValue: def({ table: 'propertyValueTable', entity: 'propertyValueReusable', itemLabel: 'Property value', catalogOwner: null,
    purpose: 'The Property values of each product (Brand = Apple, Calories = 290) for cards, filters and search.', analog1C: 'Номенклатура.ДополнительныеРеквизиты',
    emptyRowJSON: () => ({ descriptorValueGUID: null, value: null }) }),
  variant: def({ table: 'variantTable', entity: 'variantReusable', itemLabel: 'Variant', catalogOwner: null,
    purpose: 'Each sellable Variant (Red / 256 GB) with its own price, barcode and stock.', analog1C: 'Справочник ХарактеристикиНоменклатуры',
    emptyRowJSON: () => ({ title: null, descriptorKey: null, isActive: true }) }),
  variantValue: def({ table: 'variantValueTable', entity: 'variantValueReusable', itemLabel: 'Variant value', catalogOwner: null,
    purpose: 'Which descriptor values make up each Variant; source of the variant title and descriptorKey.', analog1C: 'ХарактеристикиНоменклатуры.ДополнительныеРеквизиты',
    emptyRowJSON: () => ({ descriptorValueGUID: null }) }),
  productPackaging: def({ table: 'productPackagingTable', entity: 'productPackagingReusable', itemLabel: 'Pack', catalogOwner: null,
    purpose: 'Packs (Box of 10, Family box) and how many base units each contains.', analog1C: 'УпаковкиЕдиницыИзмерения (packs)',
    emptyRowJSON: () => ({ title: null, ratio: 1 }) }),
  productSeries: def({ table: 'productSeriesTable', entity: 'productSeriesReusable', itemLabel: 'Series', catalogOwner: null,
    purpose: 'Batches, serial numbers and expiry dates for traceability and recalls.', analog1C: 'СерииНоменклатуры',
    emptyRowJSON: () => ({ number: null, serialNumber: null, producedAt: null, expiresAt: null }) }),
  productBarcode: def({ table: 'productBarcodeTable', entity: 'productBarcodeReusable', itemLabel: 'Barcode', catalogOwner: null,
    purpose: 'Maps a scanned barcode to product + variant + pack for POS and warehouse.', analog1C: 'РС ШтрихкодыНоменклатуры',
    emptyRowJSON: () => ({ barcode: null, packagingGUID: null }) }),
  priceType: def({ table: 'priceTypeTable', entity: 'priceTypeReusable', itemLabel: 'Price type', catalogOwner: 'priceTypeCatalog',
    purpose: 'Price lists (Retail, Wholesale, Customer A…) with currency and VAT rule.', analog1C: 'Справочник ВидыЦен',
    emptyRowJSON: () => ({ title: null, currency: 'EUR', vatIncluded: true, appliesTo: ['product'] }) }),
  productPrice: def({ table: 'productPriceTable', entity: 'productPriceReusable', itemLabel: 'Price', catalogOwner: null,
    purpose: 'Prices per product / variant and price list, with a start date to keep price history.', analog1C: 'РС ЦеныНоменклатуры (periodic)',
    emptyRowJSON: () => ({ priceTypeGUID: null, price: null, validFrom: todayISO() }) }),
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
export type TargetKind = 'productType' | 'resourceRoleType';
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
export interface DescriptorGenusJSON { title: string; valueType: DescriptorValueType; unit?: string | null; allowedDescriptionModes: DescriptionMode[]; targetKinds: TargetKind[]; isActive?: boolean }
export interface DescriptorValueJSON { code: string; title: string; hex?: string | null; num?: number | null; sort?: number | null }
export interface DescriptorPlanJSON { required: boolean; sort: number | null; inVariantTitle?: boolean; showInCard?: boolean }
export interface ProductTypeJSON {
  title: string; baseUnit: string; /** valueAddedTaxTable rowGUID: default VAT rate of the products of this type */ productVATDefaultRate?: string | null; propertySet?: string | null; variantSet?: string | null; variantMode: VariantMode;
  variantSharedTypeGUID?: string | null; uniqueVariants?: boolean; variantTitleTemplate?: string | null;
  useSerialNumbers?: boolean; usePackaging?: boolean; useSeries?: boolean; isActive?: boolean;
}
export interface ProductJSON { title: string; sku?: string | null; unit?: string | null; /** valueAddedTaxTable rowGUID; null = the product type default */ productVATRate?: string | null; description?: string | null; isActive?: boolean }
/** ref genus -> descriptorValueGUID; scalar genus -> value */
export interface PropertyValueJSON { descriptorValueGUID?: string | null; value?: string | number | boolean | null }
export interface VariantJSON { title: string; descriptorKey: string; isActive?: boolean }
export interface PriceTypeJSON { title: string; currency: string; vatIncluded: boolean; appliesTo: PriceAppliesTo[] }
export interface ProductPriceJSON { priceTypeGUID: string; price: number; validFrom: string }

/** GUIDs of the fixed description-mode rows */
export const MODE_PROPERTY = 'property';
export const MODE_VARIANT = 'variant';
