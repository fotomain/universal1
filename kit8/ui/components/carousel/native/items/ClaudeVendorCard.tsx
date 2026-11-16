import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface ClaudeVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ClaudeVendorCard({ isDark, onAction, style }: ClaudeVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.claude}
      variant="native"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
