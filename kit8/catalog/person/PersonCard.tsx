// PersonCard - one person in ListWebCardsComponent (web, drag & drop) and in the native list.
// Tap / Edit -> /person/edit?rowGUID=… · Delete -> the list's delete.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import type { CardItem } from '../../components/list/web/lib/types';
import type { PersonRowJSON } from './personModel';

export interface PersonCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** web drag handle from ListWebCardsComponent (@hello-pangea/dnd) */
  dragHandleProps?: any;
  crudCardHeight?: number;
  testID?: string;
}

export default function PersonCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  dragHandleProps,
  crudCardHeight = 88,
  testID,
}: PersonCardProps) {
  const { themeColors: c } = useDesignSystem();
  const j: Partial<PersonRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const isEmployee = Boolean(j.personIsEmployee);
  const id = card.id;

  const initials = [j.personFirstName?.[0], j.personLastName?.[0]].filter(Boolean).join('').toUpperCase() || 'P';

  return (
    <View
      testID={testID || `person-card-${id}`}
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
        <div {...dragHandleProps} title="Drag to reorder" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4 }}>
          <IconApp name="drag_indicator" size={20} color={c.text} />
        </div>
      ) : null}

      <Pressable
        style={styles.main}
        onPress={() => onEdit?.(id)}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${j.personTitle || 'person'}`}
      >
        <View style={[styles.avatarBadge, { backgroundColor: isEmployee ? '#6366f1' : c.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.personTitle || [j.personFirstName, j.personLastName].filter(Boolean).join(' ') || 'Unnamed Person'}
            </Text>
            {isEmployee && (
              <View style={[styles.badge, { backgroundColor: '#6366f120', borderColor: '#6366f1' }]}>
                <Text style={[styles.badgeText, { color: '#6366f1' }]}>Employee</Text>
              </View>
            )}
            {inactive && (
              <Text style={[styles.chip, { color: c.text, borderColor: c.border }]}>
                inactive
              </Text>
            )}
          </View>

          <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>
            {[
              j.employeeData?.position,
              j.employeeData?.department,
              j.personEmail,
              j.personPhone,
            ]
              .filter(Boolean)
              .join(' · ') || 'No contact details'}
          </Text>
        </View>
      </Pressable>

      <IconApp testID={`person-card-edit-${id}`} name="edit" size={20} color={c.text} onPress={() => onEdit?.(id)} />
      <View style={{ width: 8 }} />
      <IconApp testID={`person-card-delete-${id}`} name="delete" size={20} color={c.error} onPress={() => onDelete?.(id)} />
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
  dragging: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  chip: { fontSize: 11, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
});
