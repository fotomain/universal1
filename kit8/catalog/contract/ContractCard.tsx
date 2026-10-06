// ContractCard - single contract tile within embedded ContractList (in PersonEdit / PartnerEdit).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { CardItem } from '../../ui/components/list/web/lib/types';
import type { ContractRowJSON } from './contractModel';

export interface ContractCardProps {
  card: CardItem;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  testID?: string;
}

export default function ContractCard({ card, onEdit, onDelete, testID }: ContractCardProps) {
  const { themeColors: c } = useDesignSystem();
  const j: Partial<ContractRowJSON> = card.rawItem?.rowJSON || {};
  const id = card.id;

  const isTerminated = j.contractStatus === 'terminated';
  const isFinished = j.contractStatus === 'finished';
  const isDraft = j.contractStatus === 'draft';
  const isActive = j.contractStatus === 'active' || !j.contractStatus;

  const statusColor = isTerminated ? c.error : isFinished ? '#6b7280' : isDraft ? '#f59e0b' : '#16a34a';

  const sumFormatted = (j.contractTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dates = `${j.contractStartDate || '—'} → ${j.contractFinishDate || 'open-ended'}`;
  const periodText = j.contractPaymentsPeriod ? ` / ${j.contractPaymentsPeriod}` : '';

  return (
    <View
      testID={testID || `contract-card-${id}`}
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: isTerminated || isFinished ? 0.7 : 1,
        },
      ]}
    >
      <Pressable style={styles.main} onPress={() => onEdit?.(id)} accessibilityRole="button" accessibilityLabel={`Edit contract ${j.contractNumber}`}>
        <View style={styles.headerRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{j.contractStatus?.toUpperCase() || 'ACTIVE'}</Text>
          </View>
          <Text style={[styles.number, { color: c.text }]} numberOfLines={1}>
            {j.contractNumber || 'No #'}
          </Text>
          {j.contractType && (
            <Text style={[styles.typeBadge, { color: c.text, borderColor: c.border }]}>
              {j.contractType}
            </Text>
          )}
        </View>

        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {j.contractTitle || 'Untitled Contract'}
        </Text>

        <View style={styles.detailsRow}>
          <Text style={[styles.dates, { color: c.text }]}>{dates}</Text>
          <Text style={[styles.amount, { color: c.primary }]}>
            {sumFormatted} {j.contractCurrency || 'EUR'}
            <Text style={[styles.period, { color: c.text }]}>{periodText}</Text>
          </Text>
        </View>

        {j.contractVAT ? (
          <Text style={[styles.subMeta, { color: c.text }]}>
            Before VAT: {(j.contractSumBeforeVAT ?? 0).toFixed(2)} + VAT {j.contractVATRate}% ({(j.contractVAT ?? 0).toFixed(2)})
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <IconApp testID={`contract-card-edit-${id}`} name="edit" size={18} color={c.text} onPress={() => onEdit?.(id)} />
        <View style={{ width: 8 }} />
        <IconApp testID={`contract-card-delete-${id}`} name="delete" size={18} color={c.error} onPress={() => onDelete?.(id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  main: { flex: 1, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  typeBadge: { fontSize: 10, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, opacity: 0.8 },
  number: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 13, fontWeight: '500' },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  dates: { fontSize: 11, opacity: 0.65 },
  amount: { fontSize: 13, fontWeight: '700' },
  period: { fontSize: 11, fontWeight: 'normal', opacity: 0.7 },
  subMeta: { fontSize: 10, opacity: 0.6 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
});
