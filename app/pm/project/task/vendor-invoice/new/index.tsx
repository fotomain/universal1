import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import VendorInvoiceChoose from '../../../../../../kit8/pm/vendor_invoice/VendorInvoiceChoose';

// route: /pm/project/task/vendor-invoice/new?taskGUID=<uuid>[&lineGUIDs=<uuid,uuid,...>][&projectGUID=<uuid>] - "Vendor Invoice" of the context menu: the vendors of the lines, a check box each, Create
export default function VendorInvoiceNewRoute() {
  const { taskGUID, lineGUIDs, projectGUID } = useLocalSearchParams<{ taskGUID: string; lineGUIDs?: string; projectGUID?: string }>();
  const router = useRouter();
  const lines = lineGUIDs ? String(lineGUIDs).split(',').map((x) => x.trim()).filter(Boolean) : null;
  return (
    <View style={{ flex: 1 }}>
      <VendorInvoiceChoose
        key={`${taskGUID}:${lines?.join(',') || ''}`}
        taskGUID={String(taskGUID || '')}
        lineGUIDs={lines}
        projectGUID={projectGUID ? String(projectGUID) : null}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
