import React, { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { TextInputAppProps } from '../TextInputApp';
import IconApp from '../IconApp';
import loadMaterialWebCdn from './loadMaterialWebCdn';

const MdOutlinedTextField = 'md-outlined-text-field' as any;

export const GoogleMD3WebTextInput: React.FC<TextInputAppProps & { themeColors: any; isDark: boolean }> = ({
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
  multiline = false,
  numberOfLines = 1,
  themeColors,
  isDark,
  style,
}) => {
  const fieldRef = useRef<any>(null);

  const currentValue = typeof value === 'string' ? value : '';
  const checkResult = errorCheck ? errorCheck(currentValue) : null;
  const computedErrorMessage = errorMessage || (typeof error === 'string' ? error : '') || (typeof checkResult === 'string' ? checkResult : '');
  const hasError = Boolean(showError || error || (typeof checkResult === 'string' && checkResult.length > 0));

  useEffect(() => {
    if (Platform.OS === 'web' && fieldRef.current) {
      const elem = fieldRef.current;
      const handleInput = (e: any) => {
        if (onChangeText) {
          onChangeText(e.target.value);
        }
      };
      elem.addEventListener('input', handleInput);
      return () => {
        elem.removeEventListener('input', handleInput);
      };
    }
  }, [onChangeText]);

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginBottom: '16px', width: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Material 3 Web Outlined Text Field Custom Element */}
        <MdOutlinedTextField
          ref={fieldRef}
          label={label || ''}
          value={currentValue}
          placeholder={placeholder || ''}
          disabled={disabled ? true : undefined}
          error={hasError ? true : undefined}
          error-text={hasError ? computedErrorMessage : undefined}
          supporting-text={!hasError ? helperText || '' : undefined}
          type={secureTextEntry ? 'password' : 'text'}
          style={{
            width: '100%',
            '--md-outlined-text-field-container-shape': '8px',
            '--md-outlined-text-field-outline-color': themeColors.border,
            '--md-outlined-text-field-focus-outline-color': '#0b57d0',
            '--md-outlined-text-field-label-text-color': isDark ? '#94a3b8' : '#444746',
            '--md-outlined-text-field-focus-label-text-color': '#0b57d0',
            '--md-outlined-text-field-input-text-color': themeColors.text,
            fontFamily: 'Roboto, system-ui, sans-serif',
          }}
        >
          {currentValue.length > 0 && !disabled && (
            <div
              slot="trailing-icon"
              onClick={(e) => {
                e.stopPropagation();
                if (onChangeText) onChangeText('');
              }}
              style={{ cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <IconApp name="close" size={18} color="#757575" />
            </div>
          )}
        </MdOutlinedTextField>
      </div>
    );
  }

  // Fallback for non-web environments if accessed
  return (
    <View style={[{ marginBottom: 16, width: '100%' }, style]}>
      {label && <Text style={{ fontSize: 13, color: themeColors.text, marginBottom: 4 }}>{label}</Text>}
    </View>
  );
};

export default GoogleMD3WebTextInput;
