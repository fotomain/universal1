import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import type { CardItem } from '../../components/list/web/lib/types';
import { canEditOrganization, type OrganizationRowJSON } from './organizationModel';

export interface OrganizationCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: any;
  crudCardHeight?: number;
  testID?: string;
}

export default function OrganizationCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  dragHandleProps,
  crudCardHeight = 88,
  testID,
}: OrganizationCardProps) {
  const { themeColors: c } = useDesignSystem();
  const activeUserEmail = useSelector((s: any) => s?.activeUserState?.activeUserEmail);
  const j: Partial<OrganizationRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const id = card.id;

  const canEdit = canEditOrganization(card.rawItem, activeUserEmail);
  const isMine = Boolean(
    activeUserEmail &&
      j.createdByUser &&
      activeUserEmail.toLowerCase() === j.createdByUser.toLowerCase()
  );

  return (
    <View
      testID={testID || `organization-card-${id}`}
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
        onPress={() => onEdit?.(id)}
        accessibilityRole="button"
        accessibilityLabel={`${canEdit ? 'Edit' : 'View'} ${j.organizationTitle || 'organization'}`}
      >
        <View style={[styles.avatarBadge, { backgroundColor: `${c.primary}20` }]}>
          <IconApp name="corporate_fare" size={22} color={c.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.organizationTitle || j.organizationLegalName || 'Unnamed Organization'}
            </Text>
            {isMine ? (
              <View style={[styles.badge, { backgroundColor: '#10b98120', borderColor: '#10b981' }]}>
                <Text style={[styles.badgeText, { color: '#10b981' }]}>Your Organization</Text>
              </View>
            ) : !canEdit ? (
              <View style={[styles.badge, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }]}>
                <Text style={[styles.badgeText, { color: '#d97706' }]}>Read-Only</Text>
              </View>
            ) : null}
            {inactive && (
              <View style={[styles.badge, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
                <Text style={[styles.badgeText, { color: '#ef4444' }]}>Inactive</Text>
              </View>
            )}
          </View>

          <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>
            {[
              j.organizationLegalName,
              j.legalData?.country ? `[${j.legalData.country}]` : null,
              j.createdByUser ? `Created by: ${j.createdByUser}` : null,
              j.contactEmail,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <Pressable
          testID={`organization-edit-${id}`}
          onPress={() => onEdit?.(id)}
          accessibilityRole="button"
          accessibilityLabel={canEdit ? 'Edit organization' : 'View organization'}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
        >
          <IconApp
            name={canEdit ? 'edit' : 'visibility'}
            size={18}
            color={canEdit ? c.primary : c.text}
          />
        </Pressable>
        {canEdit && onDelete && (
          <Pressable
            testID={`organization-delete-${id}`}
            onPress={() => onDelete(id)}
            accessibilityRole="button"
            accessibilityLabel="Delete organization"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
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
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dragging: {
    elevation: 8,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
});
