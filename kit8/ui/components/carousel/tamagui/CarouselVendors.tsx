import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import { VendorSlideConfig, CATEGORIES, VENDOR_ITEMS, openVendorWebsite } from '../common';
import ButtonApp from '../../common/ButtonApp';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';

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

interface CarouselVendorsProps {
  maxWidth?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  itemHeight?: number;
  showCategoryTabs?: boolean;
}

export default function CarouselVendors({
  maxWidth = 960,
  autoPlay = true,
  autoPlayInterval = 2500,
  itemHeight = 440,
  showCategoryTabs = true,
}: CarouselVendorsProps) {
  let isDark = false;
  let primaryColor = '#2563eb';
  let containerBg = '#f8fafc';
  let textColor = '#0f172a';
  let cardBorderColor = '#e2e8f0';
  let surfaceColor = '#ffffff';

  try {
    const ds = useDesignSystem();
    if (ds) {
      if (typeof ds.isDark === 'boolean') isDark = ds.isDark;
      if (ds.themeColors) {
        primaryColor = ds.themeColors.primary || primaryColor;
        containerBg = ds.themeColors.background || (isDark ? '#0b1120' : '#f8fafc');
        textColor = ds.themeColors.text || (isDark ? '#f8fafc' : '#0f172a');
        cardBorderColor = ds.themeColors.border || (isDark ? '#1e293b' : '#e2e8f0');
        surfaceColor = ds.themeColors.surface || (isDark ? '#131b2e' : '#ffffff');
      }
    }
  } catch {
    // fallback if outside provider
  }

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeVendorIndex, setActiveVendorIndex] = useState<number>(0);

  const filteredSlides = useMemo(() => {
    if (activeCategory === 'All') return VENDOR_SLIDES;
    return VENDOR_SLIDES.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  const handleAction = useCallback((slide: VendorSlideConfig) => {
    openVendorWebsite(slide.websiteUrl);
  }, []);

  const subtitleColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.rootContainer, { backgroundColor: containerBg }]}>
      <View style={[styles.responsiveWrapper, { maxWidth }]}>
        {/* Section Header */}
        <View style={styles.headerArea}>
          <View style={styles.kickerRow}>
            <MaterialCommunityIcons name="shield-crown" size={16} color={primaryColor} />
            <Text style={[styles.kickerText, { color: primaryColor }]}>
              ENTERPRISE STACK & ECOSYSTEM (TAMAGUI)
            </Text>
          </View>
          <Text style={[styles.heading, { color: textColor }]}>
            Technology Vendor Solutions
          </Text>
          <Text style={[styles.subheading, { color: subtitleColor }]}>
            High-availability cloud providers, frontier artificial intelligence, relational persistence, and universal runtime architecture.
          </Text>
        </View>

        {/* Category Filter Tabs */}
        {showCategoryTabs && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
            style={styles.filterScrollView}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat;
              return (
                <ButtonApp
                  key={cat}
                  title={cat}
                  variant={isSelected ? 'contained' : 'outlined'}
                  size="small"
                  active={isSelected}
                  onPress={() => setActiveCategory(cat)}
                  style={{ marginVertical: 0 }}
                />
              );
            })}
          </ScrollView>
        )}

        {/* The Reusable Carousel Component */}
        <CarouselApp
          data={filteredSlides}
          maxWidth={maxWidth}
          itemHeight={itemHeight}
          autoPlay={autoPlay}
          autoPlayInterval={autoPlayInterval}
          loop={filteredSlides.length > 1}
          showControls={true}
          showPagination={true}
          onIndexChange={(idx) => setActiveVendorIndex(idx)}
          renderItem={(slide: VendorSlideConfig) => {
            const SubComponent = slide.component;
            return (
              <View style={styles.slideItemContainer}>
                <SubComponent
                  isDark={isDark}
                  onAction={() => handleAction(slide)}
                />
              </View>
            );
          }}
        />

        {/* Business Confidence Trust Banner */}
        <View style={[styles.trustBanner, { borderColor: cardBorderColor, backgroundColor: surfaceColor }]}>
          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="check-decagram" size={20} color="#10b981" />
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: textColor }]}>Tier-1 Production Tested</Text>
              <Text style={[styles.trustDesc, { color: subtitleColor }]}>Zero-compromise SLA & reliability</Text>
            </View>
          </View>

          <View style={[styles.trustDivider, { backgroundColor: cardBorderColor }]} />

          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="lock-check" size={20} color={primaryColor} />
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: textColor }]}>SOC 2 & HIPAA Verified</Text>
              <Text style={[styles.trustDesc, { color: subtitleColor }]}>End-to-end enterprise compliance</Text>
            </View>
          </View>

          <View style={[styles.trustDivider, { backgroundColor: cardBorderColor }]} />

          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="speedometer" size={20} color="#8b5cf6" />
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: textColor }]}>Responsive Native Flow</Text>
              <Text style={[styles.trustDesc, { color: subtitleColor }]}>Max 960px width layout</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responsiveWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  headerArea: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 720,
  },
  filterScrollView: {
    marginBottom: 16,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  slideItemContainer: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 2,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 200,
  },
  trustTextCol: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  trustDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  trustDivider: {
    width: 1,
    height: 32,
  },
});
