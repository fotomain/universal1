import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { CardItem } from '../../ui/components/list/web/lib/types';
import type { PersonRowJSON } from './personModel';
import ContractList from '../contract/ContractList';

export interface PersonCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onContracts?: (id: string) => void;
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
  onContracts,
  dragHandleProps,
  crudCardHeight = 88,
  testID,
}: PersonCardProps) {
  const { themeColors: c } = useDesignSystem();
  const [showContracts, setShowContracts] = useState(false);
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

      <IconApp
        testID={`person-card-contracts-${id}`}
        name="description"
        size={20}
        color={c.primary}
        onPress={() => {
          if (onContracts) onContracts(id);
          else setShowContracts(true);
        }}
      />
      <View style={{ width: 8 }} />
      <IconApp testID={`person-card-edit-${id}`} name="edit" size={20} color={c.text} onPress={() => onEdit?.(id)} />
      <View style={{ width: 8 }} />
      <IconApp testID={`person-card-delete-${id}`} name="delete" size={20} color={c.error} onPress={() => onDelete?.(id)} />

      {showContracts && (
        <Modal
          visible={showContracts}
          transparent
          animationType="fade"
          onRequestClose={() => setShowContracts(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconApp name="person" size={22} color={c.primary} />
                  <Text style={[styles.modalTitle, { color: c.text }]}>
                    {j.personTitle || 'Person'} — Contracts
                  </Text>
                </View>
                <IconApp
                  testID={`person-contracts-close-${id}`}
                  name="close"
                  size={20}
                  color={c.text}
                  onPress={() => setShowContracts(false)}
                />
              </View>
              <ScrollView style={{ maxHeight: 460 }}>
                <ContractList
                  ownerGUID={id}
                  partyType="person"
                  defaultCurrency="EUR"
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
});
