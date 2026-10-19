// SelectCatalogItemWithFolders - the pure side (no React): a catalog of FOLDERS and ITEMS in ONE table (budget items, management genus, products ...):
//   folder = a row that has sub-rows or sits at the top level (`isFolder` of the catalog decides); item = any other row. Only an item can be chosen.
//   rowParentGUID = the folder ('empty' / '' = the top level), rowJSON.title = the text.
import type { DefRow } from '../../product/productModel';
import type { FolderTreeNode } from '../../../ui/components/tree/folderTreeModel';

type Row = DefRow<any>;

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** a column of the item table (Tree and List views): `text` makes the cell of a row */
export interface WithFoldersColumn {
  key: string;
  title: string;
  width?: number;
  text: (row: Row) => string;
  /** not shown as a column, but the search looks in it (the SearchName of a product) */
  searchOnly?: boolean;
}

/** the columns the tables show (the search looks in all of them, `searchOnly` ones included) */
export const shownColumns = (columns: WithFoldersColumn[]): WithFoldersColumn[] => columns.filter((c) => !c.searchOnly);

export const rowTitleText = (r: Row): string => String(r?.rowJSON?.title ?? r?.rowJSON?.name ?? r?.rowGUID ?? '');

/** the default columns: the description (the title) and the code (the rowGUID), as in the picture of the 1C catalog */
export const DEFAULT_WITH_FOLDERS_COLUMNS: WithFoldersColumn[] = [
  { key: 'title', title: 'Description', text: rowTitleText },
  { key: 'code', title: 'Code', width: 150, text: (r) => r.rowGUID },
];

/** default `isFolder`: a row at the top level, or a row that has sub-rows */
export function defaultIsFolder(rows: Row[]): (r: Row) => boolean {
  const parents = new Set((rows || []).map((r) => r.rowParentGUID));
  return (r) => !isSet(r.rowParentGUID) || parents.has(r.rowGUID);
}

const order = (a: Row, b: Row) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0);

/**
 * The rows the window shows: the items that pass `filterItem` and the folders that hold (at any depth) at least one of them. Folder rows stay in their order.
 */
export function visibleRows(rows: Row[], isFolder: (r: Row) => boolean, filterItem?: (r: Row) => boolean): Row[] {
  const byId = new Map((rows || []).map((r) => [r.rowGUID, r]));
  const keep = new Set<string>();
  for (const r of rows || []) {
    if (isFolder(r) || (filterItem && !filterItem(r))) continue;
    keep.add(r.rowGUID);
    const seen = new Set<string>([r.rowGUID]);
    for (let p = byId.get(r.rowParentGUID); p && !seen.has(p.rowGUID); p = byId.get(p.rowParentGUID)) { seen.add(p.rowGUID); keep.add(p.rowGUID); }
  }
  return (rows || []).filter((r) => keep.has(r.rowGUID)).slice().sort(order);
}

/** folders AND items as tree nodes (an item is a leaf with the dash icon): the tree-table view */
export function allNodes(rows: Row[], isFolder: (r: Row) => boolean, titleOf: (r: Row) => string): FolderTreeNode[] {
  const ids = new Set(rows.map((r) => r.rowGUID));
  return rows.map((r) => ({
    id: r.rowGUID,
    parentId: isSet(r.rowParentGUID) && ids.has(r.rowParentGUID) ? r.rowParentGUID : null,
    title: titleOf(r) || '(no title)',
    order: Number(r.orderInList) || 0,
    ...(isFolder(r) ? {} : { icon: 'remove' }),
  }));
}

/** the FOLDERS only as tree nodes: the folders-and-table view */
export const folderNodes = (rows: Row[], isFolder: (r: Row) => boolean, titleOf: (r: Row) => string): FolderTreeNode[] => allNodes(rows.filter(isFolder), isFolder, titleOf);

/** the pinned "No folder" row of the folders tree of the split view: the items that sit at the top level */
export const WITH_FOLDERS_NONE = '__tree_none__';

/** the items inside a folder, the sub-folders included (folder null = every item; WITH_FOLDERS_NONE = the items without a folder) */
export function itemsInFolder(rows: Row[], isFolder: (r: Row) => boolean, folder: string | null): Row[] {
  const items = rows.filter((r) => !isFolder(r));
  if (!folder) return items.slice().sort(order);
  if (folder === WITH_FOLDERS_NONE) { const ids = new Set(rows.map((r) => r.rowGUID)); return items.filter((r) => !isSet(r.rowParentGUID) || !ids.has(r.rowParentGUID)).sort(order); }
  const inside = new Set<string>([folder]);
  let grew = true;
  while (grew) { grew = false; for (const r of rows) if (!inside.has(r.rowGUID) && inside.has(r.rowParentGUID)) { inside.add(r.rowGUID); grew = true; } }
  return items.filter((r) => inside.has(r.rowParentGUID)).sort(order);
}

/** does the row match a search text? (a case-insensitive substring of any cell) */
export function rowMatches(r: Row, columns: WithFoldersColumn[], query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || columns.some((c) => c.text(r).toLowerCase().includes(q));
}

/** the ids shown while searching the tree table: the matching items and folders, with every ancestor of a match */
export function searchIds(rows: Row[], columns: WithFoldersColumn[], query: string): Set<string> | null {
  if (!query.trim()) return null;
  const byId = new Map(rows.map((r) => [r.rowGUID, r]));
  const out = new Set<string>();
  for (const r of rows) {
    if (!rowMatches(r, columns, query)) continue;
    const seen = new Set<string>();
    for (let n: Row | undefined = r; n && !seen.has(n.rowGUID); n = byId.get(n.rowParentGUID)) { seen.add(n.rowGUID); out.add(n.rowGUID); }
  }
  return out;
}

/** 'Costs › Time': the folders down to the row */
export function folderPathText(rows: Row[], guid: string | null | undefined, titleOf: (r: Row) => string = rowTitleText, separator = ' › '): string {
  const byId = new Map(rows.map((r) => [r.rowGUID, r]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (let n = guid ? byId.get(guid) : undefined; n && !seen.has(n.rowGUID); n = byId.get(n.rowParentGUID)) { seen.add(n.rowGUID); out.unshift(titleOf(n)); }
  return out.join(separator);
}

/** below this width (px) the window opens as a List (the Tree needs room) */
export const WITH_FOLDERS_SMALL_WIDTH = 640;
