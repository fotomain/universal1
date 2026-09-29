// Segmented choice of a progress line position: On top · In the middle (under the text) · On bottom.
// Used for uxuiSettings.taskProgressLinePosition / projectProgressLinePosition.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PMProgressLinePosition, PM_PROGRESS_LINE_POSITIONS, PM_PROGRESS_LINE_POSITION_LABEL } from './progressLineConstants';

const LABEL = PM_PROGRESS_LINE_POSITION_LABEL;

export default function PMProgressLinePositionSelector({
  value,
  onChange,
  colors,
  testID,
}: {
  value: PMProgressLinePosition;
  onChange: (v: PMProgressLinePosition) => void;
  colors: { primary: string; text: string; border: string };
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      {PM_PROGRESS_LINE_POSITIONS.map((p, i) => {
        const active = p === value;
        return (
          <Pressable
            key={p}
            testID={`${testID}-${p}`}
            onPress={() => onChange(p)}
            style={[
              styles.btn,
              { borderColor: colors.border, backgroundColor: active ? colors.primary : 'transparent' },
              i === 0 && styles.first,
              i === PM_PROGRESS_LINE_POSITIONS.length - 1 && styles.last,
              i > 0 && { borderLeftWidth: 0 },
            ]}
          >
            <Text numberOfLines={1} style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
              {LABEL[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderWidth: 1 },
  first: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  last: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
});
