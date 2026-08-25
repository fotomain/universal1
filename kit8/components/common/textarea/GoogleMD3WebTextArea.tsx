import React from 'react';
import GoogleMD3WebTextInput from '../googlemd3web/GoogleMD3WebTextInput';
import { TextAreaSubcomponentProps } from './types';

export const GoogleMD3WebTextArea: React.FC<TextAreaSubcomponentProps> = ({
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
}) => {
  return (
    <GoogleMD3WebTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      disabled={disabled}
      error={hasError}
      errorMessage={computedErrorMessage}
      helperText={helperText}
      multiline={true}
      numberOfLines={numberOfLines}
      style={style}
      themeColors={themeColors}
      isDark={isDark}
    />
  );
};

export default GoogleMD3WebTextArea;
