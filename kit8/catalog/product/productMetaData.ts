// Product catalog - the SystemMetaData entries (one reusable redux entity + saga per table, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...productSystemMetaData()`.
import { PRODUCT_TABLES, PRODUCT_TABLE_KEYS } from './productModel';

export function productSystemMetaData(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of PRODUCT_TABLE_KEYS) {
    const t = PRODUCT_TABLES[key];
    out[t.entity] = {
      tableName: t.table,
      itemLabel: t.itemLabel,
      updateValidator: () => {},
      defaultData: t.emptyRowJSON(),
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    };
  }
  return out;
}
