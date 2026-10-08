// Product catalog - pure rules of the descriptor model (unit-tested: __tests__/catalog/product).
//   R6  who owns the variants of a product (variantMode)
//   R9  descriptorKey = sorted 'dp=dv' pairs computed from variantValueTable
//   R10 variant title from the product type's variantTitleTemplate
//   R13 the valid price = latest validFrom <= day; a variant row beats the "all variants" row
import { MODE_PROPERTY, MODE_VARIANT, PRODUCT_TABLE_KEYS, ProductTableKey } from '../productModel';
import type { DefRow } from '../productModel';

/** every table of the catalog (rows as read into redux) */
export type ProductCatalogData = Record<ProductTableKey, DefRow<any>[]>;

export const emptyCatalogData = (): ProductCatalogData =>
  PRODUCT_TABLE_KEYS.reduce((acc, k) => ({ ...acc, [k]: [] }), {} as ProductCatalogData);

export const EMPTY = 'empty';
export const isSet = (guid: unknown): guid is string => typeof guid === 'string' && guid !== '' && guid !== EMPTY;

export function byGUID<T extends DefRow<any>>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows || []) if (r?.rowGUID) m.set(r.rowGUID, r);
  return m;
}
const sortKey = (r: DefRow<any>) => Number(r?.rowJSON?.sort ?? Number.MAX_SAFE_INTEGER);
/** by rowJSON.sort, then orderInList */
export function sortBySort<T extends DefRow<any>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => sortKey(a) - sortKey(b) || Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0));
}

/** the title of any catalog row ('' = none) */
export function rowTitle(r: DefRow<any> | undefined | null): string {
  const j = r?.rowJSON || {};
  return String(j.title ?? j.number ?? j.serialNumber ?? j.barcode ?? r?.rowGUID ?? '');
}

// ───────────── descriptor sets ─────────────
/** plan lines of a descriptor set (destination), in their order */
export function planLinesOfSet(data: ProductCatalogData, setGUID: string | null | undefined): DefRow<any>[] {
  if (!isSet(setGUID)) return [];
  return sortBySort(data.descriptorPlan.filter((p) => p.rowOwnerGUID === setGUID));
}

/** the destination (set) of a product type for a mode: the type's propertySet / variantSet, else the destination row of that type + mode */
export function setOfType(data: ProductCatalogData, typeGUID: string | null | undefined, mode: 'property' | 'variant'): string | null {
  if (!isSet(typeGUID)) return null;
  const type = data.productType.find((t) => t.rowGUID === typeGUID);
  const declared = type?.rowJSON?.[mode === MODE_PROPERTY ? 'propertySet' : 'variantSet'];
  if (isSet(declared)) return declared;
  const dest = data.descriptorDestination.find((d) => d.rowOwnerGUID === typeGUID && d.rowParentGUID === mode);
  return dest?.rowGUID ?? null;
}

/** the product type whose variant set describes the variants of `typeGUID` (sharedWithType -> the shared type) */
export function variantSourceType(data: ProductCatalogData, typeGUID: string | null | undefined): string | null {
  if (!isSet(typeGUID)) return null;
  const type = data.productType.find((t) => t.rowGUID === typeGUID);
  if (type?.rowJSON?.variantMode === 'sharedWithType' && isSet(type.rowJSON.variantSharedTypeGUID)) return type.rowJSON.variantSharedTypeGUID;
  return typeGUID;
}

/** property plan lines of a product (its type's property set) */
export function propertyLinesOfProduct(data: ProductCatalogData, product: DefRow<any> | undefined): DefRow<any>[] {
  return product ? planLinesOfSet(data, setOfType(data, product.rowOwnerGUID, MODE_PROPERTY)) : [];
}

/** the product type a variant owner stands for: the type itself, or the type of the product */
export function typeOfVariantOwner(data: ProductCatalogData, ownerGUID: string | null | undefined): string | null {
  if (!isSet(ownerGUID)) return null;
  if (data.productType.some((t) => t.rowGUID === ownerGUID)) return ownerGUID;
  const product = data.product.find((p) => p.rowGUID === ownerGUID);
  return product ? product.rowOwnerGUID : null;
}

/** variant plan lines for variants owned by a type or a product */
export function variantLinesOfOwner(data: ProductCatalogData, ownerGUID: string | null | undefined): DefRow<any>[] {
  const type = variantSourceType(data, typeOfVariantOwner(data, ownerGUID));
  return planLinesOfSet(data, setOfType(data, type, MODE_VARIANT));
}

