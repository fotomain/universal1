import React from 'react';
import { View, Text } from 'react-native';
import { TextareaItem } from 'antd-mobile-rn';
import { TextAreaSubcomponentProps } from './types';

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

  return (
    <View style={[{ marginBottom: 14, width: '100%' }, style]}>
      <TextareaItem
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
};

export default AntTextArea;
