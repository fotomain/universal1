import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from './IconApp';
import GoogleMD3WebButton from './googlemd3web/GoogleMD3WebButton';

export interface ButtonAppProps {
  title?: string;
  onPress: () => void;
  /**
   * contained / outlined / text follow the active design system.
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
  /** fixed width, content centered */
  width?: number;
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
  const widthStyle = width ? { width, justifyContent: 'center' as const } : null;

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
          <ActivityIndicator size="small" color={tint} />
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
          style={[{ marginVertical: 6 }, widthStyle, style]}
        >
          {children || buttonText}
        </PaperButton>
      );
    }

    case 'tamagui': {
      const isContained = variant === 'contained';
      const isOutlined = variant === 'outlined';

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
              backgroundColor: disabled
                ? isDark
                  ? '#374151'
                  : '#e5e7eb'
                : isContained
                ? btnColor
                : 'transparent',
              borderWidth: isOutlined ? 1.5 : 0,
              borderColor: isOutlined ? btnColor : 'transparent',
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
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} />
          ) : (
            <>
              {icon && <IconApp testID="b5d10e4f-2a6c-7b89-1d23-456789012d04" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: disabled
                    ? '#9ca3af'
                    : isContained
                    ? textColor || '#ffffff'
                    : textColor || btnColor,
                  fontSize: size === 'small' ? 13 : size === 'large' ? 17 : 15,
                  fontWeight: '700',
                  letterSpacing: 0.2,
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
      const isContained = variant === 'contained';
      const isOutlined = variant === 'outlined';

      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.7}
          style={[
            {
              backgroundColor: disabled
                ? '#f5f5f5'
                : isContained
                ? btnColor
                : 'transparent',
              borderWidth: 1,
              borderColor: disabled
                ? '#d9d9d9'
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
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />
          ) : (
            <>
              {icon && <IconApp testID="c6e21f50-3b7d-8c90-2e34-567890123e05" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: disabled
                    ? '#00000040'
                    : isContained
                    ? textColor || '#ffffff'
                    : textColor || btnColor,
                  fontSize: size === 'small' ? 13 : 15,
                  fontWeight: '500',
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
      const isContained = variant === 'contained';
      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.85}
          style={[
            {
              backgroundColor: disabled
                ? isDark
                  ? '#334155'
                  : '#e2e8f0'
                : isContained
                ? btnColor
                : 'transparent',
              borderRadius: 24,
              paddingVertical: 12,
              paddingHorizontal: 22,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginVertical: 6,
              borderWidth: variant === 'outlined' ? 2 : 0,
              borderColor: btnColor,
            },
            widthStyle,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />
          ) : (
            <>
              {icon && <IconApp testID="d7f32a61-4c8e-9d01-3f45-678901234f06" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: isContained ? textColor || '#ffffff' : textColor || btnColor,
                  fontSize: 16,
                  fontWeight: '800',
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
      const isContained = variant === 'contained';
      const isOutlined = variant === 'outlined';

      return (
        <TouchableOpacity
          {...common}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.7}
          style={[
            {
              backgroundColor: disabled
                ? isDark
                  ? '#27272a'
                  : '#e4e4e7'
                : isContained
                ? btnColor
                : 'transparent',
              borderWidth: isOutlined ? 1 : 0,
              borderColor: btnColor,
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
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} />
          ) : (
            <>
              {icon && <IconApp testID="e8043b72-5d9f-0e12-4056-789012345a07" name={icon} size={iconSize ?? 18} color={isContained ? textColor || '#fff' : textColor || btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: isContained ? textColor || '#ffffff' : textColor || btnColor,
                  fontSize: 15,
                  fontWeight: '600',
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
