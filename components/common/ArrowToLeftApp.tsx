import React from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { useDesignSystem } from '../../context/DesignSystemContext';
import { MaterialSymbol } from './iconsvariants/MaterialSymbol';
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
  const { activeSystem, themeColors } = useDesignSystem();
  const iconColor = color || themeColors.text;

  const renderIcon = () => {
    if (activeSystem === 'paper') {
      return <IconApp testID="f3b98c2d-0e4a-5f67-9b01-234567890b02" name="arrow-left" size={size} color={iconColor} style={style} />;
    }

    // Fallback to MaterialSymbol for all design systems
    return (
      <MaterialSymbol
        name="arrow_back"
        size={size}
        color={iconColor}
        style={style as any}
      />
    );
  };

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
