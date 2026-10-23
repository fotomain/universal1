import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PMPaymentFactDocumentForm from '../../../../../kit8/documents/payment/fact/PMPaymentFactDocumentForm';
import { documentsOfRoute } from '../../../../../kit8/documents/payment/fact/paymentFactModel';

// route: /pm/project/task/payment-fact?documentGUID=<uuid>[&documents=<uuid,uuid,...>] - the payment fact(s) (kit8/documents/payment/fact): ONE bank transaction each; a tab for each document, and on the web every
// document can also be opened in a browser tab of its own (the same route with that single documentGUID)
export default function PaymentFactRoute() {
  const { documentGUID, documents } = useLocalSearchParams<{ documentGUID?: string; documents?: string; taskGUID?: string; projectGUID?: string }>();
  const router = useRouter();
  const guids = documentsOfRoute(documentGUID ? String(documentGUID) : null, documents ? String(documents) : null);
  return (
    <View style={{ flex: 1 }}>
      <PMPaymentFactDocumentForm
        key={guids.join(',')}
        documents={guids}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
