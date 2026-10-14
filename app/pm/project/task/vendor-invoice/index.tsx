import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import VendorInvoiceDocumentForm from '../../../../../kit8/pm/vendor_invoice/VendorInvoiceDocumentForm';
import { documentsOfRoute } from '../../../../../kit8/pm/vendor_invoice/vendorInvoiceModel';

// route: /pm/project/task/vendor-invoice?documentGUID=<uuid>[&documents=<uuid,uuid,...>] - the vendor invoice(s) (kit8/pm/vendor_invoice): a tab for each document (one vendor + one contract each);
// on the web every document can also be opened in a browser tab of its own (the same route with that single documentGUID)
export default function VendorInvoiceRoute() {
  const { documentGUID, documents } = useLocalSearchParams<{ documentGUID?: string; documents?: string; taskGUID?: string; projectGUID?: string }>();
  const router = useRouter();
  const guids = documentsOfRoute(documentGUID ? String(documentGUID) : null, documents ? String(documents) : null);
  return (
    <View style={{ flex: 1 }}>
      <VendorInvoiceDocumentForm
        key={guids.join(',')}
        documents={guids}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
