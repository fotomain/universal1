# ReusableTable

`ListWebCardsComponent` as a table: one row of a def-table (`rowGUID · rowOwnerGUID · rowParentGUID · orderInList · rowJSON`)
= one table row, one `visualColumn` = one cell edited in place and stored in `rowJSON`.

    <ReusableTable
      entityName="task_expense_input_table"   // SystemMetaData key (any reusable entity, e.g. productReusable)
      listOwnerGUID={projectGUID}              // rowOwnerGUID  (the more generic entity)
      listParentGUID={taskGUID}                // rowParentGUID (one level higher)
      visualColumns={columns}                  // VisualColumn[]
    />

Same parameters as ListWebCardsComponent: `entityName, entityForArchivationName, crudListTitle, listOwnerGUID, itemLabel,
realtime, readParams, reorderEnabled`. Table parameters: `listParentGUID, visualColumns, defaultRowJSON, selectionEnabled,
uxuiTable { inlineEdit = true, verticalDelimitersForCells = true, verticalDelimitersForColumnNames = true, roundedCells = false, borderedCells = false, minimumTableToolBarHeight = true, minimumTableRowHeight = true, useTableFooterHeightAsLineHeight = true, justifyTotalsOfFieldsMode = 'justifyTextCenter' | 'justifyTextRight', colorForColumnHeadersBackground = react-native-paper surfaceVariant as hex ('transparent' possible), searchInputHeight = 'smallestHeight' | 'mediumHeight' | 'normalHeight',
tableBarLayoutVariant = 'leftCrudPanel_rightSearch' (default) | 'leftCrudPanel_rightSearchTitle' | 'leftTitle_rightSearchCrudPanel', fixedWidth = '100%' (px: horizontal scroll) },
selectRowCheckBoxForm ('formRound' | 'formSquare' - project UX/UI setting), dragAndDropColumns, resizeColumnWidth,
columnSortAndFilter (▾ on a header: sort + filter, default on), crudPanelEnabled (icon panel, default on),
columnsOrder, columnsWidths, onColumnsOrderChange, onColumnsWidthsChange,
searchEnabled, contextMenuEnabled, extraMenuItems, onRowsChange, rowHeight, tableMaxWidth, emptyText`.

**Edit in a modal card** (`EditRowModalCard` prop): a component `(EditRowModalCardProps) => ReactNode` that edits ONE row in a window.
It gets `row` (always the fresh row), `itemLabel`, `visualColumns`, `setCell(columnKey, value)` / `patchRow(rowJSONPatch)` (saved exactly like an
in-place edit: `validate`, `computeRowJSON`, root columns) and `onClose`. The row menu (right-click / long-press / ⋮) gets **Edit** as its first
command. `uxuiTable.inlineEdit` (default **true**) = cells are edited in place; `false` = cells only show and a click / tap on a row opens the card
(without an `EditRowModalCard` the cells stay editable). Product catalog: `ProductItemEditModalCard` (Main · Prices · Variants · Properties).

**Which row the user touched** (`onRowEdit(rowGUID, 'create' | 'update' | 'move' | 'delete')`): called for the ONE row each change of the user touched - not for
rows that arrive from the server / realtime (`onRowsChange` gets the whole list). **Marked row** (`focusRowGUID`): the row to mark and scroll into view; default
the route parameter `focusRowGUID`. Used by the task finances (`kit8/pm/view/task/finances`).

**All-rows mode** (catalog dashboards, e.g. kit8/catalog/product/dashboard): `listOwnerGUID={REUSABLE_TABLE_ALL}` (and
`listParentGUID={REUSABLE_TABLE_ALL}`) = the rows of every owner / parent; the read has no `match`, so the redux entity
keeps the whole table for every other screen. `rowFilter` filters the shown rows on the client (master -> detail),
`newRowDefaults` gives a new row its rowOwnerGUID / rowParentGUID / rowJSON, `computeRowJSON` adds derived fields to a
change, `toolbarExtra` puts more buttons after the CRUD panel.

**Where a cell is stored**: `target: 'rowJSON'` (default, rowJSON[field]) or `'rowOwnerGUID'` / `'rowParentGUID'`
(the root column, saved with `updateOne({ columns })`; "nothing" = 'empty'). `validate(value, row)` refuses a value
with a snackbar. Number columns: `total: false` = no footer sum (prices, ratios).

