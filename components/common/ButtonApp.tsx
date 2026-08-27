import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { useDesignSystem } from '../../kit8/providers/DesignSystemContext';
import IconApp from './IconApp';
import GoogleMD3WebButton from './googlemd3web/GoogleMD3WebButton';

export interface ButtonAppProps {
  title?: string;
  onPress: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  disabled?: boolean;
  loading?: boolean;
  icon?: string | any;
  color?: string;
  size?: 'small' | 'medium' | 'large';
  style?: any;
  children?: React.ReactNode;
}

export const ButtonApp: React.FC<ButtonAppProps> = ({
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
}) => {
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const btnColor = color || themeColors.primary;
  const buttonText = title || (typeof children === 'string' ? children : '');

  switch (activeSystem) {
    case 'paper': {
      const mode = variant === 'contained' ? 'contained' : variant === 'outlined' ? 'outlined' : 'text';
      return (
        <PaperButton
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
          textColor={variant === 'contained' ? '#ffffff' : btnColor}
          style={[{ marginVertical: 6 }, style]}
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
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} />
          ) : (
            <>
              {icon && <IconApp testID="b5d10e4f-2a6c-7b89-1d23-456789012d04" name={icon} size={18} color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: disabled
                    ? '#9ca3af'
                    : isContained
                    ? '#ffffff'
                    : btnColor,
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
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />
          ) : (
            <>
              {icon && <IconApp testID="c6e21f50-3b7d-8c90-2e34-567890123e05" name={icon} size={18} color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: disabled
                    ? '#00000040'
                    : isContained
                    ? '#ffffff'
                    : btnColor,
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
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />
          ) : (
            <>
              {icon && <IconApp testID="d7f32a61-4c8e-9d01-3f45-678901234f06" name={icon} size={18} color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: isContained ? '#ffffff' : btnColor,
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
          variant={variant}
          size={size}
          disabled={disabled}
          loading={loading}
          icon={icon}
          style={style}
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
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isContained ? '#fff' : btnColor} />
          ) : (
            <>
              {icon && <IconApp testID="e8043b72-5d9f-0e12-4056-789012345a07" name={icon} size={18} color={isContained ? '#fff' : btnColor} style={{ marginRight: 6 }} />}
              <Text
                style={{
                  color: isContained ? '#ffffff' : btnColor,
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
};

export default ButtonApp;
