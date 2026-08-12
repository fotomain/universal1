import React from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { useDesignSystem } from '../../kit8/providers/DesignSystemContext';
import IconApp from './IconApp';

export interface ArrowToLeftAppProps {
  size?: number;
  color?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ArrowToLeftApp: React.FC<ArrowToLeftAppProps> = ({
  size = 24,
  color,
  onPress,
  style,
}) => {
  const { themeColors } = useDesignSystem();
  const iconColor = color || themeColors.text;

  const renderIcon = () => (
    <IconApp
      testID="f3b98c2d-0e4a-5f67-9b01-234567890b02"
      name="arrow_back"
      size={size}
      color={iconColor}
      style={style}
    />
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
        {renderIcon()}
      </TouchableOpacity>
    );
  }

  return renderIcon();
};

export default ArrowToLeftApp;
