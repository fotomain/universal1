// TREE.PLUGIN - useLocalFolderTree: keeps the flat folder list in React state and gives FolderTreeReusable the four CRUD
// callbacks. For demos, tests and screens whose folders live only in memory (stored folders: see
// kit8/catalog/product/tree/useProductFolderTree.ts - the same callbacks, saved through redux).
//   const { nodes, treeProps } = useLocalFolderTree(initialNodes);
//   <FolderTreeReusable nodes={nodes} {...treeProps} />
import { useMemo, useRef, useState } from 'react';
import type { FolderTreeMove } from './FolderTreeReusable';
import { FolderTreeNode, NewNode, treeOps } from './folderTreeModel';

export function useLocalFolderTree(initial: FolderTreeNode[] | (() => FolderTreeNode[])) {
  const [nodes, setNodes] = useState<FolderTreeNode[]>(initial);
  const queue = useRef<FolderTreeNode[]>([]);
  const scheduled = useRef(false);

  const treeProps = useMemo(() => ({
    // "duplicate with subfolders" calls onCreate once per folder: one state update (and one O(n) copy) for all of them
    onCreate: (n: NewNode) => {
      queue.current.push({ id: n.id, parentId: n.parentId, title: n.title, order: n.order });
      if (scheduled.current) return;
      scheduled.current = true;
      Promise.resolve().then(() => {
        const add = queue.current;
        queue.current = [];
        scheduled.current = false;
        setNodes((prev) => treeOps.createMany(prev, add));
      });
    },
    onRename: (id: string, title: string) => setNodes((prev) => treeOps.rename(prev, id, title)),
    onDelete: (ids: string[]) => setNodes((prev) => treeOps.remove(prev, new Set(ids))),
    onMove: (m: FolderTreeMove) => setNodes((prev) => treeOps.move(prev, m.id, m.parentId, m.order)),
  }), []);

  return { nodes, setNodes, treeProps };
}
