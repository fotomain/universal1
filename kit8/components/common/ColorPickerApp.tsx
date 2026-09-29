// ColorPickerApp: app-wide color selector built on reanimated-color-picker.
//
//   [● Default] [quick swatches ...] [🎨 Custom #RRGGBB]
//
// - "Default" chip (only when `defaultColor` is given) -> onChange(null)
// - quick swatches (optional)                         -> onChange(swatch)
// - "Custom" chip opens a modal with the full picker (saturation/brightness panel, hue slider,
//   preview old -> new, swatches, HEX input). "Select" -> onChange('#RRGGBB'), "Cancel" / backdrop discard.
//
// Values are always upper-case '#RRGGBB' (no alpha). The picker itself is loaded lazily
// (colorpicker/ColorPickerAppModalContent) - only when the modal opens.

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';

export interface ColorPickerAppColors {
  text: string;
  border: string;
  background: string;
  primary?: string;
}

export interface ColorPickerAppProps {
  /** current color ('#RRGGBB'); null / undefined = default */
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  /** color used when value is null; when given a "Default" chip is shown */
  defaultColor?: string;
  /** quick swatches shown in the row and inside the picker */
  swatches?: string[];
  /** title of the picker window */
  title?: string;
  /** theme colors; default = the active design system colors */
  colors?: ColorPickerAppColors;
  testID: string;
}

/** '#abc' / '#aabbcc' / '#aabbccff' -> '#AABBCC'; anything else -> null */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let v = value.trim().toUpperCase();
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9A-F]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9A-F]{8}$/.test(v)) v = v.slice(0, 7);
  return /^#[0-9A-F]{6}$/.test(v) ? v : null;
}

export default function ColorPickerApp({ value, onChange, defaultColor, swatches = [], title = 'Select a color', colors, testID }: ColorPickerAppProps) {
  const ds = useDesignSystem();
  const c: ColorPickerAppColors = colors ?? {
    text: ds.themeColors.text,
    border: ds.themeColors.border,
    background: ds.themeColors.background,
    primary: ds.themeColors.primary,
  };
  const [open, setOpen] = useState(false);
  const current = normalizeHexColor(value);
  const isDefault = !current && !!defaultColor;
  const swatchSet = swatches.map((s) => normalizeHexColor(s) ?? s);
  const isCustom = !!current && !swatchSet.includes(current);
  const effective = current ?? defaultColor ?? '#000000';

  return (
    <View style={styles.row} testID={testID}>
      {!!defaultColor && (
        <Pressable
          testID={`${testID}-default`}
          accessibilityLabel="Default color"
          onPress={() => onChange(null)}
          style={[styles.chip, { borderColor: isDefault ? c.text : c.border, borderWidth: isDefault ? 2 : 1, backgroundColor: c.background }]}
        >
          <View style={[styles.dot, { backgroundColor: defaultColor, borderColor: c.border }]} />
          <Text style={[styles.chipText, { color: c.text }]}>Default</Text>
        </Pressable>
      )}
      {swatchSet.map((s) => {
        const selected = current === s;
        return (
          <Pressable
            key={s}
            testID={`${testID}-${s}`}
            accessibilityLabel={`Color ${s}`}
            onPress={() => onChange(s)}
            style={[styles.swatch, { backgroundColor: s, borderColor: selected ? c.text : c.border, borderWidth: selected ? 3 : 1 }]}
          />
        );
      })}
      <Pressable
        testID={`${testID}-custom`}
        accessibilityLabel="Custom color"
        onPress={() => setOpen(true)}
        style={[styles.chip, { borderColor: isCustom ? c.text : c.border, borderWidth: isCustom ? 2 : 1, backgroundColor: c.background }]}
      >
        <View style={[styles.dot, styles.rainbow, { backgroundColor: isCustom ? current! : 'transparent', borderColor: c.border }]}>
          {!isCustom && <Text style={styles.rainbowText}>🎨</Text>}
        </View>
        <Text style={[styles.chipText, { color: c.text }]}>{isCustom ? current : 'Custom…'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open && (
          <ColorPickerAppModalHost
            testID={testID}
            title={title}
            initial={effective}
            swatches={swatchSet}
            colors={c}
            onCancel={() => setOpen(false)}
            onSelect={(hex) => {
              setOpen(false);
              onChange(hex);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function ColorPickerAppModalHost(props: {
  testID: string;
  title: string;
  initial: string;
  swatches: string[];
  colors: ColorPickerAppColors;
  onCancel: () => void;
  onSelect: (hex: string) => void;
}) {
  // lazy: reanimated-color-picker (reanimated + gesture handler) loads only when the picker opens
  const Content = require('./colorpicker/ColorPickerAppModalContent').default as React.ComponentType<typeof props>;
  return <Content {...props} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', height: 28, paddingHorizontal: 8, borderRadius: 14, marginRight: 8, marginBottom: 6 },
  chipText: { fontSize: 11, fontWeight: '600' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, marginRight: 5 },
  rainbow: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rainbowText: { fontSize: 9, lineHeight: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, marginRight: 8, marginBottom: 6 },
});
