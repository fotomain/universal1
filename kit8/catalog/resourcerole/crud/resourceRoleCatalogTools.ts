// Resource role catalog - pure rules. The descriptor rules (sets, plan lines, variant owner R6, descriptorKey + title R9/R10,
// generated variants, valid price R13) are written ONCE for the product catalog (product/crud/productCatalogTools.ts); the role
// catalog feeds them through roleAsProductData(): role type = product type, role = product, role rate = product price.
import type { DefRow, ProductTableKey } from '../../product/productModel';
import {
  currentPrice, isSet, ProductCatalogData, variantAllowedForProduct, variantOwnerOfProduct, variantsOfProduct,
} from '../../product/crud/productCatalogTools';
import { RESOURCE_ROLE_TABLE_KEYS, ROLE_AS_PRODUCT_SLOT, ResourceRoleTableKey } from '../resourceRoleModel';

export { byGUID, EMPTY, isSet, rowTitle, sortBySort } from '../../product/crud/productCatalogTools';

/** every table of the role dashboard (rows as read into redux; the shared rows are those of the role side) */
export type ResourceRoleCatalogData = Record<ResourceRoleTableKey, DefRow<any>[]> & {
  /** managementGenusTable (kit8/catalog/management/genus): the genus a role type points at with rowJSON.managementGenus */
  managementGenus: DefRow<any>[];
};

export const emptyResourceRoleData = (): ResourceRoleCatalogData =>
  RESOURCE_ROLE_TABLE_KEYS.reduce((acc, k) => ({ ...acc, [k]: [] }), { managementGenus: [] } as unknown as ResourceRoleCatalogData);

/** the role catalog as the product catalog the shared rules are written for (no packs, series, barcodes) */
export function roleAsProductData(d: ResourceRoleCatalogData): ProductCatalogData {
  return {
    valueAddedTax: d.valueAddedTax, measureUnit: d.measureUnit, descriptorGenus: d.descriptorGenus, descriptorValue: d.descriptorValue,
    descriptorMode: d.descriptorMode, descriptorDestination: d.descriptorDestination, descriptorPlan: d.descriptorPlan,
    propertyValue: d.propertyValue, variant: d.variant, variantValue: d.variantValue, priceType: d.priceType,
    productType: d.resourceRoleType, productFolder: d.resourceRoleFolder, product: d.resourceRole, productPrice: d.rolePrice,
    productPackage: [], productSeries: [], productBarcode: [],
  };
}

/** the role-side key of a product-catalog slot ('productType' -> 'resourceRoleType'); other keys stay */
export const roleKeyOfSlot = (slot: ProductTableKey): ResourceRoleTableKey =>
  (Object.entries(ROLE_AS_PRODUCT_SLOT).find(([, s]) => s === slot)?.[0] as ResourceRoleTableKey | undefined) ?? (slot as ResourceRoleTableKey);

/** the rate a resource has when its VAT is empty: 0 % (valueAddedTaxTable row 'vat_0') */
export const ZERO_VAT_RATE = 'vat_0';

/**
 * The VAT rate of a role: its own roleVATRate, else the roleVATDefaultRate of its role type, else - when both are empty - 0 %.
 * undefined only for a missing role (or when the VAT table has no 0 % row).
 */
export function vatRateOfRole(data: ResourceRoleCatalogData, role: DefRow<any> | undefined | null): DefRow<any> | undefined {
  if (!role) return undefined;
  const own = role.rowJSON?.roleVATRate;
  const type = data.resourceRoleType.find((t) => t.rowGUID === role.rowOwnerGUID);
  const guid = isSet(own) ? own : type?.rowJSON?.roleVATDefaultRate;
  if (isSet(guid)) return data.valueAddedTax.find((v) => v.rowGUID === guid);
  return data.valueAddedTax.find((v) => v.rowGUID === ZERO_VAT_RATE) ?? data.valueAddedTax.find((v) => Number(v.rowJSON?.vatTablePercent) === 0);
}

/** the VAT percent of a role (0 when its VAT is empty) */
export const vatPercentOfRole = (data: ResourceRoleCatalogData, role: DefRow<any> | undefined | null): number =>
  Number(vatRateOfRole(data, role)?.rowJSON?.vatTablePercent) || 0;

// ───────────── variants of a role (rule R6: perType -> the role type owns them) ─────────────
export const variantOwnerOfRole = (data: ResourceRoleCatalogData, role: DefRow<any> | undefined) => variantOwnerOfProduct(roleAsProductData(data), role);
export const variantsOfRole = (data: ResourceRoleCatalogData, role: DefRow<any> | undefined) => variantsOfProduct(roleAsProductData(data), role);
export const variantAllowedForRole = (data: ResourceRoleCatalogData, role: DefRow<any> | undefined, variantGUID: string | null | undefined) =>
  variantAllowedForProduct(roleAsProductData(data), role, variantGUID);

// ───────────── rates (rule R13) ─────────────
/** price type may be used for resource roles (appliesTo); a type without appliesTo may be used anywhere */
export const priceTypeForRoles = (pt: DefRow<any> | undefined) => !pt || !Array.isArray(pt.rowJSON?.appliesTo) || pt.rowJSON.appliesTo.includes('resourceRoleType');

/**
 * The rate valid on `day` for a role (+ variant) and price list: the latest validFrom <= day; a row of the variant beats the
 * "all variants" row. Prefers the rates per the role type's base unit (hour), then any unit. null = no rate.
 */
export function currentRate(rates: DefRow<any>[], role: DefRow<any>, roleType: DefRow<any> | undefined, variantGUID: string | null, priceTypeGUID: string, day: string): DefRow<any> | null {
  const unit = roleType?.rowJSON?.baseUnit;
  return (isSet(unit) ? currentPrice(rates, role.rowGUID, variantGUID, priceTypeGUID, day, unit) : null)
    ?? currentPrice(rates, role.rowGUID, variantGUID, priceTypeGUID, day);
}
