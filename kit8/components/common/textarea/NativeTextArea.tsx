import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import IconApp from '../IconApp';
import { TextAreaSubcomponentProps } from './types';

export const NativeTextArea: React.FC<TextAreaSubcomponentProps> = ({
  label,
  value = '',
  onChangeText,
  placeholder,
  disabled = false,
  error: hasError,
  computedErrorMessage,
  helperText,
  numberOfLines = 3,
  themeColors,
  isDark = false,
  style,
  onClear,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const currentValue = typeof value === 'string' ? value : '';

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
          alignItems: 'flex-start',
          borderWidth: 1,
          borderColor: hasError ? themeColors.error : isFocused ? themeColors.primary : themeColors.border,
          borderRadius: 6,
          paddingHorizontal: 12,
          backgroundColor: themeColors.surface,
          paddingVertical: 8,
        }}
      >
        <TextInput
          value={currentValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
          editable={!disabled}
          multiline={true}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            color: themeColors.text,
            fontSize: 15,
            opacity: disabled ? 0.6 : 1,
            outlineStyle: 'none',
            borderWidth: 0,
            textAlignVertical: 'top',
            minHeight: numberOfLines * 20,
          } as any}
        />
        {currentValue.length > 0 && !disabled && (
          <IconApp testID="a20879bc-5fd3-0ab2-4kp6-789012345c27" name="close" size={18} color="#888" onPress={onClear} style={{ marginLeft: 8, marginTop: 2 }} />
        )}
      </View>
      {(hasError || helperText) && (
        <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#71717a', marginTop: 4 }}>
          {hasError ? computedErrorMessage : helperText}
        </Text>
      )}
    </View>
  );
};

export default NativeTextArea;
