// ReusableTable - types.
// The table works like ListWebCardsComponent (reusable redux entity: read by owner, realtime, optimistic
// create / update / delete + Undo, orderInList drag & drop) but shows the rows as a TABLE: one row of the
// SQL table = one table row, one visualColumn = one input cell stored in rowJSON.
//
// SQL concept (kit8/sql/defTable.md): rowGUID · rowOwnerGUID (the more generic entity) ·
// rowParentGUID (the entity one level higher in the hierarchy) · orderInList · rowJSON (all other fields).
import type { ReactNode } from 'react';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';

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
  /** false = shown, not editable */
  editable?: boolean;
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
  placeholder?: string;
  /**
   * "…" button in the cell: opens the details of the selected element.
   *  string   = the route, opened with ?rowGUID=<selected GUID>           e.g. '/catalog/person/edit'
   *  function = any route for this GUID / table row (string or { pathname, params })
   */
  detailsRoute?: string | ((guid: string, tableRow: ReusableTableRow) => string | { pathname: string; params?: Record<string, string> } | null);
  titleExtractor?: (catalogRow: any) => string;
  subtitleExtractor?: (catalogRow: any) => string | undefined;
  filterItem?: (catalogRow: any) => boolean;
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
}

export interface TextColumn extends ColumnBase { type: 'text'; placeholder?: string }

export interface CustomColumn extends ColumnBase {
  type: 'custom';
  renderCell: (row: ReusableTableRow, rowIndex: number, patch: (rowJSONPatch: Record<string, any>) => void) => ReactNode;
  /** text used by the search box */
  searchText?: (row: ReusableTableRow) => string;
}

export type VisualColumn = RowNumberColumn | CatalogColumn | NumberColumn | TextColumn | CustomColumn;

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
}

export interface ReusableTableProps {
  // ---- the same parameters as ListWebCardsComponent ----
  /** SystemMetaData key (redux entity + Supabase table) */
  entityName: string;
  /** SystemMetaData key of the archive entity ('' / undefined = no "Archive" command) */
  entityForArchivationName?: string;
  crudListTitle?: string;
  /** rowOwnerGUID of every row of this table (no owner = "awaiting owner" empty state) */
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
  /** rowParentGUID of every row of this table (default 'empty') */
  listParentGUID?: string;
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
