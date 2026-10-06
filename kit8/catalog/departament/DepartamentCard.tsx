import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { CardItem } from '../../ui/components/list/web/lib/types';
import type { DepartamentRowJSON } from './departamentModel';

export interface DepartamentCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCreateChild?: (parentId: string) => void;
  onToggleExpand?: () => void;
  depth?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  dragHandleProps?: any;
  crudCardHeight?: number;
  testID?: string;
}

export default function DepartamentCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  onCreateChild,
  onToggleExpand,
  depth = 0,
  hasChildren = false,
  isExpanded = true,
  dragHandleProps,
  crudCardHeight = 84,
  testID,
}: DepartamentCardProps) {
  const { themeColors: c } = useDesignSystem();
  const rawItem = card.rawItem || {};
  const j: Partial<DepartamentRowJSON> = rawItem.rowJSON || {};
  const inactive = j.isActive === false;
  const id = card.id;

  const cardDepth = card.depth ?? depth;
  const cardHasChildren = card.hasChildren ?? hasChildren;
  const cardIsExpanded = card.isExpanded ?? isExpanded;

  const handleEditPress = () => onEdit?.(id);
  const handleDeletePress = () => onDelete?.(id);
  const handleAddChildPress = () => onCreateChild?.(id);

  return (
    <View
      testID={testID || `departament-card-${id}`}
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
        testID={testID ? `${testID}-main` : `departament-card-main-${id}`}
        style={styles.main}
        onPress={handleEditPress}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${j.departmentName || 'department'}`}
      >
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: cardDepth > 0 ? `${c.primary}12` : `${c.primary}22`,
            },
          ]}
        >
          <IconApp
            name={cardDepth > 0 ? 'subdirectory_arrow_right' : 'schema'}
            size={cardDepth > 0 ? 18 : 20}
            color={c.primary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.departmentName || 'Untitled Department'}
            </Text>
            {j.departmentCode && (
              <View style={[styles.badge, { backgroundColor: `${c.primary}20`, borderColor: c.primary }]}>
                <Text style={[styles.badgeText, { color: c.primary }]}>{j.departmentCode}</Text>
              </View>
            )}
            {cardDepth > 0 && (
              <View style={[styles.badge, { backgroundColor: '#6366f120', borderColor: '#6366f1' }]}>
                <Text style={[styles.badgeText, { color: '#6366f1' }]}>Level {cardDepth + 1}</Text>
              </View>
            )}
            {cardHasChildren && (
              <View style={[styles.badge, { backgroundColor: '#10b98120', borderColor: '#10b981' }]}>
                <Text style={[styles.badgeText, { color: '#10b981' }]}>Has sub-units</Text>
              </View>
            )}
            {inactive && (
              <View style={[styles.badge, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
                <Text style={[styles.badgeText, { color: '#ef4444' }]}>Inactive</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {j.headPersonName ? (
              <Text style={[styles.metaText, { color: c.text + '99' }]}>
                👤 {j.headPersonName}
              </Text>
            ) : (
              <Text style={[styles.metaText, { color: c.text + '80', fontStyle: 'italic' }]}>
                No lead assigned
              </Text>
            )}
            {j.description ? (
              <Text style={[styles.metaText, { color: c.text + '99' }]} numberOfLines={1}>
                · {j.description}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        {onCreateChild && (
          <Pressable
            testID={testID ? `${testID}-add-child` : `departament-card-add-child-${id}`}
            onPress={handleAddChildPress}
            style={[styles.actionBtn, { backgroundColor: `${c.primary}14` }]}
            accessibilityLabel="Add sub-department"
            accessibilityHint="Add sub-department under this department"
          >
            <IconApp name="add" size={16} color={c.primary} />
            <Text style={[styles.addChildText, { color: c.primary }]}>Sub-unit</Text>
          </Pressable>
        )}
        <Pressable
          testID={testID ? `${testID}-edit` : `departament-card-edit-${id}`}
          onPress={handleEditPress}
          style={styles.actionBtn}
          accessibilityLabel="Edit department"
        >
          <IconApp name="edit" size={18} color={c.primary} />
        </Pressable>
        {onDelete && (
          <Pressable
            testID={testID ? `${testID}-delete` : `departament-card-delete-${id}`}
            onPress={handleDeletePress}
            style={styles.actionBtn}
            accessibilityLabel="Delete department"
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
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addChildText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
