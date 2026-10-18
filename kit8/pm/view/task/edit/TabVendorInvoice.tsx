// TabVendorInvoice - the 2nd level tab "Vendor invoice" of TabTaskEditFact: the vendor invoices of the task (VendorInvoiceDocumentList with the scope of the task:
// the chip "Task: …", the folders legal entity → vendor, the quick filters; a click on a row opens the document).
import React from 'react';
import { View } from 'react-native';
import VendorInvoiceDocumentList from '../../../../documents/vendor/invoice/VendorInvoiceDocumentList';

export default function TabVendorInvoice({ taskGUID }: { taskGUID: string }) {
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-vendor-invoice">
      <VendorInvoiceDocumentList testID="pm-task-edit-vendor-invoice" taskGUID={taskGUID} />
    </View>
  );
}
