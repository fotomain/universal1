import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import ButtonApp from '../../common/ButtonApp';

export interface ThemeButtonProps {
  title?: string;
  onPress?: () => void;
  mode?: 'contained' | 'outlined';
  size?: 'small' | 'medium';
  icon?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export default function ThemeButton({
  title,
  onPress = () => {},
  mode = 'contained',
  size = 'small',
  icon,
  style,
  testID,
  accessibilityLabel,
}: ThemeButtonProps) {
  return (
    <ButtonApp
      testID={testID}
      title={title}
      onPress={onPress}
      variant={mode}
      size={size}
      icon={icon}
      accessibilityLabel={accessibilityLabel}
      style={[{ marginVertical: 0 }, style]}
    />
  );
}
