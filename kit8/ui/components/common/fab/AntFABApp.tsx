import React from 'react';
import { FAB as PaperFAB } from 'react-native-paper';
import IconApp from '../IconApp';

export interface AntFABAppProps {
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

export const AntFABApp: React.FC<AntFABAppProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color = '#ffffff',
  backgroundColor = '#10b981',
  disabled = false,
  style,
  testID,
}) => {
  return (
    <PaperFAB
      testID={testID}
      icon={typeof icon === 'string' ? icon : (() => <IconApp testID="fb310245-8eac-3f45-7di9-012345678b20" name={icon} color={color} />)}
      label={label}
      onPress={onPress}
      disabled={disabled}
      color={color}
      size={size === 'large' ? 'medium' : size}
      style={[
        {
          backgroundColor,
          borderRadius: label ? 20 : 28,
          elevation: 4,
        },
        style,
      ]}
    />
  );
};

export default AntFABApp;
