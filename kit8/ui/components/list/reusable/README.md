# ReusableList

`ReusableTable`'s functions for rows shown as **items**, on iOS, Android and the web, for **big lists**. Plan and decisions: `documentation/ReusableList_WBS.html`. Demo: route `/demo/list/reusable` (media posts in both data modes, or 1 000 / 10 000 / 100 000 / 500 000 generated rows).

    <ReusableList
      entityName="mediaPostReusable"                 // SystemMetaData key
      listOwnerGUID={ownerGUID} listParentGUID="empty"
      visualColumns={columns}                        // the SCHEMA: item text (listRole), search, sort, filter, validation, export, edit card
      reusableListDataMode="serverDataMode"          // 'clientDataMode' (default) | 'serverDataMode'
      orderDirection="desc" itemHeight={72}
    />
    // a list needs a parent with a height (flex: 1)

## The two data modes (`reusableListDataMode`)
| | `clientDataMode` (default) | `serverDataMode` |
|---|---|---|
| rows in memory | all rows of the scope (redux entity, or `localRows`) | only the loaded pages (`serverPageSize`, default 100) |
| search / filter / sort | on the device (`listEngine.buildView`, search text cached per row object) | in the database (`serverQuery.ts`: PostgREST `or(ilike)`, `ilike`, `eq`, `gte`, `order`, `range`); search starts 300 ms after the last key |
| count | rows.length | `count` of the first page (`serverCount`: exact / estimated / planned) |
| next rows | - | `onEndReached` loads the next page |
| writes | redux sagas (optimistic, Undo) | the same sagas; the loaded rows are patched by hand |
| realtime | yes (as the table) | **no** - the refresh button reloads |
| select all | "all except" store (instant for any size) | the loaded rows only |
| reorder | any position | not AFTER the last loaded row while more pages exist |
| limits | ~100 000 rows in memory; **web: ~236 000 rows** (see below) | any size; archive and Undo of a delete are not available |

serverDataMode reads `SystemMetaData[entityName].tableName` through the Supabase client with the user's session (RLS decides what is read). **No SQL is needed**: it uses the existing table. A register with 500k+ rows should get its own view / RPC later (the plan, W11).

Web scroll limit: a browser scroll element cannot be taller than 33 554 428 px (Chrome / Edge) or 17 895 697 px (Firefox). 500 000 rows x 72 px = 36 000 000 px: the last ~34 000 rows cannot be reached (measured in Chrome 156). `webRowLimit(itemHeight)` = 236 111 rows at 72 px; above it the list shows a warning - use `serverDataMode` or a filter.

## Drag reorder (phone and web)
Every item has a ⠿ grip (when the list is in the stored order: no search / filter / column sort, `reorderEnabled`, not `readOnly`). Hold it and drag: a ghost follows the finger, a line shows the drop place, the list scrolls by itself near its top / bottom edge, and on release **one** row is saved (`orderInList` between its new neighbours; ascending and descending lists are both handled). Cost does not depend on the list size: only index math over a **fixed item height** (`itemHeight`) - nothing is measured per item.
`reorderController.ts` (pure, tested with fake timers) · `ReorderHandle.tsx` (a `PanResponder` on the grip alone: the list does not scroll under the finger; same code on iOS, Android, web). Row menu commands (Move up / down / first / last) stay.

## Rules
- No state of a ROW inside an item (FlashList recycles the cell for another row): selection and "dragged" live in `listStores.ts`, each item reads only its own flag.
- An item is display only; the edit card (`EditRowModalCard`) or `onRowOpen` edits. `renderItem(row, { grip, ... })` replaces the default item.
- `maintainVisibleContentPosition` is off: after a drop the viewport stays where it is.
- Web: the list scrolls by setting `scrollTop`; devices use FlashList `scrollToOffset`. While the browser pane / tab is hidden no scroll events are fired (that is the browser, not the list).

## Same as ReusableTable (shared code)
`useReusableTableCrud` (clientDataMode; got `setOrder`), `tableRows`, `tableFilter`, `ReusableTableRowMenu`, `ReusableTableColumnMenu`, `tableExportActions`, the permission props (`readOnly`, `addEnabled`, `deleteEnabled`), `onRowOpen`, `EditRowModalCard`, `localRows`, `extraMenuItems`, `focusRowGUID`. Column key `listRole` ('title' | 'subtitle' | 'meta' | 'badge' | 'hidden') says where a column goes in the default item (default: first text column = title, then subtitle, two meta).
Not in the list (yet): folders tree, Post button, column fill, drag reorder in server mode with the finger beyond the loaded rows.

## Files
`ReusableList.tsx` (hosts + view) · `ReusableListBar.tsx` · `ReusableListItem.tsx` · `reusableListTypes.ts` · `listEngine.ts` · `listStores.ts` · `reorderController.ts` · `ReorderHandle.tsx` · `useReusableListClient.ts` · `useReusableListServer.ts` · `serverQuery.ts` · `demo/` · `index.ts`.
Tests: `__tests__/ui/list` (engine, stores, reorder controller, server query with a fake builder, component tests of both modes with FlashList replaced by a plain list).
Verified: Jest (68 tests), tsc of these files, Chrome 156 on the dev server (10 000 / 100 000 rows: 21 items mounted, drag reorder with the real mouse). **Not verified**: iOS / Android devices, a signed-in media post list (the browser pane was not signed in), the auto scroll at the list edge in a visible browser window.
