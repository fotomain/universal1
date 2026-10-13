// BudgetScenarioCRUD - the budget scenarios (budgetScenarioTable): a plain list, Plan | Fact. A project points at one of each
// (project.rowJSON.budgetScenarioForPlan / budgetScenarioForFact, Project settings -> Budgets).
//   ReusableTable   add / duplicate / reorder / sql_for_delete + Undo, in-place editing, search, column sort + filter, export, realtime
//   Columns: Scenario (title) · Kind (Plan | Fact) · Code (the rowGUID, read only) · Description · Active
// Route: /budget/scenario/list (drawer: Budgets > Budget scenarios). SQL: kit8/sql/start/start_sql_structure.sql PART 19
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { BUDGET_SCENARIO_KINDS, BUDGET_SCENARIO_TABLE, emptyBudgetScenario } from './budgetScenarioModel';

export default function BudgetScenarioCRUD({ testID = 'budget-scenario' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const t = BUDGET_SCENARIO_TABLE;

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: 'Scenario', type: 'text', width: 280, placeholder: 'Scenario title' },
    { key: 'scenarioKind', title: 'Kind', type: 'select', options: BUDGET_SCENARIO_KINDS, allowEmpty: false, width: 110 },
    {
      key: 'code', title: 'Code', type: 'custom', width: 220, editable: false,
      renderCell: (row) => <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 13 }}>{String((row as any).rowGUID ?? '')}</Text>,
      searchText: (row) => String((row as any).rowGUID ?? ''),
    },
    { key: 'description', title: 'Description', type: 'text', width: 380 },
    { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
  ], [c.text]);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="flag" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Budget scenarios</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{t.purpose}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <ReusableTable
          testID={`${testID}-table`}
          entityName={t.entity}
          crudListTitle="Scenarios"
          itemLabel="Scenario"
          listOwnerGUID={t.catalogOwner as string}
          listParentGUID="empty"
          visualColumns={columns}
          defaultRowJSON={emptyBudgetScenario}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          dragAndDropColumns
          resizeColumnWidth
          realtime
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  content: { flex: 1, padding: 12 },
});
