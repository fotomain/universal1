// SegmentButtonsApp - one choice out of a few (Stage | Task | Milestone), in the active design system.
//
//   paper         react-native-paper SegmentedButtons
//                 (https://oss.callstack.com/react-native-paper/docs/components/SegmentedButtons/SegmentedButtons)
//   applemacui       AppleSegmentedControl (iOS segmented control with the sliding selection)
//   tamagui / ant / expo / googlemd3web / native: the same control drawn with the look of that system
//
//   <SegmentButtonsApp value={kind} onValueChange={setKind}
//     buttons={[{ value: 'stage', label: 'Stage' }, { value: 'task', label: 'Task', icon: 'check' }]} />
//
// testIDs: `testID` = the group, button.testID (or `${testID}-${value}`) = each segment.

import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { SegmentedButtons as PaperSegmentedButtons } from 'react-native-paper';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from './IconApp';
import { AppleSegmentedControl } from '../../applemacui/components/AppleSegmentedControl';

export interface SegmentButtonApp<T extends string = string> {
  value: T;
  label: string;
  /** IconApp name, shown before the label */
  icon?: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export interface SegmentButtonsAppProps<T extends string = string> {
  value: T | null | undefined;
  onValueChange: (value: T) => void;
  buttons: SegmentButtonApp<T>[];
  label?: string;
  disabled?: boolean;
  /** lower buttons for dense dialogs */
  compact?: boolean;
  /** check mark on the selected segment (Material look; default: paper and googlemd3web only) */
  showSelectedCheck?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SegmentButtonsApp<T extends string = string>({
  value,
  onValueChange,
  buttons,
  label,
  disabled = false,
  compact = false,
  showSelectedCheck,
  style,
  testID = 'segment-buttons-app',
}: SegmentButtonsAppProps<T>) {
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const idOf = (b: SegmentButtonApp<T>) => b.testID || `${testID}-${b.value}`;
  const labelNode = label ? <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text, marginBottom: 6 }}>{label}</Text> : null;

  if (activeSystem === 'paper') {
    return (
      <View style={style} testID={testID}>
        {labelNode}
        <PaperSegmentedButtons
          value={(value ?? '') as string}
          onValueChange={(v: string) => onValueChange(v as T)}
          density={compact ? 'small' : 'regular'}
          buttons={buttons.map((b) => ({
            value: b.value,
            label: b.label,
            icon: b.icon ? ({ size, color }: { size: number; color: string }) => <IconApp name={b.icon} size={size} color={color} /> : undefined,
            disabled: disabled || b.disabled,
            showSelectedCheck: showSelectedCheck ?? true,
            testID: idOf(b),
            accessibilityLabel: b.accessibilityLabel || b.label,
          }))}
        />
      </View>
    );
  }

  if (activeSystem === 'applemacui') {
    return (
      <View style={style}>
        {labelNode}
        <AppleSegmentedControl
          testID={testID}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          segments={buttons.map((b) => ({ value: b.value, label: b.label, icon: b.icon, disabled: b.disabled, testID: idOf(b) }))}
        />
      </View>
    );
  }

  const primary = themeColors.primary;
  // the look of each design system: track (group box) + selected / idle segment
  const look =
    activeSystem === 'tamagui'
      ? { radius: 10, height: 40, pad: 3, gap: 0, track: isDark ? '#1f2937' : '#f3f4f6', trackBorder: isDark ? '#374151' : '#e5e7eb', divider: false, selBg: primary, selText: '#ffffff', text: themeColors.text, weight: '700' as const, font: 14, inner: 8, pill: true }
      : activeSystem === 'ant'
      ? { radius: 6, height: 34, pad: 0, gap: 0, track: 'transparent', trackBorder: '#d9d9d9', divider: true, selBg: `${primary}14`, selText: primary, text: themeColors.text, weight: '500' as const, font: 14, inner: 0, pill: false }
      : activeSystem === 'expo'
      ? { radius: 22, height: 44, pad: 4, gap: 0, track: isDark ? '#1e293b' : '#f1f5f9', trackBorder: 'transparent', divider: false, selBg: primary, selText: '#ffffff', text: themeColors.text, weight: '800' as const, font: 15, inner: 18, pill: true }
      : activeSystem === 'googlemd3web'
      ? { radius: 20, height: 40, pad: 0, gap: 0, track: 'transparent', trackBorder: isDark ? '#938f99' : '#79747e', divider: true, selBg: `${primary}29`, selText: themeColors.text, text: themeColors.text, weight: '500' as const, font: 14, inner: 0, pill: false }
      : { radius: 6, height: 40, pad: 0, gap: 0, track: 'transparent', trackBorder: themeColors.border, divider: true, selBg: primary, selText: '#ffffff', text: themeColors.text, weight: '600' as const, font: 14, inner: 0, pill: false };
  const check = showSelectedCheck ?? activeSystem === 'googlemd3web';
  const height = compact ? Math.min(34, look.height) : look.height;

  return (
    <View style={style}>
      {labelNode}
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        style={{
          flexDirection: 'row',
          height,
          padding: look.pad,
          borderRadius: look.radius,
          borderWidth: look.trackBorder === 'transparent' ? 0 : 1,
          borderColor: look.trackBorder,
          backgroundColor: look.track,
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {buttons.map((b, i) => {
          const selected = b.value === value;
          const off = disabled || !!b.disabled;
          const color = selected ? look.selText : look.text;
          return (
            <Pressable
              key={b.value}
              testID={idOf(b)}
              accessibilityRole="radio"
              accessibilityLabel={b.accessibilityLabel || b.label}
              accessibilityState={{ selected, checked: selected, disabled: off }}
              // react-native-web 0.21 ignores accessibilityState -> aria-* too
              aria-checked={selected}
              aria-selected={selected}
              disabled={off}
              onPress={() => {
                if (!selected) onValueChange(b.value);
              }}
              style={({ hovered, pressed }: any) => ({
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
                borderRadius: look.pill ? look.inner : 0,
                borderLeftWidth: look.divider && i > 0 ? 1 : 0,
                borderLeftColor: look.trackBorder,
                backgroundColor: selected ? look.selBg : hovered || pressed ? `${primary}12` : 'transparent',
                opacity: b.disabled && !disabled ? 0.4 : 1,
              })}
            >
              {check && selected ? (
                <IconApp name="check" size={16} color={color} style={{ marginRight: 6 }} />
              ) : b.icon ? (
                <IconApp name={b.icon} size={16} color={color} style={{ marginRight: 6 }} />
              ) : null}
              <Text numberOfLines={1} style={{ color, fontSize: look.font, fontWeight: selected ? look.weight : '500', flexShrink: 1 }}>
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default SegmentButtonsApp;
