import React from 'react';
import { View } from 'react-native';
import VendorInvoiceDocumentList from '../../../../kit8/documents/vendor/invoice/VendorInvoiceDocumentList';

// route: /pm/vendor-invoice/list - the list of the vendor invoices (hamburger menu → Budgets → Vendor invoices): folders legal entity → vendor, quick filters; a click on a row opens the document
export default function VendorInvoiceListRoute() {
  return (
    <View style={{ flex: 1 }}>
      <VendorInvoiceDocumentList />
    </View>
  );
}
