// Customer invoice - the SystemMetaData entries (reusable redux entities + sagas, Supabase Realtime), spread into kit8/redux/SystemMetaData.ts: `...customerInvoiceSystemMetaData()`.
//   customerInvoiceHeader        the DOCUMENTS (the list reads them, realtime); never made / changed by the table: the RPCs make, set, post and delete them
//   customerInvoiceLinesReusable the LINES (the form's table reads and edits them): a cell of qtyInvoiced / priceInvoiced / vatRatioInvoiced is a real column, saved by updateOne({ columns })
import { CUSTOMER_INVOICE_HEADER_ENTITY, CUSTOMER_INVOICE_HEADER_TABLE, CUSTOMER_INVOICE_LINES_ENTITY, CUSTOMER_INVOICE_LINES_TABLE } from './customerInvoiceModel';

export function customerInvoiceSystemMetaData(): Record<string, any> {
  return {
    [CUSTOMER_INVOICE_HEADER_ENTITY]: {
      tableName: CUSTOMER_INVOICE_HEADER_TABLE,
      itemLabel: 'Customer invoice',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a customer invoice is made by create_customer_invoices'); },
      prepareReadApi: (_p: any) => {},
    },
    [CUSTOMER_INVOICE_LINES_ENTITY]: {
      tableName: CUSTOMER_INVOICE_LINES_TABLE,
      itemLabel: 'Invoice line',
      rootColumns: ['qtyInvoiced', 'priceInvoiced', 'vatRatioInvoiced', 'sumForAccountingBeforeVAT', 'sumForAccountingVAT'],
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('the lines of a customer invoice come from the task lines'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
