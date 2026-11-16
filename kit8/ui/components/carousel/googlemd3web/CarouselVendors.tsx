import React from 'react';
import CarouselApp from './CarouselApp';
import {
  GoogleVendorCard,
  MicrosoftVendorCard,
  PostgreSqlVendorCard,
  ClaudeVendorCard,
  ReactNativeExpoVendorCard,
  AppleVendorCard,
  SwiftVendorCard,
  MaterialYouVendorCard,
  AndroidVendorCard,
  GoogleAntigravityVendorCard,
} from './items';
import { VendorSlideConfig, VENDOR_ITEMS, VariantCarouselVendors } from '../common';

export const VENDOR_SLIDES: VendorSlideConfig[] = [
  {
    id: 'google',
    name: 'Google Cloud',
    category: 'Cloud',
    websiteUrl: VENDOR_ITEMS.google.websiteUrl,
    component: GoogleVendorCard,
  },
  {
    id: 'microsoft',
    name: 'Microsoft Azure',
    category: 'Cloud',
    websiteUrl: VENDOR_ITEMS.microsoft.websiteUrl,
    component: MicrosoftVendorCard,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'Database',
    websiteUrl: VENDOR_ITEMS.postgresql.websiteUrl,
    component: PostgreSqlVendorCard,
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    category: 'AI',
    websiteUrl: VENDOR_ITEMS.claude.websiteUrl,
    component: ClaudeVendorCard,
  },
  {
    id: 'react-native-expo',
    name: 'React Native & Expo',
    category: 'Framework',
    websiteUrl: VENDOR_ITEMS.reactNativeExpo.websiteUrl,
    component: ReactNativeExpoVendorCard,
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'Platform',
    websiteUrl: VENDOR_ITEMS.apple.websiteUrl,
    component: AppleVendorCard,
  },
  {
    id: 'swift',
    name: 'Swift Language',
    category: 'Language',
    websiteUrl: VENDOR_ITEMS.swift.websiteUrl,
    component: SwiftVendorCard,
  },
  {
    id: 'google-material-you',
    name: 'Google Material You',
    category: 'Design',
    websiteUrl: VENDOR_ITEMS.materialYou.websiteUrl,
    component: MaterialYouVendorCard,
  },
  {
    id: 'android',
    name: 'Android',
    category: 'Platform',
    websiteUrl: VENDOR_ITEMS.android.websiteUrl,
    component: AndroidVendorCard,
  },
  {
    id: 'google-antigravity',
    name: 'Google Antigravity',
    category: 'AI',
    websiteUrl: VENDOR_ITEMS.googleAntigravity.websiteUrl,
    component: GoogleAntigravityVendorCard,
  },
];

export interface CarouselVendorsProps {
  maxWidth?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  itemHeight?: number;
  showCategoryTabs?: boolean;
}

export default function CarouselVendors(props: CarouselVendorsProps) {
  return (
    <VariantCarouselVendors
      {...props}
      designVariant="googlemd3web"
      designLabel="GOOGLE MD3 WEB"
      slides={VENDOR_SLIDES}
      CarouselComponent={CarouselApp}
    />
  );
}
