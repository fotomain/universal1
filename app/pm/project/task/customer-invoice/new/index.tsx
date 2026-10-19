import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CustomerInvoiceChoose from '../../../../../../kit8/documents/customer/invoice/CustomerInvoiceChoose';

// route: /pm/project/task/customer-invoice/new?taskGUID=<uuid>[&lineGUIDs=<uuid,uuid,...>][&projectGUID=<uuid>] - "Customer Invoice" of the context menu: the customers of the lines, a check box each, Create
export default function CustomerInvoiceNewRoute() {
  const { taskGUID, lineGUIDs, projectGUID } = useLocalSearchParams<{ taskGUID: string; lineGUIDs?: string; projectGUID?: string }>();
  const router = useRouter();
  const lines = lineGUIDs ? String(lineGUIDs).split(',').map((x) => x.trim()).filter(Boolean) : null;
  return (
    <View style={{ flex: 1 }}>
      <CustomerInvoiceChoose
        key={`${taskGUID}:${lines?.join(',') || ''}`}
        taskGUID={String(taskGUID || '')}
        lineGUIDs={lines}
        projectGUID={projectGUID ? String(projectGUID) : null}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
