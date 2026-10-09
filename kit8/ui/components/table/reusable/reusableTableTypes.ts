// ReusableTable - types.
// The table works like ListWebCardsComponent (reusable redux entity: read by owner, realtime, optimistic
// create / update / delete + Undo, orderInList drag & drop) but shows the rows as a TABLE: one row of the
// SQL table = one table row, one visualColumn = one input cell stored in rowJSON.
//
// SQL concept (kit8/sql/defTable.md): rowGUID · rowOwnerGUID (the more generic entity) ·
// rowParentGUID (the entity one level higher in the hierarchy) · orderInList · rowJSON (all other fields).
import type { ReactNode } from 'react';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';
import type { FolderTreeNode } from '../../tree/folderTreeModel';
import type { FolderTreeReusableProps } from '../../tree/FolderTreeReusable';

export type ColumnAlign = 'left' | 'center' | 'right';

/** a server row of a reusable entity */
export interface ReusableTableRow {
  rowGUID: string;
  rowOwnerGUID?: string;
  rowParentGUID?: string;
  orderInList?: number;
  rowJSON?: Record<string, any>;
  [k: string]: any;
}

interface ColumnBase {
  /** unique column id; also the rowJSON field when `field` is not set */
  key: string;
  title: string;
  /** px (defaults by type) */
  width?: number;
  align?: ColumnAlign;
  /** rowJSON field the cell reads / writes (default: key) */
  field?: string;
  /**
   * where the value is stored (default 'rowJSON' = rowJSON[field]).
   * 'rowOwnerGUID' / 'rowParentGUID' = the ROOT column of the row (e.g. product -> its product type / folder);
   * such a cell is saved with updateOne({ columns: { rowOwnerGUID } }).
   */
  target?: CellTarget;
  /** false = shown, not editable */
  editable?: boolean;
  /**
   * checked before a changed value is saved: a message = the value is refused (snackbar), null = ok.
   * `row` is the row BEFORE the change.
   */
  validate?: (value: any, row: ReusableTableRow) => string | null | undefined;
}

/** where a column value is stored */
export type CellTarget = 'rowJSON' | 'rowOwnerGUID' | 'rowParentGUID';

/** one choice of a select / multiSelect column */
export interface SelectOption {
  value: string;
  label: string;
  /** small color dot before the label (e.g. a color descriptor value) */
  color?: string;
  /** second line in the picker */
  hint?: string;
}

/** 1, 2, 3 ... - the position in the list (not stored) */
export interface RowNumberColumn extends ColumnBase { type: 'rowNumber' }

/**
 * A GUID of another catalog: the cell SHOWS the catalog element's title and STORES its rowGUID in rowJSON[field].
 * Input = SelectElementFromCatalog (kit8/catalog/inner/select_element).
 */
export interface CatalogColumn extends ColumnBase {
  type: 'catalog';
  /** SystemMetaData key of the catalog, e.g. 'personReusable', 'contractReusable' */
  catalogEntityName: string;
  /** fixed scope of the catalog rows */
  catalogRowOwnerGUID?: string;
  catalogRowParentGUID?: string;
  /**
   * key of another catalog column of THIS row: the GUID selected there becomes rowOwnerGUID of this
   * catalog (Person -> the contracts of that person). The cell is disabled until that column is filled,
   * and it is cleared when that column changes.
   */
  dependsOn?: string;
  /** shown in the disabled cell, e.g. "Select a person first" */
  dependsOnMessage?: string;
  /**
   * false: `dependsOn` only disables / clears this cell; the catalog is NOT scoped by the owner GUID
   * (use filterItem(catalogRow, tableRow) for any other relation). Default true.
   */
  dependsOnScopesCatalog?: boolean;
  placeholder?: string;
  /**
   * "…" button in the cell: opens the details of the selected element.
   *  string   = the route, opened with ?rowGUID=<selected GUID>           e.g. '/catalog/person/edit'
   *  function = any route for this GUID / table row (string or { pathname, params })
   */
  detailsRoute?: string | ((guid: string, tableRow: ReusableTableRow) => string | { pathname: string; params?: Record<string, string> } | null);
  titleExtractor?: (catalogRow: any) => string;
  subtitleExtractor?: (catalogRow: any) => string | undefined;
  /** which catalog rows can be picked; tableRow = the row of THIS table (e.g. values of the row's descriptor) */
  filterItem?: (catalogRow: any, tableRow: ReusableTableRow) => boolean;
}

