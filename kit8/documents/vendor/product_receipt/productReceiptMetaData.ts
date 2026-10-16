// Product receipt - the SystemMetaData entries (reusable redux entities + sagas, Supabase Realtime), spread into kit8/redux/SystemMetaData.ts: `...productReceiptSystemMetaData()`.
//   productReceiptHeader        the DOCUMENTS (the list reads them, realtime); never made / changed by the table: the RPCs make, set, post and delete them
//   productReceiptLinesReusable the LINES (the form's table reads and edits them): a cell of qtyReceived / priceReceived / vatRatioReceived is a real column, saved by updateOne({ columns })
import { PRODUCT_RECEIPT_HEADER_ENTITY, PRODUCT_RECEIPT_HEADER_TABLE, PRODUCT_RECEIPT_LINES_ENTITY, PRODUCT_RECEIPT_LINES_TABLE } from './productReceiptModel';

export function productReceiptSystemMetaData(): Record<string, any> {
  return {
    [PRODUCT_RECEIPT_HEADER_ENTITY]: {
      tableName: PRODUCT_RECEIPT_HEADER_TABLE,
      itemLabel: 'Product receipt',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a product receipt is made from a purchase order (create_product_receipt_from_order)'); },
      prepareReadApi: (_p: any) => {},
    },
    [PRODUCT_RECEIPT_LINES_ENTITY]: {
      tableName: PRODUCT_RECEIPT_LINES_TABLE,
      itemLabel: 'Receipt line',
      rootColumns: ['qtyReceived', 'priceReceived', 'vatRatioReceived'],
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('the lines of a product receipt come from the lines of the purchase order'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
