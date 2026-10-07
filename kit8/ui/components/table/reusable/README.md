# ReusableTable

`ListWebCardsComponent` as a table: one row of a def-table (`rowGUID · rowOwnerGUID · rowParentGUID · orderInList · rowJSON`)
= one table row, one `visualColumn` = one cell edited in place and stored in `rowJSON`.

    <ReusableTable
      entityName="task_expense_input_table"   // SystemMetaData key
      listOwnerGUID={projectGUID}              // rowOwnerGUID  (the more generic entity)
      listParentGUID={taskGUID}                // rowParentGUID (one level higher)
      visualColumns={taskExpenseInputColumns}
    />

Same parameters as ListWebCardsComponent: `entityName, entityForArchivationName, crudListTitle, listOwnerGUID, itemLabel,
realtime, readParams, reorderEnabled`. Table parameters: `listParentGUID, visualColumns, defaultRowJSON, selectionEnabled,
uxuiTable { verticalDelimitersForCells = true, verticalDelimitersForColumnNames = true, roundedCells = false, borderedCells = false, minimumTableToolBarHeight = true, minimumTableRowHeight = true, useTableFooterHeightAsLineHeight = true, justifyTotalsOfFieldsMode = 'justifyTextCenter' | 'justifyTextRight', colorForColumnHeadersBackground = react-native-paper surfaceVariant as hex ('transparent' possible), searchInputHeight = 'smallestHeight' | 'mediumHeight' | 'normalHeight',
tableBarLayoutVariant = 'leftCrudPanel_rightSearch' (default) | 'leftCrudPanel_rightSearchTitle' | 'leftTitle_rightSearchCrudPanel', fixedWidth = '100%' (px: horizontal scroll) },
selectRowCheckBoxForm ('formRound' | 'formSquare' - project UX/UI setting), dragAndDropColumns, resizeColumnWidth,
columnSortAndFilter (▾ on a header: sort + filter, default on), crudPanelEnabled (icon panel, default on),
columnsOrder, columnsWidths, onColumnsOrderChange, onColumnsWidthsChange,
searchEnabled, contextMenuEnabled, extraMenuItems, onRowsChange, rowHeight, tableMaxWidth, emptyText`.

Column types (`reusableTableTypes.ts`): `rowNumber` · `catalog` (stores a catalog rowGUID, shows its title through
SelectElementFromCatalog; `dependsOn` = the column whose GUID scopes this catalog, cleared when that column changes;
`detailsRoute` = a "…" button in the cell that opens the details page of the selected element; the page gets
`returnTo` = this screen + `focusRowGUID`, so the app's Back button returns to the same row - kit8/lib/returnTo.ts) ·
`integer` / `number` (− / + buttons by default; `stepper: false`, `step`) · `text` · `custom`.

Rows: context menu (right-click, long-press, ⋮): add above / below, duplicate, move up / down / first / last, copy GUID,
archive, delete (+ Undo snackbar). Web: drag the ⠿ handle to reorder (orderInList). iOS / Android: reorder from the menu.

Files: `ReusableTable.tsx` (view) · `useReusableTableCrud.ts` (data + commands) · `tableRows.ts` (pure helpers) ·
`ReusableTableCell.tsx` · `ReusableTableRowMenu.tsx` · `ReusableTableBodyWeb.tsx` (drag & drop, web only) ·
`example/` TableExample2 = `task_expense_input_table` (SQL: `kit8/sql/init/create_task_expense_input_table.sql`).
Tests: `__tests__/ui/table`.

Bar: Search is a `TextInputApp`; the clock icon lists the last 10 search substrings of this table (kept on the device,
`useSearchHistory.ts`). The ⋮ menu: Default settings (column order / widths, sort, filters, search) · Export · Share,
each to JSON, CSV, PDF - full data, PDF - visible (`tableExport.ts`, `tablePdf.ts`, `tableExportActions.ts`).
Exports take the rows and columns as shown now; JSON / CSV / PDF full data add the GUIDs, PDF visible does not.
