// Gantt bar control: shape of the dependency arrows.
//   smoothForm = cubic Bézier curves (default)
//   squareForm = orthogonal (right-angle) lines, MS Project / DHTMLX style
// The choice is saved per project in project_table.rowJSON.ganttArrowsForm
// (crud.setGanttArrowsForm); the store mirrors it as linkLineForm.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMLinkLineForm } from '../../../model/types';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';

export const DEPENDENCY_LINE_FORMS: { form: PMLinkLineForm; icon: string; title: string }[] = [
  { form: 'smoothForm', icon: 'conversion_path', title: 'Dependency arrows: smooth curves' },
  { form: 'squareForm', icon: 'polyline', title: 'Dependency arrows: square (right-angle) lines' },
];

export default function DependencyArrowLineFormSelector({
  color,
  activeColor,
  border,
  onChange,
}: {
  color: string;
  activeColor: string;
  border: string;
  onChange: (form: PMLinkLineForm) => void;
}) {
  const form = usePMStore((s) => s.linkLineForm);
  return (
    <View style={[styles.group, { borderColor: border }]} testID="pm-gantt-line-form">
      {DEPENDENCY_LINE_FORMS.map((f) => (
        <PMIconButton
          key={f.form}
          testID={`pm-gantt-line-form-${f.form}`}
          icon={f.icon}
          title={f.title}
          active={form === f.form}
          activeColor={activeColor}
          color={color}
          onPress={() => form !== f.form && onChange(f.form)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingLeft: 2, marginHorizontal: 2 },
});
