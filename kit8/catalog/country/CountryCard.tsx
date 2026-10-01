import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import type { CardItem } from '../../components/list/web/lib/types';
import type { CountryRowJSON } from './countryModel';

export interface CountryCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: any;
  crudCardHeight?: number;
  testID?: string;
}

export default function CountryCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  dragHandleProps,
  crudCardHeight = 80,
  testID,
}: CountryCardProps) {
  const { themeColors: c } = useDesignSystem();
  const j: Partial<CountryRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const id = card.id;

  const handleEditPress = () => onEdit?.(id);
  const handleDeletePress = () => onDelete?.(id);

  return (
    <View
      testID={testID || `country-card-${id}`}
      style={[
        styles.card,
        {
          minHeight: crudCardHeight,
          backgroundColor: isSelected ? `${c.primary}18` : c.surface,
          borderColor: isSelected ? c.primary : c.border,
          opacity: inactive ? 0.65 : 1,
        },
        isDragging && styles.dragging,
      ]}
    >
      {Platform.OS === 'web' && dragHandleProps ? (
        <div
          {...dragHandleProps}
          title="Drag to reorder"
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <IconApp name="drag_indicator" size={20} color={c.text} />
        </div>
      ) : null}

      <Pressable
        testID={testID ? `${testID}-main` : `country-card-main-${id}`}
        style={styles.main}
        onPress={handleEditPress}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${j.countryName || 'country'}`}
      >
        <View style={[styles.flagBadge, { backgroundColor: `${c.primary}15` }]}>
          <Text style={styles.flagText}>{j.flagEmoji || '🏳️'}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.countryName || 'Unnamed Country'}
            </Text>
            {j.countryCode && (
              <View style={[styles.badge, { backgroundColor: `${c.primary}20`, borderColor: c.primary }]}>
                <Text style={[styles.badgeText, { color: c.primary }]}>{j.countryCode}</Text>
              </View>
            )}
            {inactive && (
              <View style={[styles.badge, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
                <Text style={[styles.badgeText, { color: '#ef4444' }]}>Inactive</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {j.countryCodeAlpha3 ? (
              <Text style={[styles.metaText, { color: c.text + '99' }]}>
                {j.countryCodeAlpha3}
              </Text>
            ) : null}
            {j.phonePrefix ? (
              <Text style={[styles.metaText, { color: c.text + '99' }]}>
                📞 {j.phonePrefix}
              </Text>
            ) : null}
            {j.currencyCode ? (
              <Text style={[styles.metaText, { color: c.text + '99' }]}>
                💱 {j.currencyCode}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          testID={testID ? `${testID}-edit` : `country-card-edit-${id}`}
          onPress={handleEditPress}
          style={styles.actionBtn}
          accessibilityLabel="Edit country"
        >
          <IconApp name="edit" size={18} color={c.primary} />
        </Pressable>
        {onDelete && (
          <Pressable
            testID={testID ? `${testID}-delete` : `country-card-delete-${id}`}
            onPress={handleDeletePress}
            style={styles.actionBtn}
            accessibilityLabel="Delete country"
          >
            <IconApp name="delete" size={18} color="#ef4444" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dragging: {
    elevation: 8,
    shadowOpacity: 0.2,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flagBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: {
    fontSize: 22,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
