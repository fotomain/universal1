import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMFactInputDocumentList from '../../../../kit8/documents/fact/input/PMFactInputDocumentList';

// route: /pm/fact/list[?projectGUID=<uuid>] - the list of the fact input documents (hamburger menu → Budgets → Actuals), with the fast filters; a click on a row opens the form of the document
export default function PMFactInputListRoute() {
  const { projectGUID } = useLocalSearchParams<{ projectGUID?: string }>();
  return (
    <View style={{ flex: 1 }}>
      <PMFactInputDocumentList projectGUID={projectGUID ? String(projectGUID) : null} />
    </View>
  );
}
