import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PMTimesheetDocumentForm from '../../../../kit8/documents/timesheet/PMTimesheetDocumentForm';

// route: /pm/timesheet/form?documentGUID=<uuid> - ONE time sheet (kit8/documents/timesheet); "Create based on this → Time sheet" of a task opens it in a new browser tab on the web
export default function TimesheetFormRoute() {
  const { documentGUID } = useLocalSearchParams<{ documentGUID?: string }>();
  const router = useRouter();
  const guid = Array.isArray(documentGUID) ? documentGUID[0] : documentGUID;
  return (
    <View style={{ flex: 1 }}>
      <PMTimesheetDocumentForm
        key={guid || 'none'}
        documentGUID={guid ? String(guid) : ''}
        onClose={() => (router.canGoBack() ? router.back() : router.replace('/pm/timesheet/list' as any))}
      />
    </View>
  );
}