// ───────────── R6: variants of a product ─────────────
/** who owns the variants a product may use (null = no variants) */
export function variantOwnerOfProduct(data: ProductCatalogData, product: DefRow<any> | undefined): string | null {
  if (!product) return null;
  const type = data.productType.find((t) => t.rowGUID === product.rowOwnerGUID);
  const mode = type?.rowJSON?.variantMode;
  if (mode === 'perType') return type!.rowGUID;
  if (mode === 'perProduct') return product.rowGUID;
  if (mode === 'sharedWithType') return isSet(type!.rowJSON.variantSharedTypeGUID) ? type!.rowJSON.variantSharedTypeGUID : null;
  return null;
}
/** the variants a product may use (rule R6), active first */
export function variantsOfProduct(data: ProductCatalogData, product: DefRow<any> | undefined): DefRow<any>[] {
  const owner = variantOwnerOfProduct(data, product);
  if (!owner) return [];
  return data.variant.filter((v) => v.rowOwnerGUID === owner).sort((a, b) => Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0));
}
export function variantAllowedForProduct(data: ProductCatalogData, product: DefRow<any> | undefined, variantGUID: string | null | undefined): boolean {
  if (!isSet(variantGUID)) return true; // empty = all variants / the product itself
  return variantsOfProduct(data, product).some((v) => v.rowGUID === variantGUID);
}

// ───────────── R9 / R10: descriptorKey + title ─────────────
/** sorted 'planGUID=valueGUID' pairs joined by '|' */
export function descriptorKey(pairs: { planGUID: string; valueGUID: string }[]): string {
  return pairs.filter((p) => isSet(p.planGUID) && isSet(p.valueGUID)).map((p) => `${p.planGUID}=${p.valueGUID}`).sort().join('|');
}

/**
 * '{color} / {deviceMemory}' + { color: 'Red', deviceMemory: '256 GB' } -> 'Red / 256 GB'.
 * A missing value drops its placeholder AND the separator in front of it ('{portion}, {sauce}' without sauce -> 'Double').
 * No template: the values joined by ' / ' in `order`.
 */
export function buildVariantTitle(template: string | null | undefined, values: Record<string, string>, order: string[] = Object.keys(values)): string {
  if (!template || !/\{\w+\}/.test(template)) return order.map((k) => values[k]).filter(Boolean).join(' / ');
  const tokens = template.split(/(\{\w+\})/);
  let out = tokens[0];
  let have = false;
  let sep = '';
  for (let i = 1; i < tokens.length; i += 2) {
    const v = values[tokens[i].slice(1, -1)];
    const after = tokens[i + 1] ?? '';
    if (v) {
      out += (have ? sep : '') + v;
      have = true;
      sep = after;
    }
  }
  // the text after the last placeholder ('…)') stays when the last value is there
  const last = tokens.length >= 2 ? values[tokens[tokens.length - 2].slice(1, -1)] : '';
  if (last) out += tokens[tokens.length - 1];
  return out.trim();
}

/** genus code -> the shown value of a variant (from its variantValue rows) */
export function variantValueTitles(data: ProductCatalogData, variantGUID: string): { titles: Record<string, string>; pairs: { planGUID: string; valueGUID: string }[]; order: string[] } {
  const plans = byGUID(data.descriptorPlan);
  const values = byGUID(data.descriptorValue);
  const rows = data.variantValue.filter((vv) => vv.rowOwnerGUID === variantGUID);
  const titles: Record<string, string> = {};
  const pairs: { planGUID: string; valueGUID: string }[] = [];
  const withSort = rows.map((vv) => ({ vv, plan: plans.get(vv.rowParentGUID) })).sort((a, b) => sortKey(a.plan as any) - sortKey(b.plan as any));
  const order: string[] = [];
  for (const { vv, plan } of withSort) {
    const valueGUID = vv.rowJSON?.descriptorValueGUID;
    if (!plan || !isSet(valueGUID)) continue;
    pairs.push({ planGUID: plan.rowGUID, valueGUID });
    const genus = plan.rowParentGUID;
    titles[genus] = rowTitle(values.get(valueGUID)) || valueGUID;
    order.push(genus);
  }
  return { titles, pairs, order };
}

/** what title + descriptorKey a variant should have (computed from its variant values) */
export function computedVariant(data: ProductCatalogData, variant: DefRow<any>): { title: string; descriptorKey: string } {
  const { titles, pairs, order } = variantValueTitles(data, variant.rowGUID);
  const type = data.productType.find((t) => t.rowGUID === variantSourceType(data, typeOfVariantOwner(data, variant.rowOwnerGUID)));
  return { title: buildVariantTitle(type?.rowJSON?.variantTitleTemplate, titles, order), descriptorKey: descriptorKey(pairs) };
}

/** variants whose stored title / descriptorKey differ from the computed ones (only variants with values) */
export function variantsToRebuild(data: ProductCatalogData): { variant: DefRow<any>; title: string; descriptorKey: string }[] {
  const out: { variant: DefRow<any>; title: string; descriptorKey: string }[] = [];
  for (const v of data.variant) {
    const c = computedVariant(data, v);
    if (!c.descriptorKey) continue;
    if (c.descriptorKey !== (v.rowJSON?.descriptorKey ?? '') || (c.title && c.title !== (v.rowJSON?.title ?? ''))) out.push({ variant: v, ...c });
  }
  return out;
}

