import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Card, Text, Chip, Button, useTheme, Surface, Badge } from 'react-native-paper';
import { SvgXml } from 'react-native-svg';
import { antigravityLogoSvg, VENDOR_ITEMS, openVendorWebsite } from '../../common';
import ButtonApp from '../../../common/ButtonApp';

const data = VENDOR_ITEMS.googleAntigravity;

interface GoogleAntigravityVendorCardProps {
  isDark?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function GoogleAntigravityVendorCard({
  isDark = false,
  onAction,
  style,
}: GoogleAntigravityVendorCardProps) {
  const theme = useTheme();

  const handlePress = () => {
    if (onAction) {
      onAction();
    } else {
      openVendorWebsite(data.websiteUrl);
    }
  };

  return (
    <Card
      mode="elevated"
      onPress={handlePress}
      style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }, style]}
    >
      <View style={[styles.topBar, { backgroundColor: '#6366f1' }]} />

      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Surface style={[styles.logoSurface, { backgroundColor: '#000000' }]} elevation={1}>
            <SvgXml xml={antigravityLogoSvg} width={44} height={44} />
          </Surface>

          <View style={styles.headerInfo}>
            <View style={styles.badgeRow}>
              <Badge size={22} style={[styles.statusBadge, { backgroundColor: '#e0e7ff', color: '#4338ca' }]}>
                {data.badge}
              </Badge>
              <Chip compact mode="outlined" style={styles.tierChip} textStyle={styles.tierChipText}>
                {data.tier}
              </Chip>
            </View>
            <Text variant="titleLarge" style={styles.title}>
              {data.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              {data.subtitle}
            </Text>
          </View>
        </View>

        <Text variant="titleSmall" style={[styles.tagline, { color: theme.colors.onSurface }]}>
          {data.tagline}
        </Text>
        <Text variant="bodyMedium" numberOfLines={3} style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          {data.description}
        </Text>

        <View style={styles.statsGrid}>
          {data.stats.map((stat, i) => (
            <Surface key={stat.label} style={styles.statSurface} elevation={1}>
              <Text variant="titleMedium" style={{ color: i === 0 ? '#6366f1' : i === 1 ? '#4285F4' : i === 2 ? '#a855f7' : '#10b981', fontWeight: '700' }}>
                {stat.value}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                {stat.label}
              </Text>
            </Surface>
          ))}
        </View>

        <View style={styles.chipsRow}>
          {data.features.map((feat) => (
            <Chip key={feat} compact mode="flat" icon="check" style={styles.featureChip} textStyle={styles.featureChipText}>
              {feat}
            </Chip>
          ))}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            {data.compliance.join(' • ')}
          </Text>

          <ButtonApp
          title={data.ctaLabel}
          icon="open_in_new"
          variant="contained"
          size="small"
          onPress={handlePress}
          style={{ marginVertical: 0 }}
        />
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  topBar: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoSurface: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  tierChip: {
    borderRadius: 8,
  },
  tierChipText: {
    fontSize: 11,
    lineHeight: 15,
    minHeight: 15,
    marginVertical: 3,
    marginHorizontal: 6,
  },
  title: {
    fontWeight: '700',
  },
  tagline: {
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  description: {
    lineHeight: 18,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statSurface: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  featureChip: {
    borderRadius: 8,
  },
  featureChipText: {
    fontSize: 11,
    lineHeight: 16,
    minHeight: 16,
    marginVertical: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    borderRadius: 8,
  },
});
