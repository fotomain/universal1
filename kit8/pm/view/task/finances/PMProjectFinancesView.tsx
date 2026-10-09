// PMProjectFinancesView - the "Finances" view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showFinancesView';
// the Skia task tree stays on the left):
//
//   toolbar   <task name> ........ [Gantt | Kanban | Network | Versions | Finances]
//   body      the lines of the task selected in the tree (PMProjectTaskFinancesCRUD); no budget / roll-up of stages in this version
//
// The place of the last edit (rowJSON.lastEditPlace, surface 'financesView') is activated when a task is selected: its genus tab opens
// and its line is marked.
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMTipIcon } from '../../../inner/buttons';
import { PMToolbar, PMToolbarSpacer } from '../../../inner/toolbars/PMToolbarPrimitives';
import GanttToNetworkViewToggleButtons from '../../gantt/toolbars/GanttToNetworkViewToggleButtons';
import { lastEditPlaceOf } from '../../../model/lastEditPlace';
import { pmT } from '../../../i18n/pmT';
import PMProjectTaskFinancesCRUD from './PMProjectTaskFinancesCRUD';

export interface PMProjectFinancesViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
}

export default function PMProjectFinancesView({ projectGUID, width, height, palette, crud }: PMProjectFinancesViewProps) {
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const task = usePMStore((s) => (s.selectedGUID ? s.tasksById[s.selectedGUID] : undefined));
  const place = lastEditPlaceOf(task?.rowJSON);
  const recordEditPlace = crud.recordEditPlace;
  const onEditPlace = useCallback(
    (p: { genus: string; lineGUID?: string }) => {
      if (selectedGUID) recordEditPlace?.(selectedGUID, { surface: 'financesView', section: 'finances', genus: p.genus, lineGUID: p.lineGUID });
    },
    [recordEditPlace, selectedGUID],
  );

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-finances-view">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMTipIcon tip={pmT('Finances')} testID="pm-finances-icon" name="payments" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
        <Text style={[styles.title, { color: palette.text }]} testID="pm-finances-title" numberOfLines={1}>
          {task ? task.rowJSON?.name || pmT('Task') : pmT('Finances')}
        </Text>
        <PMToolbarSpacer />
        <GanttToNetworkViewToggleButtons palette={palette} onChange={crud.setGanttVsNetworkView} />
      </PMToolbar>

      {!task || !selectedGUID ? (
        <View style={styles.center} testID="pm-finances-empty">
          <PMTipIcon tip={pmT('Finances')} testID="pm-finances-empty-icon" name="payments" size={36} color={palette.primary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>{pmT('Select a task')}</Text>
          <Text style={[styles.emptyText, { color: palette.textMuted }]}>
            {pmT('Click a task in the tree to see and edit its lines: time, material, expenses and revenues.')}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <PMProjectTaskFinancesCRUD
            key={selectedGUID}
            projectGUID={projectGUID}
            taskGUID={selectedGUID}
            initialPlace={place}
            onEditPlace={onEditPlace}
            testID="pm-finances"
          />
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
