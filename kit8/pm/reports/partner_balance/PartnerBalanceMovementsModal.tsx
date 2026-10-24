// PartnerBalanceMovementsModal - the rows behind a sum of Monitor07 (partner_balance_movements_list, display sign): date · what it is · document number · project / task · the amount of the kind that was
// pressed. A press on a row opens the document (vendor / customer invoice, payment fact).
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import { pmT } from '../../i18n/pmT';
import { formatReportMoney } from '../common/reportFormat';
import { BalanceMovement, BalanceMovementsParams, fetchPartnerBalanceMovements } from './partnerBalanceApi';
import { MOVEMENT_TYPE_TITLE, SUM_KINDS, SumKindId, movementRouteOf } from './partnerBalanceModel';

export interface PartnerBalanceMovementsModalProps {
  params: BalanceMovementsParams | null;
  kind: SumKindId;
  title: string;
  onClose: () => void;
  onOpenDocument: (route: string, documentGUID: string) => void;
  testID?: string;
}

export default function PartnerBalanceMovementsModal({ params, kind, title, onClose, onOpenDocument, testID = 'partner-balance-movements' }: PartnerBalanceMovementsModalProps) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const [rows, setRows] = useState<BalanceMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = params ? JSON.stringify(params) : '';
  useEffect(() => {
    if (!params) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchPartnerBalanceMovements(supabase, params)
      .then((r) => { if (!cancelled) { setRows(r); setError(null); } })
      .catch((e: any) => { if (!cancelled) setError(e?.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase]);
  const kindDef = SUM_KINDS.find((k) => k.id === kind) ?? SUM_KINDS[0];
  if (!params) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.head}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={2}>{title} · {pmT(kindDef.title)}</Text>
            <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />
          </View>
          {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 8 }}>{error}</Text>}
          {loading && <Text style={{ color: c.text, opacity: 0.6, padding: 8 }}>{pmT('Loading…')}</Text>}
          <FlatList
            data={rows}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={!loading ? <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('No rows.')}</Text> : null}
            renderItem={({ item }) => (
              <Pressable testID={`${testID}-row-${item.id}`} onPress={() => onOpenDocument(movementRouteOf(item), item.registratorGUID)} accessibilityRole="link"
                style={[styles.row, { borderBottomColor: c.border }]}>
                <Text style={[styles.cell, { color: c.text, width: 92 }]}>{item.periodDay}</Text>
                <Text style={[styles.cell, { color: c.text, flex: 1 }]} numberOfLines={1}>{pmT(MOVEMENT_TYPE_TITLE[item.operationType] ?? item.operationType)}{item.documentNumber ? ` · ${item.documentNumber}` : ''}</Text>
                <Text style={[styles.cell, { color: c.text, flex: 1, opacity: 0.7 }]} numberOfLines={1}>{[item.projectTitle, item.taskTitle].filter(Boolean).join(' / ')}</Text>
                <Text testID={`${testID}-amount-${item.id}`} style={[styles.cell, { color: c.text, width: 110, textAlign: 'right', fontWeight: '700' }]}>{formatReportMoney(Number(item[kindDef.column]))}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 900, maxHeight: '85%', borderWidth: 1, borderRadius: 10, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { fontSize: 13 },
});
