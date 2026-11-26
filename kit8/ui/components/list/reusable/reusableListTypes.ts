// ReusableList - types. The list takes the props of ReusableTable that make sense for rows shown as ITEMS (same names, same meaning) and adds the data mode.
// Plan + decisions: documentation/ReusableList_WBS.html
import type { ComponentType, ReactNode } from 'react';
import type { ReusableTableProps, ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';
import type { CardSize } from '../cards/cardSize';
import type { CardFabAction } from '../cards/CardLocalFab';
import type { SwipeActionsProp, SwipeInset } from './swipeModel';

/**
 * where the rows live while the list is open:
 *  clientDataMode  every row of the scope is in memory (redux entity or `localRows`); search / filter / sort run on the device. Up to ~100 000 rows.
 *  serverDataMode  only the loaded pages are in memory; search / filter / sort / count are done by the database (PostgREST range + count); the next page loads when the list ends.
 */
export type ReusableListDataMode = 'clientDataMode' | 'serverDataMode';
export const CLIENT_DATA_MODE: ReusableListDataMode = 'clientDataMode';
export const SERVER_DATA_MODE: ReusableListDataMode = 'serverDataMode';

export type ListRole = 'title' | 'subtitle' | 'meta' | 'badge' | 'hidden';

/** the columns of an item: which column fills which place (pure, see resolveListRoles) */
export interface ListRoles { title: VisualColumn | null; subtitle: VisualColumn | null; meta: VisualColumn[]; badge: VisualColumn[] }

/** the commands of one row that a custom item (a card) can call: the same ones as the row menu. Stable functions: they ask the list at the moment of the call */
export interface ReusableListRowActions {
  /** the edit card / onRowOpen of the list (does nothing when the list has neither) */
  edit: (guid: string) => void;
  /** asks first when the user setting says so, then deletes */
  remove: (guid: string) => void;
  duplicate: (guid: string) => void;
  createBefore: (guid: string) => void;
  createAfter: (guid: string) => void;
  moveUp: (guid: string) => void;
  moveDown: (guid: string) => void;
  makeFirst: (guid: string) => void;
  makeLast: (guid: string) => void;
  /** the row menu of the list at a window point */
  openMenu: (guid: string, x: number, y: number) => void;
  /** Archive / Restore: toggles `rowJSON.rowIsArchived` (the same as the swipe; does nothing when the list does not offer it for this row) */
  archive: (guid: string) => void;
  /** the card was used (pressed ...): the toolbar button "scroll to the last used card" goes to it. Every other command marks it too */
  markUsed: (guid: string) => void;
}

/** what an item gets from the list */
export interface ReusableListItemState {
  index: number;
  /** the list is sorted by orderInList and not filtered: the ⠿ handle may be shown */
  reorderable: boolean;
  /** true while the row is dragged: draw it as a ghost / dimmed */
  dragging: boolean;
  /** the ⠿ grip to put in your own item (null when the row cannot be dragged now) */
  grip: ReactNode;
  /** the commands of the row (the card's local FAB uses them) */
  actions: ReusableListRowActions;
  /** what the user may do now (read only / permissions): a card hides the actions it may not run */
  canEdit: boolean;
  canAdd: boolean;
  canDelete: boolean;
  /** the list has an edit card or onRowOpen */
  canOpen: boolean;
  /** `rowJSON.rowIsArchived` is true (the list draws the small info icon on the card itself; a custom card may also dim / label it) */
  archived: boolean;
}

/** the props of a form that makes a NEW element (the Add button of the toolbar opens it). The rowJSON is the content of the new row. */
export interface CreateListElementFormProps {
  /** put the new element at the top of the shown list. `extras` = what goes with it but is not stored in it (the owner photo of a person document: the host uploads it) */
  onCreateFirst: (rowJSON: Record<string, any>, extras?: Record<string, any>) => void;
  /** put the new element at the end of the shown list */
  onCreateLast: (rowJSON: Record<string, any>, extras?: Record<string, any>) => void;
  onClose: () => void;
  testID?: string;
}

export interface ReusableListUx {
  /** thin line under every item (default true) */
  dividers?: boolean;
  /** rounded card look (default false) */
  roundedCards?: boolean;
}

type FromTable = Pick<ReusableTableProps,
  | 'entityName' | 'entityForArchivationName' | 'crudListTitle' | 'listOwnerGUID' | 'listParentGUID' | 'itemLabel' | 'realtime' | 'readParams'
  | 'reorderEnabled' | 'rowFilter' | 'newRowDefaults' | 'computeRowJSON' | 'defaultRowJSON' | 'selectionEnabled' | 'crudPanelEnabled'
  | 'addEnabled' | 'readOnly' | 'deleteEnabled' | 'onAdd' | 'onRowOpen' | 'openLabel' | 'searchEnabled' | 'contextMenuEnabled' | 'EditRowModalCard'
  | 'extraMenuItems' | 'onRowsChange' | 'onRowEdit' | 'emptyText' | 'focusRowGUID' | 'testID' | 'localRows' | 'onLocalRowsChange' | 'duplicateOverrides'
  | 'onSelectionChange' | 'toolbarExtra' | 'duplicateOverrides'>;

export interface ReusableListProps extends FromTable {
  /** the columns are the SCHEMA of the list: types, validation, storage, search text, sort, filter, export, the edit card - and the default item */
  visualColumns: VisualColumn[];
  /** clientDataMode (default) | serverDataMode */
  reusableListDataMode?: ReusableListDataMode;
  /** serverDataMode: rows per page (default 100) */
  serverPageSize?: number;
  /** serverDataMode: how the total is counted: 'exact' (default), 'estimated' (big tables) or 'planned' */
  serverCount?: 'exact' | 'estimated' | 'planned';
  /** serverDataMode: the rowJSON fields the search box looks in (default: the fields of the text columns) */
  serverSearchFields?: string[];
  /** serverDataMode: table name (default: SystemMetaData[entityName].tableName) */
  serverTableName?: string;
  /** 'asc' (default) = ascending orderInList, 'desc' = the highest orderInList first (newest first for posts) */
  orderDirection?: 'asc' | 'desc';
  /** height of an item in px (default 72). A drag reorder needs a FIXED height */
  itemHeight?: number;
  /** another look of an item (default: built from the columns, see listRole) */
  renderItem?: (row: ReusableTableRow, state: ReusableListItemState) => ReactNode;
  uxuiList?: ReusableListUx;
  /** the ring button of the toolbar switches the select-rows check boxes on / off; true = they are on when the list opens (default false) */
  selectionVisibleAtStart?: boolean;
  /** width of the list in px (it never gets wider than its parent). Not set = as wide as the parent but at most 960 px; the list is centred when narrower */
  reusableListWidth?: number;
  /** a new element was made with the form: its guid, its rowJSON and the extras of the form (the host uploads the photo of a person document ...) */
  onElementCreated?: (guid: string, rowJSON: Record<string, any>, extras?: Record<string, any>) => void;
  /** the Add button opens this form (a modal over the list) instead of adding an empty row; it makes the rowJSON of the new element (CreateListElementForm) */
  CreateElementForm?: ComponentType<CreateListElementFormProps>;
  /** the size of the cards: with `cardSize` the toolbar shows the button that picks it (cardSmall / cardMedium / cardBig). The HOST owns the value and sets `itemHeight` from it (cards/cardSize.ts) */
  cardSize?: CardSize;
  onCardSizeChange?: (size: CardSize) => void;
  /** the sizes the button offers (default all three) */
  cardSizes?: readonly CardSize[];
  /** before a delete: gets the ids and returns the ids that are left for the ordinary delete (the host deletes the others itself, e.g. file rows go through the files function) */
  onDeleteRows?: (ids: string[], rows: ReusableTableRow[]) => string[];
  /** read the rows again every time the screen comes into focus (a Drawer screen stays mounted: a recording saved elsewhere appears) */
  refreshOnFocus?: boolean;
  /** anything the custom `renderItem` reads from outside (a map of names, a handler): when it changes the visible items are drawn again */
  renderItemDeps?: unknown;
  /** the INNER id of this list (a constant string per list, e.g. 'mediaPosts.list'). The local settings of the list (three dots menu -> Settings: what a swipe does, ...) are kept on this device under it - so it must never change and be unique in the app */
  reusableListGUID: string;
  /** swipe actions on every item (default ON; false = none): what a swipe does in each direction is the SETTING of the list (archive | delete, with a stop at the button | the card disappears; default left -> right = archiveWithStop, right -> left = deleteWithStop).
   *  An object switches an action off: { archive: false } / { delete: false }. Archive sets ONLY `rowJSON.rowIsArchived` (the row stays, the card shows the Archive icon); Delete asks first when the user setting says so. Needs canEdit / canDelete */
  swipeActions?: SwipeActionsProp;
  /** with swipeActions: how far the VISIBLE card is inset inside its item (a card with its own margin / rounded corners): the Archive / Delete buttons are drawn exactly under the card, on its vertical line, with its corner radius */
  swipeInset?: SwipeInset;
  /** with swipeActions: false = this row cannot be archived (no Archive button for it; Delete stays). A row the database refuses to update (a file row of the media posts) */
  canArchiveRow?: (row: ReusableTableRow) => boolean;
  /** every custom card (`renderItem`) gets the small round FAB of the list at its bottom right (default ON, like the three dots menu at its top right): it opens the commands of THAT card
   *  (Edit, Add above / below, Duplicate, Move up / down, Archive / Restore, Delete - only what the user may do) plus `cardFabActions`. false = none (a card that draws its own FAB) */
  cardFab?: boolean;
  /** extra commands of a card for its FAB (shown before the standard ones; the host gives the same commands to `extraMenuItems` for the three dots menu) */
  cardFabActions?: (row: ReusableTableRow, state: ReusableListItemState) => CardFabAction[];
  /** px under which the list asks for the next page / the end of the list (FlashList onEndReachedThreshold, default 1.5 screens) */
  endReachedThreshold?: number;
}

/** what a data source (client or server) gives the list */
export interface ReusableListSource {
  mode: ReusableListDataMode;
  /** clientDataMode: ALL rows, ascending orderInList; serverDataMode: the loaded rows in the order of the query */
  rows: ReusableTableRow[];
  loading: boolean;
  loadingMore: boolean;
  error: any;
  /** the number of rows behind the query (server: the counted total; client: rows.length) */
  total: number | null;
  /** serverDataMode: more pages exist */
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  /** a new row at the position of the LIST (index of the shown list); returns its rowGUID */
  createAt: (viewIndex: number, rowJSON?: Record<string, any>) => string | null;
  duplicate: (guid: string, before?: boolean) => string | null;
  setCell: (guid: string, columnKey: string, value: any) => boolean;
  patchRow: (guid: string, rowJSONPatch: Record<string, any>, columnsPatch?: Record<string, any>) => void;
  remove: (guids: string[]) => void;
  archive: (guid: string) => void;
  canArchive: boolean;
  /** give ONE row an orderInList (a drag / move command) */
  setOrder: (guid: string, orderInList: number) => void;
}

/** sort + filters + search of the list (the same shapes as the table's) */
export interface ReusableListQuery {
  search: string;
  sort: import('../../table/reusable/tableFilter').ColumnSort | null;
  filters: import('../../table/reusable/tableFilter').ColumnFilters;
}
