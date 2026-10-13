import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PMFactInputDocument from '../../../../../kit8/pm/fact/PMFactInputDocument';

// route: /pm/project/task/fact?taskGUID=<uuid>&taskLineGUID=<uuid, optional>&genus=<optional>&documentGUID=<optional>&projectGUID=<optional>
// - the fact input document of a task (kit8/pm/fact): opens on the tab of the clicked line, on the latest draft unless a document is named
export default function PMFactInputRoute() {
  const { taskGUID, taskLineGUID, genus, documentGUID } = useLocalSearchParams<{ taskGUID: string; taskLineGUID?: string; genus?: string; documentGUID?: string; projectGUID?: string }>();
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <PMFactInputDocument
        key={`${taskGUID}:${documentGUID || ''}`}
        taskGUID={String(taskGUID || '')}
        taskLineGUID={taskLineGUID ? String(taskLineGUID) : null}
        genus={genus ? String(genus) : null}
        documentGUID={documentGUID ? String(documentGUID) : null}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/project/dashboard' as any))}
      />
    </View>
  );
}
