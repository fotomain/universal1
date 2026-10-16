import React from 'react';
import { View } from 'react-native';
import PMPurchaseOrderDocumentList from '../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentList';

// route: /pm/purchase-order/list - the list of the purchase orders (hamburger menu → Budgets → Purchase orders): folders legal entity → vendor, quick filters; a click on a row opens the document
export default function PurchaseOrderListRoute() {
  return (
    <View style={{ flex: 1 }}>
      <PMPurchaseOrderDocumentList />
    </View>
  );
}
