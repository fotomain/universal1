// Estimation dashboard - the SystemMetaData entries (one reusable redux entity + saga + Supabase Realtime per table). Spread into kit8/redux/SystemMetaData.ts:
// `...estimationSystemMetaData()`. Only the SMALL tables are redux entities (the tree of norm books, the coefficients, the overhead / profit norms, the indices, the export templates):
// the norms and the resources of a book are tens of thousands of rows and are read page by page (kit8/pm/estimation/ui/useNormBook.ts); the lines of a document are read by useEstimationDocument.
import { ESTIMATION_TABLES, type EstimationTableKey } from './model/estimationModel';

const REDUX_TABLES: EstimationTableKey[] = ['normBook', 'coefficient', 'exportTemplate', 'indexHistory', 'overheadProfit'];

export function estimationSystemMetaData(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of REDUX_TABLES) {
    const t = ESTIMATION_TABLES[key];
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
