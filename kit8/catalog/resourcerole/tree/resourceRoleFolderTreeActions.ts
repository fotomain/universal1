// Resource role folder tree - what each tree command saves (dispatched to the reusable saga of resourceRoleFolderTable / resourceRoleTable).
//   folder row  resourceRoleFolderTable: rowOwnerGUID 'resourceRoleFolderCatalog', rowParentGUID = parent folder | 'empty', rowJSON { title }
//   role row    resourceRoleTable: rowOwnerGUID = role type, rowParentGUID = its folder | 'empty'
// Same payloads as ReusableTable (createOne / updateOne { columns } / deleteOne), so tables and tree stay in step.
import { SystemMetaData } from '../../../redux/SystemMetaData';
import type { FolderTreeNode, NewNode } from '../../../ui/components/tree/folderTreeModel';
import type { DefRow } from '../../product/productModel';
import { EMPTY, isSet } from '../../product/crud/productCatalogTools';
import { RESOURCE_ROLE_OWN_TABLES } from '../resourceRoleModel';

type Dispatch = (a: any) => any;
const FOLDER_OWNER = RESOURCE_ROLE_OWN_TABLES.resourceRoleFolder.catalogOwner as string;
const folderActions = () => SystemMetaData[RESOURCE_ROLE_OWN_TABLES.resourceRoleFolder.entity]?.actions;
const roleActions = () => SystemMetaData[RESOURCE_ROLE_OWN_TABLES.resourceRole.entity]?.actions;

/** role folder rows -> tree nodes (title, parent, order) */
export function roleFolderNodes(folders: DefRow<any>[]): FolderTreeNode[] {
  return (folders || []).map((f) => ({
    id: f.rowGUID,
    parentId: isSet(f.rowParentGUID) ? f.rowParentGUID : null,
    title: String(f.rowJSON?.title ?? '').trim() || '(no title)',
    order: Number(f.orderInList) || 0,
  }));
}

export function createRoleFolder(dispatch: Dispatch, n: NewNode): boolean {
  const a = folderActions();
  if (!a?.createOne) return false;
  dispatch(a.createOne({ rowGUID: n.id, rowOwnerGUID: FOLDER_OWNER, rowParentGUID: n.parentId ?? EMPTY, orderInList: n.order, rowJSON: { title: n.title } }));
  return true;
}

export function renameRoleFolder(dispatch: Dispatch, folder: DefRow<any> | undefined, title: string): boolean {
  const a = folderActions();
  if (!a?.updateOne || !folder) return false;
  dispatch(a.updateOne({ rowGUID: folder.rowGUID, rowOwnerGUID: folder.rowOwnerGUID, rowJSON: { title } }));
  return true;
}

/** new parent + new order of a folder (one update) */
export function moveRoleFolder(dispatch: Dispatch, folder: DefRow<any> | undefined, parentId: string | null, order: number): boolean {
  const a = folderActions();
  if (!a?.updateOne || !folder) return false;
  dispatch(a.updateOne({ rowGUID: folder.rowGUID, rowOwnerGUID: folder.rowOwnerGUID, columns: { rowParentGUID: parentId ?? EMPTY, orderInList: order } }));
  return true;
}

/** roles to a folder (null = no folder): their rowParentGUID */
export function moveRolesToFolder(dispatch: Dispatch, roles: DefRow<any>[], folderId: string | null): number {
  const a = roleActions();
  if (!a?.updateOne) return 0;
  const target = folderId ?? EMPTY;
  let n = 0;
  for (const r of roles) {
    if (r.rowParentGUID === target) continue;
    dispatch(a.updateOne({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID, columns: { rowParentGUID: target } }));
    n++;
  }
  return n;
}

/**
 * Deletes folders (the one the user chose + all its subfolders, `ids`). The roles in them are NOT deleted: they get
 * no folder. Returns how many roles were released.
 */
export function deleteRoleFolders(dispatch: Dispatch, folders: DefRow<any>[], roles: DefRow<any>[], ids: string[]): { folders: number; roles: number } {
  const fa = folderActions();
  if (!fa?.deleteOne) return { folders: 0, roles: 0 };
  const gone = new Set(ids);
  const released = moveRolesToFolder(dispatch, roles.filter((r) => gone.has(r.rowParentGUID)), null);
  let count = 0;
  for (const f of folders) {
    if (!gone.has(f.rowGUID)) continue;
    dispatch(fa.deleteOne({ rowGUID: f.rowGUID, rowOwnerGUID: f.rowOwnerGUID }));
    count++;
  }
  return { folders: count, roles: released };
}
