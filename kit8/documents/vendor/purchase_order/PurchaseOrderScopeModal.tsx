// PurchaseOrderScopeModal - "Purchase Order" from a LINE of the task Finances table: what goes into the new purchase order?
//   1) the data of the current line (default)      2) the data of all the lines of the task
// Create makes the document(s) at once (useStartPurchaseOrder); Cancel closes the window.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import { pmT } from '../../../pm/i18n/pmT';
import { DEFAULT_PURCHASE_ORDER_SCOPE, PurchaseOrderScope } from './purchaseOrderModel';

export interface PurchaseOrderScopeModalProps {
  visible: boolean;
  busy?: boolean;
  onCancel: () => void;
  onCreate: (scope: PurchaseOrderScope) => void;
  testID?: string;
}

const OPTIONS: { scope: PurchaseOrderScope; text: string }[] = [
  { scope: 'line', text: 'Fill the data of the current line' },
  { scope: 'task', text: 'Fill the data of all the lines of the task' },
];

export default function PurchaseOrderScopeModal({ visible, busy = false, onCancel, onCreate, testID = 'vendor-scope' }: PurchaseOrderScopeModalProps) {
  const { themeColors: c } = useDesignSystem();
  const [scope, setScope] = useState<PurchaseOrderScope>(DEFAULT_PURCHASE_ORDER_SCOPE);
  useEffect(() => { if (visible) setScope(DEFAULT_PURCHASE_ORDER_SCOPE); }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{pmT('Purchase Order')}</Text>
          <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('What goes into the new purchase order?')}</Text>
          {OPTIONS.map((o) => {
            const on = scope === o.scope;
            return (
              <Pressable key={o.scope} accessibilityRole="radio" aria-checked={on} testID={`${testID}-${o.scope}`} onPress={() => setScope(o.scope)} style={[styles.option, { borderColor: on ? c.primary : c.border, backgroundColor: on ? `${c.primary}10` : 'transparent' }]}>
                <IconApp name={on ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={on ? c.primary : c.text} />
                <Text style={{ color: c.text, flexShrink: 1 }}>{pmT(o.text)}</Text>
              </Pressable>
            );
          })}
          <View style={styles.buttons}>
            <ButtonApp testID={`${testID}-cancel`} title={pmT('Cancel')} variant="text" onPress={onCancel} />
            <ButtonApp testID={`${testID}-create`} title={pmT('Create')} icon="add" disabled={busy} loading={busy} onPress={() => onCreate(scope)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
});
