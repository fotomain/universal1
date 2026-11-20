import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PM80HomeSettings,
  PM80ItemShape,
  PM80ItemsPerRow,
  PM80_ITEMS_PER_ROW_OPTIONS,
  PM80_ITEM_SHAPE_OPTIONS,
} from './homeSettingsModel';

// PM80HomeSettingsPanel - the look of the home: two radio sets (items in the first row, form of the items), shown on the
//   Business order screen (the tune button of the home is gone: one place for both setups).
//   Own small radios (no design system needed); a change applies and is saved at once, on this device.

export interface PM80HomeSettingsPanelProps {
  settings: PM80HomeSettings;
  onChange: (next: Partial<PM80HomeSettings>) => void;
  textStrong: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  testID?: string;
}

const SHAPE_LABEL: Record<PM80ItemShape, string> = { circle: 'Circle', square: 'Square' };

export default function PM80HomeSettingsPanel({
  settings, onChange, textStrong, textMuted, accent, borderColor, testID = 'pm80-home-settings',
}: PM80HomeSettingsPanelProps) {
  const radio = <T extends string | number>(group: string, value: T, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={String(value)}
      testID={`${testID}-${group}-${value}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.option, { borderColor: selected ? accent : borderColor, backgroundColor: selected ? `${accent}22` : 'transparent' }]}
    >
      <View style={[styles.dot, { borderColor: selected ? accent : textMuted }]}>{selected ? <View style={[styles.dotFill, { backgroundColor: accent }]} /> : null}</View>
      <Text style={[styles.optionText, { color: textStrong, fontWeight: selected ? '800' : '500' }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={[styles.panel, { borderColor }]}>
      <Text style={[styles.heading, { color: textStrong }]}>Home settings</Text>

      <Text style={[styles.caption, { color: accent }]}>Items in the first row</Text>
      <View style={styles.optionsRow} accessibilityRole="radiogroup">
        {PM80_ITEMS_PER_ROW_OPTIONS.map((n) =>
          radio<PM80ItemsPerRow>('perRow', n, String(n), settings.itemsPerRow === n, () => onChange({ itemsPerRow: n }))
        )}
      </View>

      <Text style={[styles.caption, { color: accent }]}>Items form</Text>
      <View style={styles.optionsRow} accessibilityRole="radiogroup">
        {PM80_ITEM_SHAPE_OPTIONS.map((s) =>
          radio<PM80ItemShape>('shape', s, SHAPE_LABEL[s], settings.itemShape === s, () => onChange({ itemShape: s }))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 12 },
  heading: { fontSize: 14, fontWeight: '800' },
  caption: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14, minWidth: 72 },
  optionText: { fontSize: 14 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 8, height: 8, borderRadius: 4 },
});
