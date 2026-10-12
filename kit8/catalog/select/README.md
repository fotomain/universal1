# kit8/catalog/select - fields that choose ONE item of a catalog in a window

| Folder | Component | For |
|---|---|---|
| (flat list) | `kit8/catalog/inner/select_element/SelectElementFromCatalog` | a catalog that is a plain list (persons, partners ...) |
| `from_tree/` | `SelectCatalogItemFromTreeReusable` | a catalog whose rows are ALL nodes of one tree (business units): a field + `CatalogTreePicker` (the tree with a search box and counts; a RadioSetApp **Tree | List** at its right corner; `isSelectable` / `reasonWhy`) |
| `with_folders/` | `SelectCatalogItemWithFolders` | a catalog of FOLDERS and ITEMS in one table (budget items, management genus ...); only an item can be chosen |

`SelectFieldBox.tsx` is the field of both (label, icon, text / placeholder, clear, ▾, `compact` for a table cell).

## SelectCatalogItemWithFolders

    <SelectCatalogItemWithFolders rows={rows} isFolder={isBudgetItemFolder} filterItem={(r) => r.rowJSON.managementGenusItem === genus} value={guid} onChange={(guid, row) => ...} views={['tree', 'split', 'list']} />

The window has a **RadioSetApp** at its top right (the views of `views`, in that order; default `['tree', 'list']`) and ONE search box (a substring of any cell):

* **Tree** (`'tree'`) - `WithFoldersTreeTable`: one tree-table, folders ⊞ / ⊟, items = leaf rows; columns Description + Code (`columns`).
* **Tree + items** (`'split'`) - `WithFoldersSplit`: the folders tree on the full left side (with "All", "No folder" while there are loose items, and the counts), the table of the items of the picked branch (sub-folders included) on the right; stacked on a narrow window.
* **List** (`'list'`) - `WithFoldersList`: every item once, flat cards (title, folder path or `subtitleOf`, the chosen one has the ACTIVE badge).
* The window opens as the **List on a small width** (`WITH_FOLDERS_SMALL_WIDTH` = 640 px), as the first view otherwise; `defaultView` forces one.
* `isFolder` (default: a top level row or a row with sub-rows), `filterItem` (items that do not fit are left out, with the folders that hold none of them), `titleOf`, `subtitleOf`, `columns`.

Pure side: `withFoldersModel.ts`. Tests: `__tests__/catalog/select/with_folders`, `__tests__/catalog/select/from_tree`.

First users (task line table, `kit8/pm/view/task/finances/taskLineColumns.tsx`; each is a `renderPicker` of a catalog column, so title / search / fill column stay as they were):
* **Budget item** - `data.budgetItem`, `isBudgetItemFolder`, the items of the genus of the tab.
* **Product** - views Tree | Tree + items | List; `productRowsWithFolders(data.productFolder, data.product)` (`kit8/catalog/product/productSelectModel.ts`: a product's `rowParentGUID` is its folder, `empty` = no folder = shown at the top level), columns Description + SKU, the List shows title + description.

