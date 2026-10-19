import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import CustomerInvoiceDocumentList from '../../../../kit8/documents/customer/invoice/CustomerInvoiceDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/customer-invoice/list[?taskGUID=<uuid>&taskLineGUID=<uuid>] - the list of the customer invoices (hamburger menu → Budgets → Customer invoices): folders legal entity → customer, quick filters;
// a click on a row opens the document. With taskGUID / taskLineGUID (menu "Go to → Customer invoices" of a task / task line) only the invoices of that task / line, with a chip to clear it.
export default function CustomerInvoiceListRoute() {
  const params = useLocalSearchParams<{ taskGUID?: string; taskLineGUID?: string }>();
  const scope = parseTaskScope(params as any);
  return (
    <View style={{ flex: 1 }}>
      <CustomerInvoiceDocumentList taskGUID={scope.taskGUID} taskLineGUID={scope.taskLineGUID} />
    </View>
  );
}
