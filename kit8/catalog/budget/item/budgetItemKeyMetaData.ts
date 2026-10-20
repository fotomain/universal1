// Budget item key - the SystemMetaData entry of budgetItemGenericKeyTable (one reusable redux entity + saga, Supabase Realtime; the table is read only for the app).
// Spread into kit8/redux/SystemMetaData.ts: `...budgetItemKeySystemMetaData()`.
import { BUDGET_ITEM_KEY_TABLE } from './budgetItemKeyModel';

export function budgetItemKeySystemMetaData(): Record<string, any> {
  const t = BUDGET_ITEM_KEY_TABLE;
  return {
    [t.entity]: {
      tableName: t.table,
      itemLabel: t.itemLabel,
      updateValidator: () => {},
      defaultData: t.emptyRowJSON(),
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
