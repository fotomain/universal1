// TabCustomerInvoice - the 2nd level tab "Customer invoice" of TabTaskEditFact (after Vendor invoice; only while the project switch customerInvoiceFunctionalityEnabled is on): the customer invoices of the task
// (CustomerInvoiceDocumentList with the scope of the task: the chip "Task: …", the folders legal entity → customer, the quick filters; a click on a row opens the document).
import React from 'react';
import { View } from 'react-native';
import CustomerInvoiceDocumentList from '../../../../documents/customer/invoice/CustomerInvoiceDocumentList';

export default function TabCustomerInvoice({ taskGUID }: { taskGUID: string }) {
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-customer-invoice">
      <CustomerInvoiceDocumentList testID="pm-task-edit-customer-invoice" taskGUID={taskGUID} />
    </View>
  );
}
