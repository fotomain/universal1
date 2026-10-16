import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import VendorInvoiceDocumentList from '../../../../kit8/documents/vendor/invoice/VendorInvoiceDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/vendor-invoice/list[?taskGUID=<uuid>&taskLineGUID=<uuid>] - the list of the vendor invoices (hamburger menu → Budgets → Vendor invoices): folders legal entity → vendor, quick filters;
// a click on a row opens the document. With taskGUID / taskLineGUID (menu "Go to → Vendor invoices" of a task / task line) only the invoices of that task / line, with a chip to clear it.
export default function VendorInvoiceListRoute() {
  const params = useLocalSearchParams<{ taskGUID?: string; taskLineGUID?: string }>();
  const scope = parseTaskScope(params as any);
  return (
    <View style={{ flex: 1 }}>
      <VendorInvoiceDocumentList taskGUID={scope.taskGUID} taskLineGUID={scope.taskLineGUID} />
    </View>
  );
}
