// The seed of kit8/sql/init/create_resource_role_tables.sql on top of the seed of create_product_tables.sql, as the tables are in
// Supabase: the shared tables hold the rows of BOTH sides.
import productSeed from '../product/productSeed.json';
import roleSeed from './resourceRoleSeed.json';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import type { ProductCatalogData } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { sideOf } from '../../../kit8/catalog/product/crud/catalogSides';
import { RESOURCE_ROLE_TABLE_KEYS, RESOURCE_ROLE_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import type { ResourceRoleCatalogData } from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const rowsOf = (seed: any, table: string): any[] => clone(seed[table] || []);

/** every table as in the database (shared tables: product rows + role rows) */
export function rawRoleTables(): ResourceRoleCatalogData {
  const out = {} as ResourceRoleCatalogData;
  for (const k of RESOURCE_ROLE_TABLE_KEYS) {
    const table = RESOURCE_ROLE_TABLES[k].table;
    out[k] = [...rowsOf(productSeed, table), ...rowsOf(roleSeed, table)];
  }
  return out;
}
/** the product tables as in the database (including the role rows of the shared ones) */
export function rawProductTables(): ProductCatalogData {
  const out = {} as ProductCatalogData;
  for (const k of PRODUCT_TABLE_KEYS) out[k] = [...rowsOf(productSeed, PRODUCT_TABLES[k].table), ...rowsOf(roleSeed, PRODUCT_TABLES[k].table)];
  return out;
}

/** what the role dashboard works with: the role side of the database */
export function seedRoleCatalog(): ResourceRoleCatalogData {
  const raw = rawRoleTables();
  const products = rowsOf(productSeed, 'productTable');
  const types = rowsOf(productSeed, 'productTypeTable');
  return sideOf(raw, types, products).data;
}
/** what the product dashboard works with: the product side of the database */
export function seedProductSide(): ProductCatalogData {
  const raw = rawProductTables();
  return sideOf(raw, rowsOf(roleSeed, 'resourceRoleTypeTable'), rowsOf(roleSeed, 'resourceRoleTable')).data;
}
