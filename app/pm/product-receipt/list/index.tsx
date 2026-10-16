import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMProductReceiptDocumentList from '../../../../kit8/documents/vendor/product_receipt/PMProductReceiptDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/product-receipt/list[?taskGUID=<uuid>&taskLineGUID=<uuid>] - the list of the product receipts (hamburger menu → Documents → Product receipts): folders legal entity → vendor, quick filters; a click on a row opens the document.
// With taskGUID / taskLineGUID (menu "Go to → Product receipts" of a task / task line) only the receipts of that task / line, with a chip to clear it.
export default function ProductReceiptListRoute() {
  const params = useLocalSearchParams<{ taskGUID?: string; taskLineGUID?: string }>();
  const scope = parseTaskScope(params as any);
  return (
    <View style={{ flex: 1 }}>
      <PMProductReceiptDocumentList taskGUID={scope.taskGUID} taskLineGUID={scope.taskLineGUID} />
    </View>
  );
}
