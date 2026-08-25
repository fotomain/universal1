import React from 'react';
import { View } from 'react-native';
import { TextInput as PaperTextInput, HelperText as PaperHelperText } from 'react-native-paper';
import IconApp from '../IconApp';
import { TextAreaSubcomponentProps } from './types';

export const PaperTextArea: React.FC<TextAreaSubcomponentProps> = ({
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
    <View style={[{ marginBottom: 12, width: '100%' }, style]}>
      <PaperTextInput
        mode="outlined"
        label={label}
        value={currentValue}
        onChangeText={onChangeText}
        placeholder={placeholder}
        disabled={disabled}
        error={!!hasError}
        multiline={true}
        numberOfLines={numberOfLines}
        outlineColor={themeColors.border}
        activeOutlineColor={themeColors.primary}
        style={{ backgroundColor: themeColors.surface, minHeight: numberOfLines * 24 }}
        right={
          currentValue.length > 0 && !disabled ? (
            <PaperTextInput.Icon
              icon="close"
              onPress={onClear}
              forceTextInputFocus={false}
            />
          ) : undefined
        }
      />
      {(hasError || helperText) && (
        <PaperHelperText type={hasError ? 'error' : 'info'} visible={true}>
          {hasError && computedErrorMessage ? computedErrorMessage : helperText || ' '}
        </PaperHelperText>
      )}
    </View>
  );
};

export default PaperTextArea;
