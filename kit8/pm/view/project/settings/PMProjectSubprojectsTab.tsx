// PMProjectSubprojectsTab - "Subprojects" tab of the Project settings window (TabSubprojects, after TabVendor): documentation/SUBPROJECTS_BRD_TRD.html, kit8/pm/subproject/README.md.
//   project_table.rowJSON:
//     subprojectsFunctionalityEnabled                      false by default: tasks of this project may stand for another project (the master switch)
//     autoChangeOriginTaskBasedOnSubprojects               true by default; shown only while the master switch is on: the origin task follows its subproject
//       autoChangeStartAndFinishDatesForOriginTask         true by default; shown only while the line above is on: the origin task takes the start and the finish of the subproject
//       aggregateTimeFromSubprojectToTheOriginTask         false by default: Monitor01 shows the Time plan / fact of the subproject on the origin task too
//       aggregateMaterialFromSubprojectToTheOriginTask     false by default: ... Material
//       aggregateExpenceFromSubprojectToTheOriginTask      false by default: ... Expenses
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';
import { PMSubprojectValues, subprojectValuesOf } from '../../../subproject/subprojectModel';

export type { PMSubprojectValues } from '../../../subproject/subprojectModel';
export { subprojectValuesOf } from '../../../subproject/subprojectModel';

export default function PMProjectSubprojectsTab({ values, onChange }: { values: PMSubprojectValues; onChange: (patch: PMSubprojectValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = subprojectValuesOf(values);
  return (
    <View testID="pm-project-tab-subprojects-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Subprojects')}</Text>
      <SwitchApp
        testID="pm-project-subprojects-enabled"
        label={pmT('Subprojects functionality (subprojectsFunctionalityEnabled)')}
        value={v.subprojectsFunctionalityEnabled}
        onValueChange={(on) => onChange({ subprojectsFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: a task of this project can stand for another project (a subproject). The subproject is a normal project. Off: tasks are as always.')}</Text>
      {v.subprojectsFunctionalityEnabled && (
        <View testID="pm-project-subprojects-more">
          <SwitchApp
            testID="pm-project-subprojects-auto-change"
            label={pmT('Origin task follows its subproject (autoChangeOriginTaskBasedOnSubprojects)')}
            value={v.autoChangeOriginTaskBasedOnSubprojects}
            onValueChange={(on) => onChange({ autoChangeOriginTaskBasedOnSubprojects: on })}
            style={styles.switchRow}
          />
          <Text style={styles.hint}>{pmT('On: the switches below work. Off: the origin task is an ordinary task.')}</Text>
          {v.autoChangeOriginTaskBasedOnSubprojects && (
            <View testID="pm-project-subprojects-children" style={styles.children}>
              <SwitchApp
                testID="pm-project-subprojects-dates"
                label={pmT('Start and finish dates (autoChangeStartAndFinishDatesForOriginTask)')}
                value={v.autoChangeStartAndFinishDatesForOriginTask}
                onValueChange={(on) => onChange({ autoChangeStartAndFinishDatesForOriginTask: on })}
                style={styles.switchRow}
              />
              <Text style={styles.hint}>{pmT('On: when the start or the end of the subproject changes, the origin task changes its start and end.')}</Text>
              <SwitchApp
                testID="pm-project-subprojects-aggregate-time"
                label={pmT('Aggregate Time (aggregateTimeFromSubprojectToTheOriginTask)')}
                value={v.aggregateTimeFromSubprojectToTheOriginTask}
                onValueChange={(on) => onChange({ aggregateTimeFromSubprojectToTheOriginTask: on })}
                style={styles.switchRow}
              />
              <SwitchApp
                testID="pm-project-subprojects-aggregate-material"
                label={pmT('Aggregate Material (aggregateMaterialFromSubprojectToTheOriginTask)')}
                value={v.aggregateMaterialFromSubprojectToTheOriginTask}
                onValueChange={(on) => onChange({ aggregateMaterialFromSubprojectToTheOriginTask: on })}
                style={styles.switchRow}
              />
              <SwitchApp
                testID="pm-project-subprojects-aggregate-expense"
                label={pmT('Aggregate Expenses (aggregateExpenceFromSubprojectToTheOriginTask)')}
                value={v.aggregateExpenceFromSubprojectToTheOriginTask}
                onValueChange={(on) => onChange({ aggregateExpenceFromSubprojectToTheOriginTask: on })}
                style={styles.switchRow}
              />
              <Text style={styles.hint}>{pmT('On: Monitor01 shows the plan and the fact of the subproject (this kind of lines) on the origin task, together with its own numbers.')}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  children: { marginLeft: 16 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
