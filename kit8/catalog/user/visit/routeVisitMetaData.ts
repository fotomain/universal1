// Route visits - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime).
// Spread into kit8/redux/SystemMetaData.ts: `...routeVisitSystemMetaData()`.
import { ROUTE_VISIT_TABLE } from './routeVisitModel';

export function routeVisitSystemMetaData(): Record<string, any> {
  const t = ROUTE_VISIT_TABLE;
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
