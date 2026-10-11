// Budget item tree - the budget item FOLDERS (level 1 of budgetItemTable) as a ReusableTable `foldersTree` binding; the items (level 2) are the rows
// of the table. create / rename / move / delete of a folder save through redux, so the tree, the table and every other screen see the same rows
// (realtime). There is no subfolder: an item is added in the table (it gets the picked folder).
// Without `editable` the tree is read-only (no CRUD, no drag, nothing can be dropped on a folder).
import { useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { showSnackbar } from '../../../redux/uxuiSlice';
import type { ReusableTableFoldersTree } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { DefRow } from '../../product/productModel';
import { BUDGET_ITEM_TABLE, budgetItemNodes } from './budgetItemModel';

const actions = () => SystemMetaData[BUDGET_ITEM_TABLE.entity]?.actions;

export function useBudgetItemTree(rows: DefRow<any>[], editable: boolean, onRefresh?: () => void) {
  const dispatch = useDispatch();
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);
  const live = useRef(rows);
  live.current = rows;
  const nodes = useMemo(() => budgetItemNodes(rows), [rows]);

  const foldersTree = useMemo<ReusableTableFoldersTree>(() => {
    const base = { title: 'Budget items', allLabel: 'All budget items', noneLabel: 'Top level', onRefresh };
    const common = { showNoneNode: false, ...base };
    if (!editable) return { nodes, folderTarget: 'rowParentGUID', noFolderValue: 'empty', includeSubfolders: false, tree: { ...common, readOnly: true, acceptItemKinds: [] } };
    return {
      nodes, folderTarget: 'rowParentGUID', noFolderValue: 'empty', includeSubfolders: false,
      tree: {
        ...common,
        newId: () => Crypto.randomUUID(),
        newFolderTitle: 'New folder',
        confirmDelete: askBeforeDelete,
        deleteHint: 'Its budget items are deleted too.',
        onCreate: (n) => {
          // level 2 are items: they are added in the table
          if (n.parentId) { dispatch(showSnackbar({ message: 'A budget item is added in the table: pick the folder and press +' })); return; }
          if (actions()?.createOne) dispatch(actions().createOne({ rowGUID: n.id, rowOwnerGUID: BUDGET_ITEM_TABLE.catalogOwner, rowParentGUID: n.parentId ?? 'empty', orderInList: n.order, rowJSON: { title: n.title } }));
        },
        onRename: (id, title) => {
          const r = live.current.find((x) => x.rowGUID === id);
          if (r && actions()?.updateOne) dispatch(actions().updateOne({ rowGUID: id, rowOwnerGUID: r.rowOwnerGUID, rowJSON: { title } }));
        },
        onMove: (m) => {
          if (m.parentId) { dispatch(showSnackbar({ message: 'A folder stays on the top level' })); return; }
          const r = live.current.find((x) => x.rowGUID === m.id);
          if (r && actions()?.updateOne) dispatch(actions().updateOne({ rowGUID: m.id, rowOwnerGUID: r.rowOwnerGUID, columns: { rowParentGUID: m.parentId ?? 'empty', orderInList: m.order } }));
        },
        onDelete: (ids) => {
          // the folders chosen + the items in them
          const gone = new Set(ids);
          for (const r of live.current) if (gone.has(r.rowParentGUID)) gone.add(r.rowGUID);
          for (const r of live.current) if (gone.has(r.rowGUID) && actions()?.deleteOne) dispatch(actions().deleteOne({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID }));
        },
      },
    };
  }, [nodes, editable, askBeforeDelete, dispatch, onRefresh]);

  return { nodes, foldersTree };
}
