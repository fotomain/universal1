// Resource role dashboard - commands that change several rows (dispatched to the reusable sagas of the role / product entities).
// Variants and variant values are the product tables' (same entities and rules): the product commands run on the role data
// seen as product data (roleAsProductData), only the delete is written for the role dashboard tables.
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { createPlannedVariants, rebuildVariants } from '../../product/dashboard/productDashboardActions';
import type { PlannedVariant } from '../../product/crud/productCatalogTools';
import { RESOURCE_ROLE_TABLES, ResourceRoleTableKey } from '../resourceRoleModel';
import { ResourceRoleCatalogData, roleAsProductData } from '../crud/resourceRoleCatalogTools';

type Dispatch = (a: any) => any;

/** creates the variants (owner = role type or role) and one variantValue row per descriptor value; returns the count */
export function createPlannedRoleVariants(dispatch: Dispatch, data: ResourceRoleCatalogData, ownerGUID: string, planned: PlannedVariant[], uuid?: () => string): number {
  return createPlannedVariants(dispatch, roleAsProductData(data), ownerGUID, planned, uuid);
}

/** variant title + descriptorKey from its values (rules R9 / R10); only = these variants; returns the count */
export function rebuildRoleVariants(dispatch: Dispatch, data: ResourceRoleCatalogData, only?: string[]): number {
  return rebuildVariants(dispatch, roleAsProductData(data), only);
}

export function deleteRoleRows(dispatch: Dispatch, key: ResourceRoleTableKey, rows: { rowGUID: string; rowOwnerGUID?: string }[]): number {
  const a = SystemMetaData[RESOURCE_ROLE_TABLES[key].entity]?.actions;
  if (!a?.deleteOne) return 0;
  rows.forEach((r) => dispatch(a.deleteOne({ rowGUID: r.rowGUID, ...(r.rowOwnerGUID ? { rowOwnerGUID: r.rowOwnerGUID } : {}) })));
  return rows.length;
}