// ───────────── generate variants (cartesian product of the variant set values) ─────────────
export interface PlannedVariant {
  title: string;
  descriptorKey: string;
  values: { planGUID: string; valueGUID: string }[];
}

/**
 * The variants a type / product is still missing: every combination of the values of the REQUIRED lines of its
 * variant set (optional lines are left empty), skipping descriptorKeys that already exist. `limit` caps the result.
 * `only` = genus -> value GUIDs to use (default: every value of the genus).
 */
export function plannedVariants(data: ProductCatalogData, ownerGUID: string, opts: { limit?: number; only?: Record<string, string[]> } = {}): PlannedVariant[] {
  const limit = opts.limit ?? 500;
  const lines = variantLinesOfOwner(data, ownerGUID).filter((l) => l.rowJSON?.required);
  if (lines.length === 0) return [];
  const valuesOf = (genus: string) => {
    const all = sortBySort(data.descriptorValue.filter((v) => v.rowOwnerGUID === genus));
    const only = opts.only?.[genus];
    return only && only.length ? all.filter((v) => only.includes(v.rowGUID)) : all;
  };
  const axes = lines.map((l) => ({ line: l, values: valuesOf(l.rowParentGUID) }));
  if (axes.some((a) => a.values.length === 0)) return [];
  const existing = new Set(data.variant.filter((v) => v.rowOwnerGUID === ownerGUID).map((v) => v.rowJSON?.descriptorKey).filter(Boolean));
  const type = data.productType.find((t) => t.rowGUID === variantSourceType(data, typeOfVariantOwner(data, ownerGUID)));
  const out: PlannedVariant[] = [];
  const walk = (i: number, picked: { planGUID: string; valueGUID: string; genus: string; title: string }[]) => {
    if (out.length >= limit) return;
    if (i === axes.length) {
      const values = picked.map(({ planGUID, valueGUID }) => ({ planGUID, valueGUID }));
      const key = descriptorKey(values);
      if (existing.has(key)) return;
      const titles: Record<string, string> = {};
      picked.forEach((p) => { titles[p.genus] = p.title; });
      out.push({ title: buildVariantTitle(type?.rowJSON?.variantTitleTemplate, titles, picked.map((p) => p.genus)), descriptorKey: key, values });
      return;
    }
    for (const v of axes[i].values) walk(i + 1, [...picked, { planGUID: axes[i].line.rowGUID, valueGUID: v.rowGUID, genus: axes[i].line.rowParentGUID, title: rowTitle(v) }]);
  };
  walk(0, []);
  return out;
}

// ───────────── R13: prices ─────────────
/**
 * The price valid on `day` for a product (+ variant) and price type: the latest validFrom <= day; a row of the
 * variant beats the "all variants" row (rowParentGUID 'empty'). null = no price.
 */
export function currentPrice(prices: DefRow<any>[], productGUID: string, variantGUID: string | null, priceTypeGUID: string, day: string): DefRow<any> | null {
  const pick = (variant: string | null) => {
    let best: DefRow<any> | null = null;
    for (const p of prices) {
      if (p.rowOwnerGUID !== productGUID || p.rowJSON?.priceTypeGUID !== priceTypeGUID) continue;
      const pv = isSet(p.rowParentGUID) ? p.rowParentGUID : null;
      if (pv !== variant) continue;
      const from = String(p.rowJSON?.validFrom ?? '');
      if (!from || from > day) continue;
      if (!best || from > String(best.rowJSON?.validFrom ?? '')) best = p;
    }
    return best;
  };
  return (variantGUID ? pick(variantGUID) : null) ?? pick(null);
}

/** price type may be used for products (appliesTo) */
export const priceTypeForProducts = (pt: DefRow<any> | undefined) => !pt || !Array.isArray(pt.rowJSON?.appliesTo) || pt.rowJSON.appliesTo.includes('product');

// ───────────── barcodes ─────────────
/** GTIN-8 / 12 / 13 / 14 with a correct check digit */
export function isValidGtin(code: unknown): boolean {
  const s = String(code ?? '').trim();
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s)) return false;
  const digits = s.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** the next free EAN-13 with the same 7-digit prefix as the existing ones (default prefix 4750001) */
export function nextEan13(existing: string[], prefix = '4750001'): string {
  const body = (n: number) => `${prefix}${String(n).padStart(12 - prefix.length, '0')}`;
  const withCheck = (b: string) => {
    const sum = b.split('').map(Number).reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
    return b + String((10 - (sum % 10)) % 10);
  };
  const used = new Set(existing);
  let max = 0;
  for (const c of existing) if (c.startsWith(prefix) && c.length === 13) max = Math.max(max, Number(c.slice(prefix.length, 12)) || 0);
  let n = max + 1;
  while (used.has(withCheck(body(n)))) n++;
  return withCheck(body(n));
}
