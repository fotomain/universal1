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

**Width** (`reusableListWidth`, px): not set = the list is as wide as its parent but **at most 960 px** (centred when the parent is wider); set = exactly that width, never wider than the parent, also centred. A wrong value (0, negative, NaN) counts as not set. Rule in `reusableListWidth.ts` (`reusableListWidthStyle`), test `__tests__/ui/list/reusableListWidth.test.ts`.

Web scroll limit: a browser scroll element cannot be taller than 33 554 428 px (Chrome / Edge) or 17 895 697 px (Firefox). 500 000 rows x 72 px = 36 000 000 px: the last ~34 000 rows cannot be reached (measured in Chrome 156). `webRowLimit(itemHeight)` = 236 111 rows at 72 px; above it the list shows a warning - use `serverDataMode` or a filter.

## Drag reorder (phone and web)
Every item has a ⠿ grip (when the list is in the stored order: no search / filter / column sort, `reorderEnabled`, not `readOnly`). Hold it and drag: a ghost follows the finger, a line shows the drop place, the list scrolls by itself near its top / bottom edge, and on release **one** row is saved (`orderInList` between its new neighbours; ascending and descending lists are both handled). Cost does not depend on the list size: only index math over a **fixed item height** (`itemHeight`) - nothing is measured per item.
`reorderController.ts` (pure, tested with fake timers) · `ReorderHandle.tsx` (a `PanResponder` on the grip alone: the list does not scroll under the finger; same code on iOS, Android, web). Row menu commands (Move up / down / first / last) stay.

## Rules
- No state of a ROW inside an item (FlashList recycles the cell for another row): selection and "dragged" live in `listStores.ts`, each item reads only its own flag.
- An item is display only; the edit card (`EditRowModalCard`) or `onRowOpen` edits. `renderItem(row, { grip, ... })` replaces the default item.
- `maintainVisibleContentPosition` is off: after a drop the viewport stays where it is.
- Web: the list scrolls by setting `scrollTop`; devices use FlashList `scrollToOffset`. While the browser pane / tab is hidden no scroll events are fired (that is the browser, not the list).

## Toolbar (`ReusableListToolbar.tsx`, 2026-11-24)
Every menu of the toolbar (More, Sort and filter, card size) opens **right under its own button** (`useMenuAnchor.ts`: the right edge of the menu under the right edge of the button; measured at layout and at the press) - not at a fixed place of the window.
Icons only - the name of an icon is its tip, never text next to it; an icon the list does not need is not drawn: search · **Add (+)** · **card size** (only with `cardSize`) · **Sort and filter** (the column menu, sorts / filters of the columns) · reload (serverDataMode) · `toolbarExtra` · **More (⋮)** (Export, Share). Under it the chips of the active sort / filters and the selection strip.
- **Add**: `CreateElementForm` (a component, props `CreateListElementFormProps`) = the Add button opens it in a window over the list (`ReusableListCreateModal`); the form hands a `rowJSON` to `onCreateFirst` or `onCreateLast`; its three dots icon (top right) = Export / Share of the typed data (the same formats as the More menu), the list makes the row at the top / end of the SHOWN list (`source.createAt(index, rowJSON)`), closes the window and scrolls to it. Without the prop Add makes an empty row (or calls `onAdd`). The Media Posts list uses `forms/CreateListElementForm` (origin types, see `kit8/ui/components/list/forms`).
- **Scroll buttons** (`ScrollToLastUsedCardButton`, `ScrollTopButton`, `ScrollBottomButton`, before More): the last used card = the card pressed / opened, whose menu / FAB command ran (`state.actions.*`, `markUsed`), dragged or just made by the Add form; the button is off while there is none (or it is filtered away) and scrolls so that card is in the middle of the list (fixed item height = index math). Top / bottom scroll to the first / last item. The toolbar row wraps on a narrow phone.
- **Card size**: `cardSize` + `onCardSizeChange` (+ `cardSizes`) show the button `cards/SelectCardSizeIconButton` (menu cardSmall / cardMedium / cardBig, the current one checked). The HOST owns the value and sets `itemHeight` from it (`cards/cardSize.ts`: 96 / 192 / 400 px) - an item has a fixed height.

