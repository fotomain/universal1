import React, { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { ButtonAppProps } from '../ButtonApp';
import loadMaterialWebCdn from './loadMaterialWebCdn';

const MdFilledButton = 'md-filled-button' as any;
const MdOutlinedButton = 'md-outlined-button' as any;
const MdTextButton = 'md-text-button' as any;

export const GoogleMD3WebButton: React.FC<ButtonAppProps & { themeColors: any; isDark: boolean }> = ({
  title,
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'contained',
  size = 'medium',
  themeColors,
  isDark,
  style,
}) => {
  const btnRef = useRef<any>(null);
  const buttonText = title || children || '';

  useEffect(() => {
    if (Platform.OS === 'web' && btnRef.current) {
      const elem = btnRef.current;
      const handleClick = (e: any) => {
        if (onPress && !disabled && !loading) {
          onPress();
        }
      };
      elem.addEventListener('click', handleClick);
      return () => {
        elem.removeEventListener('click', handleClick);
      };
    }
  }, [onPress, disabled, loading]);

  if (Platform.OS === 'web') {
    const commonStyle = {
      margin: '4px 0',
      fontFamily: 'Roboto, system-ui, sans-serif',
      '--md-filled-button-container-shape': '20px',
      '--md-outlined-button-container-shape': '20px',
      '--md-text-button-container-shape': '20px',
      '--md-filled-button-container-color': '#0b57d0',
      '--md-outlined-button-outline-color': '#0b57d0',
      '--md-outlined-button-label-text-color': '#0b57d0',
      '--md-text-button-label-text-color': '#0b57d0',
    };

    if (variant === 'outlined') {
      return (
        <MdOutlinedButton
          ref={btnRef}
          disabled={disabled || loading ? true : undefined}
          style={commonStyle}
        >
          {loading ? 'Loading...' : buttonText}
        </MdOutlinedButton>
      );
    }

    if (variant === 'text') {
      return (
        <MdTextButton
          ref={btnRef}
          disabled={disabled || loading ? true : undefined}
          style={commonStyle}
        >
          {loading ? 'Loading...' : buttonText}
        </MdTextButton>
      );
    }

    // Default: Filled Button
    return (
      <MdFilledButton
        ref={btnRef}
        disabled={disabled || loading ? true : undefined}
        style={commonStyle}
      >
        {loading ? 'Loading...' : buttonText}
      </MdFilledButton>
    );
  }

  return (
    <View style={[{ marginVertical: 4 }, style]}>
      <Text>{buttonText}</Text>
    </View>
  );
};

export default GoogleMD3WebButton;
