// TabPaymentFact - the 2nd level tab "Payments" of TabTaskEditFact (after Customer invoice): the payment facts (ONE bank transaction each) that pay this task, with two sub-tabs Outbound · Inbound
// (PMPaymentFactDocumentList with the scope of the task and one direction: the chip "Task: …", the folders money account → payee, the quick filters; a click on a row opens the document; + makes a draft for the task).
// documentation/PAYMENTS_FACT_WBS.html (A1). Each sub-tab is created when it is first opened (it reads the database) and kept after that.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';
import PMPaymentFactDocumentList from '../../../../documents/payment/fact/PMPaymentFactDocumentList';
import { PAYMENT_FACT_DIRECTIONS, PaymentFactDirection } from '../../../../documents/payment/fact/paymentFactModel';
import { pmT } from '../../../i18n/pmT';

export default function TabPaymentFact({ taskGUID }: { taskGUID: string }) {
  const { themeColors } = useDesignSystem();
  const [active, setActive] = useState<PaymentFactDirection>('outbound');
  const [visited, setVisited] = useState<Record<string, boolean>>({ outbound: true });
  const open = (d: PaymentFactDirection) => { setActive(d); setVisited((v) => (v[d] ? v : { ...v, [d]: true })); };
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-payment-fact">
      <View style={[styles.barBox, { borderBottomColor: themeColors.border }]}>
        <ScrollableTabBar testID="pm-task-edit-payment-fact-tabs" style={styles.bar}>
          {PAYMENT_FACT_DIRECTIONS.map((d) => {
            const on = active === d.value;
            return (
              <Pressable
                key={d.value} testID={`pm-task-edit-payment-fact-tab-${d.value}`} accessibilityRole="tab" aria-selected={on} onPress={() => open(d.value)}
                style={[styles.tab, { borderBottomColor: on ? themeColors.primary : 'transparent' }]}
              >
                <IconApp name={d.icon} size={16} color={on ? themeColors.primary : themeColors.text} />
                <Text style={{ fontSize: 13, color: on ? themeColors.primary : themeColors.text, fontWeight: on ? '700' : '500' }}>{pmT(d.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollableTabBar>
      </View>
      {PAYMENT_FACT_DIRECTIONS.map((d) => (
        <View key={d.value} style={active === d.value ? styles.fill : styles.hidden} testID={`pm-task-edit-payment-fact-content-${d.value}`}>
          {visited[d.value] ? <PMPaymentFactDocumentList testID={`pm-task-edit-payment-fact-${d.value}`} taskGUID={taskGUID} direction={d.value} /> : null}
        </View>
      ))}
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
