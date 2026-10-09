// Product catalog - the validation rules of the sheet (R1-R13, product side) as a report (pure, unit-tested).
// SQL enforces only what an index / check can (kit8/sql/init/create_product_tables.sql); everything else is found
// here and shown in the dashboard "Checks" panel, each issue pointing at the table + row to fix.
import { MODE_PROPERTY, MODE_VARIANT, ProductTableKey } from '../productModel';
import type { DefRow, TargetKind } from '../productModel';
import {
  byGUID, computedVariant, isSet, ProductCatalogData, priceTypeForProducts, propertyLinesOfProduct, rowTitle, setOfType,
  typeOfVariantOwner, variantAllowedForProduct, variantLinesOfOwner, variantSourceType, isValidGtin,
} from './productCatalogTools';

export type IssueSeverity = 'error' | 'warning';
/** a table an issue points at: a product-catalog table, or one of the four role tables (resourceRoleType ...) */
export type IssueTable = ProductTableKey | 'resourceRoleType' | 'resourceRoleFolder' | 'resourceRole' | 'rolePrice';
/** one finding; `T` = the tables it can point at (the product catalog's by default) */
export interface ProductIssue<T extends string = ProductTableKey> {
  /** sheet rule: R1 ... R13 */
  rule: string;
  severity: IssueSeverity;
  table: T;
  rowGUID: string;
  message: string;
  /** a fix the dashboard can apply by itself */
  fix?: 'rebuildVariant' | 'deleteRow';
}

export const RULES: Record<string, string> = {
  R1: 'Every GUID points to an existing row',
  R2: 'A set holds only descriptors allowed for its mode; one set per type and mode',
  R3: 'A descriptor appears only once per product type (Property OR Variant)',
  R4: 'Values use plan lines of the right set',
  R5: 'A list value belongs to the descriptor of its plan line; scalar descriptors use value',
  R6: 'Variants are owned as the variant mode says',
  R7: 'Prices / barcodes use variants allowed for their product',
  R8: 'Required plan lines have a value; one value per owner and plan line',
  R9: 'descriptorKey is computed from the variant values and unique',
  R10: 'Variant title follows the type template',
  R11: 'A plan line descriptor is meant for product types',
  R13: 'Price type is meant for products',
  GTIN: 'Barcode has a valid check digit',
};

/**
 * Which side of the descriptor model is checked. The rules are the same for both: the PRODUCT side (product type -> product ->
 * price) and the ROLE side (resource role type -> resource role -> rate), which the role catalog passes in as product data
 * (roleAsProductData). Only the words, the table the issues point at, the VAT fields and the product-only logistics differ.
 */
export interface CatalogKind {
  /** targetKinds a plan-line descriptor must list (rule R11) */
  kind: TargetKind;
  /** the tables the issues point at */
  tables: { type: IssueTable; item: IssueTable; folder: IssueTable; price: IssueTable };
  /** rowJSON field of the type's default VAT rate / of the item's own VAT rate */
  vat: { type: string; item: string };
  /** words in the messages */
  words: { item: string; itemLower: string; type: string; typeLower: string };
  priceFor: (pt: DefRow<any> | undefined) => boolean;
  /** units for inventory / SKU / packs / series / barcodes are product-only */
  productLogistics: boolean;
}
export const PRODUCT_KIND: CatalogKind = {
  kind: 'productType',
  tables: { type: 'productType', item: 'product', folder: 'productFolder', price: 'productPrice' },
  vat: { type: 'productVATDefaultRate', item: 'productVATRate' },
  words: { item: 'Product', itemLower: 'product', type: 'Type', typeLower: 'product type' },
  priceFor: priceTypeForProducts,
  productLogistics: true,
};

