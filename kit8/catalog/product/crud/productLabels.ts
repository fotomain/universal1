// Product catalog - titles and pick lists built from the loaded rows (pure, unit-tested).
import type { SelectOption } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { DefRow } from '../productModel';
import { MODE_PROPERTY } from '../productModel';
import { byGUID, isSet, ProductCatalogData, rowTitle, sortBySort } from './productCatalogTools';

const byTitle = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });

export interface ProductLabels {
  title: (table: keyof ProductCatalogData, guid: string | null | undefined) => string;
  /** 'Electronics › Mobile devices' */
  folderPath: (guid: string | null | undefined) => string;
  /** 'Type · Smartphone' / 'Product · Kodo Air 13' */
  ownerLabel: (guid: string | null | undefined) => string;
  /** 'Smartphone · Red / 256 GB' */
  variantLabel: (guid: string | null | undefined) => string;
  /** 'Smartphone – variants · Color' */
  planLabel: (guid: string | null | undefined) => string;
  /** the shown value of a property / variant value row ('Apple', '290 kcal', 'Yes') */
  valueText: (row: DefRow<any>) => string;
  /** pick lists */
  options: {
    units: SelectOption[]; unitsDefault: SelectOption[]; vatRates: SelectOption[]; genus: SelectOption[]; types: SelectOption[]; folders: SelectOption[]; products: SelectOption[];
    destinations: SelectOption[]; priceTypes: SelectOption[]; variants: SelectOption[];
    /** owners a variant may have: perType types + perProduct products */
    variantOwners: SelectOption[];
    /** owners of a pack: every type + every product */
    packOwners: SelectOption[];
    /** the values of a descriptor */
    valuesOf: (genusGUID: string | null | undefined) => SelectOption[];
  };
}

