// TamaguiTextInputSub - Tamagui Input adapter following https://tamagui.dev/ui/inputs
// Features:
// - Tamagui SizeTokens: $2 (sm), $3 (md), $4 (default/lg), $5 (xl)
// - Tamagui Input & Label styling (border tokens, inputBg, focusStyle, hoverStyle)
// - Left/Right icons and clear button
// - Tokenized error and helper text

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TextInputAppProps } from '../TextInputApp';
import IconApp from '../IconApp';
import tamaguiConfig from '../../../../../tamagui.config';

interface SizeConfig {
  height: number;
  fontSize: number;
  paddingH: number;
  radius: number;
  labelSize: number;
}

const SIZE_MAP: Record<string, SizeConfig> = {
  $2: { height: 32, fontSize: 12, paddingH: 10, radius: 6, labelSize: 12 },
  $3: { height: 38, fontSize: 13, paddingH: 12, radius: 8, labelSize: 13 },
  $4: { height: 44, fontSize: 14, paddingH: 14, radius: 9, labelSize: 14 },
  $5: { height: 52, fontSize: 16, paddingH: 18, radius: 12, labelSize: 15 },
  small: { height: 32, fontSize: 12, paddingH: 10, radius: 6, labelSize: 12 },
  medium: { height: 44, fontSize: 14, paddingH: 14, radius: 9, labelSize: 14 },
  large: { height: 52, fontSize: 16, paddingH: 18, radius: 12, labelSize: 15 },
};

export interface TamaguiTextInputSubProps extends TextInputAppProps {
  themeColors: any;
  isDark: boolean;
}

export const TamaguiTextInputSub: React.FC<TamaguiTextInputSubProps> = ({
  label,
  value = '',
  onChangeText,
  placeholder,
  disabled = false,
  error,
  errorCheck,
  errorMessage,
  showError,
  secureTextEntry = false,
  helperText,
  leftIcon,
  rightIcon,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  left,
  right,
  hideClearIcon = false,
  size = '$4',
  unstyled = false,
  themeColors,
  isDark,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const currentValue = typeof value === 'string' ? value : '';
  const checkResult = errorCheck ? errorCheck(currentValue) : null;

  let computedErrorMessage = errorMessage || (typeof error === 'string' ? error : '');
  let hasError = Boolean(showError || error);

  if (checkResult) {
    hasError = true;
    if (typeof checkResult === 'string') {
      computedErrorMessage = checkResult;
    } else if (!computedErrorMessage) {
      computedErrorMessage = 'Field has an error';
    }
  }

  const showClearIcon = currentValue.length > 0 && !disabled && !hideClearIcon;

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  const tokens = isDark ? tamaguiConfig.themes.dark : tamaguiConfig.themes.light;
  const sizeConfig = SIZE_MAP[size as string] || SIZE_MAP.$4;

  const primaryColor = themeColors.primary || tokens.primary || '#6366f1';
  const textColor = themeColors.text || tokens.color || (isDark ? '#f9fafb' : '#111827');
  const borderColor = hasError
    ? (themeColors.error || '#ef4444')
    : isFocused
    ? primaryColor
    : isHovered
    ? (isDark ? '#4b5563' : '#cbd5e1')
    : (themeColors.border || tokens.borderColor || '#e5e7eb');

  const bgColor = isDark
    ? (tokens.inputBg || '#1f2937')
    : (tokens.inputBg || '#ffffff');
  const placeholderColor = isDark
    ? (tokens.placeholder || '#6b7280')
    : (tokens.placeholder || '#9ca3af');

  if (unstyled) {
    return (
      <View style={[{ width: '100%' }, style]}>
        {label && <Text style={{ color: textColor, marginBottom: 4 }}>{label}</Text>}
        <TextInput
          value={currentValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{ color: textColor }}
          {...(props as any)}
        />
      </View>
    );
  }

  return (
    <View style={[{ marginBottom: 14, width: '100%' }, style]}>
      {/* Tamagui Form Label */}
      {label && (
        <Text
          style={[
            styles.label,
            {
              fontSize: sizeConfig.labelSize,
              color: textColor,
            },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Tamagui Input Box (XStack container) */}
      <View
        {...((Platform.OS === 'web'
          ? {
              onMouseEnter: () => setIsHovered(true),
              onMouseLeave: () => setIsHovered(false),
            }
          : {}) as any)}
        style={[
          styles.container,
          {
            height: multiline ? undefined : sizeConfig.height,
            minHeight: multiline ? (numberOfLines || 3) * 22 : sizeConfig.height,
            backgroundColor: bgColor,
            borderColor,
            borderWidth: isFocused ? 1.5 : 1,
            borderRadius: sizeConfig.radius,
            paddingHorizontal: sizeConfig.paddingH,
            paddingVertical: multiline ? 8 : 0,
            opacity: disabled ? 0.5 : 1,
            ...(Platform.OS === 'web' && isFocused
              ? {
                  boxShadow: `0 0 0 1px ${borderColor}`,
                }
              : {}),
          },
        ]}
      >
        {/* Left icon / custom component */}
        {left !== undefined ? (
          left
        ) : leftIcon ? (
          <IconApp
            testID="tamagui-input-left-icon"
            name={leftIcon}
            size={18}
            color={placeholderColor}
            style={{ marginRight: 8 }}
          />
        ) : null}

        <TextInput
          value={currentValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            {
              fontSize: sizeConfig.fontSize,
              color: textColor,
              minHeight: multiline ? (numberOfLines || 3) * 20 : 24,
            },
          ]}
          {...(props as any)}
        />

        {/* Clear icon */}
        {showClearIcon && (
          <Pressable
            testID="tamagui-input-clear-btn"
            accessibilityRole="button"
            accessibilityLabel="Clear text"
            onPress={handleClear}
            hitSlop={6}
            style={({ pressed }: any) => [
              styles.iconBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconApp
              name="close"
              size={16}
              color={placeholderColor}
            />
          </Pressable>
        )}

        {/* Right icon / custom component */}
        {right !== undefined ? (
          right
        ) : rightIcon ? (
          <IconApp
            testID="tamagui-input-right-icon"
            name={rightIcon}
            size={18}
            color={placeholderColor}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </View>

      {/* Tamagui Helper & Error Text */}
      {(hasError || helperText) && (
        <Text
          style={[
            styles.helperText,
            {
              color: hasError
                ? (themeColors.error || '#ef4444')
                : (isDark ? '#9ca3af' : '#6b7280'),
            },
          ]}
        >
          {hasError ? computedErrorMessage : helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  iconBtn: {
    padding: 2,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
});

export default TamaguiTextInputSub;
