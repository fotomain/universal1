// Settings block of ONE progress line (task or project): position + color + preview.
// Used twice by PMGanttUXUISettinsModalWindow.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PMProgressLinePosition, PM_DEFAULT_PROGRESS_LINE_COLOR } from './progressLineConstants';
import PMProgressLinePositionSelector from './PMProgressLinePositionSelector';
import PMColorSwatchPicker from './PMColorSwatchPicker';

export function PMProgressLinePreview({ color, bar, border }: { color: string; bar: string; border: string }) {
  return (
    <View style={[styles.preview, { borderColor: border }]}>
      <View style={[styles.previewBar, { backgroundColor: bar }]} />
      <View style={[styles.previewLine, { backgroundColor: color }]} />
    </View>
  );
}

export default function PMProgressLineSettings({
  title,
  positionLabel,
  position,
  onPosition,
  color,
  onColor,
  previewBarColor,
  colors,
  testID,
}: {
  title: string;
  positionLabel: string;
  position: PMProgressLinePosition;
  onPosition: (p: PMProgressLinePosition) => void;
  /** effective color (default = PM_DEFAULT_PROGRESS_LINE_COLOR) */
  color: string;
  onColor: (c: string) => void;
  previewBarColor: string;
  colors: { text: string; border: string; background: string; primary: string };
  /** e.g. "pm-uxui-task-line" -> -pos / -color testIDs */
  testID: string;
}) {
  return (
    <View testID={testID}>
      <Text style={[styles.section, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.label, { color: colors.text }]}>{positionLabel}</Text>
      <PMProgressLinePositionSelector testID={`${testID}-pos`} value={position} onChange={onPosition} colors={colors} />
      <Text style={[styles.label, { color: colors.text }]}>Color</Text>
      <PMColorSwatchPicker
        testID={`${testID}-color`}
        value={color === PM_DEFAULT_PROGRESS_LINE_COLOR ? null : color}
        onChange={(v) => onColor(v || PM_DEFAULT_PROGRESS_LINE_COLOR)}
        defaultColor={PM_DEFAULT_PROGRESS_LINE_COLOR}
        colors={colors}
      />
      <PMProgressLinePreview color={color} bar={previewBarColor} border={colors.border} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 16 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 10, marginBottom: 4 },
  preview: { height: 26, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, marginTop: 4, justifyContent: 'center', paddingHorizontal: 10 },
  previewBar: { height: 12, borderRadius: 4, width: '100%' },
  previewLine: { position: 'absolute', left: 10, top: 5, height: 4, borderRadius: 2, width: '55%' },
});
