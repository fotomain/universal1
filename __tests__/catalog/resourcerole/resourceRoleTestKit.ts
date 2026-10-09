// The seed of kit8/sql/init/create_resource_role_tables.sql on top of the seed of create_product_tables.sql, as the tables are in
// Supabase: the shared tables hold the rows of BOTH sides.
import productSeed from '../product/productSeed.json';
import roleSeed from './resourceRoleSeed.json';
import rowsSeed from './resourceRowsSeed.json';
import genusSeed from '../management/managementGenusSeed.json';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import type { ProductCatalogData } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { sideOf } from '../../../kit8/catalog/product/crud/catalogSides';
import { RESOURCE_ROLE_TABLE_KEYS, RESOURCE_ROLE_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import type { ResourceRoleCatalogData } from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const rowsOf = (seed: any, table: string): any[] => clone(seed[table] || []);

export interface KitOptions {
  /** add the rows of insert_rows_resource_table.sql (Human / Material / Expense Resources) to the sheet's role rows */
  withResources?: boolean;
}
/** the role rows of a table: the sheet's (create_resource_role_tables.sql) + the demo rows (insert_rows_resource_table.sql) */
const roleRows = (table: string, o: KitOptions) => [...rowsOf(roleSeed, table), ...(o.withResources ? rowsOf(rowsSeed, table) : [])];
export const genusRows = () => rowsOf(genusSeed, 'managementGenusTable');

/** every table as in the database (shared tables: product rows + role rows) */
export function rawRoleTables(o: KitOptions = {}): ResourceRoleCatalogData {
  const out = { managementGenus: genusRows() } as unknown as ResourceRoleCatalogData;
  for (const k of RESOURCE_ROLE_TABLE_KEYS) {
    const table = RESOURCE_ROLE_TABLES[k].table;
    out[k] = [...rowsOf(productSeed, table), ...roleRows(table, o)];
  }
  return out;
}
/** the product tables as in the database (including the role rows of the shared ones) */
export function rawProductTables(o: KitOptions = {}): ProductCatalogData {
  const out = {} as ProductCatalogData;
  for (const k of PRODUCT_TABLE_KEYS) out[k] = [...rowsOf(productSeed, PRODUCT_TABLES[k].table), ...roleRows(PRODUCT_TABLES[k].table, o)];
  return out;
}

/** what the role dashboard works with: the role side of the database */
export function seedRoleCatalog(o: KitOptions = {}): ResourceRoleCatalogData {
  const raw = rawRoleTables(o);
  const products = rowsOf(productSeed, 'productTable');
  const types = rowsOf(productSeed, 'productTypeTable');
  return sideOf(raw, types, products).data;
}
/** what the product dashboard works with: the product side of the database */
export function seedProductSide(o: KitOptions = {}): ProductCatalogData {
  const raw = rawProductTables(o);
  return sideOf(raw, roleRows('resourceRoleTypeTable', o), roleRows('resourceRoleTable', o)).data;
}
