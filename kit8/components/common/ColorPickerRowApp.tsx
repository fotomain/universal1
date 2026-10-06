// ColorPickerRowApp - reusable one-row color choice, drawn in the look of the active design system:
//
//   ( auto ) ● ● ● ● ● ● ●   [● Default]   [🎨 Custom…]
//
//   auto swatch   (showAuto)      -> onChange(null)   "no own color"
//   Default chip  (defaultColor)  -> onChange(null)   shows the color used when nothing is chosen
//   swatches                      -> onChange('#RRGGBB'); the selected one has a ring + check mark
//   Custom… chip  (allowCustom)   -> opens the full picker (colorpicker/ColorPickerAppModalContent, lazy);
//                                    shows the color itself when the value is not one of the swatches
//
// Looks: paper / googlemd3web = round swatches + pill chips (Material) · applemacui = round swatches + tinted
// capsule buttons · tamagui = round, 10 px chips · ant = 4 px squares and chips · expo = bigger round, bold pills ·
// native = 6 px rounded squares.
// Values are upper-case '#RRGGBB'. testIDs: `${testID}-auto` · `-default` · `-${color}` · `-custom`
// (swatchTestID overrides the swatch / auto ids).

import React, { useState } from 'react';
import { Modal, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from './IconApp';

export interface ColorPickerRowAppColors {
  text: string;
  border: string;
  background: string;
  primary?: string;
}

export interface ColorPickerRowAppProps {
  /** current color ('#RRGGBB'); null / undefined = auto / default */
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  swatches?: readonly string[];
  /** first swatch "auto" = no own color (null) */
  showAuto?: boolean;
  /** color used when value is null; when given a "Default" chip is shown */
  defaultColor?: string;
  /** "Custom…" chip with the full picker (default true) */
  allowCustom?: boolean;
  label?: string;
  /** title of the picker window */
  title?: string;
  autoLabel?: string;
  defaultLabel?: string;
  customLabel?: string;
  /** theme colors; default = the active design system colors */
  colors?: ColorPickerRowAppColors;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID: string;
  swatchTestID?: (color: string | null) => string;
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

/** black or white, whichever is readable on the color (check mark of the selected swatch) */
export function readableOn(hex: string): string {
  const c = normalizeHexColor(hex);
  if (!c) return '#000000';
  const n = parseInt(c.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#000000' : '#FFFFFF';
}

interface Look {
  swatch: number;
  swatchRadius: number;
  gap: number;
  chipHeight: number;
  chipRadius: number;
  chipPadH: number;
  chipFont: number;
  chipWeight: '500' | '600' | '700';
  /** chip: outlined (border) or filled (soft background) */
  chipFilled: boolean;
  chipBg: string;
  chipBgSelected: string;
  chipBorder: string;
  chipBorderSelected: string;
  chipText: string;
  chipTextSelected: string;
  ring: string;
  labelStyle: any;
}

export default function ColorPickerRowApp({
  value,
  onChange,
  swatches = [],
  showAuto = false,
  defaultColor,
  allowCustom = true,
  label,
  title = 'Select a color',
  autoLabel = 'auto',
  defaultLabel = 'Default',
  customLabel = 'Custom…',
  colors,
  disabled = false,
  style,
  testID,
  swatchTestID,
}: ColorPickerRowAppProps) {
  const ds = useDesignSystem();
  const { activeSystem, isDark } = ds;
  const c: ColorPickerRowAppColors = colors ?? { text: ds.themeColors.text, border: ds.themeColors.border, background: ds.themeColors.background, primary: ds.themeColors.primary };
  const primary = c.primary || ds.themeColors.primary;
  const [open, setOpen] = useState(false);
  const current = normalizeHexColor(value);
  const swatchSet = swatches.map((s) => normalizeHexColor(s) ?? s);
  const isNone = !current;
  const isCustom = !!current && !swatchSet.includes(current);
  const effective = current ?? defaultColor ?? '#000000';
  const apple = ds.appleMacUITheme;

  const base = { gap: 8, ring: c.text, chipText: c.text, chipTextSelected: c.text, chipBorder: c.border, chipBorderSelected: c.text, chipBg: c.background, chipBgSelected: c.background };
  const look: Look =
    activeSystem === 'applemacui' && apple
      ? { ...base, swatch: 30, swatchRadius: 15, chipHeight: 32, chipRadius: 16, chipPadH: 12, chipFont: 15, chipWeight: '500', chipFilled: true, chipBg: apple.colors.tertiaryFill, chipBgSelected: `${apple.tint}26`, chipBorder: 'transparent', chipBorderSelected: 'transparent', chipText: apple.colors.label, chipTextSelected: apple.tint, ring: apple.tint, labelStyle: { ...apple.typography.subhead, fontFamily: apple.fontFamily, color: apple.colors.secondaryLabel, marginBottom: 6 } }
      : activeSystem === 'paper' || activeSystem === 'googlemd3web'
      ? { ...base, swatch: 32, swatchRadius: 16, chipHeight: 32, chipRadius: 8, chipPadH: 12, chipFont: 13, chipWeight: '500', chipFilled: false, chipBgSelected: `${primary}22`, chipBorderSelected: primary, chipTextSelected: c.text, ring: primary, labelStyle: { fontSize: 12, fontWeight: '500', color: c.text, opacity: 0.8, marginBottom: 6 } }
      : activeSystem === 'tamagui'
      ? { ...base, swatch: 30, swatchRadius: 15, chipHeight: 32, chipRadius: 10, chipPadH: 12, chipFont: 13, chipWeight: '600', chipFilled: false, chipBg: isDark ? '#1f2937' : '#f9fafb', chipBgSelected: isDark ? '#1f2937' : '#f9fafb', chipBorderSelected: primary, ring: primary, labelStyle: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' } }
      : activeSystem === 'ant'
      ? { ...base, swatch: 26, swatchRadius: 4, gap: 6, chipHeight: 28, chipRadius: 4, chipPadH: 10, chipFont: 13, chipWeight: '500', chipFilled: false, chipBorder: '#d9d9d9', chipBorderSelected: primary, chipTextSelected: primary, ring: primary, labelStyle: { fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 4 } }
      : activeSystem === 'expo'
      ? { ...base, swatch: 34, swatchRadius: 17, gap: 10, chipHeight: 36, chipRadius: 18, chipPadH: 14, chipFont: 14, chipWeight: '700', chipFilled: true, chipBg: isDark ? '#1e293b' : '#f1f5f9', chipBgSelected: primary, chipBorder: 'transparent', chipBorderSelected: 'transparent', chipTextSelected: '#ffffff', ring: primary, labelStyle: { fontSize: 14, fontWeight: '700', color: primary, marginBottom: 4 } }
      : { ...base, swatch: 28, swatchRadius: 6, chipHeight: 30, chipRadius: 6, chipPadH: 10, chipFont: 13, chipWeight: '600', chipFilled: false, chipBorderSelected: primary, ring: primary, labelStyle: { fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 4 } };

  const idOf = (color: string | null) => (swatchTestID ? swatchTestID(color) : `${testID}-${color ?? 'auto'}`);
  const ringGap = 2;
  const outer = look.swatch + 2 * (ringGap + 2);

  /** one swatch: the color disc inside a selection ring (the ring's box is always there, so nothing jumps) */
  const swatch = (color: string | null, selected: boolean) => (
    <Pressable
      key={color ?? 'auto'}
      testID={idOf(color)}
      accessibilityRole="radio"
      accessibilityLabel={color ? `Color ${color}` : autoLabel}
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={() => onChange(color)}
      style={({ hovered, pressed }: any) => ({
        width: outer,
        height: outer,
        borderRadius: look.swatchRadius + ringGap + 2,
        borderWidth: 2,
        borderColor: selected ? look.ring : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: look.gap - 4,
        marginBottom: 4,
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: hovered && !selected ? 1.06 : 1 }],
      })}
    >
      <View
        style={{
          width: look.swatch,
          height: look.swatch,
          borderRadius: look.swatchRadius,
          backgroundColor: color || c.background,
          borderWidth: color ? 0 : 1,
          borderColor: c.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!color ? (
          <Text style={{ fontSize: 10, fontWeight: '600', color: c.text }} numberOfLines={1}>
            {autoLabel}
          </Text>
        ) : selected ? (
          <IconApp name="check" size={Math.round(look.swatch * 0.55)} color={readableOn(color)} />
        ) : null}
      </View>
    </Pressable>
  );

  const chip = (id: string, text: string, selected: boolean, dot: React.ReactNode, onPress: () => void, a11y: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        height: look.chipHeight,
        paddingHorizontal: look.chipPadH,
        borderRadius: look.chipRadius,
        borderWidth: look.chipFilled ? 0 : selected ? 2 : 1,
        borderColor: selected ? look.chipBorderSelected : look.chipBorder,
        backgroundColor: selected ? look.chipBgSelected : look.chipBg,
        marginRight: look.gap,
        marginBottom: 4,
        opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
      })}
    >
      {dot}
      <Text style={{ fontSize: look.chipFont, fontWeight: look.chipWeight, color: selected ? look.chipTextSelected : look.chipText }} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
  const dotStyle = { width: 14, height: 14, borderRadius: 7, borderWidth: 0.5, borderColor: c.border, marginRight: 6, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const };

  return (
    <View style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      {!!label && <Text style={look.labelStyle}>{label}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }} testID={testID} accessibilityRole="radiogroup">
        {!!defaultColor && chip(`${testID}-default`, defaultLabel, isNone, <View style={[dotStyle, { backgroundColor: defaultColor }]} />, () => onChange(null), 'Default color')}
        {showAuto && swatch(null, isNone)}
        {swatchSet.map((s) => swatch(s, current === s))}
        {allowCustom &&
          chip(
            `${testID}-custom`,
            isCustom ? current! : customLabel,
            isCustom,
            <View style={[dotStyle, { backgroundColor: isCustom ? current! : 'transparent' }]}>{!isCustom && <Text style={{ fontSize: 9, lineHeight: 12 }}>🎨</Text>}</View>,
            () => setOpen(true),
            'Custom color'
          )}
      </View>
      {allowCustom && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          {open && (
            <PickerHost
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
      )}
    </View>
  );
}

function PickerHost(props: { testID: string; title: string; initial: string; swatches: string[]; colors: ColorPickerRowAppColors; onCancel: () => void; onSelect: (hex: string) => void }) {
  // lazy: reanimated-color-picker (reanimated + gesture handler) loads only when the picker opens
  const Content = require('./colorpicker/ColorPickerAppModalContent').default as React.ComponentType<typeof props>;
  return <Content {...props} />;
}
