import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface AndroidVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function AndroidVendorCard({ isDark, onAction, style }: AndroidVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.android}
      variant="ant"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
