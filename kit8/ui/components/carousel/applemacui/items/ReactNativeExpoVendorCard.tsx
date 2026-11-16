import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface ReactNativeExpoVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ReactNativeExpoVendorCard({ isDark, onAction, style }: ReactNativeExpoVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.reactNativeExpo}
      variant="applemacui"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
