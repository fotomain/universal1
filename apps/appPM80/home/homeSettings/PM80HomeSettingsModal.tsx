import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  PM80HomeSettings,
  PM80ItemShape,
  PM80ItemsPerRow,
  PM80_ITEMS_PER_ROW_OPTIONS,
  PM80_ITEM_SHAPE_OPTIONS,
} from './homeSettingsModel';

// PM80HomeSettingsModal - the look of the home: two radio sets (items in the first row, form of the items).
//   Own small radios (no design system needed, same look in Paper and Tamagui); a change applies and is saved at once.

export interface PM80HomeSettingsModalProps {
  visible: boolean;
  settings: PM80HomeSettings;
  onChange: (next: Partial<PM80HomeSettings>) => void;
  onClose: () => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  testID?: string;
}

const SHAPE_LABEL: Record<PM80ItemShape, string> = { circle: 'Circle', square: 'Square' };

export default function PM80HomeSettingsModal({
  visible, settings, onChange, onClose, isDark, textStrong, textMuted, accent, borderColor, testID = 'pm80-home-settings',
}: PM80HomeSettingsModalProps) {
  const sheetBg = isDark ? '#1D1B20' : '#FFFFFF';

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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`}>
        {visible && (
          <Pressable testID={testID} onPress={() => undefined} style={[styles.sheet, { backgroundColor: sheetBg, borderColor }]}>
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

            <View style={styles.footer}>
              <TouchableOpacity testID={`${testID}-close`} onPress={onClose} style={[styles.closeBtn, { backgroundColor: accent }]}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  caption: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, minWidth: 72 },
  optionText: { fontSize: 14 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 8, height: 8, borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  closeBtn: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 18 },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
