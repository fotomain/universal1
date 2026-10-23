import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMPaymentFactDocumentList from '../../../../kit8/documents/payment/fact/PMPaymentFactDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/payment-fact/list[?taskGUID=<uuid>] - the list of the payment facts (hamburger menu → Documents → Payment facts): folders money account → payee, quick filters; a click on a row opens the document.
// With taskGUID (menu "Go to → Payment facts" of a task) only the documents that pay that task, with a chip to clear it.
export default function PaymentFactListRoute() {
  const params = useLocalSearchParams<{ taskGUID?: string }>();
  const scope = parseTaskScope(params as any);
  return (
    <View style={{ flex: 1 }}>
      <PMPaymentFactDocumentList taskGUID={scope.taskGUID} />
    </View>
  );
}
