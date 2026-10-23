// paymentFactListColumns - the columns of the ReusableTable of the payment fact list (PMPaymentFactDocumentList).
// The rows of the table are the header rows of the redux entity (realtime); what a cell SHOWS comes from the list RPC (payment_fact_list: the money account, the payee, the amount of the account), found by the GUID
// of the row through `fromStored`. Every cell is read only: a document is changed in its form. The amount column has NO footer sum: the totals are per currency (the list adds them up below the table).
import { pmT } from '../../../pm/i18n/pmT';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { PaymentFactListRow } from './paymentFactModel';

export type PaymentFactListInfo = (row: ReusableTableRow) => PaymentFactListRow | undefined;

export function paymentFactListColumns(info: PaymentFactListInfo): VisualColumn[] {
  const text = (key: string, title: string, width: number, get: (r: PaymentFactListRow) => string): VisualColumn =>
    ({ key, title: pmT(title), type: 'text', width, editable: false, fromStored: (_s: any, row: ReusableTableRow) => { const r = info(row); return r ? get(r) : ''; } } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    text('paymentFactNumber', 'Bank transaction no.', 160, (r) => r.paymentFactNumber),
    text('document', 'Document', 110, (r) => r.documentNumber),
    text('paymentFactDate', 'Date', 120, (r) => r.paymentFactDay ?? ''),
    text('direction', 'Direction', 110, (r) => (r.direction ? pmT(r.direction === 'inbound' ? 'Inbound' : 'Outbound') : '')),
    text('payee', 'Payee', 220, (r) => r.payeeTitle),
    text('account', 'Money account', 200, (r) => r.moneyAccountTitle),
    { key: 'sumForMoneyAccount', title: pmT('Amount of the money account'), type: 'number', width: 190, editable: false, stepper: false, total: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.sumForMoneyAccount ?? 0 } as VisualColumn,
    text('currency', 'Currency', 90, (r) => r.currency),
    text('legalEntity', 'Legal entity', 200, (r) => r.legalEntityTitle),
    text('status', 'Status', 90, (r) => pmT(r.documentStatus === 'posted' ? 'Posted' : 'Draft')),
    text('author', 'Author', 150, (r) => r.authorName),
    { key: 'lines', title: pmT('Lines'), type: 'integer', width: 80, editable: false, stepper: false, total: false, fromStored: (_s: any, row: ReusableTableRow) => info(row)?.lineCount ?? 0 } as VisualColumn,
  ];
}
