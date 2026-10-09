# TREE.PLUGIN - FolderTreeReusable

A folder tree for web + iOS + Android that stays fast with **200 000+ folders**, with full CRUD and drag & drop, built to work
**inside** `ReusableTable` (a folders tree beside the table) and **alone**.

    import { FolderTreeReusable, useLocalFolderTree } from 'kit8/ui/components/tree';

    const { nodes, treeProps } = useLocalFolderTree(initialNodes);          // flat nodes in state
    <FolderTreeReusable nodes={nodes} {...treeProps} height={500} />

Demo: route **/demo/foldertree** (`FolderTree200k.tsx`: 200k folders + 200k products, drag a product onto a folder).

## Data

Flat list `FolderTreeNode { id, parentId, title, order?, icon?, color?, data? }` (`parentId` null / 'empty' = top level). The
component is **controlled**: it never changes `nodes`; every command is a callback and the caller saves it (redux, state ...).
A callback that is not given hides its command (no `onDelete` = no delete button / menu item / Delete key).

| Prop | |
|---|---|
| `onCreate({ id, parentId, title, order })` | new folder / subfolder / duplicate (once per copied folder). `newId` makes the id (pass `Crypto.randomUUID`) |
| `onRename(id, title, previousTitle)` | inline rename (F2, double click, menu) |
| `onDelete(ids, rootId)` | `ids` = the chosen folder **and all its subfolders**; asks first (`confirmDelete`, `deleteHint`) |
| `onMove({ id, parentId, order })` | a folder dropped before / after / inside another, or "Move up / down" |
| `onDropItems(folderId \| null, payload)` | rows dropped on a folder (null = "No folder"); `payload.kind === 'items'`, `payload.ids` |
| `onSelect(id, node)` | `TREE_ALL_ID` ("All items") · `TREE_NONE_ID` ("No folder") · a folder id. `selectedId` = controlled |
| `itemCounts` (Map / record, items per folder) | counts incl. subfolders (`countMode: 'direct'` = without); `totalCount`, `noneCount` for the pinned rows |

Orders are numbers between the neighbours (`(prev + next) / 2`, ±1000 at the ends) - store them in a numeric column (`orderInList`).

Other props: `title`, `showHeader / showToolbar / showSearch`, `showAllNode` + `allLabel`, `showNoneNode` + `noneLabel`,
`initialExpandDepth` (default 1) / `defaultExpandedIds`, `rowHeight` (28), `indent` (16), `height`, `readOnly`, `extraMenuItems`,
`hoverExpandMs`, `acceptItemKinds`, `onMessage`, `onRefresh`. A ref gives `expandAll / collapseAll / reveal(id) / select / startCreate /
startRename / scrollToNode`.

## `uxuiFolders` (look + behaviour)

| Option | Default | |
|---|---|---|
| `alwaysFullHeight` | `true` | the tree is as high as the screen: from its top edge down to the bottom of the window. Inside `ReusableTable` the **table is too** (fixed height, header + footer stay in view, the rows scroll inside). An explicit `height` prop (tree) or numeric `uxuiTable.foldersTreeHeight` (table) wins; `false` = the parent decides |
| `fullHeightBottomOffset` / `fullHeightMin` | 16 / 260 (table 320) | px kept free below / smallest height |
| `doubleClickOnBranch` | `'toggleOpenClose'` | double click (web) opens / closes a folder that has subfolders; `'openToEdit'` renames it in place |
| `commandsInMainFab` | `true` | the **main FAB** (bottom right, `FABProvider.useFABContextActions`) shows the commands of the selected folder - the same as its context menu: new top level folder / subfolder / folder below, rename, duplicate, move up / down, expand / collapse below, your `extraMenuItems`, delete - plus expand / collapse all and refresh. They are named after the folder ("Rename "Audio"") and follow the selection; they leave when the tree unmounts |

Rename from the right-click menu: the menu is a Modal that gives the focus back to the page while it closes; commands of the menu therefore
run 250 ms after it has closed, and a rename input ignores a blur that happens before it ever had the focus.

## Why it is fast (`folderTreeModel.ts`, pure, unit-tested)

* `buildTreeIndex(nodes)`: typed arrays (parent index + CSR child lists), O(n); siblings sorted by `order` only when needed;
  missing parents become top level folders, parent loops are cut. 200k nodes: ~150 ms.
* `flattenTree(index, { expanded, mask })`: the visible rows only; iterative (a 100 000-level chain is fine).
* The list is **windowed**: ~40 rows are mounted whatever the size; rows are memoized, scrolling mounts only new rows.
* Search is debounced; `computeSubtreeTotals` adds up counts in one pass; nothing recurses.

## Drag & drop (`folderTreeDnd.ts`, `useFolderDragSource.ts`)

One shared drag session (payload + pointer position), so **any** list can drag into a tree: `beginFolderDrag(payload, x, y)` /
`moveFolderDrag` / `endFolderDrag`, or `useFolderDragSource({ getPayload, mode })` on a view. Trees register as drop zones.

* Drag a **folder**: top / bottom quarter of a row = before / after (a line), middle = inside (a frame); never into itself;
  hover over a closed folder opens it; near the edge the list scrolls; drop on "All items" = top level.
* Drop **rows** on a folder / "No folder". Web: pointer events; touch = hold ~350 ms (so swipes still scroll). iOS / Android:
  hold a row ~350 ms; a ⠿ grip drags at once (`mode: 'handle'`).
* The dragged picture is `FolderTreeDragGhost` (the tree and `ReusableTable` mount it).
* Web keyboard: ↑ ↓ ← → Home End · F2 rename · Delete · Insert / Ctrl+N new subfolder · `*` expand below · Enter.

## With ReusableTable

    <ReusableTable ... foldersTree={{ nodes, tree: { onCreate, onRename, onMove, onDelete } }} uxuiTable={{ showFoldersTree: true }} />

See `../table/reusable/README.md` (folders tree) - the table filters its rows by the picked folder (with subfolders), "Add" creates the
row in it, its ⠿ handle (web: the same drag that reorders; iOS / Android: a grip column) drops rows on a folder and saves the folder
column. Product catalog: `kit8/catalog/product/tree` (`useProductFolderTree`, `ProductFolderTree`) and the dashboard tab
**Products & folders** (`ProductsWithTree`).

## Files

`FolderTreeReusable.tsx` (component) · `FolderTreeRow.tsx` (memo row) · `FolderTreeDragGhost.tsx` · `folderTreeModel.ts` ·
`folderTreeDnd.ts` · `useFolderDragSource.ts` · `useLocalFolderTree.ts` · `folderTreeDemoData.ts` · `FolderTree200k.tsx` ·
tests: `__tests__/ui/tree`, `__tests__/ui/table/reusableTableFolders.test.tsx`, `__tests__/catalog/product/productsWithTree.test.tsx`.
