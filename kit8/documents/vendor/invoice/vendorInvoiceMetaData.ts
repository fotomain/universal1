// Vendor invoice - the SystemMetaData entries (reusable redux entities + sagas, Supabase Realtime), spread into kit8/redux/SystemMetaData.ts: `...vendorInvoiceSystemMetaData()`.
//   vendorInvoiceHeader        the DOCUMENTS (the list reads them, realtime); never made / changed by the table: the RPCs make, set, post and delete them
//   vendorInvoiceLinesReusable the LINES (the form's table reads and edits them): a cell of qtyInvoiced / priceInvoiced / vatRatioInvoiced is a real column, saved by updateOne({ columns })
import { VENDOR_INVOICE_HEADER_ENTITY, VENDOR_INVOICE_HEADER_TABLE, VENDOR_INVOICE_LINES_ENTITY, VENDOR_INVOICE_LINES_TABLE } from './vendorInvoiceModel';

export function vendorInvoiceSystemMetaData(): Record<string, any> {
  return {
    [VENDOR_INVOICE_HEADER_ENTITY]: {
      tableName: VENDOR_INVOICE_HEADER_TABLE,
      itemLabel: 'Vendor invoice',
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('a vendor invoice is made by create_vendor_invoices'); },
      prepareReadApi: (_p: any) => {},
    },
    [VENDOR_INVOICE_LINES_ENTITY]: {
      tableName: VENDOR_INVOICE_LINES_TABLE,
      itemLabel: 'Invoice line',
      rootColumns: ['qtyInvoiced', 'priceInvoiced', 'vatRatioInvoiced'],
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: () => { throw new Error('the lines of a vendor invoice come from the task lines'); },
      prepareReadApi: (_p: any) => {},
    },
  };
}
