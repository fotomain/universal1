import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PMProductReceiptDocumentForm from '../../../../../kit8/documents/vendor/product_receipt/PMProductReceiptDocumentForm';
import { documentsOfRoute } from '../../../../../kit8/documents/vendor/product_receipt/productReceiptModel';

// route: /pm/project/task/product-receipt?documentGUID=<uuid>[&documents=<uuid,uuid,...>] - the product receipt(s) (kit8/documents/vendor/product_receipt): a tab for each document (one vendor + one contract each);
// on the web every document can also be opened in a browser tab of its own (the same route with that single documentGUID)
export default function ProductReceiptRoute() {
  const { documentGUID, documents } = useLocalSearchParams<{ documentGUID?: string; documents?: string; taskGUID?: string; projectGUID?: string }>();
  const router = useRouter();
  const guids = documentsOfRoute(documentGUID ? String(documentGUID) : null, documents ? String(documents) : null);
  return (
    <View style={{ flex: 1 }}>
      <PMProductReceiptDocumentForm
        key={guids.join(',')}
        documents={guids}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
