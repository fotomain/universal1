// Catalog translations - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime). Spread into kit8/redux/SystemMetaData.ts: `...catalogTranslationSystemMetaData()`.
import { CATALOG_TRANSLATION_TABLE } from './catalogTranslationModel';

export function catalogTranslationSystemMetaData(): Record<string, any> {
  const t = CATALOG_TRANSLATION_TABLE;
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
