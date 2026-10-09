// ProductFolderTree - the product catalog folders (productFolderTable) as a stand-alone FolderTreeReusable:
// create / rename / duplicate / delete / reorder / nest folders, counts of products per folder (with subfolders), and
// products dropped on a folder (from ReusableTable rows or any 'items' drag) get that folder. For the tree BESIDE the
// product table use ProductsWithTree (uxuiTable.showFoldersTree) - it uses the same useProductFolderTree binding.
import React, { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { showSnackbar } from '../../../redux/uxuiSlice';
import FolderTreeReusable from '../../../ui/components/tree/FolderTreeReusable';
import type { FolderTreeReusableProps } from '../../../ui/components/tree/FolderTreeReusable';
import type { FolderDragPayload } from '../../../ui/components/tree/folderTreeDnd';
import { countItemsByFolder } from '../../../ui/components/tree/folderTreeModel';
import type { ProductCatalogData } from '../crud/productCatalogTools';
import { useProductFolderTree } from './useProductFolderTree';

export interface ProductFolderTreeProps extends Partial<Omit<FolderTreeReusableProps, 'nodes'>> {
  /** the folder and product rows (useProductCatalogData) */
  data: Pick<ProductCatalogData, 'productFolder' | 'product'>;
  onReload?: () => void;
}

export default function ProductFolderTree({ data, onReload, ...rest }: ProductFolderTreeProps) {
  const dispatch = useDispatch();
  const { nodes, treeProps, dropProducts, askBeforeDelete } = useProductFolderTree(data, onReload);
  const counts = useMemo(() => countItemsByFolder(data.product, (p) => p.rowParentGUID), [data.product]);
  const known = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const noneCount = useMemo(() => data.product.filter((p) => !known.has(p.rowParentGUID)).length, [data.product, known]);
  const onDropItems = (folderId: string | null, payload: FolderDragPayload) => {
    const n = dropProducts(folderId, payload.ids);
    if (n > 0) dispatch(showSnackbar({ message: `${n} product${n === 1 ? '' : 's'} moved` }));
  };
  return (
    <FolderTreeReusable
      testID="product-folder-tree"
      title="Product folders"
      showAllNode
      allLabel="All products"
      showNoneNode
      noneLabel="No folder"
      itemCounts={counts}
      totalCount={data.product.length}
      noneCount={noneCount}
      confirmDelete={askBeforeDelete}
      onDropItems={onDropItems}
      onMessage={(message) => dispatch(showSnackbar({ message }))}
      {...treeProps}
      {...rest}
      nodes={nodes}
    />
  );
}
