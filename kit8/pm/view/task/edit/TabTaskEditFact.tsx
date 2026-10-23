// TabTaskEditFact - the 1st level tab "Fact" of the task window. It has 2nd level tabs (like TabTaskEditMain has Main · UX/UI), each with the list of the documents of THIS task:
//   TabFactInput       the fact input documents (TabFactInput.tsx)
//   TabProductReceipt  the product receipts (TabProductReceipt.tsx)
//   TabVendorInvoice   the vendor invoices (TabVendorInvoice.tsx)
//   TabCustomerInvoice the customer invoices (TabCustomerInvoice.tsx; only while the project switch customerInvoiceFunctionalityEnabled is on)
//   TabPaymentFact     the payment facts = bank transactions that pay the task (TabPaymentFact.tsx; sub-tabs Outbound · Inbound)
// A list is created when its tab is first opened (it reads the database) and kept after that.
// Every 2nd level tab has a TIP with the number of documents of the task ("Vendor invoice - 3 documents"; useTaskDocumentCounts: read when the tab opens and after each change of tab).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';
import { pmT } from '../../../i18n/pmT';
import TabFactInput from './TabFactInput';
import TabProductReceipt from './TabProductReceipt';
import TabVendorInvoice from './TabVendorInvoice';
import TabCustomerInvoice from './TabCustomerInvoice';
import TabPaymentFact from './TabPaymentFact';
import { usePMStore } from '../../../store/store_pm';
import { usePMTip } from '../../../inner/tooltip/PMTooltip';
import { documentCountText, useTaskDocumentCounts } from './useTaskDocumentCounts';
import { customerInvoiceEnabledOf } from '../../project/settings/PMProjectCustomerTab';

export type TaskEditFactTab = 'TabFactInput' | 'TabProductReceipt' | 'TabVendorInvoice' | 'TabCustomerInvoice' | 'TabPaymentFact';
export const TASK_EDIT_FACT_TABS: { id: TaskEditFactTab; label: string; icon: string }[] = [
  { id: 'TabFactInput', label: 'Fact input', icon: 'fact_check' },
  { id: 'TabProductReceipt', label: 'Product receipt', icon: 'move_to_inbox' },
  { id: 'TabVendorInvoice', label: 'Vendor invoice', icon: 'receipt_long' },
  { id: 'TabCustomerInvoice', label: 'Customer invoice', icon: 'payments' },
  { id: 'TabPaymentFact', label: 'Payments', icon: 'account_balance' },
];

/** one 2nd level tab: the tip = its name + the number of documents of the task */
function FactSubTab({ id, label, icon, on, count, onPress }: { id: TaskEditFactTab; label: string; icon: string; on: boolean; count: number | null | undefined; onPress: () => void }) {
  const { themeColors } = useDesignSystem();
  const counted = documentCountText(count);
  const tipText = counted ? `${pmT(label)} - ${pmT(counted)}` : pmT(label);
  const tip = usePMTip(tipText);
  return (
    <Pressable
      {...tip}
      testID={`pm-task-edit-fact-${id}`}
      accessibilityRole="tab"
      accessibilityLabel={tipText}
      aria-selected={on}
      onPress={onPress}
      style={[styles.tab, { borderBottomColor: on ? themeColors.primary : 'transparent', backgroundColor: on ? `${themeColors.primary}18` : 'transparent' }]}
    >
      <IconApp name={icon} size={16} color={on ? themeColors.primary : themeColors.text} />
      <Text style={{ fontSize: 13, color: on ? themeColors.primary : themeColors.text, fontWeight: on ? '700' : '500' }}>{pmT(label)}</Text>
    </Pressable>
  );
}

export default function TabTaskEditFact({ projectGUID, taskGUID }: { projectGUID: string | null; taskGUID: string }) {
  const { themeColors } = useDesignSystem();
  // the Customer invoice tab is there only while the project switch is on
  const customerOn = usePMStore((s) => customerInvoiceEnabledOf(projectGUID ? s.projectsById[projectGUID]?.rowJSON : undefined));
  const tabs = TASK_EDIT_FACT_TABS.filter((t) => t.id !== 'TabCustomerInvoice' || customerOn);
  const [active, setActive] = useState<TaskEditFactTab>('TabFactInput');
  const [visited, setVisited] = useState<Record<string, boolean>>({ TabFactInput: true });
  const open = (id: TaskEditFactTab) => { setActive(id); setVisited((v) => (v[id] ? v : { ...v, [id]: true })); };
  // the number of documents of the task per kind (the tips); read again after each change of tab (a document may have been made or deleted in the tab left)
  const counts = useTaskDocumentCounts(taskGUID, tabs.map((t) => t.id), active);
  const show = (id: TaskEditFactTab) => (active === id ? styles.fill : styles.hidden);
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-fact">
      <View style={[styles.barBox, { borderBottomColor: themeColors.border }]}>
        <ScrollableTabBar testID="pm-task-edit-fact-tabs" style={styles.bar}>
          {tabs.map((t) => (
            <FactSubTab key={t.id} id={t.id} label={t.label} icon={t.icon} on={active === t.id} count={counts[t.id]} onPress={() => open(t.id)} />
          ))}
        </ScrollableTabBar>
      </View>
      <View style={show('TabFactInput')} testID="pm-task-edit-fact-content-TabFactInput">
        {visited.TabFactInput ? <TabFactInput projectGUID={projectGUID} taskGUID={taskGUID} /> : null}
      </View>
      <View style={show('TabProductReceipt')} testID="pm-task-edit-fact-content-TabProductReceipt">
        {visited.TabProductReceipt ? <TabProductReceipt taskGUID={taskGUID} /> : null}
      </View>
      <View style={show('TabVendorInvoice')} testID="pm-task-edit-fact-content-TabVendorInvoice">
        {visited.TabVendorInvoice ? <TabVendorInvoice taskGUID={taskGUID} /> : null}
      </View>
      {customerOn ? (
        <View style={show('TabCustomerInvoice')} testID="pm-task-edit-fact-content-TabCustomerInvoice">
          {visited.TabCustomerInvoice ? <TabCustomerInvoice taskGUID={taskGUID} /> : null}
        </View>
      ) : null}
      <View style={show('TabPaymentFact')} testID="pm-task-edit-fact-content-TabPaymentFact">
        {visited.TabPaymentFact ? <TabPaymentFact taskGUID={taskGUID} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barBox: { borderBottomWidth: 1 },
  bar: { flexDirection: 'row' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 2 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
