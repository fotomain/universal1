import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import IconApp from '../IconApp';
import { TextAreaSubcomponentProps } from './types';

export const ExpoTextArea: React.FC<TextAreaSubcomponentProps> = ({
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
          alignItems: 'flex-start',
        }}
      >
        <TextInput
          value={currentValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          editable={!disabled}
          multiline={true}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            fontSize: 15,
            color: themeColors.text,
            outlineStyle: 'none',
            borderWidth: 0,
            textAlignVertical: 'top',
            minHeight: numberOfLines * 20,
          } as any}
        />
        {currentValue.length > 0 && !disabled && (
          <IconApp name="close" size={18} color="#64748b" onPress={onClear} style={{ marginLeft: 8, marginTop: 2 }} />
        )}
      </View>
      {(hasError || helperText) && (
        <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#64748b', marginTop: 4, marginLeft: 8 }}>
          {hasError ? computedErrorMessage : helperText}
        </Text>
      )}
    </View>
  );
};

export default ExpoTextArea;
