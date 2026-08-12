import React from 'react';
import { FAB as PaperFAB } from 'react-native-paper';
import IconApp from '../IconApp';

export interface TamaguiFABAppProps {
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

export const TamaguiFABApp: React.FC<TamaguiFABAppProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color = '#ffffff',
  backgroundColor = '#ec4899',
  disabled = false,
  style,
  testID,
}) => {
  return (
    <PaperFAB
      testID={testID}
      icon={typeof icon === 'string' ? icon : (() => <IconApp testID="e086579a-3df1-8e90-2in4-567890123a25" name={icon} color={color} />)}
      label={label}
      onPress={onPress}
      disabled={disabled}
      color={color}
      size={size === 'large' ? 'medium' : size}
      style={[
        {
          backgroundColor,
          borderRadius: label ? 28 : 24,
          elevation: 6,
        },
        style,
      ]}
    />
  );
};

export default TamaguiFABApp;
