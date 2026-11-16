import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface AppleVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function AppleVendorCard({ isDark, onAction, style }: AppleVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.apple}
      variant="native"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