export interface NumberColumn extends ColumnBase {
  /** integer: digits only; number: decimals allowed */
  type: 'integer' | 'number';
  min?: number;
  max?: number;
  placeholder?: string;
  /** − / + buttons of an editable cell (default true) */
  stepper?: boolean;
  /** what one press of − / + changes (default 1) */
  step?: number;
  /** false: no sum in the footer (prices, ratios ... where a sum means nothing). Default true */
  total?: boolean;
}

export interface TextColumn extends ColumnBase { type: 'text'; placeholder?: string }

/** true / false - a check box */
export interface BooleanColumn extends ColumnBase { type: 'boolean' }

/**
 * One value of a fixed or computed list (stores option.value, shows option.label).
 * `options` may depend on the row (e.g. "a product type OR a product", the descriptor values of the row's genus).
 */
export interface SelectColumn extends ColumnBase {
  type: 'select';
  options: SelectOption[] | ((row: ReusableTableRow) => SelectOption[]);
  placeholder?: string;
  /** the picker offers "— none —" (stores null). Default true */
  allowEmpty?: boolean;
}

/** several values of a list, stored as string[] */
export interface MultiSelectColumn extends ColumnBase {
  type: 'multiSelect';
  options: SelectOption[] | ((row: ReusableTableRow) => SelectOption[]);
  placeholder?: string;
}

/** 'YYYY-MM-DD' (typed; refused when it is not a real day) */
export interface DateColumn extends ColumnBase { type: 'date'; placeholder?: string }

/** '#RRGGBB' with a color swatch */
export interface ColorColumn extends ColumnBase { type: 'color'; placeholder?: string }

/** any JSON value (object / array / scalar) edited as text in a window */
export interface JsonColumn extends ColumnBase { type: 'json' }

export interface CustomColumn extends ColumnBase {
  type: 'custom';
  renderCell: (row: ReusableTableRow, rowIndex: number, patch: (rowJSONPatch: Record<string, any>) => void) => ReactNode;
  /** text used by the search box */
  searchText?: (row: ReusableTableRow) => string;
}

export type VisualColumn = RowNumberColumn | CatalogColumn | NumberColumn | TextColumn | CustomColumn
  | BooleanColumn | SelectColumn | MultiSelectColumn | DateColumn | ColorColumn | JsonColumn;

/** listOwnerGUID / listParentGUID value: no scope by that column - the table shows the rows of ALL owners / parents */
export const REUSABLE_TABLE_ALL = '*';

/** what a new row gets besides rowJSON (all-rows mode: the owner / parent of the new row) */
export interface NewRowDefaults {
  rowOwnerGUID?: string;
  rowParentGUID?: string;
  rowJSON?: Record<string, any>;
}

/**
 * Layout of the bar above the table:
 *  leftCrudPanel_rightSearch       = Left: CRUD panel · Right: Search          (default; no title)
 *  leftCrudPanel_rightSearchTitle  = Left: CRUD panel · Right: Search, Title
 *  leftTitle_rightSearchCrudPanel  = Left: Title      · Right: Search, CRUD panel
 */
export type ReusableTableBarLayoutVariant = 'leftCrudPanel_rightSearch' | 'leftCrudPanel_rightSearchTitle' | 'leftTitle_rightSearchCrudPanel';

/** how the table looks */
export interface ReusableTableUxUi {
  /** vertical lines between the cells of the rows (and the totals row) (default true) */
  verticalDelimitersForCells?: boolean;
  /** vertical lines between the column names in the header (default true) */
  verticalDelimitersForColumnNames?: boolean;
  /** rounded corners of the input cells (default false = square cells) */
  roundedCells?: boolean;
  /** what is on the left / right of the bar above the table (default 'leftCrudPanel_rightSearch') */
  tableBarLayoutVariant?: ReusableTableBarLayoutVariant;
  /** height of the search input: 'smallestHeight' (default) | 'mediumHeight' | 'normalHeight' */
  searchInputHeight?: 'normalHeight' | 'mediumHeight' | 'smallestHeight';
  /** background of the column headers row: any color or 'transparent' (default: the table header color of the react-native-paper theme - surfaceVariant - as hex) */
  colorForColumnHeadersBackground?: string;
  /** the bar above the table is as low as possible (default true); false = roomy padding */
  minimumTableToolBarHeight?: boolean;
  /** rows as low as possible (default true, about 32 px); false = roomy rows (about 52 px). An explicit rowHeight prop wins */
  minimumTableRowHeight?: boolean;
  /** totals of the number columns (bottom row): 'justifyTextCenter' (default) | 'justifyTextRight' */
  justifyTotalsOfFieldsMode?: 'justifyTextCenter' | 'justifyTextRight';
  /** the footer (count + totals) is as high as a table row (default true); false = the header height (38 px) */
  useTableFooterHeightAsLineHeight?: boolean;
  /** the same setting, as it was first spelled */
  useTableFooterHeightAlLineHeight?: boolean;
  /** border around every input cell (default false = flat cells, like a spreadsheet) */
  borderedCells?: boolean;
  /** width of the table: px or '50%' ... (default '100%'). Wider than the screen = the table scrolls horizontally */
  fixedWidth?: number | string;

