// Row of color swatches + a "Default" chip (null = default color).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PM_PROGRESS_LINE_SWATCHES } from './progressLineConstants';

export { PM_PROGRESS_LINE_SWATCHES };

export default function PMColorSwatchPicker({
  value,
  onChange,
  swatches = PM_PROGRESS_LINE_SWATCHES,
  defaultColor,
  colors,
  testID,
}: {
  /** current color; null / undefined = default */
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  swatches?: string[];
  /** shown inside the "Default" chip */
  defaultColor: string;
  colors: { text: string; border: string; background: string };
  testID: string;
}) {
  const isDefault = !value;
  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        testID={`${testID}-default`}
        accessibilityLabel="Default color"
        onPress={() => onChange(null)}
        style={[styles.defaultChip, { borderColor: isDefault ? colors.text : colors.border, borderWidth: isDefault ? 2 : 1, backgroundColor: colors.background }]}
      >
        <View style={[styles.dot, { backgroundColor: defaultColor, borderColor: colors.border }]} />
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>Default</Text>
      </Pressable>
      {swatches.map((c) => {
        const selected = !isDefault && value === c;
        return (
          <Pressable
            key={c}
            testID={`${testID}-${c}`}
            accessibilityLabel={`Color ${c}`}
            onPress={() => onChange(c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: selected ? colors.text : colors.border, borderWidth: selected ? 3 : 1 }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  defaultChip: { flexDirection: 'row', alignItems: 'center', height: 28, paddingHorizontal: 8, borderRadius: 14, marginRight: 8, marginBottom: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, marginRight: 5 },
  swatch: { width: 28, height: 28, borderRadius: 14, marginRight: 8, marginBottom: 6 },
});
