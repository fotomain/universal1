import React from 'react';
import { TouchableOpacity, Text, View, Pressable, StyleSheet } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ActivityIndicatorCircleApp from '../activityindicator/ActivityIndicatorCircleApp';
import IconApp from './IconApp';
import GoogleMD3WebButton from './googlemd3web/GoogleMD3WebButton';
import { AppleButton } from '../../applemacui/components/AppleButton';

export interface ButtonAppProps {
  title?: string;
  onPress: () => void;
  /**
   * contained / outlined / text follow the active design system.
   * outlined = transparent background + a border in the button color (primary by default) and the label in the
   * same color - in EVERY design system. Contained and outlined buttons have the same outer size (a contained
   * button carries a border of its own color), so a row / column of mixed buttons lines up.
   * toolbar = compact icon (+ optional label) button for toolbars and floating panels:
   * transparent, hover highlight (web), `active` state, optional `badge` - same look in
   * every design system.
   */
  variant?: 'contained' | 'outlined' | 'text' | 'toolbar';
  disabled?: boolean;
  loading?: boolean;
  icon?: string | any;
  color?: string;
  size?: 'small' | 'medium' | 'large';
  style?: any;
  children?: React.ReactNode;

  // ---- optional extras (all variants unless noted) ----
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** red button for destructive actions (uses the theme's error color) */
  danger?: boolean;
  /** text / icon color override (default: white on contained, `color` otherwise) */
  textColor?: string;
  iconSize?: number;
  /** fixed width, content centered (the label is cut with … when it does not fit) */
  width?: number;
  /** at least this wide (buttons of one group: same minWidth = equal size, still grows for a long label) */
  minWidth?: number;
  /** fixed height (overrides the vertical padding of the design system) */
  height?: number;
  onLongPress?: () => void;
  delayLongPress?: number;
  onPressIn?: () => void;
  /** web hover (toolbar variant; other variants ignore it) */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  /** toolbar: highlighted (toggle on / current choice) */
  active?: boolean;
  activeColor?: string;
  /** toolbar: small counter bubble after the label */
  badge?: number;
  /** toolbar: smaller (24 px) button for floating row panels */
  compact?: boolean;
}

export const ButtonApp = React.forwardRef<View, ButtonAppProps>(function ButtonApp(
  {
    title,
    onPress,
    variant = 'contained',
    disabled = false,
    loading = false,
    icon,
    color,
    size = 'medium',
    style,
    children,
    testID,
    accessibilityLabel,
    accessibilityHint,
    danger,
    textColor,
    iconSize,
    width,
    minWidth,
    height,
    onLongPress,
    delayLongPress,
    onPressIn,
    onHoverIn,
    onHoverOut,
    active,
    activeColor,
    badge,
    compact,
  },
  ref
) {
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const btnColor = color || (danger ? themeColors.error : themeColors.primary);
  const buttonText = title || (typeof children === 'string' ? children : '');
  // props every TouchableOpacity / Pressable branch accepts
  const common: any = {
    ref,
    testID,
    accessibilityRole: 'button',
    accessibilityLabel: accessibilityLabel || buttonText || undefined,
    accessibilityHint,
    accessibilityState: { disabled: disabled || loading, selected: !!active },
    // react-native-web 0.21 ignores accessibilityState -> also pass the aria-* props
    'aria-disabled': disabled || loading || undefined,
    'aria-selected': active === undefined ? undefined : !!active,
    onLongPress,
    delayLongPress,
    onPressIn,
  };
  // fixed width: never shrinks / grows inside a row or a horizontally scrolling toolbar
  const fixedWidthStyle = width ? { width, minWidth: width, maxWidth: width, flexGrow: 0, flexShrink: 0, justifyContent: 'center' as const } : null;
  const widthStyle =
    fixedWidthStyle || minWidth || height
      ? { ...(fixedWidthStyle || {}), ...(minWidth && !width ? { minWidth } : null), ...(height ? { height, paddingVertical: 0 } : null) }
      : null;
  // a fixed-width button never wraps its label onto a second line
  const labelProps: any = width ? { numberOfLines: 1, ellipsizeMode: 'tail' } : {};
  const labelFit = width ? { flexShrink: 1 } : null;
  const isContained = variant === 'contained';
  const isOutlined = variant === 'outlined';

  if (variant === 'toolbar') {
    const tint = active && activeColor ? activeColor : textColor || color || themeColors.text;
    return (
      <Pressable
        {...common}
        disabled={disabled || loading}
        onPress={disabled || loading ? undefined : onPress}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        hitSlop={4}
        style={({ pressed, hovered }: any) => [
          toolbarStyles.btn,
          compact && toolbarStyles.compact,
          widthStyle,
          {
            opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
            backgroundColor: active ? `${activeColor || tint}22` : hovered ? `${tint}14` : 'transparent',
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicatorCircleApp size="small" color={tint} />
        ) : (
          <>
            {!!icon && (typeof icon === 'string' ? <IconApp testID={testID ? `${testID}-icon` : undefined} name={icon} size={iconSize ?? (compact ? 16 : 18)} color={tint} /> : icon)}
            {!!buttonText && <Text style={[toolbarStyles.label, { color: tint }]}>{buttonText}</Text>}
            {!!badge && badge > 0 && (
              <View style={[toolbarStyles.badge, { backgroundColor: tint }]}>
                <Text style={toolbarStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            )}
            {typeof children !== 'string' ? children : null}
          </>
        )}
      </Pressable>
    );
  }

  switch (activeSystem) {
    case 'applemacui': {
      // contained = filled · outlined = tinted (iOS has no outlined button) · text = plain
      return (
        <AppleButton
          testID={testID}
          title={buttonText || undefined}
          onPress={onPress}
          onLongPress={onLongPress}
          variant={isContained ? 'filled' : isOutlined ? 'tinted' : 'plain'}
          size={size}
          loading={loading}
          disabled={disabled}
          destructive={danger}
          color={color}
          icon={icon}
          accessibilityLabel={common.accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={[{ marginVertical: 6, alignSelf: 'auto' }, widthStyle, style]}
        >
          {typeof children !== 'string' ? children : null}
        </AppleButton>
      );
    }

    case 'paper': {
      const mode = variant === 'contained' ? 'contained' : variant === 'outlined' ? 'outlined' : 'text';
      return (
        <PaperButton
          ref={ref as any}
          testID={testID}
          accessibilityLabel={common.accessibilityLabel}
          onLongPress={onLongPress}
          mode={mode}
          onPress={onPress}
          disabled={disabled || loading}
          loading={loading}
          icon={
            typeof icon === 'function' || React.isValidElement(icon)
              ? (icon as any)
              : typeof icon === 'string'
              ? (props) => <IconApp testID="a4c09d3e-1f5b-6a78-0c12-345678901c03" name={icon} size={props.size} color={props.color} />
              : undefined
          }
          buttonColor={variant === 'contained' ? btnColor : undefined}
          textColor={textColor || (variant === 'contained' ? '#ffffff' : btnColor)}
          style={[
            { marginVertical: 6 },
            // same outer size for contained and outlined; outlined = border in the button color
            isContained ? { borderWidth: 1, borderColor: disabled ? 'transparent' : btnColor } : isOutlined ? { borderWidth: 1, borderColor: btnColor } : null,
            widthStyle,
            style,
          ]}
        >
          {children || buttonText}
        </PaperButton>
      );
    }

    case 'tamagui': {

      const paddingV = size === 'small' ? 8 : size === 'large' ? 14 : 11;
      const paddingH = size === 'small' ? 14 : size === 'large' ? 24 : 18;

      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.8}
          style={[
            {
              backgroundColor: !isContained ? 'transparent' : disabled ? (isDark ? '#374151' : '#e5e7eb') : btnColor,
              borderWidth: isOutlined || isContained ? 1.5 : 0,
              borderColor: isOutlined ? (disabled ? '#9ca3af' : btnColor) : isContained ? (disabled ? 'transparent' : btnColor) : 'transparent',
              borderRadius: 12,
              paddingVertical: paddingV,
              paddingHorizontal: paddingH,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginVertical: 6,
              boxShadow: isContained && !disabled ? '0px 4px 12px rgba(99, 102, 241, 0.35)' : 'none',
            },
            widthStyle,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicatorCircleApp size="small" color={isContained ? '#fff' : btnColor} />
          ) : (
            <>
              {icon && <IconApp testID="b5d10e4f-2a6c-7b89-1d23-456789012d04" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                {...labelProps}
                style={{
                  color: disabled
                    ? '#9ca3af'
                    : isContained
                    ? textColor || '#ffffff'
                    : textColor || btnColor,
                  fontSize: size === 'small' ? 13 : size === 'large' ? 17 : 15,
                  fontWeight: '700',
                  letterSpacing: 0.2,
                  ...labelFit,
                }}
              >
                {buttonText}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    case 'ant': {

      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.7}
          style={[
            {
              backgroundColor: !isContained ? 'transparent' : disabled ? '#f5f5f5' : btnColor,
              borderWidth: 1,
              borderColor: disabled
                ? variant === 'text' ? 'transparent' : '#d9d9d9'
                : isOutlined
                ? btnColor
                : isContained
                ? btnColor
                : 'transparent',
              borderRadius: 6,
              paddingVertical: size === 'small' ? 6 : 10,
              paddingHorizontal: size === 'small' ? 12 : 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginVertical: 6,
            },
            widthStyle,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicatorCircleApp size="small" color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />
          ) : (
            <>
              {icon && <IconApp testID="c6e21f50-3b7d-8c90-2e34-567890123e05" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                {...labelProps}
                style={{
                  color: disabled
                    ? '#00000040'
                    : isContained
                    ? textColor || '#ffffff'
                    : textColor || btnColor,
                  fontSize: size === 'small' ? 13 : 15,
                  fontWeight: '500',
                  ...labelFit,
                }}
              >
                {buttonText}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    case 'expo': {
      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.85}
          style={[
            {
              backgroundColor: !isContained ? 'transparent' : disabled ? (isDark ? '#334155' : '#e2e8f0') : btnColor,
              borderRadius: 24,
              paddingVertical: 12,
              paddingHorizontal: 22,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginVertical: 6,
              borderWidth: isOutlined || isContained ? 2 : 0,
              borderColor: disabled ? (isOutlined ? '#94a3b8' : 'transparent') : btnColor,
              opacity: disabled && !isContained ? 0.6 : 1,
            },
            widthStyle,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicatorCircleApp size="small" color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />
          ) : (
            <>
              {icon && <IconApp testID="d7f32a61-4c8e-9d01-3f45-678901234f06" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                {...labelProps}
                style={{
                  color: isContained ? textColor || '#ffffff' : textColor || btnColor,
                  fontSize: 16,
                  fontWeight: '800',
                  ...labelFit,
                }}
              >
                {buttonText}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    case 'googlemd3web': {
      return (
        <GoogleMD3WebButton
          title={title}
          onPress={onPress}
          variant={variant as 'contained' | 'outlined' | 'text'}
          size={size}
          disabled={disabled}
          loading={loading}
          icon={icon}
          style={widthStyle ? [widthStyle, style] : style}
          themeColors={themeColors}
          isDark={isDark}
        >
          {children}
        </GoogleMD3WebButton>
      );
    }

    case 'native':
    default: {

      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.7}
          style={[
            {
              backgroundColor: !isContained ? 'transparent' : disabled ? (isDark ? '#27272a' : '#e4e4e7') : btnColor,
              borderWidth: isOutlined || isContained ? 1 : 0,
              borderColor: isContained && disabled ? 'transparent' : btnColor,
              borderRadius: 4,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginVertical: 6,
              opacity: disabled ? 0.6 : 1,
            },
            widthStyle,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicatorCircleApp size="small" color={isContained ? '#fff' : btnColor} />
          ) : (
            <>
              {icon && <IconApp testID="e8043b72-5d9f-0e12-4056-789012345a07" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                {...labelProps}
                style={{
                  color: isContained ? textColor || '#ffffff' : textColor || btnColor,
                  fontSize: 15,
                  fontWeight: '600',
                  ...labelFit,
                }}
              >
                {buttonText}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    }
  }
});

const toolbarStyles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', height: 30, paddingHorizontal: 7, borderRadius: 8, marginRight: 2 },
  compact: { height: 24, paddingHorizontal: 4, borderRadius: 6, marginRight: 0 },
  label: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  badge: { minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, marginLeft: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default ButtonApp;
