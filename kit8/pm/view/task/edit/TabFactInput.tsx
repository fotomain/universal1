// TabFactInput - the 2nd level tab "Fact input" of TabTaskEditFact: the fact input documents (Actuals) of the task - the list of PMFactInputDocumentList
// with the scope of the task (the chip "Task: …", the period / business unit / role / resource filters, the + New and Delete of drafts, the table).
import React from 'react';
import { View } from 'react-native';
import PMFactInputDocumentList from '../../../../documents/fact/input/PMFactInputDocumentList';

export default function TabFactInput({ projectGUID, taskGUID }: { projectGUID: string | null; taskGUID: string }) {
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-fact-input">
      <PMFactInputDocumentList testID="pm-task-edit-fact" projectGUID={projectGUID} taskGUID={taskGUID} />
    </View>
  );
}
