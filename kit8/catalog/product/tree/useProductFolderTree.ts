// Product folder tree - the folders of productFolderTable as a ReusableTable `foldersTree` binding (and the nodes + CRUD
// callbacks for a stand-alone FolderTreeReusable): create / rename / move / delete save through redux, so the tree, the
// "Folders" table of the dashboard and every other screen see the same rows (realtime).
import { useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { showSnackbar } from '../../../redux/uxuiSlice';
import type { ReusableTableFoldersTree } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { FolderTreeReusableProps } from '../../../ui/components/tree/FolderTreeReusable';
import type { ProductCatalogData } from '../crud/productCatalogTools';
import { createFolder, deleteFolders, folderNodes, moveFolder, moveProductsToFolder, renameFolder } from './productFolderTreeActions';

type Needs = Pick<ProductCatalogData, 'productFolder' | 'product'>;

export function useProductFolderTree(data: Needs, onRefresh?: () => void) {
  const dispatch = useDispatch();
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);
  const live = useRef(data);
  live.current = data;
  const nodes = useMemo(() => folderNodes(data.productFolder), [data.productFolder]);

  /** CRUD props of FolderTreeReusable (same for the stand-alone tree and the one beside the product table) */
  const treeProps = useMemo<Pick<FolderTreeReusableProps, 'newId' | 'newFolderTitle' | 'onCreate' | 'onRename' | 'onMove' | 'onDelete' | 'onRefresh' | 'deleteHint'>>(() => ({
    newId: () => Crypto.randomUUID(),
    newFolderTitle: 'New folder',
    onCreate: (n) => { createFolder(dispatch, n); },
    onRename: (id, title) => { renameFolder(dispatch, live.current.productFolder.find((f) => f.rowGUID === id), title); },
    onMove: (m) => { moveFolder(dispatch, live.current.productFolder.find((f) => f.rowGUID === m.id), m.parentId, m.order); },
    onDelete: (ids) => {
      const r = deleteFolders(dispatch, live.current.productFolder, live.current.product, ids);
      if (r.products > 0) dispatch(showSnackbar({ message: `${r.products} product${r.products === 1 ? '' : 's'} moved to "No folder"` }));
    },
    onRefresh,
    deleteHint: 'Its products are kept and get no folder.',
  }), [dispatch, onRefresh]);

  /** the binding for ReusableTable (uxuiTable.showFoldersTree + foldersTree) */
  const foldersTree = useMemo<ReusableTableFoldersTree>(() => ({
    nodes,
    folderTarget: 'rowParentGUID',
    noFolderValue: 'empty',
    includeSubfolders: true,
    tree: { title: 'Product folders', allLabel: 'All products', noneLabel: 'No folder', ...treeProps },
  }), [nodes, treeProps]);

  /** products dropped on a folder, for a tree that is NOT inside a table */
  const dropProducts = (folderId: string | null, productGUIDs: string[]) => {
    const set = new Set(productGUIDs);
    return moveProductsToFolder(dispatch, live.current.product.filter((p) => set.has(p.rowGUID)), folderId);
  };

  return { nodes, treeProps, foldersTree, dropProducts, askBeforeDelete };
}
