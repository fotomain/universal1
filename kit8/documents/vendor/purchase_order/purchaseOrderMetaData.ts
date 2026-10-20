// Purchase order - the SystemMetaData entries (reusable redux entities + sagas, Supabase Realtime), spread into kit8/redux/SystemMetaData.ts: `...purchaseOrderSystemMetaData()`.
//   purchaseOrderHeader        the DOCUMENTS (the list reads them, realtime); never made / changed by the table: the RPCs make, set, post and delete them
//   purchaseOrderLinesReusable the LINES (the form's table reads and edits them): a cell of qtyOrdered / priceOrdered / vatRatioOrdered is a real column, saved by updateOne({ columns })
import { PURCHASE_ORDER_HEADER_ENTITY, PURCHASE_ORDER_HEADER_TABLE, PURCHASE_ORDER_LINES_ENTITY, PURCHASE_ORDER_LINES_TABLE } from './purchaseOrderModel';

export function purchaseOrderSystemMetaData(): Record<string, any> {
  return {
    [PURCHASE_ORDER_HEADER_ENTITY]: {
      tableName: PURCHASE_ORDER_HEADER_TABLE,
      itemLabel: 'Purchase order',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a purchase order is made by create_purchase_orders'); },
      prepareReadApi: (_p: any) => {},
    },
    [PURCHASE_ORDER_LINES_ENTITY]: {
      tableName: PURCHASE_ORDER_LINES_TABLE,
      itemLabel: 'Order line',
      rootColumns: ['qtyOrdered', 'priceOrdered', 'vatRatioOrdered', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT'],
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('the lines of a purchase order come from the task lines'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
