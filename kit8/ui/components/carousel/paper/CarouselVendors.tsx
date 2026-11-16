import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Text,
  Chip,
  Surface,
  useTheme,
  Divider,
} from 'react-native-paper';
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
  const theme = useTheme();

  let isDark = false;
  try {
    const ds = useDesignSystem();
    if (ds && typeof ds.isDark === 'boolean') {
      isDark = ds.isDark;
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

  return (
    <Surface
      style={[styles.rootContainer, { backgroundColor: theme.colors.background }]}
      elevation={0}
    >
      <View style={[styles.responsiveWrapper, { maxWidth }]}>

        {/* Section Header */}
        <View style={styles.headerArea}>
          <View style={styles.kickerRow}>
            <MaterialCommunityIcons name="shield-crown" size={16} color={theme.colors.primary} />
            <Text
              variant="labelSmall"
              style={[styles.kickerText, { color: theme.colors.primary }]}
            >
              ENTERPRISE STACK & ECOSYSTEM (PAPER)
            </Text>
          </View>

          <Text
            variant="headlineMedium"
            style={[styles.heading, { color: theme.colors.onBackground }]}
          >
            Technology Vendor Solutions
          </Text>

          <Text
            variant="bodyMedium"
            style={[styles.subheading, { color: theme.colors.onSurfaceVariant }]}
          >
            High-availability cloud providers, frontier artificial intelligence, relational
            persistence, and universal runtime architecture.
          </Text>
        </View>

        {/* Category Filter — Theme-adaptive buttons */}
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

        {/* Reusable Carousel */}
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

        {/* Trust Banner — Paper Surface */}
        <Surface
          style={[styles.trustBanner, { borderColor: theme.colors.outlineVariant }]}
          elevation={1}
        >
          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="check-decagram" size={20} color="#10b981" />
            <View style={styles.trustTextCol}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                Tier-1 Production Tested
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Zero-compromise SLA & reliability
              </Text>
            </View>
          </View>

          <Divider style={[styles.trustDivider, { backgroundColor: theme.colors.outlineVariant }]} />

          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="lock-check" size={20} color={theme.colors.primary} />
            <View style={styles.trustTextCol}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                SOC 2 & HIPAA Verified
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                End-to-end enterprise compliance
              </Text>
            </View>
          </View>

          <Divider style={[styles.trustDivider, { backgroundColor: theme.colors.outlineVariant }]} />

          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="speedometer" size={20} color="#8b5cf6" />
            <View style={styles.trustTextCol}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                Responsive Native Flow
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Max 960px width layout
              </Text>
            </View>
          </View>
        </Surface>

      </View>
    </Surface>
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
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heading: {
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subheading: {
    maxWidth: 720,
    lineHeight: 20,
  },
  filterScrollView: {
    marginBottom: 16,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    borderRadius: 20,
  },
  filterChipText: {
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
    gap: 2,
  },
  trustDivider: {
    width: 1,
    height: 32,
    alignSelf: 'center',
  },
});
