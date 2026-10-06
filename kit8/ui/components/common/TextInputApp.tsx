import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, TextInputProps as RNTextInputProps } from 'react-native';
import { TextInput as PaperTextInput, HelperText as PaperHelperText, TextInputProps as PaperTextInputProps } from 'react-native-paper';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from './IconApp';
import GoogleMD3WebTextInput from './googlemd3web/GoogleMD3WebTextInput';
import TamaguiTextInputSub from './tamagui/TamaguiTextInputSub';
import { AppleTextField } from '../../applemacui/components/AppleTextField';
import { installNoAutofillHighlight } from '../../../lib/webAutofillStyle';

// web: no light-blue browser autofill background on any app input
installNoAutofillHighlight();

export interface TextInputAppProps extends Omit<RNTextInputProps & PaperTextInputProps, 'inputMode' | 'style' | 'error'> {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean | string;
  errorCheck?: (text: string) => string | boolean | null | undefined;
  errorMessage?: string;
  showError?: boolean;
  secureTextEntry?: boolean;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  inputMode?: any;
  style?: any;
  /** custom element inside the input box at the left / right (paper: a TextInput.Icon / TextInput.Affix) */
  left?: any;
  right?: any;
  /** no clear (x) icon inside the input (read-only values such as GUIDs) */
  hideClearIcon?: boolean;
  /** Tamagui size token: '$2' | '$3' | '$4' | '$5' or 'small' | 'medium' | 'large' */
  size?: '$2' | '$3' | '$4' | '$5' | 'small' | 'medium' | 'large';
  /** unstyled variant in Tamagui */
  unstyled?: boolean;
}

