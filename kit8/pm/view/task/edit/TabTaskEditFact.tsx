// TabTaskEditFact - the 1st level tab "Fact" of the task window. It has 2nd level tabs (like TabTaskEditMain has Main · UX/UI), each with the list of the documents of THIS task:
//   TabFactInput       the fact input documents (TabFactInput.tsx)
//   TabProductReceipt  the product receipts (TabProductReceipt.tsx)
//   TabVendorInvoice   the vendor invoices (TabVendorInvoice.tsx)
//   TabCustomerInvoice the customer invoices (TabCustomerInvoice.tsx; only while the project switch customerInvoiceFunctionalityEnabled is on)
// A list is created when its tab is first opened (it reads the database) and kept after that.
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
import { usePMStore } from '../../../store/store_pm';
import { customerInvoiceEnabledOf } from '../../project/settings/PMProjectCustomerTab';

export type TaskEditFactTab = 'TabFactInput' | 'TabProductReceipt' | 'TabVendorInvoice' | 'TabCustomerInvoice';
export const TASK_EDIT_FACT_TABS: { id: TaskEditFactTab; label: string; icon: string }[] = [
  { id: 'TabFactInput', label: 'Fact input', icon: 'fact_check' },
  { id: 'TabProductReceipt', label: 'Product receipt', icon: 'move_to_inbox' },
  { id: 'TabVendorInvoice', label: 'Vendor invoice', icon: 'receipt_long' },
  { id: 'TabCustomerInvoice', label: 'Customer invoice', icon: 'payments' },
];

export default function TabTaskEditFact({ projectGUID, taskGUID }: { projectGUID: string | null; taskGUID: string }) {
  const { themeColors } = useDesignSystem();
  // the Customer invoice tab is there only while the project switch is on
  const customerOn = usePMStore((s) => customerInvoiceEnabledOf(projectGUID ? s.projectsById[projectGUID]?.rowJSON : undefined));
  const tabs = TASK_EDIT_FACT_TABS.filter((t) => t.id !== 'TabCustomerInvoice' || customerOn);
  const [active, setActive] = useState<TaskEditFactTab>('TabFactInput');
  const [visited, setVisited] = useState<Record<string, boolean>>({ TabFactInput: true });
  const open = (id: TaskEditFactTab) => { setActive(id); setVisited((v) => (v[id] ? v : { ...v, [id]: true })); };
  const show = (id: TaskEditFactTab) => (active === id ? styles.fill : styles.hidden);
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-fact">
      <View style={[styles.barBox, { borderBottomColor: themeColors.border }]}>
        <ScrollableTabBar testID="pm-task-edit-fact-tabs" style={styles.bar}>
          {tabs.map((t) => {
            const on = active === t.id;
            return (
              <Pressable
                key={t.id}
                testID={`pm-task-edit-fact-${t.id}`}
                accessibilityRole="tab"
                aria-selected={on}
                onPress={() => open(t.id)}
                style={[styles.tab, { borderBottomColor: on ? themeColors.primary : 'transparent', backgroundColor: on ? `${themeColors.primary}18` : 'transparent' }]}
              >
                <IconApp name={t.icon} size={16} color={on ? themeColors.primary : themeColors.text} />
                <Text style={{ fontSize: 13, color: on ? themeColors.primary : themeColors.text, fontWeight: on ? '700' : '500' }}>{pmT(t.label)}</Text>
              </Pressable>
            );
          })}
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