  // ---- folders tree next to the table (needs the `foldersTree` prop: FolderTreeReusable, see ../../tree) ----
  /** show the folders tree beside the table: pick a folder = filter the rows, drag rows onto a folder = move them (default false) */
  showFoldersTree?: boolean;
  /** calibration: side of the tree (default 'left') */
  foldersTreePosition?: 'left' | 'right';
  /** calibration: tree width in px (default 260; the user can drag the splitter when foldersTreeResizable) */
  foldersTreeWidth?: number;
  foldersTreeMinWidth?: number;
  foldersTreeMaxWidth?: number;
  /** the splitter between tree and table can be dragged (default true) */
  foldersTreeResizable?: boolean;
  /** a button in the table bar hides / shows the tree (default true) */
  foldersTreeCollapsible?: boolean;
  /** start with the tree hidden (default false) */
  foldersTreeCollapsed?: boolean;
  /** px between tree and table (default 8) */
  foldersTreeGap?: number;
  /**
   * calibration: the tree's header is as high as the table's bar + column header and its rows are as high as the table
   * rows, so folders and table rows line up (default true). false: the tree uses its own heights (rows 28 px)
   */
  foldersTreeAlignRows?: boolean;
  /** height of the tree: 'matchTable' = as high as the table, between the min and the max (default) | px */
  foldersTreeHeight?: 'matchTable' | number;
  foldersTreeMinHeight?: number;
  foldersTreeMaxHeight?: number;
  /** web: the tree stays in view while a long table scrolls (default true) */
  foldersTreeSticky?: boolean;
  /** a container narrower than this puts the tree ABOVE the table (default 720) */
  foldersTreeStackBelowWidth?: number;
  /** height of the tree when it is above the table (default 240) */
  foldersTreeStackedHeight?: number;
}

/**
 * The folders of the tree beside a table and how rows relate to them.
 * A row is "in" a folder through ONE of its columns (default rowParentGUID, as productTable -> productFolderTable).
 * Needs uxuiTable.showFoldersTree.
 */
export interface ReusableTableFoldersTree {
  /** the folders: flat list { id, parentId, title, order } */
  nodes: FolderTreeNode[];
  /** where a row stores its folder: 'rowParentGUID' (default) | 'rowOwnerGUID' | 'rowJSON' (+ folderField) */
  folderTarget?: CellTarget;
  /** rowJSON field of the folder id (folderTarget 'rowJSON') */
  folderField?: string;
  /** stored when a row has no folder (default 'empty') */
  noFolderValue?: string;
  /** picking a folder also shows the rows of its subfolders (default true) */
  includeSubfolders?: boolean;
  /** the picked folder: FolderTreeReusable's TREE_ALL_ID (default) | TREE_NONE_ID | a folder id (controlled) */
  selectedFolderId?: string;
  onSelectedFolderChange?: (folderId: string) => void;
  /** rows dropped on a folder (null = no folder). Default: the table saves the folder column of every dropped row */
  onRowsDrop?: (rowGUIDs: string[], folderId: string | null) => void;
  /** the tree's own options: CRUD callbacks (onCreate / onRename / onDelete / onMove), title, extraMenuItems ... */
  tree?: Omit<FolderTreeReusableProps, 'nodes' | 'index' | 'selectedId' | 'onSelect' | 'itemCounts' | 'totalCount' | 'noneCount' | 'onDropItems' | 'rowHeight' | 'toolbarHeight' | 'searchHeight' | 'height' | 'dragGhost' | 'testID' | 'style'>;
}