export function buildProductLabels(data: ProductCatalogData): ProductLabels {
  const idx = {
    valueAddedTax: byGUID(data.valueAddedTax), measureUnitForInventory: byGUID(data.measureUnitForInventory), measureUnitDefault: byGUID(data.measureUnitDefault), descriptorGenus: byGUID(data.descriptorGenus), descriptorValue: byGUID(data.descriptorValue),
    descriptorMode: byGUID(data.descriptorMode), descriptorDestination: byGUID(data.descriptorDestination), descriptorPlan: byGUID(data.descriptorPlan),
    productType: byGUID(data.productType), productFolder: byGUID(data.productFolder), product: byGUID(data.product),
    propertyValue: byGUID(data.propertyValue), variant: byGUID(data.variant), variantValue: byGUID(data.variantValue),
    productPackaging: byGUID(data.productPackaging), productSeries: byGUID(data.productSeries), productBarcode: byGUID(data.productBarcode),
    priceType: byGUID(data.priceType), productPrice: byGUID(data.productPrice),
  } as Record<keyof ProductCatalogData, Map<string, DefRow<any>>>;

  const title = (table: keyof ProductCatalogData, guid: string | null | undefined) => (isSet(guid) ? rowTitle(idx[table].get(guid)) || guid : '');
  const folderPath = (guid: string | null | undefined): string => {
    const parts: string[] = [];
    let g = guid; const seen = new Set<string>();
    while (isSet(g) && !seen.has(g)) {
      seen.add(g);
      const f = idx.productFolder.get(g);
      if (!f) { parts.unshift(g); break; }
      parts.unshift(rowTitle(f));
      g = f.rowParentGUID;
    }
    return parts.join(' › ');
  };
  const ownerLabel = (guid: string | null | undefined) => {
    if (!isSet(guid)) return '';
    if (idx.productType.has(guid)) return `Type · ${rowTitle(idx.productType.get(guid))}`;
    if (idx.product.has(guid)) return `Product · ${rowTitle(idx.product.get(guid))}`;
    return guid;
  };
  const variantLabel = (guid: string | null | undefined) => {
    if (!isSet(guid)) return '';
    const v = idx.variant.get(guid);
    if (!v) return guid;
    const owner = idx.productType.get(v.rowOwnerGUID) ?? idx.product.get(v.rowOwnerGUID);
    return `${owner ? rowTitle(owner) + ' · ' : ''}${rowTitle(v)}`;
  };
  const planLabel = (guid: string | null | undefined) => {
    if (!isSet(guid)) return '';
    const p = idx.descriptorPlan.get(guid);
    if (!p) return guid;
    return `${title('descriptorDestination', p.rowOwnerGUID)} · ${title('descriptorGenus', p.rowParentGUID)}`;
  };
  const valueText = (row: DefRow<any>) => {
    const j = row?.rowJSON || {};
    if (isSet(j.descriptorValueGUID)) return title('descriptorValue', j.descriptorValueGUID);
    if (j.value === true) return 'Yes';
    if (j.value === false) return 'No';
    if (j.value === null || j.value === undefined || j.value === '') return '';
    const plan = idx.descriptorPlan.get(row.rowParentGUID);
    const unit = plan ? idx.descriptorGenus.get(plan.rowParentGUID)?.rowJSON?.unit : undefined;
    return `${j.value}${unit ? ` ${unit}` : ''}`;
  };

  const opt = (rows: DefRow<any>[], label: (r: DefRow<any>) => string, hint?: (r: DefRow<any>) => string | undefined) =>
    rows.map((r) => ({ value: r.rowGUID, label: label(r) || r.rowGUID, ...(hint && hint(r) ? { hint: hint(r) } : {}) })).sort(byTitle);

  const typeById = idx.productType;
  const options: ProductLabels['options'] = {
    vatRates: data.valueAddedTax
      .slice().sort((a, b) => (Number(b.rowJSON?.vatTablePercent) || 0) - (Number(a.rowJSON?.vatTablePercent) || 0))
      .map((r) => ({ value: r.rowGUID, label: rowTitle(r) || r.rowGUID, hint: `${Number(r.rowJSON?.vatTablePercent) || 0} %` })),
    unitsDefault: opt(data.measureUnitDefault, rowTitle, (r) => (r.rowJSON?.code ? `code ${r.rowJSON.code}` : undefined)),
    units: opt(data.measureUnitForInventory, rowTitle, (r) => (r.rowJSON?.code ? `code ${r.rowJSON.code}` : undefined)),
    genus: opt(data.descriptorGenus, rowTitle, (r) => [r.rowJSON?.valueType, r.rowJSON?.unit].filter(Boolean).join(' · ')),
    types: opt(data.productType, rowTitle, (r) => r.rowJSON?.variantMode),
    folders: opt(data.productFolder, (r) => folderPath(r.rowGUID)),
    products: opt(data.product, rowTitle, (r) => [r.rowJSON?.sku, title('productType', r.rowOwnerGUID)].filter(Boolean).join(' · ')),
    destinations: opt(data.descriptorDestination, (r) => rowTitle(r), (r) => `${title('productType', r.rowOwnerGUID)} · ${r.rowParentGUID === MODE_PROPERTY ? 'Property set' : 'Variant set'}`),
    priceTypes: opt(data.priceType, rowTitle, (r) => [r.rowJSON?.currency, r.rowJSON?.vatIncluded ? 'VAT incl.' : 'VAT excl.'].join(' · ')),
    variants: opt(data.variant, (r) => variantLabel(r.rowGUID), (r) => r.rowJSON?.descriptorKey),
    variantOwners: [
      ...opt(data.productType.filter((t) => t.rowJSON?.variantMode === 'perType'), (r) => `Type · ${rowTitle(r)}`),
      ...opt(data.product.filter((p) => typeById.get(p.rowOwnerGUID)?.rowJSON?.variantMode === 'perProduct'), (r) => `Product · ${rowTitle(r)}`, (r) => r.rowJSON?.sku),
    ],
    packOwners: [...opt(data.productType, (r) => `Type · ${rowTitle(r)}`), ...opt(data.product, (r) => `Product · ${rowTitle(r)}`, (r) => r.rowJSON?.sku)],
    valuesOf: (genusGUID) => (isSet(genusGUID)
      ? sortBySort(data.descriptorValue.filter((v) => v.rowOwnerGUID === genusGUID)).map((v) => ({ value: v.rowGUID, label: rowTitle(v), ...(v.rowJSON?.hex ? { color: v.rowJSON.hex } : {}), ...(v.rowJSON?.code ? { hint: v.rowJSON.code } : {}) }))
      : []),
  };
  return { title, folderPath, ownerLabel, variantLabel, planLabel, valueText, options };
}
