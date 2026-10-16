import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMPurchaseOrderDocumentList from '../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/purchase-order/list[?taskGUID=<uuid>&taskLineGUID=<uuid>] - the list of the purchase orders (hamburger menu → Budgets → Purchase orders): folders legal entity → vendor, quick filters; a click on a row opens the document.
// With taskGUID / taskLineGUID (menu "Go to → Purchase orders" of a task / task line) only the orders of that task / line, with a chip to clear it.
export default function PurchaseOrderListRoute() {
  const params = useLocalSearchParams<{ taskGUID?: string; taskLineGUID?: string }>();
  const scope = parseTaskScope(params as any);
  return (
    <View style={{ flex: 1 }}>
      <PMPurchaseOrderDocumentList taskGUID={scope.taskGUID} taskLineGUID={scope.taskLineGUID} />
    </View>
  );
}
