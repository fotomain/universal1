// The window of ColorPickerApp: reanimated-color-picker (Panel1 + HueSlider + Preview + Swatches + HEX input).
// Loaded lazily by ColorPickerApp when the picker opens.

import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ColorPicker, { ColorFormatsObject, HueSlider, InputWidget, Panel1, Preview, Swatches } from 'reanimated-color-picker';
import type { ColorPickerAppColors } from '../ColorPickerApp';
import { normalizeHexColor } from '../ColorPickerApp';

export default function ColorPickerAppModalContent({
  testID,
  title,
  initial,
  swatches,
  colors: c,
  onCancel,
  onSelect,
}: {
  testID: string;
  title: string;
  initial: string;
  swatches: string[];
  colors: ColorPickerAppColors;
  onCancel: () => void;
  onSelect: (hex: string) => void;
}) {
  const picked = useRef(initial);
  const [hex, setHex] = useState(initial);
  const onColor = (col: ColorFormatsObject) => {
    const v = normalizeHexColor(col.hex);
    if (v) {
      picked.current = v;
      setHex(v);
    }
  };
  const primary = c.primary ?? c.text;

  return (
    <GestureHandlerRootView style={styles.root}>
      <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
      <View testID={`${testID}-window`} style={[styles.card, { backgroundColor: c.background, borderColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <ColorPicker style={styles.picker} value={initial} onCompleteJS={onColor} onChangeJS={onColor} sliderThickness={22} thumbSize={24} boundedThumb>
          <Preview style={styles.preview} hideInitialColor={false} />
          <Panel1 style={styles.panel} />
          <HueSlider style={styles.slider} />
          {swatches.length > 0 && <Swatches colors={swatches} style={styles.swatches} swatchStyle={styles.swatch} />}
          <InputWidget formats={['HEX']} disableAlphaChannel inputStyle={{ color: c.text, borderColor: c.border }} iconColor={c.text} />
        </ColorPicker>
        <View style={styles.buttons}>
          <Pressable testID={`${testID}-cancel`} onPress={onCancel} style={[styles.btn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable testID={`${testID}-select`} onPress={() => onSelect(picked.current)} style={[styles.btn, { backgroundColor: primary, borderColor: primary }]}>
            <View style={[styles.selDot, { backgroundColor: hex }]} />
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Select</Text>
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { width: 320, maxWidth: '92%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  picker: { gap: 14 },
  preview: { height: 36, borderRadius: 8 },
  panel: { height: 180, borderRadius: 12 },
  slider: { borderRadius: 11 },
  swatches: { justifyContent: 'flex-start', gap: 6 },
  swatch: { width: 24, height: 24, borderRadius: 12, marginHorizontal: 0, marginBottom: 0 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1 },
  selDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#ffffff', marginRight: 6 },
});
