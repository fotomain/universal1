import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface SwiftVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function SwiftVendorCard({ isDark, onAction, style }: SwiftVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.swift}
      variant="ant"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