## Cards (a custom `renderItem`)
`renderItem(row, state)` - `state` = `{ index, reorderable, dragging, grip, actions, canEdit, canAdd, canDelete, canOpen }`; `state.actions` = `edit remove duplicate createBefore createAfter moveUp moveDown makeFirst makeLast openMenu` (stable functions; `remove` asks first, every command checks the user's rights). `renderItemDeps` = anything the item reads from outside (a map of names ...): when it changes the visible items are drawn again (FlashList draws again only when `extraData` changes). `onDeleteRows(ids, rows)` returns the ids that are left for the ordinary delete (a file row is deleted by the files function). `refreshOnFocus` reads the rows again every time the screen is focused (a Drawer screen stays mounted). Cards: `kit8/ui/components/list/cards` (README there).

## Same as ReusableTable (shared code)
`useReusableTableCrud` (clientDataMode; got `setOrder`), `tableRows`, `tableFilter`, `ReusableTableRowMenu`, `ReusableTableColumnMenu`, `tableExportActions`, the permission props (`readOnly`, `addEnabled`, `deleteEnabled`), `onRowOpen`, `EditRowModalCard`, `localRows`, `extraMenuItems`, `focusRowGUID`. Column key `listRole` ('title' | 'subtitle' | 'meta' | 'badge' | 'hidden') says where a column goes in the default item (default: first text column = title, then subtitle, two meta).
Not in the list (yet): folders tree, Post button, column fill, drag reorder in server mode with the finger beyond the loaded rows.

## Files
`ReusableList.tsx` (hosts + view) · `ReusableListToolbar.tsx` · `ScrollTopButton.tsx` · `ScrollBottomButton.tsx` · `ScrollToLastUsedCardButton.tsx` · `useMenuAnchor.ts` · `ReusableListCreateModal.tsx` · `RefreshOnFocus.tsx` · `ReusableListItem.tsx` · `reusableListTypes.ts` · `listEngine.ts` · `listStores.ts` · `reorderController.ts` · `ReorderHandle.tsx` · `useReusableListClient.ts` · `useReusableListServer.ts` · `serverQuery.ts` · `demo/` · `index.ts`.
Tests: `__tests__/ui/list` (engine, stores, reorder controller, server query with a fake builder, component tests of both modes with FlashList replaced by a plain list).
Verified: Jest (68 tests), tsc of these files, Chrome 156 on the dev server (10 000 / 100 000 rows: 21 items mounted, drag reorder with the real mouse). **Not verified**: iOS / Android devices, a signed-in media post list (the browser pane was not signed in), the auto scroll at the list edge in a visible browser window.

## Add form: person documents (2026-11-24)
For the origin types **Person - ID card** and **Person - passport** the form `forms/CreateListElementForm` shows `forms/PersonDocumentDataInput.tsx`: the SAME data a scan gives - surname, given names, sex, date / place of birth, nationality, personal number, address, document number, issuing state, date of issue, valid until, issued by, notes - and the **owner photo** ("Attach photo" = file dialog on the web / the picker on a phone, made a small JPEG by `personPhoto.ts`; Replace, Remove). Model (pure, tested): `personDocumentInputModel.ts` - the check (surname, given names and number needed; real dates DD.MM.YYYY; 3 letter states; valid until after the date of issue), the fields in the order of a scan, the rowJSON = the one of the ID reader's post (`idCardFields`, `idCardOwnerName`, `idCardNumber`, `idCardKind`, `idCardFolder`, `mediaImageUri`), so the card, the read only details and the exports work for it. The photo also goes to the file storage `identification/idcard|passport/<post guid>`: the form hands it to the list as an extra, `onElementCreated(guid, rowJSON, extras)` lets the host upload it (`MediaPostsNativeList`; the post is written a moment later than the form closes, so `uploadIdentificationPhotoWithRetry` tries again up to 4 times).
