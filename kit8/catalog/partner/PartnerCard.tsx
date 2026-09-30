// PartnerCard - one partner in ListWebCardsComponent (web, drag & drop) and in the native list.
// Tap / Edit -> /partner/edit?rowGUID=… · Delete -> the list's delete.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import type { CardItem } from '../../components/list/web/lib/types';
import type { PartnerRowJSON } from './partnerModel';

export interface PartnerCardProps {
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

export default function PartnerCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  dragHandleProps,
  crudCardHeight = 88,
  testID,
}: PartnerCardProps) {
  const { themeColors: c } = useDesignSystem();
  const j: Partial<PartnerRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const id = card.id;

  const isSupplier = Boolean(j.partnerIsSupplier);
  const isCustomer = Boolean(j.partnerIsCustomer);

  return (
    <View
      testID={testID || `partner-card-${id}`}
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
        accessibilityLabel={`Edit ${j.partnerTitle || 'partner'}`}
      >
        <View style={[styles.avatarBadge, { backgroundColor: `${c.primary}20` }]}>
          <IconApp name={j.partnerKind === 'individual' ? 'person' : 'handshake'} size={22} color={c.primary} />
        </View>


        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.partnerTitle || j.partnerLegalName || 'Unnamed Partner'}
            </Text>
            {isSupplier && (
              <View style={[styles.badge, { backgroundColor: '#10b98120', borderColor: '#10b981' }]}>
                <Text style={[styles.badgeText, { color: '#10b981' }]}>Supplier</Text>
              </View>
            )}
            {isCustomer && (
              <View style={[styles.badge, { backgroundColor: '#3b82f620', borderColor: '#3b82f6' }]}>
                <Text style={[styles.badgeText, { color: '#3b82f6' }]}>Customer</Text>
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
              j.partnerLegalName && j.partnerLegalName !== j.partnerTitle ? j.partnerLegalName : null,
              j.legalData?.vatNo ? `VAT ${j.legalData.vatNo}` : null,
              !j.legalData?.vatNo && j.legalData?.registrationNo ? `Reg ${j.legalData.registrationNo}` : null,
              j.legalData?.country ? `(${j.legalData.country})` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'No legal details registered'}
          </Text>
        </View>
      </Pressable>

      <IconApp testID={`partner-card-edit-${id}`} name="edit" size={20} color={c.text} onPress={() => onEdit?.(id)} />
      <View style={{ width: 8 }} />
      <IconApp testID={`partner-card-delete-${id}`} name="delete" size={20} color={c.error} onPress={() => onDelete?.(id)} />
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  chip: { fontSize: 11, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
});
