// Management genus - the management-accounting classes a resource (role type) belongs to: costs (time, material, expense),
// revenue, payments (inbound, outbound). Two levels in ONE table:
//   folders (level 1)  costsGenus · revenuesGenus · paymentsGenus                      rowParentGUID 'empty'
//   items   (level 2)  timeGenus, materialGenus, expenseGenus · revenueGenus · inboundPaymentGenus, outboundPaymentGenus   rowParentGUID = its folder
//   managementGenusTable   rowGUID = the code · rowOwnerGUID 'managementGenusCatalog' · rowParentGUID = folder | 'empty' · rowJSON { title, description }
//   Only the ITEMS are genus a role type can have; the folders group them.
//   resourceRoleTypeTable.rowJSON.managementGenus = the rowGUID of the genus of the role type (Human Resources -> timeGenus)
//   SQL: kit8/sql/init/create_management_genus_table.sql · Screen: ManagementGenusDashboardCRUD · route MANAGEMENT_GENUS_ROUTES.list
import type { FolderTreeNode } from '../../../ui/components/tree/folderTreeModel';
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const MANAGEMENT_GENUS_ROUTES = { list: '/catalog/management/genus/list' } as const;

export const MANAGEMENT_GENUS_TABLE: ProductTableDef = {
  table: 'managementGenusTable',
  entity: 'managementGenusReusable',
  itemLabel: 'Genus',
  catalogOwner: 'managementGenusCatalog',
  purpose: 'The management classes of resources and money: costs (time, material, expense), revenue, payments (inbound, outbound). A resource role type points at its genus.',
  emptyRowJSON: () => ({ title: null, description: null }),
};

/** rowGUIDs of the seed rows */
export const MANAGEMENT_GENUS = {
  costs: 'costsGenus',
  time: 'timeGenus',
  material: 'materialGenus',
  expense: 'expenseGenus',
  revenues: 'revenuesGenus',
  revenue: 'revenueGenus',
  payments: 'paymentsGenus',
  inboundPayment: 'inboundPaymentGenus',
  outboundPayment: 'outboundPaymentGenus',
} as const;

export interface ManagementGenusJSON { title: string; description?: string | null }

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** a folder = a top level row (level 1); everything below is an item */
export const isManagementGenusFolder = (r: DefRow<any>) => !isSet(r.rowParentGUID);
export const managementGenusFolders = (rows: DefRow<any>[]) => (rows || []).filter(isManagementGenusFolder);
/** the genus a role type can have (level 2) */
export const managementGenusItems = (rows: DefRow<any>[]) => (rows || []).filter((r) => !isManagementGenusFolder(r));

/** the FOLDERS as tree nodes (title, order); the items are the rows of the table */
export function managementGenusNodes(rows: DefRow<any>[]): FolderTreeNode[] {
  return managementGenusFolders(rows).map((r) => ({
    id: r.rowGUID,
    parentId: null,
    title: String(r.rowJSON?.title ?? '').trim() || '(no title)',
    order: Number(r.orderInList) || 0,
  }));
}

/** 'Costs › Time' */
export function managementGenusPath(rows: DefRow<any>[], guid: string | null | undefined): string {
  const byId = new Map((rows || []).map((r) => [r.rowGUID, r]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let g = guid;
  while (isSet(g) && !seen.has(g)) {
    seen.add(g);
    const r = byId.get(g);
    if (!r) { parts.unshift(g); break; }
    parts.unshift(String(r.rowJSON?.title ?? '').trim() || r.rowGUID);
    g = r.rowParentGUID;
  }
  return parts.join(' › ');
}

/** the genus and every genus below it */
export function managementGenusDescendants(rows: DefRow<any>[], guid: string): Set<string> {
  const out = new Set<string>([guid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows || []) if (!out.has(r.rowGUID) && out.has(r.rowParentGUID)) { out.add(r.rowGUID); grew = true; }
  }
  return out;
}
