// Budget item - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...budgetItemSystemMetaData()`.
import { BUDGET_ITEM_TABLE } from './budgetItemModel';

export function budgetItemSystemMetaData(): Record<string, any> {
  const t = BUDGET_ITEM_TABLE;
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