Column types (`reusableTableTypes.ts`): `boolean` (check box) · `select` (one value of `options`, fixed or `(row) => options`;
picker with search from 8 options, color dot, hint) · `multiSelect` (string[]) · `date` ('YYYY-MM-DD', checked) ·
`color` ('#RRGGBB' + swatch) · `json` (any JSON, edited in a window) · `rowNumber` · `catalog` (stores a catalog rowGUID, shows its title through
SelectElementFromCatalog; `dependsOn` = the column whose GUID scopes this catalog, cleared when that column changes;
`dependsOnScopesCatalog: false` = only disable / clear, `filterItem(catalogRow, tableRow)`; `detailsRoute` = a "…" button in the cell that opens the details page of the selected element; the page gets
`returnTo` = this screen + `focusRowGUID`, so the app's Back button returns to the same row - kit8/lib/returnToRoute.ts) ·
`integer` / `number` (− / + buttons by default; `stepper: false`, `step`) · `text` · `custom`.

Rows: context menu (right-click, long-press, ⋮): add above / below, duplicate, move up / down / first / last, copy GUID,
archive, delete (+ Undo snackbar). Web: drag the ⠿ handle to reorder (orderInList). iOS / Android: reorder from the menu.

Files: `ReusableTable.tsx` (view) · `ReusableTableOptionPicker.tsx` (select / multiSelect picker) · `useReusableTableCrud.ts` (data + commands) · `tableRows.ts` (pure helpers) ·
`ReusableTableCell.tsx` · `ReusableTableRowMenu.tsx` · `ReusableTableBodyWeb.tsx` (drag & drop, web only) · `ReusableTableFolderGrip.tsx` (native grip for the folders tree) ·
`example/` TableExample2 = `task_expense_input_table` (SQL: `kit8/sql/init/create_task_expense_input_table.sql`).
Tests: `__tests__/ui/table` (`reusableTableAllRows.test.tsx`, `reusableTableFields.test.ts` for the all-rows mode and the new types).

**Folders tree** (`uxuiTable.showFoldersTree` + the `foldersTree` prop; `kit8/ui/components/tree` = FolderTreeReusable): a tree beside the table.
`foldersTree = { nodes, folderTarget = 'rowParentGUID' | 'rowOwnerGUID' | 'rowJSON' (+ folderField), noFolderValue = 'empty',
includeSubfolders = true, selectedFolderId / onSelectedFolderChange, onRowsDrop, tree: { onCreate, onRename, onMove, onDelete, title ... } }`.
Pick a folder = only its rows (with subfolders; "All rows" / "No folder" are pinned; reorder by position is off while a folder filters),
"Add" creates the row in the picked folder, the ⠿ of a row (all selected rows when it is selected) dropped on a folder saves the folder
column (`onRowsDrop` replaces that), counts per folder come from the rows. Web: the ⠿ that reorders also drags onto the tree; iOS / Android: a
⠿ grip column (`ReusableTableFolderGrip`). The bar gets a button that hides / shows the tree (hidden = no folder filter).
`foldersTree.uxuiFolders` (FolderTreeReusable): `alwaysFullHeight` (default **true**: tree and table are as high as the screen, the rows scroll INSIDE the table, header + footer stay in view; a numeric `foldersTreeHeight` turns it off), `doubleClickOnBranch` ('toggleOpenClose' default | 'openToEdit'), `commandsInMainFab`.
Calibration, all in `uxuiTable`: `foldersTreePosition = 'left' | 'right'`, `foldersTreeWidth = 260` (`Min/MaxWidth` 160 / 520, `foldersTreeResizable`
splitter), `foldersTreeCollapsible`, `foldersTreeCollapsed`, `foldersTreeGap = 8`, `foldersTreeAlignRows = true` (tree rows as high as table rows and the
tree header as high as table bar + column header, so lines are level), `foldersTreeHeight = 'matchTable' | px` (`Min/MaxHeight` 260 / 720),
`foldersTreeSticky` (web, stays in view), `foldersTreeStackBelowWidth = 720` (narrower: tree above the table, `foldersTreeStackedHeight = 240`).
Product catalog: `ProductsWithTree` (kit8/catalog/product/dashboard). Tests: `reusableTableFolders.test.tsx`.

Bar: Search is a `TextInputApp`; the clock icon lists the last 10 search substrings of this table (kept on the device,
`useSearchHistory.ts`). The **⚙ settings** button (right before the ⋮; `${testID}-settings`): **Fit to width** (every column gets a width so that ALL columns are visible at once - the widths add up to the
table body, the proportions stay, a column keeps at least 40 px, the row number column keeps its width; `fitColumnWidths` in `tableRows.ts`; the widths are reported through
`onColumnsWidthsChange` like a dragged separator) · **Default settings** (column order / widths, sort, filters, search). The ⋮ menu: Export · Share,
each to JSON, CSV, PDF - full data, PDF - visible (`tableExport.ts`, `tablePdf.ts`, `tableExportActions.ts`).
Exports take the rows and columns as shown now; JSON / CSV / PDF full data add the GUIDs, PDF visible does not.