export interface ReusableTableProps {
  // ---- the same parameters as ListWebCardsComponent ----
  /** SystemMetaData key (redux entity + Supabase table) */
  entityName: string;
  /** SystemMetaData key of the archive entity ('' / undefined = no "Archive" command) */
  entityForArchivationName?: string;
  crudListTitle?: string;
  /**
   * rowOwnerGUID of every row of this table (no owner = "awaiting owner" empty state).
   * REUSABLE_TABLE_ALL ('*') = the rows of every owner (a catalog dashboard); the owner of a new row comes from
   * newRowDefaults / a column with target 'rowOwnerGUID'.
   */
  listOwnerGUID?: string;
  /** "Row", "Expense", ... in user messages */
  itemLabel?: string;
  /** keep the table in sync with Supabase Realtime (default true) */
  realtime?: boolean;
  /** extra readData payload (merged into the default one) */
  readParams?: Record<string, any>;
  /** false: fixed order - no drag & drop / move commands */
  reorderEnabled?: boolean;

  // ---- table parameters ----
  /** rowParentGUID of every row of this table (default 'empty'); REUSABLE_TABLE_ALL ('*') = every parent */
  listParentGUID?: string;
  /**
   * client-side filter of the shown rows (the server read stays the same, so other screens sharing the redux
   * entity keep every row): master -> detail, e.g. the property values of ONE product
   */
  rowFilter?: (row: ReusableTableRow) => boolean;
  /** rowOwnerGUID / rowParentGUID / rowJSON of a new row (merged over listOwnerGUID / listParentGUID / defaultRowJSON) */
  newRowDefaults?: NewRowDefaults | (() => NewRowDefaults);
  /**
   * derived fields: called with the row AFTER a cell change; the returned patch is saved together with the change
   * (e.g. a title built from other cells). null / {} = nothing more
   */
  computeRowJSON?: (rowJSON: Record<string, any>, row: ReusableTableRow) => Record<string, any> | null | undefined;
  /** more buttons in the bar, after the CRUD panel */
  toolbarExtra?: ReactNode;
  /** folders tree beside the table (shown when uxuiTable.showFoldersTree is true) */
  foldersTree?: ReusableTableFoldersTree;
  /** the columns: what is shown and how it is entered / stored */
  visualColumns: VisualColumn[];
  /** rowJSON of a new row (default: every column field = null) */
  defaultRowJSON?: Record<string, any> | (() => Record<string, any>);
  /** checkbox column + "delete selected" (default true) */
  selectionEnabled?: boolean;
  /** look of the table: column delimiter lines, rounded cells, width */
  uxuiTable?: ReusableTableUxUi;
  /** form of the "select row" check boxes: 'formRound' (default) | 'formSquare' (project UX/UI setting selectRowCheckBoxForm) */
  selectRowCheckBoxForm?: 'formRound' | 'formSquare';
  /** true: the user moves a column by dragging its header (default false) */
  dragAndDropColumns?: boolean;
  /** true: the user changes a column width by dragging the separator at the right edge of its header (default false) */
  resizeColumnWidth?: boolean;
  /** the user's column order (keys) / widths (px) to start with, e.g. restored from saved settings */
  columnsOrder?: string[];
  columnsWidths?: Record<string, number>;
  /** the user moved a column / finished resizing one: save them if they must survive a reload */
  onColumnsOrderChange?: (keys: string[]) => void;
  onColumnsWidthsChange?: (widths: Record<string, number>) => void;
  /** ▾ on a column header: sort by the column + filter it, as in the Tasks Tree (default true) */
  columnSortAndFilter?: boolean;
  /** icon panel above the table: add first / add / duplicate / move up / move down / delete (default true) */
  crudPanelEnabled?: boolean;
  /** search box (default true) */
  searchEnabled?: boolean;
  /** right-click / long-press / ⋮ row menu (default true) */
  contextMenuEnabled?: boolean;
  /** more commands at the end of the row menu */
  extraMenuItems?: (row: ReusableTableRow, close: () => void) => PMMenuItemProps[];
  /** called after every change the user made (create / update / delete / reorder) */
  onRowsChange?: (rows: ReusableTableRow[]) => void;
  rowHeight?: number;
  /** max width of the table card in px (default: none - see uxuiTable.fixedWidth) */
  tableMaxWidth?: number;
  emptyText?: string;
  testID?: string;
}
