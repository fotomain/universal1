// AppleSegmentedControl - iOS segmented control: gray track, the selected segment is an elevated white (dark: gray)
// pill that slides to the chosen segment (Reanimated, UI thread).
import React, { memo, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import IconApp from '../../components/common/IconApp';
import { useAppleMacUI } from '../WithAppleMacUI';
import { appleHapticSelection } from '../lib/haptics';

export interface AppleSegment<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
  testID?: string;
}

export interface AppleSegmentedControlProps<T extends string = string> {
  value: T | null | undefined;
  onValueChange: (value: T) => void;
  segments: AppleSegment<T>[];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function AppleSegmentedControlInner<T extends string = string>({ value, onValueChange, segments, disabled = false, style, testID = 'apple-segmented' }: AppleSegmentedControlProps<T>) {
  const { theme, text, reduceMotion } = useAppleMacUI();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((x) => x.value === value));
  const has = segments.some((x) => x.value === value);
  const pad = 2;
  const segW = segments.length ? Math.max(0, (width - 2 * pad) / segments.length) : 0;
  const x = useSharedValue(index * segW);
  useEffect(() => {
    x.value = reduceMotion ? withTiming(index * segW, { duration: 0 }) : withSpring(index * segW, theme.motion.spring);
  }, [index, segW, reduceMotion, x, theme.motion.spring]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const s = useMemo(() => {
    const c = theme.colors;
    return StyleSheet.create({
      track: { flexDirection: 'row', height: theme.size.segmented, padding: pad, borderRadius: theme.radii.input - 1, backgroundColor: c.tertiaryFill, opacity: disabled ? 0.5 : 1 },
      thumb: { position: 'absolute', top: pad, bottom: pad, left: pad, borderRadius: theme.radii.input - 3, backgroundColor: c.elevatedControl, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
      segment: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space[2] },
      label: { ...text('footnote'), color: c.label, flexShrink: 1 },
      labelSelected: { fontWeight: '600' },
      icon: { marginRight: theme.space[1] },
    });
  }, [theme, text, disabled]);

  return (
    <View testID={testID} accessibilityRole="radiogroup" onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={[s.track, style]}>
      {has && segW > 0 && <Animated.View testID={`${testID}-thumb`} style={[s.thumb, { width: segW }, thumbStyle]} />}
      {segments.map((seg) => {
        const selected = seg.value === value;
        const off = disabled || !!seg.disabled;
        return (
          <Pressable
            key={seg.value}
            testID={seg.testID || `${testID}-${seg.value}`}
            accessibilityRole="radio"
            accessibilityLabel={seg.label}
            accessibilityState={{ selected, checked: selected, disabled: off }}
            aria-checked={selected}
            aria-selected={selected}
            aria-disabled={off || undefined}
            disabled={off}
            hitSlop={{ top: (theme.size.touchTarget - theme.size.segmented) / 2, bottom: (theme.size.touchTarget - theme.size.segmented) / 2 }}
            onPress={() => {
              if (selected) return;
              appleHapticSelection();
              onValueChange(seg.value);
            }}
            style={[s.segment, seg.disabled && !disabled ? { opacity: 0.4 } : null, !width && selected ? { backgroundColor: theme.colors.elevatedControl, borderRadius: theme.radii.input - 3 } : null]}
          >
            {!!seg.icon && <IconApp name={seg.icon} size={15} color={theme.colors.label} style={s.icon} />}
            <Text style={[s.label, selected && s.labelSelected]} numberOfLines={1} allowFontScaling>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const AppleSegmentedControl = memo(AppleSegmentedControlInner) as typeof AppleSegmentedControlInner;
export default AppleSegmentedControl;
