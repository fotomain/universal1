import React from 'react';
import { FAB as PaperFAB } from 'react-native-paper';
import IconApp from '../IconApp';

export interface NativeFABAppProps {
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

export const NativeFABApp: React.FC<NativeFABAppProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color = '#ffffff',
  backgroundColor = '#8b5cf6',
  disabled = false,
  style,
  testID,
}) => {
  return (
    <PaperFAB
      testID={testID}
      icon={typeof icon === 'string' ? icon : (() => <IconApp testID="ce643578-1bdf-6c78-0gl2-345678901e23" name={icon} color={color} />)}
      label={label}
      onPress={onPress}
      disabled={disabled}
      color={color}
      size={size === 'large' ? 'medium' : size}
      style={[
        {
          backgroundColor,
          borderRadius: label ? 28 : 16,
          elevation: 5,
        },
        style,
      ]}
    />
  );
};

export default NativeFABApp;
