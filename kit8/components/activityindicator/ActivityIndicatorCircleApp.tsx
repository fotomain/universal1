import React from 'react';
import { ActivityIndicator, ActivityIndicatorProps } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';

export const ACTIVITY_INDICATOR_CIRCLE_APP_SIZE = 'large' as const;
export const PM_ACTIVITY_INDICATOR_SIZE = ACTIVITY_INDICATOR_CIRCLE_APP_SIZE;

export interface ActivityIndicatorCircleAppProps extends ActivityIndicatorProps {}

export function ActivityIndicatorCircleApp({
  size = ACTIVITY_INDICATOR_CIRCLE_APP_SIZE,
  color,
  ...rest
}: ActivityIndicatorCircleAppProps) {
  let themePrimary: string | undefined;
  try {
    const ds = useDesignSystem();
    themePrimary = ds?.themeColors?.primary;
  } catch {
    // Graceful fallback if rendered outside WithDesignSystem provider
    themePrimary = '#6366f1';
  }

  return <ActivityIndicator size={size} color={color ?? themePrimary ?? '#6366f1'} {...rest} />;
}

export default ActivityIndicatorCircleApp;
