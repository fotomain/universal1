// CurrencyCard - one currency in ListWebCardsComponent (web, drag & drop) and in the native list.
// Tap / Edit -> /currency/edit?rowGUID=… · Delete -> the list's delete (asks when "ask before delete" is on).
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import type { CardItem } from '../../components/list/web/lib/types';
import type { CurrencyRowJSON } from './currencyModel';

export interface CurrencyCardProps {
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

export default function CurrencyCard({ card, isSelected, isDragging, onEdit, onDelete, dragHandleProps, crudCardHeight = 88 }: CurrencyCardProps) {
  const { themeColors: c } = useDesignSystem();
  const j: Partial<CurrencyRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const id = card.id;
  return (
    <View
      testID={`currency-card-${id}`}
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
      <Pressable style={styles.main} onPress={() => onEdit?.(id)} accessibilityRole="button" accessibilityLabel={`Edit ${j.currencyCode}`}>
        <View style={[styles.codeBadge, { backgroundColor: c.primary }]}>
          <Text style={styles.codeText} testID={`currency-card-code-${id}`}>
            {j.currencyCode || '???'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {j.currencyName || '—'}
          </Text>
          <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>
            {[j.currencySymbol && `Symbol ${j.currencySymbol}`, `${j.decimalDigits ?? 2} decimals`, j.currencyNumericCode && `No. ${j.currencyNumericCode}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {inactive && (
          <Text style={[styles.chip, { color: c.text, borderColor: c.border }]} testID={`currency-card-inactive-${id}`}>
            inactive
          </Text>
        )}
      </Pressable>
      <IconApp testID={`currency-card-edit-${id}`} name="edit" size={20} color={c.text} onPress={() => onEdit?.(id)} />
      <View style={{ width: 8 }} />
      <IconApp testID={`currency-card-delete-${id}`} name="delete" size={20} color={c.error} onPress={() => onDelete?.(id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dragging: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeBadge: { minWidth: 54, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  codeText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  chip: { fontSize: 11, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
});
