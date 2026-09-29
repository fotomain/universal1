// Full-area loading spinner of the PM module: same as the main app's loaders
// (<ActivityIndicator size="large" color={theme primary} />, e.g. app/signin).
import React from 'react';
import { ActivityIndicator, ActivityIndicatorProps } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';

export const PM_ACTIVITY_INDICATOR_SIZE = 'large' as const;

export default function PMActivityIndicator({ size = PM_ACTIVITY_INDICATOR_SIZE, color, ...rest }: ActivityIndicatorProps) {
  const { themeColors } = useDesignSystem();
  return <ActivityIndicator size={size} color={color ?? themeColors.primary} {...rest} />;
}
