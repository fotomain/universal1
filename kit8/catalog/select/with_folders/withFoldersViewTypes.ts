// The props every view of SelectCatalogItemWithFolders gets (WithFoldersTreeTable, WithFoldersSplit, WithFoldersList).
import type { DefRow } from '../../product/productModel';
import type { WithFoldersColumn } from './withFoldersModel';

export interface WithFoldersViewProps {
  /** the rows to show: the items that can be chosen + the folders that hold them (visibleRows) */
  rows: DefRow<any>[];
  isFolder: (r: DefRow<any>) => boolean;
  titleOf: (r: DefRow<any>) => string;
  subtitleOf?: (r: DefRow<any>) => string | undefined;
  columns: WithFoldersColumn[];
  /** the item chosen now */
  value?: string | null;
  /** the search text (a substring of any cell) */
  query: string;
  /** an item was pressed */
  onPick: (row: DefRow<any>) => void;
  testID: string;
}
