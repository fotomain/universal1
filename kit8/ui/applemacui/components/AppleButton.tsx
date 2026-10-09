// AppleButton - iOS button (HIG: Buttons). Variants: filled · tinted · gray · plain. Sizes: small · medium · large.
// Press feedback: spring scale 0.97 + opacity on the UI thread; light haptic on iOS; loading and disabled states.
import React, { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import IconApp from '../../components/common/IconApp';
import { appleMacUIAlpha } from '../appleMacUITheme';
import { useAppleMacUI } from '../WithAppleMacUI';
import { appleHapticTap } from '../lib/haptics';
import { usePressSpring } from '../lib/usePressSpring';

export type AppleButtonVariant = 'filled' | 'tinted' | 'gray' | 'plain';
export type AppleButtonSize = 'small' | 'medium' | 'large';

export interface AppleButtonProps {
  title?: string;
  onPress?: () => void;
  variant?: AppleButtonVariant;
  size?: AppleButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** red (systemRed) instead of the tint: sql_for_delete, remove … */
  destructive?: boolean;
  /** tint override (default: theme.tint) */
  color?: string;
  /** IconApp name or an element, before the title */
  icon?: string | React.ReactNode;
  /** stretch to the width of the parent */
  fullWidth?: boolean;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onLongPress?: () => void;
  children?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AppleButton = memo(function AppleButton({
  title,
  onPress,
  variant = 'filled',
  size = 'medium',
  loading = false,
  disabled = false,
  destructive = false,
  color,
  icon,
  fullWidth = false,
  haptics = true,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
  onLongPress,
  children,
}: AppleButtonProps) {
  const { theme, text } = useAppleMacUI();
  const off = disabled || loading;
  const press = usePressSpring(!off);
  const [focused, setFocused] = useState(false);
  const label = title ?? (typeof children === 'string' ? children : undefined);

  const s = useMemo(() => {
    const tint = color || (destructive ? theme.colors.systemRed : theme.tint);
    const c = theme.colors;
    const height = size === 'small' ? theme.size.controlSmall : size === 'large' ? theme.size.controlLarge : theme.size.controlMedium;
    const radius = size === 'small' ? theme.radii.buttonSmall : size === 'large' ? theme.radii.buttonLarge : theme.radii.button;
    const background = variant === 'filled' ? tint : variant === 'tinted' ? appleMacUIAlpha(tint, 0.15) : variant === 'gray' ? c.fill : 'transparent';
    const foreground = variant === 'filled' ? c.onTint : tint;
    const type = size === 'small' ? text('subhead') : text('body');
    return StyleSheet.create({
      box: {
        minHeight: height,
        // the touch target is never smaller than 44 pt, even for the small (32 pt) button
        minWidth: theme.size.touchTarget,
        paddingHorizontal: variant === 'plain' ? theme.space[2] : size === 'small' ? theme.space[3] : theme.space[4],
        borderRadius: radius,
        backgroundColor: off && variant !== 'plain' ? c.tertiaryFill : background,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      },
      label: { ...type, fontWeight: size === 'large' || variant === 'filled' ? '600' : type.fontWeight, color: off ? c.tertiaryLabel : foreground, flexShrink: 1 },
      icon: { marginRight: label ? theme.space[2] - 2 : 0 },
      focus: Platform.OS === 'web' ? ({ outlineStyle: 'solid', outlineWidth: theme.focusRing.width, outlineColor: theme.focusRing.color, outlineOffset: 2 } as any) : {},
      tint: { color: off ? c.tertiaryLabel : foreground },
    });
  }, [theme, text, variant, size, off, destructive, color, fullWidth, label]);

  const handlePress = useCallback(() => {
    if (haptics) appleHapticTap();
    onPress?.();
  }, [haptics, onPress]);
  const slop = size === 'small' ? (theme.size.touchTarget - theme.size.controlSmall) / 2 : 0;
  const tintColor = (StyleSheet.flatten(s.tint) as any).color as string;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: loading }}
      // react-native-web ignores accessibilityState
      aria-disabled={off || undefined}
      aria-busy={loading || undefined}
      disabled={off}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={slop}
      style={[s.box, press.animatedStyle, focused && s.focus, style]}
    >
      {loading ? (
        <ActivityIndicator testID={testID ? `${testID}-spinner` : undefined} size="small" color={tintColor} />
      ) : (
        <>
          {typeof icon === 'string' ? <IconApp name={icon} size={theme.size.icon} color={tintColor} style={s.icon} /> : icon}
          {!!label && (
            <Text style={s.label} numberOfLines={1} allowFontScaling>
              {label}
            </Text>
          )}
          {typeof children !== 'string' ? children : null}
        </>
      )}
    </AnimatedPressable>
  );
});

export default AppleButton;
