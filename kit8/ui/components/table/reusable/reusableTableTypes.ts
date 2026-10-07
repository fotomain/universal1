// ReusableTable - types. A table is described by data (rows) + a column config; nothing entity-specific lives in the table.
import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';
export type ColumnAlign = 'left' | 'center' | 'right';

export interface ReusableTableColumn<T> {
  /** unique column id; by default also the field read from the row */
  key: string;
  title: string;
  /** fixed width in px (default 140) */
  width?: number;
  align?: ColumnAlign;
  sortable?: boolean;
  /** included in the search box (default: true for string / number values) */
  searchable?: boolean;
  /** raw value used for sorting / searching (default: row[key]) */
  getValue?: (row: T) => unknown;
  /** custom cell (badge, button, icon ...); default: the value as text */
  renderCell?: (row: T, rowIndex: number) => ReactNode;
}

export interface ReusableTableProps<T> {
  data: T[];
  columns: ReusableTableColumn<T>[];
  /** unique id of a row */
  keyExtractor: (row: T) => string;
  title?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** rows per page; 0 = no pagination (default 10) */
  pageSize?: number;
  initialSort?: { key: string; direction: SortDirection };
  /** checkbox column + onSelectionChange */
  selectable?: boolean;
  onSelectionChange?: (selectedKeys: string[]) => void;
  onRowPress?: (row: T) => void;
  emptyText?: string;
  loading?: boolean;
  /** zebra rows (default true) */
  striped?: boolean;
  testID?: string;
}
