import React from 'react';
import { Platform } from 'react-native';
import { useDesignSystem } from '../../context/DesignSystemContext';
import {
  GoogleMD3WebFAB,
  PaperFABApp,
  TamaguiFABApp,
  AntFABApp,
  ExpoFABApp,
  NativeFABApp,
} from './fab';

export interface FABAppProps {
  icon?: string;
  label?: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
  style?: any;
  testID?: string;
}

export const FABApp: React.FC<FABAppProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color,
  backgroundColor,
  disabled = false,
  style,
  testID,
}) => {
  const { activeSystem, themeColors } = useDesignSystem();
  const mainBg = backgroundColor || themeColors.primary;

  switch (activeSystem) {
    case 'googlemd3web': {
      if (Platform.OS === 'web') {
        return (
          <GoogleMD3WebFAB
            icon={icon}
            label={label}
            onPress={onPress}
            size={size}
            color={color}
            backgroundColor={backgroundColor}
            disabled={disabled}
            style={style}
            testID={testID}
          />
        );
      }
      return (
        <PaperFABApp
          icon={icon}
          label={label}
          onPress={onPress}
          size={size}
          color={color}
          backgroundColor={mainBg}
          disabled={disabled}
          style={style}
          testID={testID}
        />
      );
    }

    case 'tamagui': {
      return (
        <TamaguiFABApp
          icon={icon}
          label={label}
          onPress={onPress}
          size={size}
          color={color}
          backgroundColor={mainBg}
          disabled={disabled}
          style={style}
          testID={testID}
        />
      );
    }

    case 'ant': {
      return (
        <AntFABApp
          icon={icon}
          label={label}
          onPress={onPress}
          size={size}
          color={color}
          backgroundColor={mainBg}
          disabled={disabled}
          style={style}
          testID={testID}
        />
      );
    }

    case 'expo': {
      return (
        <ExpoFABApp
          icon={icon}
          label={label}
          onPress={onPress}
          size={size}
          color={color}
          backgroundColor={mainBg}
          disabled={disabled}
          style={style}
          testID={testID}
        />
      );
    }

    case 'paper': {
      return (
        <PaperFABApp
          icon={icon}
          label={label}
          onPress={onPress}
          size={size}
          color={color}
          backgroundColor={mainBg}
          disabled={disabled}
          style={style}
          testID={testID}
        />
      );
    }

    case 'native':
    default: {
      return (
        <NativeFABApp
          icon={icon}
          label={label}
          onPress={onPress}
          size={size}
          color={color}
          backgroundColor={mainBg}
          disabled={disabled}
          style={style}
          testID={testID}
        />
      );
    }
  }
};

export default FABApp;
