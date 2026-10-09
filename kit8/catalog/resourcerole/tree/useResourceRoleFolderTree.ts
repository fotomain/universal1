// Resource role folder tree - the folders of resourceRoleFolderTable as a ReusableTable `foldersTree` binding (and the nodes + CRUD
// callbacks for a stand-alone FolderTreeReusable): create / rename / move / sql_for_delete save through redux, so the tree, the "Folders"
// table of the dashboard and every other screen see the same rows (realtime).
import { useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { showSnackbar } from '../../../redux/uxuiSlice';
import type { ReusableTableFoldersTree } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { FolderTreeReusableProps } from '../../../ui/components/tree/FolderTreeReusable';
import type { ResourceRoleCatalogData } from '../crud/resourceRoleCatalogTools';
import { createRoleFolder, deleteRoleFolders, moveRoleFolder, moveRolesToFolder, renameRoleFolder, roleFolderNodes } from './resourceRoleFolderTreeActions';

type Needs = Pick<ResourceRoleCatalogData, 'resourceRoleFolder' | 'resourceRole'>;

export function useResourceRoleFolderTree(data: Needs, onRefresh?: () => void) {
  const dispatch = useDispatch();
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);
  const live = useRef(data);
  live.current = data;
  const nodes = useMemo(() => roleFolderNodes(data.resourceRoleFolder), [data.resourceRoleFolder]);

  /** CRUD props of FolderTreeReusable (same for the stand-alone tree and the one beside the role table) */
  const treeProps = useMemo<Pick<FolderTreeReusableProps, 'newId' | 'newFolderTitle' | 'onCreate' | 'onRename' | 'onMove' | 'onDelete' | 'onRefresh' | 'deleteHint'>>(() => ({
    newId: () => Crypto.randomUUID(),
    newFolderTitle: 'New folder',
    onCreate: (n) => { createRoleFolder(dispatch, n); },
    onRename: (id, title) => { renameRoleFolder(dispatch, live.current.resourceRoleFolder.find((f) => f.rowGUID === id), title); },
    onMove: (m) => { moveRoleFolder(dispatch, live.current.resourceRoleFolder.find((f) => f.rowGUID === m.id), m.parentId, m.order); },
    onDelete: (ids) => {
      const r = deleteRoleFolders(dispatch, live.current.resourceRoleFolder, live.current.resourceRole, ids);
      if (r.roles > 0) dispatch(showSnackbar({ message: `${r.roles} role${r.roles === 1 ? '' : 's'} moved to "No folder"` }));
    },
    onRefresh,
    deleteHint: 'Its roles are kept and get no folder.',
  }), [dispatch, onRefresh]);

  /** the binding for ReusableTable (uxuiTable.showFoldersTree + foldersTree) */
  const foldersTree = useMemo<ReusableTableFoldersTree>(() => ({
    nodes,
    folderTarget: 'rowParentGUID',
    noFolderValue: 'empty',
    includeSubfolders: true,
    tree: { title: 'Role folders', allLabel: 'All roles', noneLabel: 'No folder', ...treeProps },
  }), [nodes, treeProps]);

  /** roles dropped on a folder, for a tree that is NOT inside a table */
  const dropRoles = (folderId: string | null, roleGUIDs: string[]) => {
    const set = new Set(roleGUIDs);
    return moveRolesToFolder(dispatch, live.current.resourceRole.filter((r) => set.has(r.rowGUID)), folderId);
  };

  return { nodes, treeProps, foldersTree, dropRoles, askBeforeDelete };
}
