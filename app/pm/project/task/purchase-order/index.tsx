import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PMPurchaseOrderDocumentForm from '../../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentForm';
import { documentsOfRoute } from '../../../../../kit8/documents/vendor/purchase_order/purchaseOrderModel';

// route: /pm/project/task/purchase-order?documentGUID=<uuid>[&documents=<uuid,uuid,...>] - the purchase order(s) (kit8/documents/vendor/purchase_order): a tab for each document (one vendor + one contract each);
// on the web every document can also be opened in a browser tab of its own (the same route with that single documentGUID)
export default function PurchaseOrderRoute() {
  const { documentGUID, documents } = useLocalSearchParams<{ documentGUID?: string; documents?: string; taskGUID?: string; projectGUID?: string }>();
  const router = useRouter();
  const guids = documentsOfRoute(documentGUID ? String(documentGUID) : null, documents ? String(documents) : null);
  return (
    <View style={{ flex: 1 }}>
      <PMPurchaseOrderDocumentForm
        key={guids.join(',')}
        documents={guids}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
