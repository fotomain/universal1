// Payment fact - the SystemMetaData entries (reusable redux entities + sagas, Supabase Realtime), spread into kit8/redux/SystemMetaData.ts: `...paymentFactSystemMetaData()`.
//   paymentFactHeader        the DOCUMENTS (the list reads them, realtime); never made / changed by the table: the RPCs make, set, post and delete them
//   paymentFactLinesReusable the LINES (the form's table reads and edits them): the editable cells (contract, budget item, business unit, the sums) live in rowJSON and are saved by updateOne({ field, value });
//                            the database converts the sums on every write (trigger payment_fact_lines_before_write)
import { PAYMENT_FACT_HEADER_ENTITY, PAYMENT_FACT_HEADER_TABLE, PAYMENT_FACT_LINES_ENTITY, PAYMENT_FACT_LINES_TABLE } from './paymentFactModel';

export function paymentFactSystemMetaData(): Record<string, any> {
  return {
    [PAYMENT_FACT_HEADER_ENTITY]: {
      tableName: PAYMENT_FACT_HEADER_TABLE,
      itemLabel: 'Payment fact',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a payment fact is made by payment_fact_create'); },
      prepareReadApi: (_p: any) => {},
    },
    [PAYMENT_FACT_LINES_ENTITY]: {
      tableName: PAYMENT_FACT_LINES_TABLE,
      itemLabel: 'Payment line',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a payment fact line is made by payment_fact_add_from_plan or payment_fact_add_line'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
