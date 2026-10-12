// useCatalogTree - the `foldersTree` binding of ReusableTable for a catalog whose rows are ALL nodes of ONE tree (any depth, rowParentGUID = the parent,
// 'empty' = a root): create / rename / move / delete of a node save through redux, so the tree, the table and every other screen see the same rows (realtime).
// Unlike the two-level catalogs (managementGenus, budgetItem: folders + items) a node is itself a row with attributes, a node may have sub-nodes at any depth.
//   - "new" in the tree = a new row under the chosen node (or a root)
//   - a node with sub-nodes is NOT deleted (the unit is referenced: move or delete the sub-nodes first); SQL refuses a used one as well
//   - a node cannot be moved below itself
// Without `editable` the tree is read-only (no CRUD, no drag, nothing can be dropped on a node).
import { useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { showSnackbar } from '../../../redux/uxuiSlice';
import type { DefRow, ProductTableDef } from '../../../catalog/product/productModel';
import type { ReusableTableFoldersTree } from '../table/reusable/reusableTableTypes';
import type { FolderTreeNode } from './folderTreeModel';

export interface UseCatalogTreeOptions {
  def: ProductTableDef;
  /** every row as a tree node */
  nodes: FolderTreeNode[];
  /** the rows (for the sub-node / loop checks) */
  rows: DefRow<any>[];
  /** the tree title / the "All" row */
  title: string;
  allLabel: string;
  /** rowJSON key of the node title (default 'title') */
  titleField?: string;
  /** rowJSON of a new node besides its title */
  newRowJSON?: () => Record<string, any>;
  deleteHint?: string;
  onRefresh?: () => void;
}

export function useCatalogTree(editable: boolean, o: UseCatalogTreeOptions) {
  const dispatch = useDispatch();
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);
  const live = useRef(o.rows);
  live.current = o.rows;
  const titleField = o.titleField ?? 'title';
  const { def, nodes, title, allLabel, newRowJSON, deleteHint, onRefresh } = o;
  const actions = () => SystemMetaData[def.entity]?.actions;

  const foldersTree = useMemo<ReusableTableFoldersTree>(() => {
    const common = { showNoneNode: false, title, allLabel, noneLabel: 'Top level', onRefresh, initialExpandDepth: 2 };
    // the picked node shows its sub-nodes (and theirs) in the table
    const base = { nodes, folderTarget: 'rowParentGUID' as const, noFolderValue: 'empty', includeSubfolders: true };
    if (!editable) return { ...base, tree: { ...common, readOnly: true, acceptItemKinds: [] } };
    return {
      ...base,
      tree: {
        ...common,
        newId: () => Crypto.randomUUID(),
        newFolderTitle: `New ${def.itemLabel.toLowerCase()}`,
        confirmDelete: askBeforeDelete,
        deleteHint: deleteHint ?? 'A node that has sub-nodes is not deleted.',
        onCreate: (n) => {
          if (actions()?.createOne) {
            dispatch(actions().createOne({
              rowGUID: n.id, rowOwnerGUID: def.catalogOwner, rowParentGUID: n.parentId ?? 'empty', orderInList: n.order,
              rowJSON: { ...def.emptyRowJSON(), ...(newRowJSON ? newRowJSON() : {}), [titleField]: n.title },
            }));
          }
        },
        onRename: (id, t) => {
          const r = live.current.find((x) => x.rowGUID === id);
          if (r && actions()?.updateOne) dispatch(actions().updateOne({ rowGUID: id, rowOwnerGUID: r.rowOwnerGUID, rowJSON: { [titleField]: t } }));
        },
        onMove: (m) => {
          const r = live.current.find((x) => x.rowGUID === m.id);
          if (!r || !actions()?.updateOne) return;
          // not below itself: the new parent must not be the node or one of its sub-nodes
          if (m.parentId) {
            const below = new Set<string>([m.id]);
            let grew = true;
            while (grew) { grew = false; for (const x of live.current) if (!below.has(x.rowGUID) && below.has(x.rowParentGUID)) { below.add(x.rowGUID); grew = true; } }
            if (below.has(m.parentId)) { dispatch(showSnackbar({ message: `A ${def.itemLabel.toLowerCase()} cannot be moved below itself` })); return; }
          }
          dispatch(actions().updateOne({ rowGUID: m.id, rowOwnerGUID: r.rowOwnerGUID, columns: { rowParentGUID: m.parentId ?? 'empty', orderInList: m.order } }));
        },
        onDelete: (ids, rootId) => {
          // the tree offers the node and ALL its sub-nodes: only a node WITHOUT sub-nodes is deleted (it is referenced by projects, lines, contracts ...)
          if (ids.length > 1 || live.current.some((x) => x.rowParentGUID === rootId)) {
            dispatch(showSnackbar({ message: `Not deleted: it has sub-${def.itemLabel.toLowerCase()}s. Move or delete them first.` }));
            return;
          }
          const r = live.current.find((x) => x.rowGUID === rootId);
          if (r && actions()?.deleteOne) dispatch(actions().deleteOne({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID }));
        },
      },
    };
  }, [nodes, editable, askBeforeDelete, dispatch, onRefresh, def, title, allLabel, titleField, newRowJSON, deleteHint]);

  return { foldersTree };
}
