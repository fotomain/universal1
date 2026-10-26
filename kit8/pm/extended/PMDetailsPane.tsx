// PMDetailsPane (E10) - the "Details" pane under the Gantt chart: the form of the selected task (PMTaskEditModal embedded) so it can be edited without a window.
// Shown only while the function is on AND the Details button of the Gantt bar is pressed (option detailsPane); nothing is selected = a hint.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { usePMStore } from '../store/store_pm';
import type { PMCrud } from '../crud/usePMCrud';
import { pmT } from '../i18n/pmT';
import PMTaskEditModal from '../view/task/PMTaskEditModal';

export default function PMDetailsPane({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const visible = usePMStore((s) => s.extFlags.ganttDetailsPaneEnabled === true && s.extOptions.detailsPane);
  const guid = usePMStore((s) => (s.selectedGUID && s.tasksById[s.selectedGUID] ? s.selectedGUID : null));
  if (!visible) return null;
  return (
    <View testID="pm-details-pane" style={[styles.pane, { borderColor: c.border, backgroundColor: c.background }]}>
      {guid ? <PMTaskEditModal key={guid} crud={crud} guid={guid} embedded closeOnSave={false} onClose={() => usePMStore.getState().setSelected(null)} /> : <Text style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Select a task to see its form here.')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ pane: { height: 300, borderTopWidth: 1 } });
