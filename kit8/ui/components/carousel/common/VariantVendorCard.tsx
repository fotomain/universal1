import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SvgXml } from 'react-native-svg';
import { VendorItemData } from './types';
import { openVendorWebsite } from './openVendorWebsite';
import ButtonApp from '../../common/ButtonApp';
import { DesignSystemType, useDesignSystem } from '../../../../providers/WithDesignSystem';

export interface VariantVendorCardProps {
  vendor: VendorItemData;
  variant: DesignSystemType;
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_PALETTES: Record<
  string,
  {
    radius: number;
    borderWidth: number;
    accentColor: string;
    pillRadius: number;
    btnRadius: number;
    headerBand: boolean;
  }
> = {
  applemacui: {
    radius: 14,
    borderWidth: 0.5,
    accentColor: '#007AFF',
    pillRadius: 10,
    btnRadius: 20,
    headerBand: false,
  },
  ant: {
    radius: 8,
    borderWidth: 1,
    accentColor: '#1677ff',
    pillRadius: 4,
    btnRadius: 6,
    headerBand: true,
  },
  expo: {
    radius: 22,
    borderWidth: 1.5,
    accentColor: '#f59e0b',
    pillRadius: 12,
    btnRadius: 14,
    headerBand: false,
  },
  googlemd3web: {
    radius: 24,
    borderWidth: 1,
    accentColor: '#00639B',
    pillRadius: 999,
    btnRadius: 999,
    headerBand: false,
  },
  native: {
    radius: 6,
    borderWidth: 1,
    accentColor: '#8b5cf6',
    pillRadius: 4,
    btnRadius: 6,
    headerBand: false,
  },
};

export default function VariantVendorCard({
  vendor,
  variant,
  isDark: propIsDark,
  onAction,
  style,
}: VariantVendorCardProps) {
  let isDark = propIsDark ?? false;
  let themeColors = {
    primary: '#2563eb',
    background: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    border: isDark ? '#334155' : '#e2e8f0',
    card: isDark ? '#131b2e' : '#ffffff',
  };

  try {
    const ds = useDesignSystem();
    if (ds) {
      if (propIsDark === undefined && typeof ds.isDark === 'boolean') {
        isDark = ds.isDark;
      }
      if (ds.themeColors) {
        themeColors = { ...themeColors, ...ds.themeColors };
      }
    }
  } catch {
    // outside provider fallback
  }

  const vConfig = VARIANT_PALETTES[variant] || VARIANT_PALETTES.native;
  const brandColor = vendor.color || vConfig.accentColor;

  const cardBg =
    variant === 'applemacui'
      ? isDark
        ? '#1C1C1E'
        : '#FFFFFF'
      : variant === 'googlemd3web'
      ? isDark
        ? '#172033'
        : '#F6F9FE'
      : themeColors.card;

  const borderColor =
    variant === 'applemacui'
      ? isDark
        ? '#38383A'
        : '#C6C6C8'
      : themeColors.border;

  const titleColor = themeColors.text;
  const subtitleColor = isDark ? '#94a3b8' : '#64748b';
  const statBoxBg =
    variant === 'applemacui'
      ? isDark
        ? '#2C2C2E'
        : '#F2F2F7'
      : variant === 'googlemd3web'
      ? isDark
        ? '#1e293b'
        : '#E8F0FE'
      : isDark
      ? '#1e293b'
      : '#f8fafc';

  const pillBg =
    variant === 'applemacui'
      ? isDark
        ? '#2C2C2E'
        : '#F2F2F7'
      : isDark
      ? '#1e293b'
      : '#f1f5f9';
  const pillText = isDark ? '#cbd5e1' : '#334155';

  const handlePress = () => {
    if (onAction) {
      onAction();
    } else {
      openVendorWebsite(vendor.websiteUrl);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
          borderRadius: vConfig.radius,
          borderWidth: vConfig.borderWidth,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityRole="link"
      accessibilityLabel={`Open ${vendor.name} website`}
    >
      {/* Top Accent Bar */}
      <View style={[styles.topAccentBar, { backgroundColor: brandColor }]} />

      {/* Header Row (with Ant header band if ant variant) */}
      <View
        style={[
          styles.header,
          vConfig.headerBand && {
            backgroundColor: isDark ? '#1a2234' : '#fafafa',
            marginHorizontal: -20,
            marginTop: -16,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
          },
        ]}
      >
        <View
          style={[
            styles.logoContainer,
            {
              borderRadius: Math.min(vConfig.radius, 14),
              backgroundColor:
                vendor.id === 'react-native-expo'
                  ? '#0d1117'
                  : vendor.id === 'android'
                  ? '#073042'
                  : vendor.id === 'google-antigravity'
                  ? '#000000'
                  : '#ffffff',
            },
          ]}
        >
          <SvgXml xml={vendor.svgXml} width={38} height={38} />
        </View>

        <View style={styles.headerTextContainer}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: vendor.accentBg,
                  borderRadius: vConfig.pillRadius,
                },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: brandColor }]} />
              <Text style={[styles.statusBadgeText, { color: brandColor }]}>
                {vendor.badge}
              </Text>
            </View>
            <View
              style={[
                styles.tierBadge,
                {
                  borderRadius: vConfig.pillRadius,
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              ]}
            >
              <Text style={[styles.tierBadgeText, { color: brandColor }]}>
                {vendor.tier}
              </Text>
            </View>
          </View>
          <Text style={[styles.title, { color: titleColor }]}>{vendor.name}</Text>
          <Text style={[styles.category, { color: subtitleColor }]}>
            {vendor.subtitle}
          </Text>
        </View>
      </View>

      {/* Tagline & Description */}
      <Text style={[styles.tagline, { color: isDark ? '#e2e8f0' : '#1e293b' }]}>
        {vendor.tagline}
      </Text>
      <Text style={[styles.description, { color: subtitleColor }]} numberOfLines={3}>
        {vendor.description}
      </Text>

      {/* Key Metrics Grid */}
      <View style={styles.statsGrid}>
        {vendor.stats.map((stat, i) => (
          <View
            key={stat.label}
            style={[
              styles.statBox,
              {
                backgroundColor: statBoxBg,
                borderColor,
                borderRadius: Math.min(vConfig.radius, 12),
              },
            ]}
          >
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    i === 0
                      ? brandColor
                      : i === 1
                      ? '#10b981'
                      : i === 2
                      ? vConfig.accentColor
                      : '#8b5cf6',
                },
              ]}
            >
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: subtitleColor }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Capabilities Pills */}
      <View style={styles.pillsContainer}>
        {vendor.features.map((pill) => (
          <View
            key={pill}
            style={[
              styles.pill,
              { backgroundColor: pillBg, borderRadius: vConfig.pillRadius },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={13}
              color={brandColor}
              style={styles.pillIcon}
            />
            <Text style={[styles.pillText, { color: pillText }]}>{pill}</Text>
          </View>
        ))}
      </View>

      {/* Footer / Action */}
      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <View style={styles.complianceRow}>
          <MaterialCommunityIcons name="shield-check" size={16} color="#10b981" />
          <Text style={[styles.complianceText, { color: subtitleColor }]}>
            {vendor.compliance.join(' • ')}
          </Text>
        </View>

        <ButtonApp
          title={vendor.ctaLabel}
          icon="open_in_new"
          variant="contained"
          size="small"
          onPress={handlePress}
          style={{ marginVertical: 0 }}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    padding: 20,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  category: {
    fontSize: 12,
    fontWeight: '500',
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillIcon: {
    marginRight: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 10,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  complianceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

