// Choosing a product in a window with folders (SelectCatalogItemWithFolders, kit8/catalog/select/with_folders): the folders (productFolderTable, a tree of any depth)
// and the products (productTable, rowParentGUID = its folder, 'empty' = no folder) are put in ONE list of rows.
import type { WithFoldersColumn } from '../select/with_folders/withFoldersModel';
import { PRODUCT_TABLES } from './productModel';
import type { DefRow } from './productModel';

const FOLDER_OWNER = PRODUCT_TABLES.productFolder.catalogOwner as string;

/** a row of productFolderTable (its rowOwnerGUID is the folder catalog; a product's is its product type) */
export const isProductFolder = (r: DefRow<any>): boolean => r.rowOwnerGUID === FOLDER_OWNER;

/** folders + products: the rows the selector works on (a product whose folder is missing shows at the top level) */
export const productRowsWithFolders = (folders: DefRow<any>[], products: DefRow<any>[]): DefRow<any>[] => [...(folders || []), ...(products || [])];

/** the cells of the tables of the window: Description (carries the tree) + SKU */
export const PRODUCT_SELECT_COLUMNS: WithFoldersColumn[] = [
  { key: 'title', title: 'Description', text: (r) => String(r.rowJSON?.title ?? r.rowGUID ?? '') },
  { key: 'sku', title: 'SKU', width: 150, text: (r) => String(r.rowJSON?.sku ?? '') },
];
