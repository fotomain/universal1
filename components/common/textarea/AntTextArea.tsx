import React from 'react';
import { View, Text } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { TextAreaSubcomponentProps } from './types';

let AntTextareaItem: any = null;
try {
  AntTextareaItem = require('@ant-design/react-native').TextareaItem;
} catch (e) {
  try {
    AntTextareaItem = require('@ant-design/react-native/lib/textarea-item').default;
  } catch (e2) {
    AntTextareaItem = null;
  }
}

export const AntTextArea: React.FC<TextAreaSubcomponentProps> = ({
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
  style,
  onClear,
}) => {
  const currentValue = typeof value === 'string' ? value : '';

  if (AntTextareaItem) {
    try {
      return (
        <View style={[{ marginBottom: 14, width: '100%' }, style]}>
          <AntTextareaItem
            title={label}
            value={currentValue}
            onChange={(val?: string) => onChangeText?.(val ?? '')}
            placeholder={placeholder}
            editable={!disabled}
            rows={numberOfLines}
            clear={!!onClear}
            error={!!hasError}
            autoHeight={false}
          />
          {(hasError || helperText) && (
            <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#999', marginTop: 4, marginLeft: 4 }}>
              {hasError ? computedErrorMessage : helperText}
            </Text>
          )}
        </View>
      );
    } catch (err) {
      // fallback to react-native-paper
    }
  }

  // Fallback to react-native-paper if ant-design component not enough
  return (
    <View style={[{ marginBottom: 14, width: '100%' }, style]}>
      <PaperTextInput
        mode="outlined"
        label={label}
        value={currentValue}
        onChangeText={onChangeText}
        placeholder={placeholder}
        disabled={disabled}
        error={Boolean(hasError)}
        multiline={true}
        numberOfLines={numberOfLines}
        outlineColor={themeColors.border}
        activeOutlineColor={themeColors.primary || '#1677ff'}
        style={{ backgroundColor: themeColors.surface }}
      />
      {(hasError || helperText) && (
        <Text style={{ fontSize: 12, color: hasError ? themeColors.error : '#999', marginTop: 4, marginLeft: 4 }}>
          {hasError ? computedErrorMessage : helperText}
        </Text>
      )}
    </View>
  );
};

export default AntTextArea;
