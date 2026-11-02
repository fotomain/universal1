// PMProjectKanbanSettingsSection - the switch autoUpdateTaskProgressPercentFromKanban at the top of Project settings -> Kanban.
// The rules are in kanbanSettings.ts (pure); the stage percents are edited in "Kanban Stages" (and in the Kanban stage catalog).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../../i18n/pmT';
import { kanbanValuesOf, type PMKanbanSettingsValues } from './kanbanSettings';

export default function PMProjectKanbanSettingsSection({ values, onChange }: { values: Partial<PMKanbanSettingsValues> | null | undefined; onChange: (patch: PMKanbanSettingsValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = kanbanValuesOf(values);
  return (
    <View testID="pm-project-kanban-settings" style={styles.box}>
      <SwitchApp
        testID="pm-project-kanban-auto-progress"
        label={pmT('Update the task progress % from the Kanban (autoUpdateTaskProgressPercentFromKanban)')}
        value={v.autoUpdateTaskProgressPercentFromKanban}
        onValueChange={(on) => onChange({ autoUpdateTaskProgressPercentFromKanban: on })}
        style={styles.switchRow}
      />
      <Text style={[styles.hint, { color: themeColors.text }]}>
        {pmT('Off: the Kanban never changes the progress % of a task. On: a card moved into a stage with a percent (1..100) sets the progress % of the task to it; for a stage with 0% the percent is typed on the card and sets the progress % of the task too.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: 12 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 4 },
});
