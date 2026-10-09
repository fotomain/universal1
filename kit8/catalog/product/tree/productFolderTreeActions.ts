// Product folder tree - what each tree command saves (dispatched to the reusable saga of productFolderTable / productTable).
//   folder row   productFolderTable: rowOwnerGUID 'productFolderCatalog', rowParentGUID = parent folder | 'empty', rowJSON { title }
//   product row  productTable: rowOwnerGUID = product type, rowParentGUID = its folder | 'empty'
// Same payloads as ReusableTable (createOne / updateOne { columns } / deleteOne), so tables and tree stay in step.
import { SystemMetaData } from '../../../redux/SystemMetaData';
import type { FolderTreeNode, NewNode } from '../../../ui/components/tree/folderTreeModel';
import { PRODUCT_TABLES } from '../productModel';
import type { DefRow } from '../productModel';
import { EMPTY, isSet } from '../crud/productCatalogTools';

type Dispatch = (a: any) => any;
const FOLDER_OWNER = PRODUCT_TABLES.productFolder.catalogOwner as string;
const folderActions = () => SystemMetaData[PRODUCT_TABLES.productFolder.entity]?.actions;
const productActions = () => SystemMetaData[PRODUCT_TABLES.product.entity]?.actions;

/** product folder rows -> tree nodes (title, parent, order) */
export function folderNodes(folders: DefRow<any>[]): FolderTreeNode[] {
  return (folders || []).map((f) => ({
    id: f.rowGUID,
    parentId: isSet(f.rowParentGUID) ? f.rowParentGUID : null,
    title: String(f.rowJSON?.title ?? '').trim() || '(no title)',
    order: Number(f.orderInList) || 0,
  }));
}

export function createFolder(dispatch: Dispatch, n: NewNode): boolean {
  const a = folderActions();
  if (!a?.createOne) return false;
  dispatch(a.createOne({ rowGUID: n.id, rowOwnerGUID: FOLDER_OWNER, rowParentGUID: n.parentId ?? EMPTY, orderInList: n.order, rowJSON: { title: n.title } }));
  return true;
}

export function renameFolder(dispatch: Dispatch, folder: DefRow<any> | undefined, title: string): boolean {
  const a = folderActions();
  if (!a?.updateOne || !folder) return false;
  dispatch(a.updateOne({ rowGUID: folder.rowGUID, rowOwnerGUID: folder.rowOwnerGUID, rowJSON: { title } }));
  return true;
}

/** new parent + new order of a folder (one update) */
export function moveFolder(dispatch: Dispatch, folder: DefRow<any> | undefined, parentId: string | null, order: number): boolean {
  const a = folderActions();
  if (!a?.updateOne || !folder) return false;
  dispatch(a.updateOne({ rowGUID: folder.rowGUID, rowOwnerGUID: folder.rowOwnerGUID, columns: { rowParentGUID: parentId ?? EMPTY, orderInList: order } }));
  return true;
}

/** products to a folder (null = no folder): their rowParentGUID */
export function moveProductsToFolder(dispatch: Dispatch, products: DefRow<any>[], folderId: string | null): number {
  const a = productActions();
  if (!a?.updateOne) return 0;
  const target = folderId ?? EMPTY;
  let n = 0;
  for (const p of products) {
    if (p.rowParentGUID === target) continue;
    dispatch(a.updateOne({ rowGUID: p.rowGUID, rowOwnerGUID: p.rowOwnerGUID, columns: { rowParentGUID: target } }));
    n++;
  }
  return n;
}

/**
 * Deletes folders (the one the user chose + all its subfolders, `ids`). The products in them are NOT deleted: they get
 * no folder. Returns how many products were released.
 */
export function deleteFolders(dispatch: Dispatch, folders: DefRow<any>[], products: DefRow<any>[], ids: string[]): { folders: number; products: number } {
  const fa = folderActions();
  if (!fa?.deleteOne) return { folders: 0, products: 0 };
  const gone = new Set(ids);
  const released = moveProductsToFolder(dispatch, products.filter((p) => gone.has(p.rowParentGUID)), null);
  let count = 0;
  for (const f of folders) {
    if (!gone.has(f.rowGUID)) continue;
    dispatch(fa.deleteOne({ rowGUID: f.rowGUID, rowOwnerGUID: f.rowOwnerGUID }));
    count++;
  }
  return { folders: count, products: released };
}
