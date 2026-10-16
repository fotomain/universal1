import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMFactInputDocumentList from '../../../../kit8/documents/fact/input/PMFactInputDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/fact/list[?projectGUID=<uuid>][&taskGUID=<uuid>&taskLineGUID=<uuid>] - the list of the fact input documents (hamburger menu → Budgets → Actuals), with the fast filters; a click on a row opens the form of the document.
// With taskGUID / taskLineGUID (menu "Go to → Fact input" of a task / task line) only the documents of that task / line, with a chip to clear it.
export default function PMFactInputListRoute() {
  const { projectGUID, taskGUID, taskLineGUID } = useLocalSearchParams<{ projectGUID?: string; taskGUID?: string; taskLineGUID?: string }>();
  const scope = parseTaskScope({ taskGUID, taskLineGUID });
  return (
    <View style={{ flex: 1 }}>
      <PMFactInputDocumentList projectGUID={projectGUID ? String(projectGUID) : null} taskGUID={scope.taskGUID} taskLineGUID={scope.taskLineGUID} />
    </View>
  );
}
