import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import IconApp from '../IconApp';
import { TextAreaSubcomponentProps } from './types';

export const TamaguiTextArea: React.FC<TextAreaSubcomponentProps> = ({
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
    <View style={[{ marginBottom: 14, width: '100%' }, style]}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: themeColors.text,
            marginBottom: 6,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
          borderWidth: isFocused ? 2 : 1,
          borderColor: hasError ? themeColors.error : isFocused ? '#6366f1' : '#e5e7eb',
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <TextInput
          value={currentValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
          editable={!disabled}
          multiline={true}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            fontSize: 15,
            color: themeColors.text,
            fontFamily: 'System',
            minHeight: numberOfLines * 20,
            outlineStyle: 'none',
            borderWidth: 0,
            textAlignVertical: 'top',
          } as any}
        />
        {currentValue.length > 0 && !disabled && (
          <IconApp testID="b3198acd-6ae4-1bc3-5lq7-890123456d28" name="close" size={18} color="#888" onPress={onClear} style={{ marginLeft: 8, marginTop: 2 }} />
        )}
      </View>
      {(hasError || helperText) && (
        <Text
          style={{
            fontSize: 12,
            color: hasError ? themeColors.error : '#6b7280',
            marginTop: 4,
            marginLeft: 2,
          }}
        >
          {hasError ? computedErrorMessage : helperText}
        </Text>
      )}
    </View>
  );
};

export default TamaguiTextArea;
