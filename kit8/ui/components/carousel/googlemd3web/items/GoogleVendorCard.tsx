import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface GoogleVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function GoogleVendorCard({ isDark, onAction, style }: GoogleVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.google}
      variant="googlemd3web"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
