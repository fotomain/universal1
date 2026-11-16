import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VendorSlideConfig } from './types';
import { CATEGORIES } from './vendorData';
import { openVendorWebsite } from './openVendorWebsite';
import ButtonApp from '../../common/ButtonApp';
import { DesignSystemType, useDesignSystem } from '../../../../providers/WithDesignSystem';

export interface VariantCarouselVendorsProps {
  designVariant: DesignSystemType;
  designLabel: string;
  slides: VendorSlideConfig[];
  CarouselComponent: React.ComponentType<any>;
  maxWidth?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  itemHeight?: number;
  showCategoryTabs?: boolean;
}

export default function VariantCarouselVendors({
  designVariant,
  designLabel,
  slides,
  CarouselComponent,
  maxWidth = 960,
  autoPlay = true,
  autoPlayInterval = 2500,
  itemHeight = 440,
  showCategoryTabs = true,
}: VariantCarouselVendorsProps) {
  let isDark = false;
  let primaryColor =
    designVariant === 'applemacui'
      ? '#007AFF'
      : designVariant === 'ant'
      ? '#1677ff'
      : designVariant === 'expo'
      ? '#f59e0b'
      : designVariant === 'googlemd3web'
      ? '#00639B'
      : '#8b5cf6';
  let containerBg = '#f8fafc';
  let textColor = '#0f172a';
  let cardBorderColor = '#e2e8f0';
  let surfaceColor = '#ffffff';

  try {
    const ds = useDesignSystem();
    if (ds) {
      isDark = ds.isDark;
      if (ds.themeColors) {
        primaryColor = ds.themeColors.primary || primaryColor;
        containerBg =
          designVariant === 'applemacui'
            ? isDark
              ? '#000000'
              : '#F2F2F7'
            : ds.themeColors.background || (isDark ? '#0b1120' : '#f8fafc');
        textColor = ds.themeColors.text || (isDark ? '#f8fafc' : '#0f172a');
        cardBorderColor = ds.themeColors.border || (isDark ? '#1e293b' : '#e2e8f0');
        surfaceColor =
          designVariant === 'applemacui'
            ? isDark
              ? '#1C1C1E'
              : '#FFFFFF'
            : ds.themeColors.surface || (isDark ? '#131b2e' : '#ffffff');
      }
    }
  } catch {
    // outside provider fallback
  }

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeVendorIndex, setActiveVendorIndex] = useState<number>(0);

  const filteredSlides = useMemo(() => {
    if (activeCategory === 'All') return slides;
    return slides.filter((s) => s.category === activeCategory);
  }, [activeCategory, slides]);

  const handleAction = useCallback((slide: VendorSlideConfig) => {
    openVendorWebsite(slide.websiteUrl);
  }, []);

  const subtitleColor = isDark ? '#94a3b8' : '#64748b';
  const pillRadius =
    designVariant === 'ant' || designVariant === 'native'
      ? 6
      : designVariant === 'applemacui'
      ? 10
      : 20;

  return (
    <View style={[styles.rootContainer, { backgroundColor: containerBg }]}>
      <View style={[styles.responsiveWrapper, { maxWidth }]}>
        {/* Section Header */}
        <View style={styles.headerArea}>
          <View style={styles.kickerRow}>
            <MaterialCommunityIcons name="shield-crown" size={16} color={primaryColor} />
            <Text style={[styles.kickerText, { color: primaryColor }]}>
              ENTERPRISE STACK & ECOSYSTEM ({designLabel})
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

        {/* Carousel */}
        <CarouselComponent
          data={filteredSlides}
          maxWidth={maxWidth}
          itemHeight={itemHeight}
          autoPlay={autoPlay}
          autoPlayInterval={autoPlayInterval}
          loop={filteredSlides.length > 1}
          showControls={true}
          showPagination={true}
          onIndexChange={(idx: number) => setActiveVendorIndex(idx)}
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
        <View
          style={[
            styles.trustBanner,
            {
              borderColor: cardBorderColor,
              backgroundColor: surfaceColor,
              borderRadius: designVariant === 'ant' || designVariant === 'native' ? 8 : 14,
            },
          ]}
        >
          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="check-decagram" size={20} color="#10b981" />
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: textColor }]}>
                Tier-1 Production Tested
              </Text>
              <Text style={[styles.trustDesc, { color: subtitleColor }]}>
                Zero-compromise SLA & reliability
              </Text>
            </View>
          </View>

          <View style={[styles.trustDivider, { backgroundColor: cardBorderColor }]} />

          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="lock-check" size={20} color={primaryColor} />
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: textColor }]}>
                SOC 2 & HIPAA Verified
              </Text>
              <Text style={[styles.trustDesc, { color: subtitleColor }]}>
                End-to-end enterprise compliance
              </Text>
            </View>
          </View>

          <View style={[styles.trustDivider, { backgroundColor: cardBorderColor }]} />

          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="speedometer" size={20} color="#8b5cf6" />
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: textColor }]}>
                Responsive Native Flow
              </Text>
              <Text style={[styles.trustDesc, { color: subtitleColor }]}>
                Max 960px width layout
              </Text>
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
