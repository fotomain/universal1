import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VENDOR_ITEMS, VariantVendorCard } from '../../common';

export interface MicrosoftVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function MicrosoftVendorCard({ isDark, onAction, style }: MicrosoftVendorCardProps) {
  return (
    <VariantVendorCard
      vendor={VENDOR_ITEMS.microsoft}
      variant="applemacui"
      isDark={isDark}
      onAction={onAction}
      style={style}
    />
  );
}
