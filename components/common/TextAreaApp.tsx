import React from 'react';
import { useDesignSystem } from '../../kit8/providers/DesignSystemContext';
import { TextInputAppProps } from './TextInputApp';
import {
  PaperTextArea,
  TamaguiTextArea,
  AntTextArea,
  ExpoTextArea,
  NativeTextArea,
  GoogleMD3WebTextArea,
} from './textarea';

export interface TextAreaAppProps extends Omit<TextInputAppProps, 'multiline'> {
  numberOfLines?: number;
}

export const TextAreaApp: React.FC<TextAreaAppProps> = ({
  label,
  value = '',
  onChangeText,
  placeholder,
  disabled = false,
  error,
  errorCheck,
  errorMessage,
  showError,
  helperText,
  numberOfLines = 3,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  ...props
}) => {
  const { activeSystem, themeColors, isDark } = useDesignSystem();

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

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  const sharedProps = {
    label,
    value: currentValue,
    onChangeText,
    placeholder,
    disabled,
    error: hasError,
    computedErrorMessage,
    helperText,
    numberOfLines,
    themeColors,
    isDark,
    style,
    onClear: handleClear,
  };

  switch (activeSystem) {
    case 'paper':
      return <PaperTextArea {...sharedProps} />;
    case 'tamagui':
      return <TamaguiTextArea {...sharedProps} />;
    case 'ant':
      return <AntTextArea {...sharedProps} />;
    case 'expo':
      return <ExpoTextArea {...sharedProps} />;
    case 'googlemd3web':
      return <GoogleMD3WebTextArea {...sharedProps} />;
    case 'native':
    default:
      return <NativeTextArea {...sharedProps} />;
  }
};

export default TextAreaApp;
