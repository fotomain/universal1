import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PMPurchaseOrderDocumentChoose from '../../../../../../kit8/documents/vendor/purchase_order/PMPurchaseOrderDocumentChoose';

// route: /pm/project/task/purchase-order/new?taskGUID=<uuid>[&lineGUIDs=<uuid,uuid,...>][&projectGUID=<uuid>] - "Purchase Order" of the context menu: the vendors of the lines, a check box each, Create
export default function PurchaseOrderNewRoute() {
  const { taskGUID, lineGUIDs, projectGUID } = useLocalSearchParams<{ taskGUID: string; lineGUIDs?: string; projectGUID?: string }>();
  const router = useRouter();
  const lines = lineGUIDs ? String(lineGUIDs).split(',').map((x) => x.trim()).filter(Boolean) : null;
  return (
    <View style={{ flex: 1 }}>
      <PMPurchaseOrderDocumentChoose
        key={`${taskGUID}:${lines?.join(',') || ''}`}
        taskGUID={String(taskGUID || '')}
        lineGUIDs={lines}
        projectGUID={projectGUID ? String(projectGUID) : null}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
