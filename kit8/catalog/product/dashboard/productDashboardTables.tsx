// Product dashboard - one ReusableTable configuration per product table: columns (what is shown, where it is
// stored), scope filters above the table (master -> detail: the values of ONE product ...) and table commands.
// Root columns are edited in place too: target 'rowOwnerGUID' / 'rowParentGUID' (product -> type / folder ...).
import React from 'react';
import { Text } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import type { ReusableTableRow, SelectOption, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { DESCRIPTION_MODES, MODE_PROPERTY, MODE_VARIANT, PRICE_APPLIES_TO, PRODUCT_TABLES, ProductTableKey, TARGET_KINDS, todayISO, VALUE_TYPES, VARIANT_MODES } from '../productModel';
import {
  byGUID, currentPrice, isSet, ProductCatalogData, priceTypeForProducts, propertyLinesOfProduct, rowTitle, variantLinesOfOwner, variantsOfProduct,
} from '../crud/productCatalogTools';
import type { ProductLabels } from '../crud/productLabels';
import DescriptorValueCell from './DescriptorValueCell';

/** a filter above a table: picks ONE owner / parent / rowJSON value; new rows get it too */
export interface ScopeFilterDef {
  key: string;
  label: string;
  /** 'rowOwnerGUID' | 'rowParentGUID' | a rowJSON field */
  target: string;
  options: SelectOption[];
}

export interface DashboardTableConfig {
  key: ProductTableKey;
  title: string;
  icon: string;
  group: string;
  columns: VisualColumn[];
  filters: ScopeFilterDef[];
  /** false: a fixed list (no add / delete) */
  crud?: boolean;
  extraMenuItems?: (row: ReusableTableRow, close: () => void) => PMMenuItemProps[];
}

export const DASHBOARD_GROUPS = ['Catalog', 'Descriptors', 'Product data', 'Pricing', 'Logistics'] as const;

export interface DashboardTableContext {
  /** give a barcode row the next free EAN-13 */
  assignBarcode: (row: ReusableTableRow) => void;
  /** open another table filtered by this row */
  openTable: (key: ProductTableKey, filters: Record<string, string>) => void;
  /** today 'YYYY-MM-DD' (prices valid now) */
  today?: string;
}

function Dim({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  return <Text testID={testID} numberOfLines={1} style={{ color: c.text, opacity: 0.75, fontSize: 13, flex: 1 }}>{children}</Text>;
}
const count = (key: string, title: string, fn: (row: ReusableTableRow) => number | string, width = 90): VisualColumn => ({
  key, title, type: 'custom', width, editable: false,
  renderCell: (row) => <Dim testID={`count-${key}-${row.rowGUID}`}>{String(fn(row))}</Dim>,
  searchText: (row) => String(fn(row)),
});
const rowNo: VisualColumn = { key: 'n', title: '#', type: 'rowNumber' };
const lower = (s: any) => String(s ?? '').trim().toLowerCase();

export function buildDashboardTables(data: ProductCatalogData, L: ProductLabels, ctx: DashboardTableContext): Record<ProductTableKey, DashboardTableConfig> {
  const O = L.options;
  const today = ctx.today ?? todayISO();
  const genusById = byGUID(data.descriptorGenus);
  const destById = byGUID(data.descriptorDestination);
  const planById = byGUID(data.descriptorPlan);
  const typeById = byGUID(data.productType);
  const productById = byGUID(data.product);
  const variantById = byGUID(data.variant);
  const priceTypeById = byGUID(data.priceType);
  const countBy = (rows: { rowOwnerGUID: string; rowParentGUID: string }[], col: 'rowOwnerGUID' | 'rowParentGUID') => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[col], (m.get(r[col]) ?? 0) + 1);
    return (g: string) => m.get(g) ?? 0;
  };
  const productsPerType = countBy(data.product, 'rowOwnerGUID');
  const productsPerFolder = countBy(data.product, 'rowParentGUID');
  const valuesPerGenus = countBy(data.descriptorValue, 'rowOwnerGUID');
  const linesPerSet = countBy(data.descriptorPlan, 'rowOwnerGUID');
  const variantsPerOwner = countBy(data.variant, 'rowOwnerGUID');
  const vvPerVariant = countBy(data.variantValue, 'rowOwnerGUID');
  const barcodesPerVariant = countBy(data.productBarcode, 'rowParentGUID');
  const retail = data.priceType.find((p) => p.rowGUID === 'pt_retail') ?? data.priceType.find((p) => priceTypeForProducts(p));
  const fmtPrice = (n: any, cur?: string) => (typeof n === 'number' ? `${n.toFixed(2)} ${cur ?? ''}`.trim() : '');
  const folderDescendants = (guid: string) => {
    const out = new Set<string>([guid]);
    let grew = true;
    while (grew) { grew = false; for (const f of data.productFolder) if (!out.has(f.rowGUID) && out.has(f.rowParentGUID)) { out.add(f.rowGUID); grew = true; } }
    return out;
  };
  const vvSummary = (variantGUID: string) => data.variantValue.filter((x) => x.rowOwnerGUID === variantGUID)
    .map((x) => ({ x, sort: Number(planById.get(x.rowParentGUID)?.rowJSON?.sort ?? 999) })).sort((a, b) => a.sort - b.sort)
    .map(({ x }) => L.valueText(x)).filter(Boolean).join(' · ');

  const typeColumn = (title = 'Product type'): VisualColumn => ({ key: 'type', title, type: 'select', target: 'rowOwnerGUID', options: O.types, allowEmpty: false, width: 170, placeholder: 'Select type…' });
  const productColumn = (key = 'product'): VisualColumn => ({ key, title: 'Product', type: 'select', target: 'rowOwnerGUID', options: O.products, allowEmpty: false, width: 220, placeholder: 'Select product…' });

  const tables: Record<ProductTableKey, DashboardTableConfig> = {
    // ───────────── Catalog ─────────────
    product: {
      key: 'product', title: 'Products', icon: 'inventory_2', group: 'Catalog',
      filters: [
        { key: 'type', label: 'Type', target: 'rowOwnerGUID', options: O.types },
        { key: 'folder', label: 'Folder', target: 'rowParentGUID', options: O.folders },
      ],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 220, placeholder: 'Product title' },
        { key: 'sku', title: 'SKU', type: 'text', width: 130,
          validate: (v, row) => (lower(v) && data.product.some((p) => p.rowGUID !== row.rowGUID && lower(p.rowJSON?.sku) === lower(v)) ? `SKU "${v}" is already used` : null) },
        typeColumn(),
        { key: 'folder', title: 'Folder', type: 'select', target: 'rowParentGUID', options: O.folders, width: 200 },
        { key: 'unit', title: 'Unit', type: 'select', options: O.units, width: 100 },
        { key: 'description', title: 'Description', type: 'text', width: 240 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('variants', 'Variants', (r) => variantsOfProduct(data, productById.get(r.rowGUID)).length),
        count('price', retail ? `${rowTitle(retail)} now` : 'Price now', (r) => {
          if (!retail) return '';
          const p = currentPrice(data.productPrice, r.rowGUID, null, retail.rowGUID, today);
          return p ? fmtPrice(p.rowJSON?.price, retail.rowJSON?.currency) : '—';
        }, 120),
      ],
      extraMenuItems: (row, close) => [
        { testID: `product-open-properties-${row.rowGUID}`, label: 'Property values', icon: 'tune', onPress: () => { close(); ctx.openTable('propertyValue', { product: row.rowGUID }); } },
        { testID: `product-open-prices-${row.rowGUID}`, label: 'Prices', icon: 'sell', onPress: () => { close(); ctx.openTable('productPrice', { product: row.rowGUID }); } },
        { testID: `product-open-barcodes-${row.rowGUID}`, label: 'Barcodes', icon: 'barcode', onPress: () => { close(); ctx.openTable('productBarcode', { product: row.rowGUID }); } },
      ],
    },
    productType: {
      key: 'productType', title: 'Product types', icon: 'category', group: 'Catalog', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 160 },
        { key: 'baseUnit', title: 'Base unit', type: 'select', options: O.units, width: 110 },
        { key: 'variantMode', title: 'Variants', type: 'select', options: VARIANT_MODES, allowEmpty: false, width: 150 },
        { key: 'propertySet', title: 'Property set', type: 'select', width: 200,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_PROPERTY) },
        { key: 'variantSet', title: 'Variant set', type: 'select', width: 200,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_VARIANT) },
        { key: 'variantSharedTypeGUID', title: 'Shares variants of', type: 'select', width: 160,
          options: (row) => O.types.filter((t) => t.value !== row.rowGUID && typeById.get(t.value)?.rowJSON?.variantMode !== 'sharedWithType') },
        { key: 'variantTitleTemplate', title: 'Variant title template', type: 'text', width: 220, placeholder: '{color} / {deviceMemory}' },
        { key: 'uniqueVariants', title: 'Unique', type: 'boolean', width: 70 },
        { key: 'useSerialNumbers', title: 'Serial no.', type: 'boolean', width: 80 },
        { key: 'useSeries', title: 'Batches', type: 'boolean', width: 75 },
        { key: 'usePackaging', title: 'Packs', type: 'boolean', width: 65 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 65 },
        count('products', 'Products', (r) => productsPerType(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `type-open-products-${row.rowGUID}`, label: 'Products of this type', icon: 'inventory_2', onPress: () => { close(); ctx.openTable('product', { type: row.rowGUID }); } },
        { testID: `type-open-sets-${row.rowGUID}`, label: 'Descriptor sets', icon: 'view_list', onPress: () => { close(); ctx.openTable('descriptorDestination', { type: row.rowGUID }); } },
      ],
    },
    productFolder: {
      key: 'productFolder', title: 'Folders', icon: 'folder', group: 'Catalog', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 200 },
        { key: 'parent', title: 'Parent folder', type: 'select', target: 'rowParentGUID', width: 240,
          options: (row) => { const no = folderDescendants(row.rowGUID); return O.folders.filter((f) => !no.has(f.value)); } },
        count('path', 'Path', (r) => L.folderPath(r.rowGUID), 260),
        count('products', 'Products', (r) => productsPerFolder(r.rowGUID)),
      ],
    },
    measureUnit: {
      key: 'measureUnit', title: 'Units', icon: 'straighten', group: 'Catalog', filters: [],
      columns: [rowNo, { key: 'title', title: 'Title', type: 'text', width: 160 }, { key: 'code', title: 'Code (UN/ECE, OKEI)', type: 'text', width: 160 },
        count('used', 'Products', (r) => data.product.filter((p) => p.rowJSON?.unit === r.rowGUID).length)],
    },
    // ───────────── Descriptors ─────────────
    descriptorGenus: {
      key: 'descriptorGenus', title: 'Descriptors', icon: 'label', group: 'Descriptors', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 170 },
        { key: 'valueType', title: 'Value type', type: 'select', options: VALUE_TYPES, allowEmpty: false, width: 130 },
        { key: 'unit', title: 'Unit', type: 'text', width: 80 },
        { key: 'allowedDescriptionModes', title: 'Can be', type: 'multiSelect', options: DESCRIPTION_MODES, width: 170 },
        { key: 'targetKinds', title: 'For', type: 'multiSelect', options: TARGET_KINDS, width: 170 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('values', 'Values', (r) => valuesPerGenus(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `genus-open-values-${row.rowGUID}`, label: 'Values', icon: 'list', onPress: () => { close(); ctx.openTable('descriptorValue', { genus: row.rowGUID }); } },
      ],
    },
    descriptorValue: {
      key: 'descriptorValue', title: 'Descriptor values', icon: 'list', group: 'Descriptors',
      filters: [{ key: 'genus', label: 'Descriptor', target: 'rowOwnerGUID', options: O.genus }],
      columns: [
        rowNo,
        { key: 'genus', title: 'Descriptor', type: 'select', target: 'rowOwnerGUID', options: O.genus, allowEmpty: false, width: 170 },
        { key: 'code', title: 'Code', type: 'text', width: 110,
          validate: (v, row) => (lower(v) && data.descriptorValue.some((x) => x.rowGUID !== row.rowGUID && x.rowOwnerGUID === row.rowOwnerGUID && lower(x.rowJSON?.code) === lower(v)) ? `Code "${v}" is already used by this descriptor` : null) },
        { key: 'title', title: 'Title', type: 'text', width: 180 },
        { key: 'hex', title: 'Color', type: 'color', width: 130 },
        { key: 'num', title: 'Number', type: 'number', width: 100, stepper: false, total: false },
        { key: 'sort', title: 'Sort', type: 'integer', width: 80, stepper: false, total: false },
      ],
    },
    descriptorDestination: {
      key: 'descriptorDestination', title: 'Descriptor sets', icon: 'view_list', group: 'Descriptors',
      filters: [{ key: 'type', label: 'Type', target: 'rowOwnerGUID', options: O.types }],
      columns: [
        rowNo,
        typeColumn(),
        { key: 'mode', title: 'Mode', type: 'select', target: 'rowParentGUID', options: DESCRIPTION_MODES, allowEmpty: false, width: 120,
          validate: (v, row) => (data.descriptorDestination.some((d) => d.rowGUID !== row.rowGUID && d.rowOwnerGUID === row.rowOwnerGUID && d.rowParentGUID === v) ? 'This type already has a set of that mode (rule R2)' : null) },
        { key: 'title', title: 'Title', type: 'text', width: 240 },
        count('lines', 'Lines', (r) => linesPerSet(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `set-open-lines-${row.rowGUID}`, label: 'Plan lines', icon: 'checklist', onPress: () => { close(); ctx.openTable('descriptorPlan', { set: row.rowGUID }); } },
      ],
    },
    descriptorPlan: {
      key: 'descriptorPlan', title: 'Plan lines', icon: 'checklist', group: 'Descriptors',
      filters: [{ key: 'set', label: 'Set', target: 'rowOwnerGUID', options: O.destinations }],
      columns: [
        rowNo,
        { key: 'set', title: 'Set', type: 'select', target: 'rowOwnerGUID', options: O.destinations, allowEmpty: false, width: 230 },
        { key: 'genus', title: 'Descriptor', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 180,
          // only descriptors allowed for the set's mode and meant for product types (rules R2, R11)
          options: (row) => O.genus.filter((g) => {
            const gj = genusById.get(g.value)?.rowJSON || {};
            const mode = destById.get(row.rowOwnerGUID ?? "")?.rowParentGUID;
            const modes: string[] = Array.isArray(gj.allowedDescriptionModes) ? gj.allowedDescriptionModes : [];
            const kinds: string[] = Array.isArray(gj.targetKinds) ? gj.targetKinds : [];
            return (!mode || !modes.length || modes.includes(mode)) && (!kinds.length || kinds.includes('productType'));
          }),
          // rule R3: a descriptor once per product type (over both sets)
          validate: (v, row) => {
            const type = destById.get(row.rowOwnerGUID ?? "")?.rowOwnerGUID;
            const clash = data.descriptorPlan.find((p) => p.rowGUID !== row.rowGUID && p.rowParentGUID === v && destById.get(p.rowOwnerGUID)?.rowOwnerGUID === type);
            return clash ? `${L.title('descriptorGenus', v)} is already in ${L.title('descriptorDestination', clash.rowOwnerGUID)} (rule R3)` : null;
          } },
        { key: 'required', title: 'Required', type: 'boolean', width: 85 },
        { key: 'sort', title: 'Sort', type: 'integer', width: 80, stepper: false, total: false },
        { key: 'inVariantTitle', title: 'In variant title', type: 'boolean', width: 115 },
        { key: 'showInCard', title: 'On card', type: 'boolean', width: 80 },
      ],
    },
    descriptorMode: {
      key: 'descriptorMode', title: 'Description modes', icon: 'toggle_on', group: 'Descriptors', filters: [], crud: false,
      columns: [rowNo, count('code', 'Code', (r) => r.rowGUID, 110), { key: 'title', title: 'Title', type: 'text', width: 160 },
        { key: 'createsVariant', title: 'Creates variants', type: 'boolean', width: 130, editable: false }, { key: 'sort', title: 'Sort', type: 'integer', width: 80, stepper: false, total: false }],
    },
    // ───────────── Product data ─────────────
    propertyValue: {
      key: 'propertyValue', title: 'Property values', icon: 'tune', group: 'Product data',
      filters: [{ key: 'product', label: 'Product', target: 'rowOwnerGUID', options: O.products }],
      columns: [
        rowNo,
        productColumn(),
        { key: 'plan', title: 'Property', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 190, placeholder: 'Select property…',
          // the property lines of the product's type (rule R4)
          options: (row) => propertyLinesOfProduct(data, productById.get(row.rowOwnerGUID ?? "")).map((p) => ({ value: p.rowGUID, label: L.title('descriptorGenus', p.rowParentGUID), hint: p.rowJSON?.required ? 'required' : undefined })),
          validate: (v, row) => (data.propertyValue.some((x) => x.rowGUID !== row.rowGUID && x.rowOwnerGUID === row.rowOwnerGUID && x.rowParentGUID === v) ? 'This product already has a value of that property (rule R8)' : null) },
        { key: 'value', title: 'Value', type: 'custom', width: 220,
          renderCell: (row, _i, patch) => {
            const plan = planById.get(row.rowParentGUID ?? "");
            const g = plan ? genusById.get(plan.rowParentGUID) : undefined;
            return (
              <DescriptorValueCell testID={`property-value-${row.rowGUID}`} valueType={g ? (g.rowJSON?.valueType ?? 'ref') : null} unit={g?.rowJSON?.unit} title={rowTitle(g) || 'Value'}
                options={O.valuesOf(g?.rowGUID)} descriptorValueGUID={row.rowJSON?.descriptorValueGUID} value={row.rowJSON?.value} onPatch={patch} />
            );
          },
          searchText: (row) => L.valueText(row as any) },
      ],
    },
    variant: {
      key: 'variant', title: 'Variants', icon: 'style', group: 'Product data',
      filters: [{ key: 'owner', label: 'Owner', target: 'rowOwnerGUID', options: O.variantOwners }],
      columns: [
        rowNo,
        { key: 'owner', title: 'Owner (type / product)', type: 'select', target: 'rowOwnerGUID', options: O.variantOwners, allowEmpty: false, width: 230 },
        { key: 'title', title: 'Title', type: 'text', width: 200 },
        count('values', 'Values', (r) => vvSummary(r.rowGUID) || '—', 200),
        { key: 'descriptorKey', title: 'Descriptor key', type: 'text', width: 200, editable: false },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('barcodes', 'Barcodes', (r) => barcodesPerVariant(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `variant-open-values-${row.rowGUID}`, label: 'Variant values', icon: 'tune', onPress: () => { close(); ctx.openTable('variantValue', { variant: row.rowGUID }); } },
      ],
    },
    variantValue: {
      key: 'variantValue', title: 'Variant values', icon: 'tune', group: 'Product data',
      filters: [{ key: 'variant', label: 'Variant', target: 'rowOwnerGUID', options: O.variants }],
      columns: [
        rowNo,
        { key: 'variant', title: 'Variant', type: 'select', target: 'rowOwnerGUID', options: O.variants, allowEmpty: false, width: 260 },
        { key: 'plan', title: 'Descriptor', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 170, placeholder: 'Select descriptor…',
          options: (row) => variantLinesOfOwner(data, variantById.get(row.rowOwnerGUID ?? "")?.rowOwnerGUID).map((p) => ({ value: p.rowGUID, label: L.title('descriptorGenus', p.rowParentGUID), hint: p.rowJSON?.required ? 'required' : 'optional' })),
          validate: (v, row) => (data.variantValue.some((x) => x.rowGUID !== row.rowGUID && x.rowOwnerGUID === row.rowOwnerGUID && x.rowParentGUID === v) ? 'This variant already has a value of that descriptor (rule R8)' : null) },
        { key: 'value', title: 'Value', type: 'select', field: 'descriptorValueGUID', width: 180, placeholder: 'Select value…',
          options: (row) => O.valuesOf(planById.get(row.rowParentGUID ?? "")?.rowParentGUID) },
      ],
    },
    // ───────────── Pricing ─────────────
    productPrice: {
      key: 'productPrice', title: 'Prices', icon: 'sell', group: 'Pricing',
      filters: [
        { key: 'product', label: 'Product', target: 'rowOwnerGUID', options: O.products },
        { key: 'priceType', label: 'Price type', target: 'priceTypeGUID', options: O.priceTypes },
      ],
      columns: [
        rowNo,
        productColumn(),
        { key: 'variant', title: 'Variant', type: 'select', target: 'rowParentGUID', width: 200, placeholder: 'All variants',
          // rule R7: only the variants of this product (empty = every variant)
          options: (row) => variantsOfProduct(data, productById.get(row.rowOwnerGUID ?? "")).map((v) => ({ value: v.rowGUID, label: rowTitle(v) })) },
        { key: 'priceType', title: 'Price type', type: 'select', field: 'priceTypeGUID', width: 190, allowEmpty: false,
          options: O.priceTypes.filter((p) => priceTypeForProducts(priceTypeById.get(p.value))) },
        { key: 'price', title: 'Price', type: 'number', width: 110, min: 0, stepper: false, total: false, align: 'right' },
        count('currency', 'Currency', (r) => priceTypeById.get(r.rowJSON?.priceTypeGUID)?.rowJSON?.currency ?? '', 80),
        { key: 'validFrom', title: 'Valid from', type: 'date', width: 120 },
        count('now', 'Valid now', (r) => {
          const pt = r.rowJSON?.priceTypeGUID;
          if (!isSet(pt)) return '';
          const cur = currentPrice(data.productPrice, r.rowOwnerGUID ?? "", isSet(r.rowParentGUID) ? r.rowParentGUID : null, pt, today);
          return cur?.rowGUID === r.rowGUID ? '✓ now' : String(r.rowJSON?.validFrom ?? '') > today ? 'future' : '';
        }, 90),
      ],
    },
    priceType: {
      key: 'priceType', title: 'Price types', icon: 'request_quote', group: 'Pricing', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 220 },
        { key: 'currency', title: 'Currency', type: 'text', width: 90, validate: (v) => (v && !/^[A-Z]{3}$/.test(String(v)) ? 'Currency: 3 capital letters (ISO 4217), e.g. EUR' : null) },
        { key: 'vatIncluded', title: 'VAT included', type: 'boolean', width: 105 },
        { key: 'appliesTo', title: 'Used for', type: 'multiSelect', options: PRICE_APPLIES_TO, width: 200 },
        count('prices', 'Prices', (r) => data.productPrice.filter((p) => p.rowJSON?.priceTypeGUID === r.rowGUID).length),
      ],
    },
    // ───────────── Logistics ─────────────
    productBarcode: {
      key: 'productBarcode', title: 'Barcodes', icon: 'barcode', group: 'Logistics',
      filters: [{ key: 'product', label: 'Product', target: 'rowOwnerGUID', options: O.products }],
      columns: [
        rowNo,
        productColumn(),
        { key: 'variant', title: 'Variant', type: 'select', target: 'rowParentGUID', width: 200, placeholder: 'No variant',
          options: (row) => variantsOfProduct(data, productById.get(row.rowOwnerGUID ?? "")).map((v) => ({ value: v.rowGUID, label: rowTitle(v) })) },
        { key: 'pack', title: 'Pack', type: 'select', field: 'packagingGUID', width: 170, placeholder: 'Single unit',
          options: (row) => {
            const p = productById.get(row.rowOwnerGUID ?? "");
            return data.productPackaging.filter((k) => k.rowOwnerGUID === row.rowOwnerGUID || (p && k.rowOwnerGUID === p.rowOwnerGUID))
              .map((k) => ({ value: k.rowGUID, label: rowTitle(k), hint: `${k.rowJSON?.ratio ?? '?'} × ${L.title('measureUnit', k.rowParentGUID)}` }));
          } },
        { key: 'barcode', title: 'Barcode', type: 'text', width: 170,
          validate: (v, row) => (String(v ?? '').trim() && data.productBarcode.some((b) => b.rowGUID !== row.rowGUID && String(b.rowJSON?.barcode ?? '').trim() === String(v).trim()) ? `Barcode ${v} is already used` : null) },
      ],
      extraMenuItems: (row, close) => [
        { testID: `barcode-assign-${row.rowGUID}`, label: 'Assign next EAN-13', icon: 'qr_code', onPress: () => { close(); ctx.assignBarcode(row); } },
      ],
    },
    productPackaging: {
      key: 'productPackaging', title: 'Packs', icon: 'package_2', group: 'Logistics',
      filters: [{ key: 'owner', label: 'Owner', target: 'rowOwnerGUID', options: O.packOwners }],
      columns: [
        rowNo,
        { key: 'owner', title: 'Owner (type / product)', type: 'select', target: 'rowOwnerGUID', options: O.packOwners, allowEmpty: false, width: 230 },
        { key: 'title', title: 'Title', type: 'text', width: 200 },
        { key: 'unit', title: 'Unit', type: 'select', target: 'rowParentGUID', options: O.units, allowEmpty: false, width: 110 },
        { key: 'ratio', title: 'Base units in pack', type: 'number', width: 140, min: 0, total: false },
      ],
    },
    productSeries: {
      key: 'productSeries', title: 'Series', icon: 'qr_code_2', group: 'Logistics',
      filters: [{ key: 'type', label: 'Type', target: 'rowOwnerGUID', options: O.types }],
      columns: [
        rowNo,
        typeColumn(),
        { key: 'number', title: 'Batch number', type: 'text', width: 160 },
        { key: 'serialNumber', title: 'Serial number', type: 'text', width: 160 },
        { key: 'producedAt', title: 'Produced', type: 'date', width: 120 },
        { key: 'expiresAt', title: 'Expires', type: 'date', width: 120,
          validate: (v, row) => (v && row.rowJSON?.producedAt && String(v) < String(row.rowJSON.producedAt) ? 'Expires before it was produced' : null) },
      ],
    },
  };
  return tables;
}

