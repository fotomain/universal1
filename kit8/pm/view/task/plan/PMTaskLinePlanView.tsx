// PMTaskLinePlanView - the "Plan" view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showPlanView'; the Skia task tree stays
// on the left). Like the Finances view, but it shows the PLAN: the posted days (task_line_plan) of ALL the lines of the selected task in one table.
//
//   toolbar   <task name> ........ [Gantt | Kanban | Network | Versions | Finances | Plan]
//   body      PMProjectTaskPlanCRUD (read-only - nothing is edited here; Post is on the Finances tab)
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMTipIcon } from '../../../inner/buttons';
import { PMToolbar, PMToolbarSpacer } from '../../../inner/toolbars/PMToolbarPrimitives';
import GanttToggleButtons from '../../gantt/toolbars/GanttToggleButtons';
import { pmT } from '../../../i18n/pmT';
import PMProjectTaskPlanCRUD from './PMProjectTaskPlanCRUD';

export interface PMTaskLinePlanViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
}

export default function PMTaskLinePlanView({ projectGUID, width, height, palette, crud }: PMTaskLinePlanViewProps) {
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const task = usePMStore((s) => (s.selectedGUID ? s.tasksById[s.selectedGUID] : undefined));

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-plan-view">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMTipIcon tip={pmT('Budgets')} testID="pm-plan-icon" name="event_note" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
        <Text style={[styles.title, { color: palette.text }]} testID="pm-plan-title" numberOfLines={1}>
          {task ? task.rowJSON?.name || pmT('Task') : pmT('Budgets')}
        </Text>
        <PMToolbarSpacer />
        <GanttToggleButtons palette={palette} onChange={crud.setGanttVsNetworkView} onReorder={crud.setViewButtonsOrder} />
      </PMToolbar>

      {!task || !selectedGUID ? (
        <View style={styles.center} testID="pm-plan-empty">
          <PMTipIcon tip={pmT('Budgets')} testID="pm-plan-empty-icon" name="event_note" size={36} color={palette.primary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>{pmT('Select a task')}</Text>
          <Text style={[styles.emptyText, { color: palette.textMuted }]}>
            {pmT('Click a task in the tree to see the posted days of its lines: the budget, the contract sum and the quantity spread over the working days.')}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <PMProjectTaskPlanCRUD key={selectedGUID} projectGUID={projectGUID} taskGUID={selectedGUID} testID="pm-plan" />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '600', marginHorizontal: 6, flexShrink: 1 },
  body: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 460 },
});
