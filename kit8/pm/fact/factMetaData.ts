// Fact lines - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime) the ReusableTable of the fact input form reads and edits.
// Spread into kit8/redux/SystemMetaData.ts: `...taskFactUsageTimelineSystemMetaData()`.
//   task_fact_usage_timeline has real columns next to rowJSON, so besides the usual three the saga may save these root columns of a cell (CellTarget): `rootColumns`.
//   Reading: by task (rowOwnerGUID); the form shows one document and one genus with rowFilter.
//   Creating (free input only; RLS refuses it in the strong input and in a posted document): prepareCreateApi turns the row of the table into a row of task_fact_usage_timeline.
import { FACT_USAGE_TIMELINE_ENTITY, FACT_USAGE_TIMELINE_TABLE, factLineInsert } from './factInputModel';

export function taskFactUsageTimelineSystemMetaData(): Record<string, any> {
  return {
    [FACT_USAGE_TIMELINE_ENTITY]: {
      tableName: FACT_USAGE_TIMELINE_TABLE,
      itemLabel: 'Fact line',
      rootColumns: ['rowPeriodDatetime', 'qtyForContract'],
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: (p: any) => ({ newItem: factLineInsert(p.action.payload) }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