export const TextInputApp: React.FC<TextInputAppProps> = ({
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
  size,
  unstyled,
  ...props
}) => {
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const [isFocused, setIsFocused] = useState(false);

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

  /** the clear (x) icon: only for a filled, enabled input that did not switch it off */
  const showClearIcon = currentValue.length > 0 && !disabled && !hideClearIcon;

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  switch (activeSystem) {
    case 'applemacui': {
      return (
        <AppleTextField
          {...(props as any)}
          label={label}
          value={currentValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          disabled={disabled}
          error={hasError ? computedErrorMessage || true : false}
          helperText={helperText}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          leftIcon={leftIcon}
          left={left}
          right={right}
          clearButton={!hideClearIcon}
          style={style}
        />
      );
    }

    case 'paper': {
      const leftProp = left !== undefined
        ? left
        : (leftIcon ? (
            <PaperTextInput.Icon icon={leftIcon === 'search' ? 'magnify' : leftIcon} />
          ) : undefined);

      const rightProp = right !== undefined
        ? right
        : (showClearIcon ? (
            <PaperTextInput.Icon
              icon="close"
              onPress={handleClear}
              forceTextInputFocus={false}
            />
          ) : rightIcon ? (
            <PaperTextInput.Icon icon={rightIcon} />
          ) : undefined);

      return (
        <View style={[{ marginBottom: 12, width: '100%' }, style]}>
          <PaperTextInput
            mode="outlined"
            label={label}
            value={currentValue}
            onChangeText={onChangeText}
            placeholder={placeholder}
            disabled={disabled}
            error={hasError}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            numberOfLines={numberOfLines}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            left={leftProp}
            right={rightProp}
            outlineColor={themeColors.border}
            activeOutlineColor={themeColors.primary}
            style={{ backgroundColor: themeColors.surface }}
            {...(props as any)}
          />
          {(hasError || helperText) && (
            <PaperHelperText type={hasError ? 'error' : 'info'} visible={true}>
              {hasError && computedErrorMessage ? computedErrorMessage : helperText || ' '}
            </PaperHelperText>
          )}
        </View>
      );
    }

    case 'tamagui': {
      return (
        <TamaguiTextInputSub
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          errorCheck={errorCheck}
          errorMessage={errorMessage}
          showError={showError}
          secureTextEntry={secureTextEntry}
          helperText={helperText}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={style}
          left={left}
          right={right}
          hideClearIcon={hideClearIcon}
          size={size}
          unstyled={unstyled}
          themeColors={themeColors}
          isDark={isDark}
          {...(props as any)}
        />
      );
    }

    case 'ant': {
      const isMultiline = multiline;
      const linesCount = numberOfLines || 2;
      return (
        <View style={[{ marginBottom: 14, width: '100%' }, style]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: isMultiline ? 'flex-start' : 'center',
              backgroundColor: disabled ? '#f5f5f5' : themeColors.surface,
              borderWidth: 1,
              borderColor: hasError ? themeColors.error : isFocused ? themeColors.primary : '#d9d9d9',
              borderRadius: 4,
              paddingHorizontal: 11,
              paddingVertical: isMultiline ? 8 : 6,
            }}
          >
            {label && (
              <Text style={{ width: 90, fontSize: 16, color: themeColors.text, fontWeight: '500', lineHeight: 24, margin: 0, padding: 0 }}>
                {label}
              </Text>
            )}
            {left !== undefined && left}
            {left === undefined && leftIcon && <IconApp testID="c80edf12-5bd9-0c12-4af6-789012345e18" name={leftIcon} size={18} color="#888" style={{ marginRight: 8 }} />}
            <TextInput
              value={currentValue}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#bfbfbf"
              editable={!disabled}
              secureTextEntry={secureTextEntry}
              multiline={multiline}
              numberOfLines={isMultiline ? linesCount : 1}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                flex: 1,
                fontSize: 14,
                color: themeColors.text,
                minHeight: isMultiline ? linesCount * 20 : 24,
                outlineStyle: 'none',
                borderWidth: 0,
              } as any}
              {...(props as any)}
            />
            {right !== undefined && right}
            {right === undefined && showClearIcon && (
              <IconApp testID="c80edf12-5bd9-0c12-4af6-789012345e17" name="close" size={18} color="#888" onPress={handleClear} />
            )}
          </View>
          {(hasError || helperText) && (
            <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#999', marginTop: 4 }}>
              {hasError ? computedErrorMessage : helperText}
            </Text>
          )}
        </View>
      );
    }

    case 'expo': {
      return (
        <View style={[{ marginBottom: 14, width: '100%' }, style]}>
          {label && (
            <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.primary, marginBottom: 4 }}>
              {label}
            </Text>
          )}
          <View
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderWidth: 1.5,
              borderColor: hasError ? themeColors.error : isFocused ? themeColors.primary : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {left !== undefined && left}
            {left === undefined && leftIcon && <IconApp testID="d91fe023-6cea-1d23-5bg7-890123456f19" name={leftIcon} size={18} color="#64748b" style={{ marginRight: 8 }} />}
            <TextInput
              value={currentValue}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              editable={!disabled}
              secureTextEntry={secureTextEntry}
              multiline={multiline}
              numberOfLines={numberOfLines}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                flex: 1,
                fontSize: 15,
                color: themeColors.text,
                outlineStyle: 'none',
                borderWidth: 0,
              } as any}
              {...(props as any)}
            />
            {right !== undefined && right}
            {right === undefined && showClearIcon && (
              <IconApp testID="d91fe023-6cea-1d23-5bg7-890123456f18" name="close" size={18} color="#64748b" onPress={handleClear} />
            )}
          </View>
          {(hasError || helperText) && (
            <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#64748b', marginTop: 4, marginLeft: 8 }}>
              {hasError ? computedErrorMessage : helperText}
            </Text>
          )}
        </View>
      );
    }
    case 'googlemd3web': {
      return (
        <GoogleMD3WebTextInput
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          errorCheck={errorCheck}
          errorMessage={errorMessage}
          showError={showError}
          secureTextEntry={secureTextEntry}
          helperText={helperText}
          leftIcon={leftIcon}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={style}
          themeColors={themeColors}
          isDark={isDark}
        />
      );
    }

    case 'native':
    default: {
      return (
        <View style={[{ marginBottom: 12, width: '100%' }, style]}>
          {label && (
            <Text style={{ fontSize: 14, fontWeight: '500', color: themeColors.text, marginBottom: 4 }}>
              {label}
            </Text>
          )}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: hasError ? themeColors.error : isFocused ? themeColors.primary : themeColors.border,
              borderRadius: 6,
              paddingHorizontal: 12,
              backgroundColor: themeColors.surface,
              height: multiline ? undefined : 44,
              paddingVertical: multiline ? 8 : 0,
            }}
          >
            {left !== undefined && left}
            {left === undefined && leftIcon && <IconApp testID="ea20f134-7dfb-2e34-6ch8-901234567a20" name={leftIcon} size={18} color="#888" style={{ marginRight: 8 }} />}
            <TextInput
              value={currentValue}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              editable={!disabled}
              secureTextEntry={secureTextEntry}
              multiline={multiline}
              numberOfLines={numberOfLines}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                flex: 1,
                color: themeColors.text,
                fontSize: 15,
                opacity: disabled ? 0.6 : 1,
                outlineStyle: 'none',
                borderWidth: 0,
              } as any}
              {...(props as any)}
            />
            {right !== undefined && right}
            {right === undefined && showClearIcon && (
              <IconApp testID="ea20f134-7dfb-2e34-6ch8-901234567a19" name="close" size={18} color="#888" onPress={handleClear} />
            )}
          </View>
          {(hasError || helperText) && (
            <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#71717a', marginTop: 4 }}>
              {hasError ? computedErrorMessage : helperText}
            </Text>
          )}
        </View>
      );
    }
  }
};

export default TextInputApp;



