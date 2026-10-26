// PMProjectGanttTab - the "Gantt" tab of the Project settings window: the MASTER switch of the Gantt Extended functions (kit8/pm/extended).
//   project_table.rowJSON.ganttExtendedFunctionalityEnabled   OFF while never saved
// ON: the Gantt bar gets the button "Extended" where every function (A1 manual tasks ... H1 print options) has its own xxxxEnabled switch, all OFF until chosen.
// OFF (the default): the Gantt chart, the tree, the scheduler and the exports work as they always did; the switches of the functions are kept but ignored.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';
import { extendedCountOf } from '../../../extended/extendedModel';

export interface PMProjectGanttValues {
  ganttExtendedFunctionalityEnabled?: boolean;
}

/** a missing value = OFF */
export const ganttValuesOf = (j: PMProjectGanttValues | undefined | null): Required<PMProjectGanttValues> => ({
  ganttExtendedFunctionalityEnabled: j?.ganttExtendedFunctionalityEnabled === true,
});

export default function PMProjectGanttTab({ values, onChange }: { values: PMProjectGanttValues & Record<string, unknown>; onChange: (patch: PMProjectGanttValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = ganttValuesOf(values);
  const count = extendedCountOf(values);
  return (
    <View testID="pm-project-tab-gantt-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Gantt')}</Text>
      <SwitchApp
        testID="pm-project-gantt-extended"
        label={pmT('Extended Gantt functions (ganttExtendedFunctionalityEnabled)')}
        value={v.ganttExtendedFunctionalityEnabled}
        onValueChange={(on) => onChange({ ganttExtendedFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>
        {pmT('On: the Gantt bar has the button "Extended". There every function - manual tasks, constraints, baselines, bar styles, copy and paste and more - has its own switch (xxxxEnabled), all off until you choose them. Off: the Gantt chart works as it always did.')}
      </Text>
      {v.ganttExtendedFunctionalityEnabled && <Text style={styles.hint}>{pmT('Functions switched on: {{n}}', { n: count })}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
