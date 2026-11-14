// ReusableList - types. The list takes the props of ReusableTable that make sense for rows shown as ITEMS (same names, same meaning) and adds the data mode.
// Plan + decisions: documentation/ReusableList_WBS.html
import type { ReactNode } from 'react';
import type { ReusableTableProps, ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';

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

/** what an item gets from the list */
export interface ReusableListItemState {
  index: number;
  /** the list is sorted by orderInList and not filtered: the ⠿ handle may be shown */
  reorderable: boolean;
  /** true while the row is dragged: draw it as a ghost / dimmed */
  dragging: boolean;
  /** the ⠿ grip to put in your own item (null when the row cannot be dragged now) */
  grip: ReactNode;
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
