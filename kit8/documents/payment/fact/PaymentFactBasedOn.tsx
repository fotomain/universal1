// PaymentFactBasedOn - the button "Create based on" in the bar of a POSTED vendor / customer invoice (and, for the lists, `paymentFactBasedOnMenuItem`): a small window with the item "Payment fact" that makes ONE draft
// bank transaction paying (vendor invoice, Outbound) or receiving (customer invoice, Inbound) what is still open on the invoice and opens it in a new window. The rules are in the database
// (create_payment_fact_from_vendor_invoice / _customer_invoice, PART 38); a refusal is a snackbar (useCreatePaymentFactFromInvoice).
import React, { useState } from 'react';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import ModalWindowListToSelect from '../../../ui/components/common/ModalWindowListToSelect';
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import { pmT } from '../../../pm/i18n/pmT';
import { PAYMENT_FACT_BASED_ON_ITEM, PaymentFactInvoiceKind, canCreatePaymentFactFromInvoice, paymentFactBasedOnSubtitle } from './paymentFactModel';
import { useCreatePaymentFactFromInvoice } from './usePaymentFact';

export interface PaymentFactBasedOnProps {
  kind: PaymentFactInvoiceKind;
  invoiceGUID: string;
  /** the status of the invoice: only a posted one is paid */
  status: string;
  /** another command of the form is running */
  disabled?: boolean;
  testID?: string;
}

export default function PaymentFactBasedOn({ kind, invoiceGUID, status, disabled, testID = 'invoice' }: PaymentFactBasedOnProps) {
  const toPayment = useCreatePaymentFactFromInvoice();
  const [menu, setMenu] = useState(false);
  if (!canCreatePaymentFactFromInvoice({ status })) return null;
  return (
    <>
      <ButtonApp testID={`${testID}-create-based-on`} title={pmT('Create based on')} icon="add_circle" variant="outlined" size="small" disabled={disabled || toPayment.busy} onPress={() => setMenu(true)} />
      <ModalWindowListToSelect
        visible={menu} testID={`${testID}-create-based-on-list`} title={pmT(kind === 'customer' ? 'Create based on this customer invoice' : 'Create based on this vendor invoice')} message={pmT('The new document opens in a new window.')}
        items={[{ id: PAYMENT_FACT_BASED_ON_ITEM.id, title: pmT(PAYMENT_FACT_BASED_ON_ITEM.title), subtitle: pmT(paymentFactBasedOnSubtitle(kind)), icon: PAYMENT_FACT_BASED_ON_ITEM.icon }]} selectedId="" cancelLabel={pmT('Cancel')}
        onClose={() => setMenu(false)}
        onSelect={(id) => { setMenu(false); if (id === PAYMENT_FACT_BASED_ON_ITEM.id) void toPayment.create(kind, invoiceGUID); }}
      />
    </>
  );
}

/**
 * The row menu of an invoice LIST: "Create based on → Payment fact" on a POSTED invoice, in front of the other items.
 *   const basedOn = usePaymentFactBasedOnRowMenu(kind, testID);   rowMenu = (row, close) => [...basedOn(row.rowGUID, status, close), ...taskMenu(row, close)]
 */
export function usePaymentFactBasedOnRowMenu(kind: PaymentFactInvoiceKind, testID: string) {
  const toPayment = useCreatePaymentFactFromInvoice();
  return (invoiceGUID: string, status: string | undefined, close: () => void): PMMenuItemProps[] => (
    status && canCreatePaymentFactFromInvoice({ status })
      ? [{
          testID: `${testID}-menu-create-${invoiceGUID}`, label: pmT('Create based on'), icon: 'add_circle', onPress: () => {},
          submenu: [{ testID: `${testID}-menu-create-payment-fact-${invoiceGUID}`, label: pmT(PAYMENT_FACT_BASED_ON_ITEM.title), icon: PAYMENT_FACT_BASED_ON_ITEM.icon, onPress: () => { close(); void toPayment.create(kind, invoiceGUID); } }],
        }]
      : []
  );
}