/** the order of the tables in the menu */
export const DASHBOARD_TABLE_ORDER: ProductTableKey[] = [
  'product', 'productType', 'productFolder', 'measureUnit',
  'descriptorGenus', 'descriptorValue', 'descriptorDestination', 'descriptorPlan', 'descriptorMode',
  'propertyValue', 'variant', 'variantValue',
  'productPrice', 'priceType',
  'productBarcode', 'productPackaging', 'productSeries',
];

/** rows that pass the scope filters of a table */
export function matchesScopeFilters(row: ReusableTableRow, filters: ScopeFilterDef[], values: Record<string, string | null | undefined>): boolean {
  for (const f of filters) {
    const v = values[f.key];
    if (!isSet(v)) continue;
    const actual = f.target === 'rowOwnerGUID' || f.target === 'rowParentGUID' ? row[f.target] : row.rowJSON?.[f.target];
    if (String(actual ?? '') !== v) return false;
  }
  return true;
}

/** owner / parent / rowJSON of a new row from the chosen scope filters */
export function newRowFromScopeFilters(filters: ScopeFilterDef[], values: Record<string, string | null | undefined>, key: ProductTableKey) {
  const out: { rowOwnerGUID?: string; rowParentGUID?: string; rowJSON: Record<string, any> } = { rowJSON: {} };
  for (const f of filters) {
    const v = values[f.key];
    if (!isSet(v)) continue;
    if (f.target === 'rowOwnerGUID') out.rowOwnerGUID = v;
    else if (f.target === 'rowParentGUID') out.rowParentGUID = v;
    else out.rowJSON[f.target] = v;
  }
  // a plain catalog table: its fixed owner
  const owner = PRODUCT_TABLES[key].catalogOwner;
  if (owner && !out.rowOwnerGUID) out.rowOwnerGUID = owner;
  return out;
}

