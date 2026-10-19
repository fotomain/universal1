import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CustomerInvoiceDocumentForm from '../../../../../kit8/documents/customer/invoice/CustomerInvoiceDocumentForm';
import { documentsOfRoute } from '../../../../../kit8/documents/customer/invoice/customerInvoiceModel';

// route: /pm/project/task/customer-invoice?documentGUID=<uuid>[&documents=<uuid,uuid,...>] - the customer invoice(s) (kit8/documents/customer/invoice): a tab for each document (one customer + one contract each);
// on the web every document can also be opened in a browser tab of its own (the same route with that single documentGUID)
export default function CustomerInvoiceRoute() {
  const { documentGUID, documents } = useLocalSearchParams<{ documentGUID?: string; documents?: string; taskGUID?: string; projectGUID?: string }>();
  const router = useRouter();
  const guids = documentsOfRoute(documentGUID ? String(documentGUID) : null, documents ? String(documents) : null);
  return (
    <View style={{ flex: 1 }}>
      <CustomerInvoiceDocumentForm
        key={guids.join(',')}
        documents={guids}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
