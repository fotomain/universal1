// customerInvoiceListColumns - the columns of the ReusableTable of the customer invoice list (CustomerInvoiceDocumentList).
// The rows of the table are the header rows of the redux entity (realtime); what a cell SHOWS comes from the list RPC (customer_invoice_list: the customer, the contract, the legal entity, the totals of ALL
// the lines of the document), found by the GUID of the row through `fromStored`. Every cell is read only: a document is changed in its form. The money columns have NO footer sum: the totals are per
// currency (the list adds them up PER CURRENCY below the table - currencies are never added).
import { pmT } from '../../../pm/i18n/pmT';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { CustomerInvoiceListRow } from './customerInvoiceModel';

export type CustomerInvoiceListInfo = (row: ReusableTableRow) => CustomerInvoiceListRow | undefined;

export function customerInvoiceListColumns(info: CustomerInvoiceListInfo): VisualColumn[] {
  const text = (key: string, title: string, width: number, get: (r: CustomerInvoiceListRow) => string): VisualColumn =>
    ({ key, title: pmT(title), type: 'text', width, editable: false, fromStored: (_s: any, row: ReusableTableRow) => { const r = info(row); return r ? get(r) : ''; } } as VisualColumn);
  const money = (key: 'sumBeforeVAT' | 'sumVAT' | 'sumWithVAT', title: string): VisualColumn =>
    ({ key, title: pmT(title), type: 'number', width: 150, editable: false, stepper: false, total: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.[key] ?? 0 } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    text('customerInvoiceNumber', 'Invoice number', 150, (r) => r.customerInvoiceNumber),
    text('document', 'Document', 110, (r) => r.documentNumber),
    text('customerInvoiceDate', 'Invoice date', 120, (r) => r.customerInvoiceDay ?? ''),
    text('customerInvoicePartner', 'Customer', 200, (r) => r.partnerTitle),
    money('sumBeforeVAT', 'Total sum before VAT'),
    text('currency', 'Currency', 90, (r) => r.currency),
    money('sumVAT', 'Total VAT'),
    money('sumWithVAT', 'Total sum with VAT'),
    text('contractInfo', 'Contract', 220, (r) => r.contractInfo),
    text('customerInvoiceLegalEntity', 'Legal entity', 200, (r) => r.legalEntityTitle),
    text('status', 'Status', 90, (r) => pmT(r.documentStatus === 'posted' ? 'Posted' : 'Draft')),
    text('author', 'Author', 150, (r) => r.authorName),
    { key: 'lines', title: pmT('Lines'), type: 'integer', width: 80, editable: false, stepper: false, total: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.lineCount ?? 0 } as VisualColumn,
  ];
}
