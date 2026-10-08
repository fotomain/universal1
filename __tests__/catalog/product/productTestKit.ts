// The seed of kit8/sql/init/create_product_tables.sql (sheet rows + 100 generated products) as ProductCatalogData.
import seed from './productSeed.json';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import type { ProductCatalogData } from '../../../kit8/catalog/product/crud/productCatalogTools';

export function seedCatalog(): ProductCatalogData {
  const out = {} as ProductCatalogData;
  for (const k of PRODUCT_TABLE_KEYS) out[k] = JSON.parse(JSON.stringify((seed as any)[PRODUCT_TABLES[k].table] || []));
  return out;
}
