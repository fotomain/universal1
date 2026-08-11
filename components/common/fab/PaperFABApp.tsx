import React from 'react';
import { FAB as PaperFAB } from 'react-native-paper';
import IconApp from '../IconApp';

export interface PaperFABAppProps {
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

export const PaperFABApp: React.FC<PaperFABAppProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color = '#ffffff',
  backgroundColor = '#6366f1',
  disabled = false,
  style,
  testID,
}) => {
  return (
    <PaperFAB
      testID={testID}
      icon={typeof icon === 'string' ? icon : (() => <IconApp testID="df754689-2ce0-7d89-1hm3-456789012f24" name={icon} color={color} />)}
      label={label}
      onPress={onPress}
      disabled={disabled}
      color={color}
      size={size === 'large' ? 'medium' : size}
      style={[
        {
          backgroundColor,
          borderRadius: label ? 28 : 16,
        },
        style,
      ]}
    />
  );
};

export default PaperFABApp;
