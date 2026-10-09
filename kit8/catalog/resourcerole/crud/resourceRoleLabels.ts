// Resource role catalog - titles and pick lists built from the loaded rows (pure, unit-tested). The lists are the product ones
// (product/crud/productLabels.ts, built on roleAsProductData) with the role wording; `roleTitle` takes a role-side table key.
import type { SelectOption } from '../../../ui/components/table/reusable/reusableTableTypes';
import { buildProductLabels, ProductLabels } from '../../product/crud/productLabels';
import { ProductCatalogData } from '../../product/crud/productCatalogTools';
import { ROLE_AS_PRODUCT_SLOT, ResourceRoleOwnKey, ResourceRoleTableKey } from '../resourceRoleModel';
import { managementGenusItems, managementGenusPath } from '../../management/genus/managementGenusModel';
import { priceTypeForRoles, ResourceRoleCatalogData, roleAsProductData } from './resourceRoleCatalogTools';

export interface ResourceRoleLabels extends ProductLabels {
  /** the title of any row of the role dashboard tables ('' = none) */
  roleTitle: (table: ResourceRoleTableKey, guid: string | null | undefined) => string;
  options: ProductLabels['options'] & {
    /** price lists a rate may use (appliesTo resourceRoleType) */
    rateTypes: SelectOption[];
    /** descriptors meant for role types (targetKinds) */
    roleGenus: SelectOption[];
    /** the roles: 'IT project manager' (hint: type) */
    roles: SelectOption[];
    /** the management genus a role type can have - the items, not the folders: 'Costs › Time' */
    managementGenus: SelectOption[];
  };
}

const roleWords = (label: string) => label.replace(/^Type · /, 'Role type · ').replace(/^Product · /, 'Role · ');

export function buildResourceRoleLabels(data: ResourceRoleCatalogData, adapted: ProductCatalogData = roleAsProductData(data)): ResourceRoleLabels {
  const base = buildProductLabels(adapted);
  const genusRows = data.descriptorGenus.filter((g) => !Array.isArray(g.rowJSON?.targetKinds) || !g.rowJSON.targetKinds.length || g.rowJSON.targetKinds.includes('resourceRoleType'));
  const roleGenus = new Set(genusRows.map((g) => g.rowGUID));
  const ptRows = new Set(data.priceType.filter((p) => priceTypeForRoles(p)).map((p) => p.rowGUID));
  const O = base.options;
  return {
    ...base,
    roleTitle: (table, guid) => base.title((ROLE_AS_PRODUCT_SLOT[table as ResourceRoleOwnKey] ?? table) as keyof ProductCatalogData, guid),
    ownerLabel: (guid) => roleWords(base.ownerLabel(guid)),
    options: {
      ...O,
      variantOwners: O.variantOwners.map((o) => ({ ...o, label: roleWords(o.label) })),
      packOwners: O.packOwners.map((o) => ({ ...o, label: roleWords(o.label) })),
      rateTypes: O.priceTypes.filter((o) => ptRows.has(o.value)),
      roleGenus: O.genus.filter((o) => roleGenus.has(o.value)),
      roles: O.products,
      managementGenus: managementGenusItems(data.managementGenus ?? []).map((g) => ({ value: g.rowGUID, label: managementGenusPath(data.managementGenus, g.rowGUID) || g.rowGUID })).sort((a, b) => a.label.localeCompare(b.label)),
    },
  };
}
