// Budget item tree - the budget item FOLDERS (level 1 of budgetItemTable) as a ReusableTable `foldersTree` binding; the items (level 2) are the rows
// of the table. create / rename / move / delete of a folder save through redux, so the tree, the table and every other screen see the same rows
// (realtime). The SECOND level of the tree is the ACTIVITY of the items (operating / investing / financing: virtual nodes, nothing stored, fixed): "+" on an activity node makes an item with
// that activity, a drop of items on it changes their activity. There is no subfolder of a user: an item is added in the table (it gets the picked folder).
// Without `editable` the tree is read-only (no CRUD, no drag, nothing can be dropped on a folder).
import { useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { showSnackbar } from '../../../redux/uxuiSlice';
import type { ReusableTableFoldersTree } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { DefRow } from '../../product/productModel';
import { BUDGET_ITEM_TABLE, budgetItemMoveToNode, budgetItemNodeOfRow, budgetItemNodes, budgetItemNewRowOfNode, isBudgetItemActivityNode } from './budgetItemModel';

const actions = () => SystemMetaData[BUDGET_ITEM_TABLE.entity]?.actions;

export function useBudgetItemTree(rows: DefRow<any>[], editable: boolean, onRefresh?: () => void, activityRows?: DefRow<any>[], genusOptions: { value: string }[] = []) {
  const dispatch = useDispatch();
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);
  const live = useRef(rows);
  live.current = rows;
  const nodes = useMemo(() => budgetItemNodes(rows, activityRows), [rows, activityRows]);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const genusRef = useRef(genusOptions);
  genusRef.current = genusOptions;
  // the second level of the tree is made of the activity of the items: an item is under its folder + activity, a new item of a picked activity node gets that activity
  const levelTwo = useMemo(() => ({
    folderOfRow: (row: any) => budgetItemNodeOfRow(row, nodeIds),
    newRowDefaultsOf: (id: string) => budgetItemNewRowOfNode(live.current, genusRef.current, id),
  }), [nodeIds]);

  const foldersTree = useMemo<ReusableTableFoldersTree>(() => {
    const base = { title: 'Budget items', allLabel: 'All budget items', noneLabel: 'Top level', onRefresh };
    const common = { showNoneNode: false, ...base };
    if (!editable) return { nodes, folderTarget: 'rowParentGUID', noFolderValue: 'empty', includeSubfolders: true, ...levelTwo, tree: { ...common, readOnly: true, acceptItemKinds: [] } };
    return {
      nodes, folderTarget: 'rowParentGUID', noFolderValue: 'empty', includeSubfolders: true, ...levelTwo,
      // items dropped on a node: on an activity node their activity (and folder) changes, on a folder their folder; never to "no folder" (an item always has a folder)
      onRowsDrop: (ids, folderId) => {
        if (!folderId) { dispatch(showSnackbar({ message: 'A budget item always has a folder' })); return; }
        for (const id of ids) {
          const r = live.current.find((x) => x.rowGUID === id);
          if (!r || !actions()?.updateOne) continue;
          if (isBudgetItemActivityNode(folderId)) {
            const move = budgetItemMoveToNode(r, folderId);
            if (move && 'error' in move) { dispatch(showSnackbar({ message: move.error })); continue; }
            if (move) dispatch(actions().updateOne({ rowGUID: id, rowOwnerGUID: r.rowOwnerGUID, rowJSON: move.rowJSON, columns: move.columns }));
          } else {
            dispatch(actions().updateOne({ rowGUID: id, rowOwnerGUID: r.rowOwnerGUID, columns: { rowParentGUID: folderId } }));
          }
        }
      },
      tree: {
        ...common,
        newId: () => Crypto.randomUUID(),
        newFolderTitle: 'New folder',
        confirmDelete: askBeforeDelete,
        deleteHint: 'Its budget items are deleted too.',
        onCreate: (n) => {
          // level 2 are items: they are added in the table
          if (n.parentId) { dispatch(showSnackbar({ message: 'A budget item is added in the table: pick the folder or the activity and press +' })); return; }
          if (actions()?.createOne) dispatch(actions().createOne({ rowGUID: n.id, rowOwnerGUID: BUDGET_ITEM_TABLE.catalogOwner, rowParentGUID: n.parentId ?? 'empty', orderInList: n.order, rowJSON: { title: n.title } }));
        },
        onRename: (id, title) => {
          if (isBudgetItemActivityNode(id)) { dispatch(showSnackbar({ message: 'The activity levels are fixed (IAS 7): they cannot be renamed' })); return; }
          const r = live.current.find((x) => x.rowGUID === id);
          if (r && actions()?.updateOne) dispatch(actions().updateOne({ rowGUID: id, rowOwnerGUID: r.rowOwnerGUID, rowJSON: { title } }));
        },
        onMove: (m) => {
          if (isBudgetItemActivityNode(m.id)) { dispatch(showSnackbar({ message: 'The activity levels are fixed (IAS 7): they cannot be moved' })); return; }
          if (m.parentId) { dispatch(showSnackbar({ message: 'A folder stays on the top level' })); return; }
          const r = live.current.find((x) => x.rowGUID === m.id);
          if (r && actions()?.updateOne) dispatch(actions().updateOne({ rowGUID: m.id, rowOwnerGUID: r.rowOwnerGUID, columns: { rowParentGUID: m.parentId ?? 'empty', orderInList: m.order } }));
        },
        onDelete: (ids) => {
          // the folders chosen + the items in them (an activity level is fixed: deleting one does nothing)
          const gone = new Set(ids.filter((id) => !isBudgetItemActivityNode(id)));
          for (const r of live.current) if (gone.has(r.rowParentGUID)) gone.add(r.rowGUID);
          for (const r of live.current) if (gone.has(r.rowGUID) && actions()?.deleteOne) dispatch(actions().deleteOne({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID }));
        },
      },
    };
  }, [nodes, editable, askBeforeDelete, dispatch, onRefresh, levelTwo]);

  return { nodes, foldersTree };
}