export function validateProductCatalog(data: ProductCatalogData): ProductIssue[];
export function validateProductCatalog(data: ProductCatalogData, K: CatalogKind): ProductIssue<IssueTable>[];
export function validateProductCatalog(data: ProductCatalogData, K: CatalogKind = PRODUCT_KIND): ProductIssue<any>[] {
  const W = K.words;
  const issues: ProductIssue<IssueTable>[] = [];
  const add = (rule: string, severity: IssueSeverity, table: IssueTable, rowGUID: string, message: string, fix?: ProductIssue['fix']) =>
    issues.push({ rule, severity, table, rowGUID, message, ...(fix ? { fix } : {}) });

  const units = byGUID(data.measureUnit);
  const vatRates = byGUID(data.valueAddedTax);
  const genus = byGUID(data.descriptorGenus);
  const values = byGUID(data.descriptorValue);
  const dests = byGUID(data.descriptorDestination);
  const plans = byGUID(data.descriptorPlan);
  const types = byGUID(data.productType);
  const folders = byGUID(data.productFolder);
  const products = byGUID(data.product);
  const variants = byGUID(data.variant);
  const packs = byGUID(data.productPackage);
  const priceTypes = byGUID(data.priceType);
  const T = (r: DefRow<any> | undefined) => (r ? `"${rowTitle(r)}"` : '');

  // ---- descriptor values ----
  for (const v of data.descriptorValue) {
    if (!genus.has(v.rowOwnerGUID)) add('R1', 'error', 'descriptorValue', v.rowGUID, `Value ${T(v)}: its descriptor is missing`, 'deleteRow');
  }
  // ---- destinations (sets) ----
  const setKeys = new Map<string, string>();
  for (const d of data.descriptorDestination) {
    if (!types.has(d.rowOwnerGUID)) add('R1', 'error', 'descriptorDestination', d.rowGUID, `Set ${T(d)}: its ${W.typeLower} is missing`);
    if (d.rowParentGUID !== MODE_PROPERTY && d.rowParentGUID !== MODE_VARIANT) add('R1', 'error', 'descriptorDestination', d.rowGUID, `Set ${T(d)}: choose the mode (Property / Variant)`);
    const k = `${d.rowOwnerGUID}|${d.rowParentGUID}`;
    if (setKeys.has(k)) add('R2', 'error', 'descriptorDestination', d.rowGUID, `Set ${T(d)}: the type already has a ${d.rowParentGUID} set`);
    else setKeys.set(k, d.rowGUID);
  }
  // ---- plan lines ----
  const genusPerType = new Map<string, Map<string, string>>();
  for (const p of data.descriptorPlan) {
    const d = dests.get(p.rowOwnerGUID);
    const g = genus.get(p.rowParentGUID);
    if (!d) { add('R1', 'error', 'descriptorPlan', p.rowGUID, `Plan line ${p.rowGUID}: its set is missing`, 'deleteRow'); continue; }
    if (!g) { add('R1', 'error', 'descriptorPlan', p.rowGUID, `Plan line of ${T(d)}: choose a descriptor`); continue; }
    const modes: string[] = Array.isArray(g.rowJSON?.allowedDescriptionModes) ? g.rowJSON.allowedDescriptionModes : [];
    if (modes.length && !modes.includes(d.rowParentGUID)) add('R2', 'error', 'descriptorPlan', p.rowGUID, `${T(g)} cannot be a ${d.rowParentGUID} (allowed: ${modes.join(', ')}) - set ${T(d)}`);
    const kinds: string[] = Array.isArray(g.rowJSON?.targetKinds) ? g.rowJSON.targetKinds : [];
    if (kinds.length && !kinds.includes(K.kind)) add('R11', 'error', 'descriptorPlan', p.rowGUID, `${T(g)} is not meant for ${W.typeLower}s - set ${T(d)}`);
    const perType = genusPerType.get(d.rowOwnerGUID) ?? new Map<string, string>();
    if (perType.has(g.rowGUID) && perType.get(g.rowGUID) !== p.rowGUID) add('R3', 'error', 'descriptorPlan', p.rowGUID, `${T(g)} is already used by ${T(types.get(d.rowOwnerGUID))} in another line`);
    perType.set(g.rowGUID, perType.get(g.rowGUID) ?? p.rowGUID);
    genusPerType.set(d.rowOwnerGUID, perType);
  }
  // ---- product types ----
  for (const t of data.productType) {
    const j = t.rowJSON || {};
    if (isSet(j.baseUnit) && !units.has(j.baseUnit)) add('R1', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: base unit "${j.baseUnit}" is missing`);
    if (isSet(j[K.vat.type]) && !vatRates.has(j[K.vat.type])) add('R1', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: VAT rate "${j[K.vat.type]}" is missing`);
    for (const [field, mode] of [['propertySet', MODE_PROPERTY], ['variantSet', MODE_VARIANT]] as const) {
      const s = j[field];
      if (!isSet(s)) continue;
      const d = dests.get(s);
      if (!d) add('R1', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: ${field} "${s}" is missing`);
      else if (d.rowOwnerGUID !== t.rowGUID || d.rowParentGUID !== mode) add('R2', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: ${field} must be its own ${mode} set (it is ${T(d)})`);
    }
    if ((j.variantMode === 'perType' || j.variantMode === 'perProduct') && !setOfType(data, t.rowGUID, MODE_VARIANT)) add('R6', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: variant mode "${j.variantMode}" needs a variant set`);
    if (j.variantMode === 'sharedWithType') {
      const other = types.get(j.variantSharedTypeGUID);
      if (!other) add('R6', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: choose the type whose variants it shares`);
      else if (other.rowGUID === t.rowGUID || other.rowJSON?.variantMode === 'sharedWithType') add('R6', 'error', K.tables.type, t.rowGUID, `${W.type} ${T(t)}: shares variants with ${T(other)}, which cannot share again`);
    }
  }
  // ---- folders ----
  for (const f of data.productFolder) {
    if (isSet(f.rowParentGUID) && !folders.has(f.rowParentGUID)) add('R1', 'error', K.tables.folder, f.rowGUID, `Folder ${T(f)}: its parent folder is missing`);
    // a folder may not be its own ancestor
    let p = f.rowParentGUID; const seen = new Set([f.rowGUID]);
    while (isSet(p) && folders.has(p)) { if (seen.has(p)) { add('R1', 'error', K.tables.folder, f.rowGUID, `Folder ${T(f)}: the folder tree has a loop`); break; } seen.add(p); p = folders.get(p)!.rowParentGUID; }
  }
  // ---- products + property values ----
  const skus = new Map<string, string>();
  for (const pr of data.product) {
    if (!types.has(pr.rowOwnerGUID)) add('R1', 'error', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: choose its ${W.typeLower}`);
    if (isSet(pr.rowParentGUID) && !folders.has(pr.rowParentGUID)) add('R1', 'warning', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: its folder is missing`);
    // a product has exactly ONE unit for inventory and ONE default unit, both rows of measureUnitTable (a role is counted in its type's base unit)
    if (K.productLogistics) for (const [field, label] of [['measureUnitForInventory', 'unit for inventory'], ['measureUnitDefault', 'default unit']] as const) {
      const g = pr.rowJSON?.[field];
      if (!isSet(g)) add('R1', 'error', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: choose the ${label}`);
      else if (!units.has(g)) add('R1', 'error', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: ${label} "${g}" is missing`);
    }
    if (isSet(pr.rowJSON?.[K.vat.item]) && !vatRates.has(pr.rowJSON[K.vat.item])) add('R1', 'error', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: VAT rate "${pr.rowJSON[K.vat.item]}" is missing`);
    const sku = String(pr.rowJSON?.sku ?? '').trim().toLowerCase();
    if (K.productLogistics && sku) { if (skus.has(sku)) add('R1', 'error', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: SKU "${pr.rowJSON.sku}" is used twice`); else skus.set(sku, pr.rowGUID); }
  }
  const valuePerOwnerLine = new Map<string, string>();
  for (const pv of data.propertyValue) {
    const owner = products.get(pv.rowOwnerGUID);
    const plan = plans.get(pv.rowParentGUID);
    if (!owner) { add('R1', 'error', 'propertyValue', pv.rowGUID, `Property value ${pv.rowGUID}: its ${W.itemLower} is missing`, 'deleteRow'); continue; }
    if (!plan) { add('R1', 'error', 'propertyValue', pv.rowGUID, `Property value of ${T(owner)}: choose the plan line`); continue; }
    const lines = propertyLinesOfProduct(data, owner);
    if (!lines.some((l) => l.rowGUID === plan.rowGUID)) add('R4', 'error', 'propertyValue', pv.rowGUID, `Property value of ${T(owner)}: ${T(genus.get(plan.rowParentGUID))} is not in its type's property set`);
    checkValue('propertyValue', pv, plan, T(owner));
    const k = `${pv.rowOwnerGUID}|${pv.rowParentGUID}`;
    if (valuePerOwnerLine.has(k)) add('R8', 'error', 'propertyValue', pv.rowGUID, `${T(owner)} has two values of ${T(genus.get(plan.rowParentGUID))}`);
    valuePerOwnerLine.set(k, pv.rowGUID);
  }
  for (const pr of data.product) {
    for (const line of propertyLinesOfProduct(data, pr)) {
      if (!line.rowJSON?.required) continue;
      const pv = data.propertyValue.find((x) => x.rowOwnerGUID === pr.rowGUID && x.rowParentGUID === line.rowGUID);
      if (!pv || !hasValue(pv)) add('R8', 'warning', K.tables.item, pr.rowGUID, `${W.item} ${T(pr)}: required property ${T(genus.get(line.rowParentGUID))} has no value`);
    }
  }

  // ---- variants + variant values ----
  const keys = new Map<string, string>();
  for (const v of data.variant) {
    const ownerType = typeOfVariantOwner(data, v.rowOwnerGUID);
    if (!ownerType) { add('R1', 'error', 'variant', v.rowGUID, `Variant ${T(v)}: its owner (type or product) is missing`); continue; }
    const type = types.get(ownerType);
    const mode = type?.rowJSON?.variantMode;
    const ownerIsType = types.has(v.rowOwnerGUID);
    if (mode === 'none') add('R6', 'error', 'variant', v.rowGUID, `Variant ${T(v)}: ${T(type)} has no variants (variant mode "none")`);
    else if (mode === 'perType' && !ownerIsType) add('R6', 'error', 'variant', v.rowGUID, `Variant ${T(v)}: ${T(type)} keeps variants per TYPE - the owner must be the type`);
    else if (mode === 'perProduct' && ownerIsType) add('R6', 'error', 'variant', v.rowGUID, `Variant ${T(v)}: ${T(type)} keeps variants per PRODUCT - the owner must be a product`);
    else if (mode === 'sharedWithType') add('R6', 'error', 'variant', v.rowGUID, `Variant ${T(v)}: ${T(type)} uses the variants of ${T(types.get(type?.rowJSON?.variantSharedTypeGUID))}`);
    const c = computedVariant(data, v);
    if (c.descriptorKey && c.descriptorKey !== (v.rowJSON?.descriptorKey ?? '')) add('R9', 'warning', 'variant', v.rowGUID, `Variant ${T(v)}: descriptorKey should be "${c.descriptorKey}"`, 'rebuildVariant');
    else if (c.descriptorKey && c.title && c.title !== v.rowJSON?.title) add('R10', 'warning', 'variant', v.rowGUID, `Variant ${T(v)}: title should be "${c.title}"`, 'rebuildVariant');
    const key = v.rowJSON?.descriptorKey;
    if (key) {
      const k = `${v.rowOwnerGUID}|${key}`;
      if (keys.has(k) && type?.rowJSON?.uniqueVariants !== false) add('R9', 'error', 'variant', v.rowGUID, `Variant ${T(v)}: the same values as ${T(variants.get(keys.get(k)!))}`);
      else keys.set(k, v.rowGUID);
    }
    // required variant lines
    const lines = variantLinesOfOwner(data, v.rowOwnerGUID);
    for (const line of lines) {
      if (!line.rowJSON?.required) continue;
      const vv = data.variantValue.find((x) => x.rowOwnerGUID === v.rowGUID && x.rowParentGUID === line.rowGUID);
      if (!vv || !isSet(vv.rowJSON?.descriptorValueGUID)) add('R8', 'warning', 'variant', v.rowGUID, `Variant ${T(v)}: required ${T(genus.get(line.rowParentGUID))} has no value`);
    }
  }
  const vvPerOwnerLine = new Map<string, string>();
  for (const vv of data.variantValue) {
    const v = variants.get(vv.rowOwnerGUID);
    const plan = plans.get(vv.rowParentGUID);
    if (!v) { add('R1', 'error', 'variantValue', vv.rowGUID, `Variant value ${vv.rowGUID}: its variant is missing`, 'deleteRow'); continue; }
    if (!plan) { add('R1', 'error', 'variantValue', vv.rowGUID, `Variant value of ${T(v)}: choose the plan line`); continue; }
    const lines = variantLinesOfOwner(data, v.rowOwnerGUID);
    if (!lines.some((l) => l.rowGUID === plan.rowGUID)) add('R4', 'error', 'variantValue', vv.rowGUID, `Variant value of ${T(v)}: ${T(genus.get(plan.rowParentGUID))} is not in the variant set of ${T(types.get(variantSourceType(data, typeOfVariantOwner(data, v.rowOwnerGUID)) ?? ''))}`);
    checkValue('variantValue', vv, plan, T(v), true);
    const k = `${vv.rowOwnerGUID}|${vv.rowParentGUID}`;
    if (vvPerOwnerLine.has(k)) add('R8', 'error', 'variantValue', vv.rowGUID, `${T(v)} has two values of ${T(genus.get(plan.rowParentGUID))}`);
    vvPerOwnerLine.set(k, vv.rowGUID);
  }

  if (K.productLogistics) {
    // ---- packaging / series ----
    for (const p of data.productPackage) {
      if (!types.has(p.rowOwnerGUID) && !products.has(p.rowOwnerGUID)) add('R1', 'error', 'productPackage', p.rowGUID, `Pack ${T(p)}: its owner (type or product) is missing`);
      if (!units.has(p.rowParentGUID)) add('R1', 'error', 'productPackage', p.rowGUID, `Pack ${T(p)}: choose its unit`);
    }
    for (const s of data.productSeries) {
      if (!types.has(s.rowOwnerGUID)) add('R1', 'error', 'productSeries', s.rowGUID, `Series ${T(s)}: its ${W.typeLower} is missing`);
      const { producedAt, expiresAt } = s.rowJSON || {};
      if (producedAt && expiresAt && String(expiresAt) < String(producedAt)) add('R1', 'warning', 'productSeries', s.rowGUID, `Series ${T(s)}: expires before it was produced`);
    }
    // ---- barcodes ----
    const codes = new Map<string, string>();
    for (const b of data.productBarcode) {
      const pr = products.get(b.rowOwnerGUID);
      if (!pr) { add('R1', 'error', 'productBarcode', b.rowGUID, `Barcode ${T(b)}: its ${W.itemLower} is missing`, 'deleteRow'); continue; }
      if (isSet(b.rowParentGUID) && !variants.has(b.rowParentGUID)) add('R1', 'error', 'productBarcode', b.rowGUID, `Barcode ${T(b)}: its variant is missing`);
      else if (!variantAllowedForProduct(data, pr, b.rowParentGUID)) add('R7', 'error', 'productBarcode', b.rowGUID, `Barcode ${T(b)}: ${T(variants.get(b.rowParentGUID))} is not a variant of ${T(pr)}`);
      const pack = b.rowJSON?.packagingGUID;
      if (isSet(pack) && !packs.has(pack)) add('R1', 'error', 'productBarcode', b.rowGUID, `Barcode ${T(b)}: its pack is missing`);
      const code = String(b.rowJSON?.barcode ?? '').trim();
      if (!code) add('GTIN', 'warning', 'productBarcode', b.rowGUID, `Barcode of ${T(pr)}: enter the code`);
      else if (!isValidGtin(code)) add('GTIN', 'warning', 'productBarcode', b.rowGUID, `Barcode "${code}" of ${T(pr)}: not a valid EAN / GTIN`);
      if (code) { if (codes.has(code)) add('R1', 'error', 'productBarcode', b.rowGUID, `Barcode "${code}" is used twice`); else codes.set(code, b.rowGUID); }
    }
  }

  // ---- prices ----
  for (const p of data.productPrice) {
    const pr = products.get(p.rowOwnerGUID);
    if (!pr) { add('R1', 'error', K.tables.price, p.rowGUID, `Price ${p.rowGUID}: its ${W.itemLower} is missing`, 'deleteRow'); continue; }
    const pt = priceTypes.get(p.rowJSON?.priceTypeGUID);
    if (!pt) add('R1', 'error', K.tables.price, p.rowGUID, `Price of ${T(pr)}: choose the price type`);
    else if (!K.priceFor(pt)) add('R13', 'error', K.tables.price, p.rowGUID, `Price of ${T(pr)}: ${T(pt)} is not a ${W.itemLower} price list`);
    if (isSet(p.rowParentGUID) && !variants.has(p.rowParentGUID)) add('R1', 'error', K.tables.price, p.rowGUID, `Price of ${T(pr)}: its variant is missing`);
    else if (!variantAllowedForProduct(data, pr, p.rowParentGUID)) add('R7', 'error', K.tables.price, p.rowGUID, `Price of ${T(pr)}: ${T(variants.get(p.rowParentGUID))} is not one of its variants`);
    // a price is the price of ONE unit of the units catalog
    if (!isSet(p.rowJSON?.measureUnit)) add('R1', 'error', K.tables.price, p.rowGUID, `Price of ${T(pr)}: choose the unit the price is for`);
    else if (!units.has(p.rowJSON.measureUnit)) add('R1', 'error', K.tables.price, p.rowGUID, `Price of ${T(pr)}: unit "${p.rowJSON.measureUnit}" is missing`);
    if (typeof p.rowJSON?.price !== 'number') add('R1', 'warning', K.tables.price, p.rowGUID, `Price of ${T(pr)}: enter the price`);
    if (!p.rowJSON?.validFrom) add('R1', 'warning', K.tables.price, p.rowGUID, `Price of ${T(pr)}: enter "valid from"`);
  }
  return issues;

  function hasValue(row: DefRow<any>) {
    const j = row.rowJSON || {};
    return isSet(j.descriptorValueGUID) || (j.value !== null && j.value !== undefined && j.value !== '');
  }
  /** R5: a list value of the plan line's genus; a scalar genus uses `value` of its type */
  function checkValue(table: ProductTableKey, row: DefRow<any>, plan: DefRow<any>, ownerTitle: string, listOnly = false) {
    const g = genus.get(plan.rowParentGUID);
    if (!g) return;
    const j = row.rowJSON || {};
    const type = g.rowJSON?.valueType ?? 'ref';
    if (type === 'ref' || listOnly) {
      if (!isSet(j.descriptorValueGUID)) return; // empty is reported by R8 when required
      const v = values.get(j.descriptorValueGUID);
      if (!v) add('R5', 'error', table, row.rowGUID, `${ownerTitle}: the value of ${T(g)} is missing`);
      else if (v.rowOwnerGUID !== g.rowGUID) add('R5', 'error', table, row.rowGUID, `${ownerTitle}: ${T(v)} is not a value of ${T(g)}`);
      return;
    }
    if (isSet(j.descriptorValueGUID)) add('R5', 'warning', table, row.rowGUID, `${ownerTitle}: ${T(g)} is a ${type} - use "value", not a list value`);
    const val = j.value;
    if (val === null || val === undefined || val === '') return;
    if (type === 'number' && !Number.isFinite(Number(val))) add('R5', 'error', table, row.rowGUID, `${ownerTitle}: ${T(g)} must be a number`);
    if (type === 'boolean' && typeof val !== 'boolean') add('R5', 'error', table, row.rowGUID, `${ownerTitle}: ${T(g)} must be Yes / No`);
    if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(val))) add('R5', 'error', table, row.rowGUID, `${ownerTitle}: ${T(g)} must be a date YYYY-MM-DD`);
  }
}

/** issues per table key */
export function issuesByTable<T extends string>(issues: ProductIssue<T>[]): Partial<Record<T, ProductIssue<T>[]>> {
  const out: Partial<Record<T, ProductIssue<T>[]>> = {};
  for (const i of issues) (out[i.table] = out[i.table] || []).push(i);
  return out;
}
