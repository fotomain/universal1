// PMPaymentFactGetFromPlan - the window "Get from plan": the POSTED payments of the payment plan (task_payment_plan_movements) of my projects that still have something open. A check box each; the first one checked
// fixes the payee and the direction (a document has ONE payee), so only the payments of that payee can be checked with it. "Add" makes one line per checked payment: the contract, budget item, business unit,
// currency, task and project are copied from the plan, the sum is what is still open (the lines can be changed afterwards). The header takes the payee and the direction of the first payment when it has none yet.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import { pmT } from '../../../pm/i18n/pmT';
import { PaymentFactHeaderView, PlanCandidate, candidatesOfSamePayee, candidatesOpenTotal, formatMoney } from './paymentFactModel';
import { usePlanCandidates } from './usePaymentFact';

export interface PMPaymentFactGetFromPlanProps {
  visible: boolean;
  header: PaymentFactHeaderView;
  /** the task the document was made for: the window starts with "only this task" */
  taskGUID?: string | null;
  onAdd: (planLineGUIDs: string[]) => void | Promise<void>;
  onClose: () => void;
  testID?: string;
}

export default function PMPaymentFactGetFromPlan({ visible, header, taskGUID, onAdd, onClose, testID = 'payment-fact-plan' }: PMPaymentFactGetFromPlanProps) {
  const { themeColors: c } = useDesignSystem();
  const [onlyTask, setOnlyTask] = useState(!!taskGUID);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const filter = useMemo(() => (onlyTask && taskGUID ? { taskGUID } : {}), [onlyTask, taskGUID]);
  const list = usePlanCandidates(header.guid, filter, visible);
  const first = list.rows.find((r) => checked.has(r.planLineGUID));
  const allowed = useMemo(() => new Set(candidatesOfSamePayee(list.rows, first).map((r) => r.planLineGUID)), [list.rows, first]);
  const total = candidatesOpenTotal(list.rows, checked);
  const toggle = (r: PlanCandidate) => setChecked((cur) => {
    const next = new Set(cur);
    if (next.has(r.planLineGUID)) next.delete(r.planLineGUID); else if (allowed.has(r.planLineGUID)) next.add(r.planLineGUID);
    return next;
  });
  const add = async () => {
    if (!checked.size) return;
    setBusy(true);
    try { await onAdd([...checked]); setChecked(new Set()); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} testID={testID} transparent>
      <View style={styles.backdrop}>
        <View style={[styles.window, { backgroundColor: c.background, borderColor: c.border }]}>
          <View style={[styles.bar, { borderBottomColor: c.border }]}>
            <IconApp name="playlist_add_check" size={20} color={c.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Get from plan')}</Text>
              <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
                {header.payeeTitle ? `${header.payeeTitle}${header.direction ? ` · ${pmT(header.direction === 'inbound' ? 'Inbound' : 'Outbound')}` : ''} · ` : ''}{pmT('Posted payments of the plan with something open. One document pays one payee.')}
              </Text>
            </View>
            {!!taskGUID && (
              <Pressable testID={`${testID}-only-task`} accessibilityRole="checkbox" aria-checked={onlyTask} onPress={() => { setOnlyTask((v) => !v); setChecked(new Set()); }} style={styles.toggle}>
                <IconApp name={onlyTask ? 'check_box' : 'check_box_outline_blank'} size={20} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Only this task')}</Text>
              </Pressable>
            )}
            <Pressable testID={`${testID}-close`} accessibilityRole="button" accessibilityLabel={pmT('Close')} onPress={onClose} hitSlop={8}>
              <IconApp name="close" size={22} color={c.text} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 8 }}>
            {list.isLoading && <Text style={{ color: c.text, opacity: 0.6, padding: 8 }}>{pmT('Loading…')}</Text>}
            {!!list.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 8 }}>{list.error}</Text>}
            {!list.isLoading && !list.error && list.rows.length === 0 && (
              <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.7, padding: 8 }}>{pmT('No posted payment of the plan has something open. Post the payments of a task on its tab Payments first.')}</Text>
            )}
            {list.rows.map((r) => {
              const on = checked.has(r.planLineGUID);
              const disabled = !on && !allowed.has(r.planLineGUID);
              return (
                <Pressable
                  key={r.planLineGUID} testID={`${testID}-row-${r.planLineGUID}`} accessibilityRole="checkbox" aria-checked={on} aria-disabled={disabled} onPress={() => toggle(r)}
                  style={[styles.row, { borderBottomColor: c.border, opacity: disabled ? 0.4 : 1 }]}
                >
                  <IconApp name={on ? 'check_box' : 'check_box_outline_blank'} size={20} color={c.primary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{r.payeeTitle || '—'} · {r.contractInfo || pmT('no contract')}</Text>
                    <Text numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 11 }}>{r.projectName} › {r.taskTitle} · {pmT(r.direction === 'inbound' ? 'Inbound' : 'Outbound')} · {r.plannedDay}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{formatMoney(r.open)} {r.currency}</Text>
                    <Text style={{ color: c.text, opacity: 0.6, fontSize: 11 }}>{pmT('plan')} {formatMoney(r.planSum)} · {pmT('paid')} {formatMoney(r.paid)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.foot, { borderTopColor: c.border }]}>
            <Text testID={`${testID}-total`} style={{ color: c.text, fontSize: 12, flex: 1 }}>{checked.size} {pmT('payments')} · {pmT('open')} {formatMoney(total)}</Text>
            <ButtonApp testID={`${testID}-cancel`} title={pmT('Cancel')} variant="text" size="small" onPress={onClose} />
            <ButtonApp testID={`${testID}-add`} title={pmT('Add to the document')} icon="add" size="small" disabled={!checked.size || busy} onPress={() => { void add(); }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: { width: '100%', maxWidth: 760, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
