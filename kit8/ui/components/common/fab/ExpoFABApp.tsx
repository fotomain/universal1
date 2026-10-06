import React from 'react';
import { FAB as PaperFAB } from 'react-native-paper';
import IconApp from '../IconApp';

export interface ExpoFABAppProps {
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

export const ExpoFABApp: React.FC<ExpoFABAppProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color = '#ffffff',
  backgroundColor = '#f59e0b',
  disabled = false,
  style,
  testID,
}) => {
  return (
    <PaperFAB
      testID={testID}
      icon={typeof icon === 'string' ? icon : (() => <IconApp testID="ac421356-9fbd-4a56-8ej0-123456789c21" name={icon} color={color} />)}
      label={label}
      onPress={onPress}
      disabled={disabled}
      color={color}
      size={size === 'large' ? 'medium' : size}
      style={[
        {
          backgroundColor,
          borderRadius: label ? 24 : 20,
          elevation: 5,
        },
        style,
      ]}
    />
  );
};

export default ExpoFABApp;
