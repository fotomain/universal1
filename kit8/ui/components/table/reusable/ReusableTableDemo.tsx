// ReusableTableDemo - route /demo/reusabletable: TableExample2 (task_expense_input_table) for a demo project / task.
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import TaskExpenseInputTable from './example/TaskExpenseInputTable';

/** fixed GUIDs of the demo scope (rowOwnerGUID = project, rowParentGUID = task) */
export const DEMO_PROJECT_GUID = '00000000-0000-4000-8000-00000000d001';
export const DEMO_TASK_GUID = '00000000-0000-4000-8000-00000000d002';

export default function ReusableTableDemo() {
  const { themeColors: c } = useDesignSystem();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={styles.content} testID="reusable-table-demo" keyboardShouldPersistTaps="handled">
      <TaskExpenseInputTable projectGUID={DEMO_PROJECT_GUID} taskGUID={DEMO_TASK_GUID} uxuiTable={{ fixedWidth: 1200 }} />
      <Text style={[styles.hint, { color: c.text }]}>
        Right-click (long-press on touch) or ⋮ = row menu · drag ⠿ to reorder · every change is saved to task_expense_input_table.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  hint: { opacity: 0.6, fontSize: 12, marginTop: 10, textAlign: 'center' },
});
