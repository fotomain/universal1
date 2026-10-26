// PMProjectGanttTab - the "Gantt" tab of the Project settings window: the MASTER switch of the Gantt Extended functions (kit8/pm/extended).
//   project_table.rowJSON.ganttExtendedFunctionalityEnabled   OFF while never saved
// ON: the Gantt bar gets the button "Extended" where every function (A1 manual tasks ... H1 print options) has its own xxxxEnabled switch, all OFF until chosen.
// OFF (the default): the Gantt chart, the tree, the scheduler and the exports work as they always did; the switches of the functions are kept but ignored.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';
import { extendedCountOf, PM_EXTENDED_FEATURES, PM_EXTENDED_GROUPS } from '../../../extended/extendedModel';

export interface PMProjectGanttValues {
  ganttExtendedFunctionalityEnabled?: boolean;
}

/** the master switch + every function switch (one xxxxEnabled key each, extendedModel.ts); a missing value = OFF */
export const ganttValuesOf = (j: Record<string, any> | undefined | null): Required<PMProjectGanttValues> => ({
  ganttExtendedFunctionalityEnabled: j?.ganttExtendedFunctionalityEnabled === true,
  ...Object.fromEntries(PM_EXTENDED_FEATURES.map((f) => [f.key, j?.[f.key] === true])),
}) as Required<PMProjectGanttValues>;

export default function PMProjectGanttTab({ values, onChange }: { values: Record<string, any>; onChange: (patch: Record<string, boolean>) => void }) {
  const { themeColors } = useDesignSystem();
  const v = ganttValuesOf(values) as Record<string, boolean>;
  const count = extendedCountOf(values);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const isOn = (key: string) => v[key] === true;
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
        {pmT('On: the functions below have their own switches (xxxxEnabled), all off until you choose them, and the Gantt bar has the button "Extended" for their options. Off: the Gantt chart works as it always did.')}
      </Text>
      {v.ganttExtendedFunctionalityEnabled && <Text style={styles.hint}>{pmT('Functions switched on: {{n}}', { n: count })}</Text>}
      {v.ganttExtendedFunctionalityEnabled &&
        PM_EXTENDED_GROUPS.map((g) => (
          <View key={g.id} testID={`pm-project-gantt-group-${g.id}`}>
            <Text style={[styles.section, { color: themeColors.text }]}>{pmT(g.title)}</Text>
            {PM_EXTENDED_FEATURES.filter((f) => f.group === g.id).map((f) => {
              const needsOk = !f.requires || f.requires.every(isOn);
              return (
                <View key={f.key} style={styles.feature}>
                  <SwitchApp
                    testID={`pm-project-gantt-${f.key}`}
                    label={`${f.id} · ${pmT(f.title)} (${f.key})`}
                    value={isOn(f.key) && needsOk}
                    disabled={!needsOk}
                    onValueChange={(on) => onChange({ [f.key]: on })}
                    style={styles.switchRow}
                  />
                  <Text style={[styles.hint, { color: themeColors.text }]}>{pmT(f.short)}</Text>
                  <Pressable testID={`pm-project-gantt-more-${f.id}`} onPress={() => setMore((m) => ({ ...m, [f.key]: !m[f.key] }))}>
                    <Text style={{ color: themeColors.primary, fontSize: 12 }}>{more[f.key] ? pmT('less') : pmT('more…')}</Text>
                  </Pressable>
                  {more[f.key] && <Text style={[styles.hint, { color: themeColors.text }]}>{pmT(f.more)}</Text>}
                </View>
              );
            })}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 4 },
  feature: { marginBottom: 8 },
});
