// Resource role catalog - the validation rules of the sheet (R1-R14, role side) as a report (pure, unit-tested).
// The descriptor rules are the product ones (product/crud/productValidation.ts, run on roleAsProductData with ROLE_KIND);
// this file adds what only roles have: the base unit of the role type and rule R14 (rates only in rolePriceTable).
import { priceTypeForRoles, ResourceRoleCatalogData, roleAsProductData, isSet, rowTitle, byGUID } from './resourceRoleCatalogTools';
import { CatalogKind, ProductIssue, RULES, validateProductCatalog } from '../../product/crud/productValidation';
import type { ResourceRoleTableKey } from '../resourceRoleModel';

export { issuesByTable } from '../../product/crud/productValidation';
/** a finding of the role catalog: `table` is a role dashboard table */
export type ResourceRoleIssue = ProductIssue<ResourceRoleTableKey>;

export const ROLE_KIND: CatalogKind = {
  kind: 'resourceRoleType',
  tables: { type: 'resourceRoleType', item: 'resourceRole', folder: 'resourceRoleFolder', price: 'rolePrice' },
  vat: { type: 'roleVATDefaultRate', item: 'roleVATRate' },
  words: { item: 'Role', itemLower: 'role', type: 'Role type', typeLower: 'role type' },
  priceFor: priceTypeForRoles,
  productLogistics: false,
};

const { GTIN: _gtin, ...PRODUCT_RULES } = RULES;
export const ROLE_RULES: Record<string, string> = {
  ...PRODUCT_RULES,
  R3: 'A descriptor appears only once per role type (Property OR Variant)',
  R7: 'Rates use variants allowed for their role',
  R11: 'A plan line descriptor is meant for role types',
  R12: 'Role side mirrors the product side: sets and variants are owned by the role TYPE, property values and rates by the ROLE',
  R13: 'Price type is meant for resource roles',
  R14: 'Rates are stored ONLY in rolePriceTable (no rate fields in a role or variant)',
};

/** rate-like fields a role / variant must not carry (rule R14) */
const RATE_FIELDS = ['rate', 'ratePerHour', 'hourlyRate', 'price'];

export function validateResourceRoleCatalog(data: ResourceRoleCatalogData): ResourceRoleIssue[] {
  // the shared rules only point at tables the role dashboard has (descriptor tables + the four role tables)
  const issues = validateProductCatalog(roleAsProductData(data), ROLE_KIND) as ResourceRoleIssue[];
  const T = (r: Parameters<typeof rowTitle>[0]) => `"${rowTitle(r)}"`;
  const units = byGUID(data.measureUnit);
  for (const t of data.resourceRoleType) {
    const unit = t.rowJSON?.baseUnit;
    if (!isSet(unit)) issues.push({ rule: 'R1', severity: 'warning', table: 'resourceRoleType', rowGUID: t.rowGUID, message: `Role type ${T(t)}: choose the base unit of its rates (hour)` });
    else if (!units.has(unit)) issues.push({ rule: 'R1', severity: 'error', table: 'resourceRoleType', rowGUID: t.rowGUID, message: `Role type ${T(t)}: base unit "${unit}" is missing` });
  }
  const rateField = (j: Record<string, any> | undefined) => RATE_FIELDS.find((f) => j && j[f] !== undefined && j[f] !== null);
  for (const r of data.resourceRole) {
    const f = rateField(r.rowJSON);
    if (f) issues.push({ rule: 'R14', severity: 'warning', table: 'resourceRole', rowGUID: r.rowGUID, message: `Role ${T(r)}: "${f}" belongs in the Rates table (rolePriceTable), not in the role` });
  }
  return issues;
}
