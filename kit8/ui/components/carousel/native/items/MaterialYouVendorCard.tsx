import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface MaterialYouVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function MaterialYouVendorCard({ isDark, onAction, style }: MaterialYouVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.materialYou}
      variant="native"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
