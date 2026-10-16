// PMProjectFinancesView - the "Finances" view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showFinancesView';
// the Skia task tree stays on the left):
//
//   toolbar   <task name> ........ [Gantt | Kanban | Network | Versions | Finances]
//   body      the lines of the task selected in the tree (PMProjectTaskFinancesCRUD); no budget / roll-up of stages in this version
//
// The place of the last edit (rowJSON.lastEditPlace, surface 'financesView') is activated when a task is selected: its genus tab opens
// and its line is marked. A deep link (store.placeRequest) opens a task at the place of the link.
import React, { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMDialogButton, PMTipIcon } from '../../../inner/buttons';
import { pickedTask, usePMPicker } from '../../project/pick/pmPickerContext';
import { PMToolbar, PMToolbarSpacer } from '../../../inner/toolbars/PMToolbarPrimitives';
import { lastEditPlaceOf, PMLastEditPlace } from '../../../model/lastEditPlace';
import { pmT } from '../../../i18n/pmT';
import PMProjectTaskFinancesCRUD from './PMProjectTaskFinancesCRUD';
import EditTaskNameFast from '../EditTaskNameFast';

export interface PMProjectFinancesViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
}

export default function PMProjectFinancesView({ projectGUID, width, height, palette, crud }: PMProjectFinancesViewProps) {
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  // picker mode (project/pick): the toolbar answers with the selected task
  const picker = usePMPicker();
  const task = usePMStore((s) => (s.selectedGUID ? s.tasksById[s.selectedGUID] : undefined));
  // a deep link (dashboardDeepLink.ts) for THIS task wins over the remembered place; it ends when another task is selected
  const placeRequest = usePMStore((s) => s.placeRequest);
  const requested = !!placeRequest && placeRequest.taskGUID === selectedGUID;
  useEffect(() => {
    if (placeRequest && selectedGUID && selectedGUID !== placeRequest.taskGUID) usePMStore.getState().setPlaceRequest(null);
  }, [placeRequest, selectedGUID]);
  const place: PMLastEditPlace | null = requested
    ? { v: 1, surface: 'financesView', section: 'finances', at: '', ...(placeRequest!.genus ? { genus: placeRequest!.genus } : {}), ...(placeRequest!.lineGUID ? { lineGUID: placeRequest!.lineGUID } : {}) }
    : lastEditPlaceOf(task?.rowJSON);
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
        {task && selectedGUID ? (
          // the name of the task can be typed over right here (flat field: no box, no underline); the label of a task is its name
          <View style={styles.titleBox} testID="pm-finances-title">
            <EditTaskNameFast key={selectedGUID} guid={selectedGUID} crud={crud} testID="pm-finances-task-name" />
          </View>
        ) : (
          <>
            <PMTipIcon tip={pmT('Finances')} testID="pm-finances-icon" name="payments" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
            <Text style={[styles.title, { color: palette.text }]} testID="pm-finances-title" numberOfLines={1}>{pmT('Finances')}</Text>
          </>
        )}
        {picker && task && selectedGUID ? (
          <PMDialogButton testID="pm-finances-pick-task" kind="primary" icon="task_alt" title={pmT('Select this task')} onPress={() => picker.onPick(pickedTask(projectGUID, selectedGUID))} />
        ) : null}
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
            key={requested ? `${selectedGUID}:${placeRequest!.nonce}` : selectedGUID}
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
  titleBox: { flex: 1, minWidth: 0, marginHorizontal: 6 },
  body: { padding: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 460 },
});
