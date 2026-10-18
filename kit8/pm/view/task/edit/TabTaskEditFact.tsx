// TabTaskEditFact - the 1st level tab "Fact" of the task window. It has 2nd level tabs (like TabTaskEditMain has Main · UX/UI), each with the list of the documents of THIS task:
//   TabFactInput       the fact input documents (TabFactInput.tsx)
//   TabProductReceipt  the product receipts (TabProductReceipt.tsx)
//   TabVendorInvoice   the vendor invoices (TabVendorInvoice.tsx)
// A list is created when its tab is first opened (it reads the database) and kept after that.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import { pmT } from '../../../i18n/pmT';
import TabFactInput from './TabFactInput';
import TabProductReceipt from './TabProductReceipt';
import TabVendorInvoice from './TabVendorInvoice';

export type TaskEditFactTab = 'TabFactInput' | 'TabProductReceipt' | 'TabVendorInvoice';
export const TASK_EDIT_FACT_TABS: { id: TaskEditFactTab; label: string; icon: string }[] = [
  { id: 'TabFactInput', label: 'Fact input', icon: 'fact_check' },
  { id: 'TabProductReceipt', label: 'Product receipt', icon: 'move_to_inbox' },
  { id: 'TabVendorInvoice', label: 'Vendor invoice', icon: 'receipt_long' },
];

export default function TabTaskEditFact({ projectGUID, taskGUID }: { projectGUID: string | null; taskGUID: string }) {
  const { themeColors } = useDesignSystem();
  const [active, setActive] = useState<TaskEditFactTab>('TabFactInput');
  const [visited, setVisited] = useState<Record<string, boolean>>({ TabFactInput: true });
  const open = (id: TaskEditFactTab) => { setActive(id); setVisited((v) => (v[id] ? v : { ...v, [id]: true })); };
  const show = (id: TaskEditFactTab) => (active === id ? styles.fill : styles.hidden);
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-fact">
      <View style={[styles.barBox, { borderBottomColor: themeColors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="pm-task-edit-fact-tabs" contentContainerStyle={styles.bar}>
          {TASK_EDIT_FACT_TABS.map((t) => {
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
        </ScrollView>
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
