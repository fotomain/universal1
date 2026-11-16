import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface PostgreSqlVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function PostgreSqlVendorCard({ isDark, onAction, style }: PostgreSqlVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.postgresql}
      variant="native"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
