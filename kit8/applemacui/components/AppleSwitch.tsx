// AppleSwitch - iOS toggle (HIG: Toggles): 51 x 31 track, 27 pt thumb, systemGreen when on. The thumb slides on the
// UI thread (Reanimated spring; instant with reduced motion).
import React, { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppleMacUI } from '../WithAppleMacUI';
import { appleHapticSelection } from '../lib/haptics';

export interface AppleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** "on" color (default systemGreen) */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export const AppleSwitch = memo(function AppleSwitch({ value, onValueChange, label, disabled = false, color, style, testID, accessibilityLabel }: AppleSwitchProps) {
  const { theme, text, reduceMotion } = useAppleMacUI();
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = reduceMotion ? withTiming(value ? 1 : 0, { duration: 0 }) : withSpring(value ? 1 : 0, theme.motion.spring);
  }, [value, reduceMotion, on, theme.motion.spring]);

  const { switchWidth: W, switchHeight: H, switchThumb: T } = theme.size;
  const pad = (H - T) / 2;
  const travel = W - T - 2 * pad;
  const s = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: theme.size.touchTarget },
        label: { ...text('body'), color: theme.colors.label, flex: 1, marginRight: theme.space[3] },
        track: { width: W, height: H, borderRadius: H / 2, backgroundColor: theme.colors.fill, justifyContent: 'center', opacity: disabled ? 0.5 : 1 },
        on: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: H / 2, backgroundColor: color || theme.colors.systemGreen },
        thumb: { width: T, height: T, borderRadius: T / 2, marginLeft: pad, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
      }),
    [theme, text, W, H, T, pad, disabled, color]
  );
  const onStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * travel }] }));
  const toggle = () => {
    appleHapticSelection();
    onValueChange(!value);
  };
  const control = (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={toggle}
      hitSlop={(theme.size.touchTarget - H) / 2}
      style={s.track}
    >
      <Animated.View style={[s.on, onStyle]} />
      <Animated.View style={[s.thumb, thumbStyle]} />
    </Pressable>
  );
  if (!label) return <View style={style}>{control}</View>;
  return (
    <View style={[s.row, style]}>
      <Text style={s.label} allowFontScaling>
        {label}
      </Text>
      {control}
    </View>
  );
});

export default AppleSwitch;
