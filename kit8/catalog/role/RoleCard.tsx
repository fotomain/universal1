import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import type { CardItem } from '../../components/list/web/lib/types';
import type { RoleRowJSON } from './roleModel';
import { useIsAppAdmin } from './useIsAppAdmin';

export interface RoleCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: any;
  crudCardHeight?: number;
  position?: number;
}

export default function RoleCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  dragHandleProps,
  crudCardHeight = 64,
  position,
}: RoleCardProps) {
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const j: Partial<RoleRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const id = card.id;

  return (
    <View
      testID={`role-card-${id}`}
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
        style={styles.main}
        onPress={() => isAdmin && onEdit?.(id)}
        accessibilityRole="button"
        accessibilityLabel={`Role ${j.roleTitle || j.roleName}`}
      >
        <View style={[styles.avatar, { backgroundColor: `${c.primary}20` }]}>
          <IconApp name="admin_panel_settings" size={20} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.roleTitle || j.roleName || '—'}
            </Text>
            <View style={[styles.badge, { backgroundColor: `${c.border}40` }]}>
              <Text style={[styles.badgeText, { color: c.text }]}>
                {j.roleName}
              </Text>
            </View>
          </View>
          {!!j.roleDescription && (
            <Text style={[styles.meta, { color: `${c.text}99` }]} numberOfLines={1}>
              {j.roleDescription}
            </Text>
          )}
        </View>
        {inactive && (
          <Text style={[styles.chip, { color: c.text, borderColor: c.border }]}>
            inactive
          </Text>
        )}
      </Pressable>

      {isAdmin && (
        <View style={styles.actions}>
          <IconApp
            testID={`role-card-edit-${id}`}
            name="edit"
            size={20}
            color={c.text}
            onPress={() => onEdit?.(id)}
          />
          <View style={{ width: 10 }} />
          <IconApp
            testID={`role-card-delete-${id}`}
            name="delete"
            size={20}
            color={c.error}
            onPress={() => onDelete?.(id)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  dragging: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  chip: {
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
});
