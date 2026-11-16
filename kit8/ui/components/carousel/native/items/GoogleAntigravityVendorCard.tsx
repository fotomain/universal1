import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface GoogleAntigravityVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function GoogleAntigravityVendorCard({ isDark, onAction, style }: GoogleAntigravityVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.googleAntigravity}
      variant="native"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
