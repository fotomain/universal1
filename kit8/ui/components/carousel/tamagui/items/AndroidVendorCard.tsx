import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SvgXml } from 'react-native-svg';
import { androidLogoSvg, VENDOR_ITEMS, openVendorWebsite } from '../../common';
import ButtonApp from '../../../common/ButtonApp';

const data = VENDOR_ITEMS.android;

interface AndroidVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function AndroidVendorCard({
  isDark = false,
  onAction,
  style,
}: AndroidVendorCardProps) {
  const cardBg = isDark ? '#131b2e' : '#ffffff';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';
  const titleColor = isDark ? '#f8fafc' : '#0f172a';
  const subtitleColor = isDark ? '#94a3b8' : '#64748b';
  const statBoxBg = isDark ? '#1e293b' : '#f8fafc';
  const statValColor = isDark ? '#4ade80' : '#16a34a';
  const pillBg = isDark ? '#1e293b' : '#f1f5f9';
  const pillText = isDark ? '#cbd5e1' : '#334155';

  const handlePress = () => {
    if (onAction) {
      onAction();
    } else {
      openVendorWebsite(data.websiteUrl);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor }, style]}
      onPress={handlePress}
      activeOpacity={0.92}
      accessibilityRole="link"
      accessibilityLabel={`Open ${data.name} website`}
    >
      <View style={styles.topAccentBar} />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <SvgXml xml={androidLogoSvg} width={40} height={40} />
        </View>

        <View style={styles.headerTextContainer}>
          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>{data.badge}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{data.tier}</Text>
            </View>
          </View>
          <Text style={[styles.title, { color: titleColor }]}>{data.name}</Text>
          <Text style={[styles.category, { color: subtitleColor }]}>{data.subtitle}</Text>
        </View>
      </View>

      <Text style={[styles.tagline, { color: isDark ? '#e2e8f0' : '#1e293b' }]}>
        {data.tagline}
      </Text>
      <Text style={[styles.description, { color: subtitleColor }]} numberOfLines={3}>
        {data.description}
      </Text>

      <View style={styles.statsGrid}>
        {data.stats.map((stat, i) => (
          <View key={stat.label} style={[styles.statBox, { backgroundColor: statBoxBg, borderColor }]}>
            <Text style={[styles.statValue, { color: i === 0 ? statValColor : i === 1 ? '#0284c7' : i === 2 ? '#16a34a' : '#8b5cf6' }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: subtitleColor }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.pillsContainer}>
        {data.features.map((pill) => (
          <View key={pill} style={[styles.pill, { backgroundColor: pillBg }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={13} color="#16a34a" style={styles.pillIcon} />
            <Text style={[styles.pillText, { color: pillText }]}>{pill}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <View style={styles.complianceRow}>
          <MaterialCommunityIcons name="android" size={16} color="#16a34a" />
          <Text style={[styles.complianceText, { color: subtitleColor }]}>
            {data.compliance.join(' • ')}
          </Text>
        </View>

        <ButtonApp
          title={data.ctaLabel}
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
    width: '100%',
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#3DDC84',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#073042',
    borderWidth: 1,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
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
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  tierBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
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
    marginBottom: 8,
    lineHeight: 21,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
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
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
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
    paddingTop: 14,
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
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
