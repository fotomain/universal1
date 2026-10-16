// Fact lines + documents - the SystemMetaData entries (reusable redux entities + sagas, Supabase Realtime): the lines the ReusableTable of the fact input form reads and edits, the documents the Actuals list reads.
// Spread into kit8/redux/SystemMetaData.ts: `...taskFactUsageTimelineSystemMetaData()`.
//   task_fact_usage_timeline has real columns next to rowJSON, so besides the usual three the saga may save these root columns of a cell (CellTarget): `rootColumns`.
//   Reading: by task (rowOwnerGUID); the form shows one document and one genus with rowFilter.
//   Creating (free input only; RLS refuses it in the strong input and in a posted document): prepareCreateApi turns the row of the table into a row of task_fact_usage_timeline.
import { FACT_HEADER_ENTITY, FACT_HEADER_TABLE, FACT_USAGE_TIMELINE_ENTITY, FACT_USAGE_TIMELINE_TABLE, factLineInsert } from './factInputModel';

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
    // the DOCUMENTS (the Actuals list): read, realtime and delete of a draft. A document is never made or changed by the table: it is made by task_fact_document_create (the "New" window of the list),
    // posted by post_task_fact_document, and its header fields are read only (RLS + the RPCs) - so there is no create / update API and no rootColumns here.
    [FACT_HEADER_ENTITY]: {
      tableName: FACT_HEADER_TABLE,
      itemLabel: 'Document',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a fact document is made by task_fact_document_create'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
