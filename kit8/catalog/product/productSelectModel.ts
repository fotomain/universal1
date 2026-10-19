// Choosing a product in a window with folders (SelectCatalogItemWithFolders, kit8/catalog/select/with_folders): the folders (productFolderTable, a tree of any depth)
// and the products (productTable, rowParentGUID = its folder, 'empty' = no folder) are put in ONE list of rows.
import type { WithFoldersColumn } from '../select/with_folders/withFoldersModel';
import { PRODUCT_TABLES } from './productModel';
import type { DefRow } from './productModel';
import { itemNumberOf, NO_PRODUCT_FIELDS, searchNameOf, type ProductFields } from './productFieldsModel';

const FOLDER_OWNER = PRODUCT_TABLES.productFolder.catalogOwner as string;

/** a row of productFolderTable (its rowOwnerGUID is the folder catalog; a product's is its product type) */
export const isProductFolder = (r: DefRow<any>): boolean => r.rowOwnerGUID === FOLDER_OWNER;

/** folders + products: the rows the selector works on (a product whose folder is missing shows at the top level) */
export const productRowsWithFolders = (folders: DefRow<any>[], products: DefRow<any>[]): DefRow<any>[] => [...(folders || []), ...(products || [])];

/**
 * The cells of the tables of the window: Description (carries the tree) + SKU, then - while the project switches are on (productFieldsModel.ts) - Item number and Search name.
 * A field that is Enabled but not VisibleInProjects is no column, but the search of the window still looks in it (`searchOnly`).
 */
export function productSelectColumns(fields: ProductFields = NO_PRODUCT_FIELDS): WithFoldersColumn[] {
  const cols: WithFoldersColumn[] = [
    { key: 'title', title: 'Description', text: (r) => String(r.rowJSON?.title ?? r.rowGUID ?? '') },
    { key: 'sku', title: 'SKU', width: 150, text: (r) => String(r.rowJSON?.sku ?? '') },
  ];
  if (fields.itemNumber.enabled) cols.push({ key: 'itemNumber', title: 'Item number', width: 130, text: itemNumberOf, ...(fields.itemNumber.shown ? {} : { searchOnly: true }) });
  if (fields.searchName.enabled) cols.push({ key: 'searchName', title: 'Search name', width: 160, text: searchNameOf, ...(fields.searchName.shown ? {} : { searchOnly: true }) });
  return cols;
}

/** the columns of a project without the optional fields (as before them) */
export const PRODUCT_SELECT_COLUMNS: WithFoldersColumn[] = productSelectColumns();

/** the details line of a product in the List view: the shown Item number and Search name, then the description (undefined = nothing to show) */
export function productSubtitle(r: DefRow<any>, fields: ProductFields = NO_PRODUCT_FIELDS): string | undefined {
  const parts = [fields.itemNumber.shown ? itemNumberOf(r) : '', fields.searchName.shown ? searchNameOf(r) : '', String(r.rowJSON?.description ?? '').trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}
