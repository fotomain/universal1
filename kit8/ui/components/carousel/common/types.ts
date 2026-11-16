import React from 'react';
import { StyleProp, ViewStyle, ImageSourcePropType } from 'react-native';
import { DesignSystemType } from '../../../../providers/WithDesignSystem';

export type VendorCategory =
  | 'Cloud'
  | 'Database'
  | 'AI'
  | 'Framework'
  | 'Platform'
  | 'Language'
  | 'Design';

export interface VendorStat {
  label: string;
  value: string;
}

export interface VendorItemData {
  id: string;
  name: string;
  subtitle: string;
  category: VendorCategory;
  tagline: string;
  description: string;
  badge: string;
  tier: string;
  color: string;
  accentBg: string;
  svgXml: string;
  iconSource?: ImageSourcePropType;
  stats: VendorStat[];
  features: string[];
  compliance: string[];
  ctaLabel: string;
  websiteUrl: string;
}

export interface CarouselAppProps<T = any> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  keyExtractor?: (item: T, index: number) => string;
  maxWidth?: number;
  itemHeight?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  loop?: boolean;
  showPagination?: boolean;
  showControls?: boolean;
  onIndexChange?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /** Optional explicit design system override; defaults to auto-detecting from Settings */
  variant?: DesignSystemType;
}

export interface VendorSlideConfig {
  id: string;
  name: string;
  category: VendorCategory;
  websiteUrl: string;
  component: React.ComponentType<{ isDark?: boolean; onAction?: () => void }>;
}
