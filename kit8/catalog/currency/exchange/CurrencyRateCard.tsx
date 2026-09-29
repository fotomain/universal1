// CurrencyRateCard - one exchange rate (one day) in ListWebCardsComponent (web) and in the native list.
// Shows the day, the ratio and the change against the previous day that has a rate (▲ / ▼ %).
// Tap / Edit -> /currency/exchange/edit?currencyGUID=…&rowGUID=… · Delete -> the list's delete (asks when "ask before delete" is on).
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../components/common/IconApp';
import { CurrencyExchangeRowJSON, formatDay, formatRatio, ratioChangePercent, RateCardItem, todayISO } from './currencyExchangeModel';

export interface CurrencyRateCardProps {
  card: RateCardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** web: from ListWebCardsComponent (dragging is disabled for rates - the order is the date) */
  dragHandleProps?: any;
  crudCardHeight?: number;
  /** currency code shown next to the ratio, e.g. "USD" */
  currencyCode?: string;
  testID?: string;
}

const UP = '#16a34a';
const DOWN = '#dc2626';

export default function CurrencyRateCard({ card, isSelected, isDragging, onEdit, onDelete, dragHandleProps, crudCardHeight = 72, currencyCode }: CurrencyRateCardProps) {
  const { themeColors: c } = useDesignSystem();
  const row = card.rawItem || {};
  const j: Partial<CurrencyExchangeRowJSON> = row.rowJSON || {};
  const day = j.startingDate || row.rowParentGUID || '';
  const id = card.id;
  const change = ratioChangePercent(j.currencyRatio, card.previousRatio);
  const isToday = day === todayISO();
  const code = currencyCode;

  const body = (
    <Pressable style={styles.main} onPress={() => onEdit?.(id)} accessibilityRole="button" accessibilityLabel={`Edit rate of ${day}`}>
      <View style={[styles.dayBadge, { borderColor: isToday ? c.primary : c.border, backgroundColor: isToday ? `${c.primary}14` : 'transparent' }]}>
        <Text style={[styles.dayText, { color: c.text }]} testID={`rate-card-day-${id}`}>
          {day || '—'}
        </Text>
        <Text style={[styles.dayMeta, { color: c.text }]} numberOfLines={1}>
          {isToday ? 'today' : formatDay(day).split(',')[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ratio, { color: c.text }]} numberOfLines={1} testID={`rate-card-ratio-${id}`}>
          {formatRatio(j.currencyRatio)}
          {code ? <Text style={styles.code}> {code}</Text> : null}
        </Text>
        <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>
          {formatDay(day)}
        </Text>
      </View>
      {change !== null && (
        <Text
          testID={`rate-card-change-${id}`}
          style={[styles.change, { color: change > 0 ? UP : change < 0 ? DOWN : c.text, borderColor: change > 0 ? UP : change < 0 ? DOWN : c.border }]}
          accessibilityLabel={`Change against the previous rate: ${change.toFixed(2)} percent`}
        >
          {change > 0 ? '▲' : change < 0 ? '▼' : '='} {Math.abs(change).toFixed(2)}%
        </Text>
      )}
    </Pressable>
  );

  return (
    <View
      testID={`rate-card-${id}`}
      style={[
        styles.card,
        { minHeight: crudCardHeight, backgroundColor: isSelected ? `${c.primary}18` : c.surface, borderColor: isSelected ? c.primary : c.border },
        isDragging && styles.dragging,
      ]}
    >
      {Platform.OS === 'web' && dragHandleProps ? (
        // the handle must exist for @hello-pangea/dnd; dragging itself is disabled (fixed date order)
        <div {...dragHandleProps} tabIndex={-1} style={{ display: 'flex', flex: 1, minWidth: 0, cursor: 'default' }}>
          {body}
        </div>
      ) : (
        body
      )}
      <IconApp testID={`rate-card-edit-${id}`} name="edit" size={20} color={c.text} onPress={() => onEdit?.(id)} />
      <View style={{ width: 8 }} />
      <IconApp testID={`rate-card-delete-${id}`} name="delete" size={20} color={c.error} onPress={() => onDelete?.(id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dragging: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: { minWidth: 96, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  dayText: { fontWeight: '700', fontSize: 13, fontVariant: ['tabular-nums'] },
  dayMeta: { fontSize: 11, opacity: 0.65 },
  ratio: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  code: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  change: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8, fontVariant: ['tabular-nums'] },
});
