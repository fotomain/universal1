// PMProjectPaymentsTab - "Payments" tab of the Project settings window (TabPayments, right after TabBudgets): what the payment plan of the tasks of the project may do (kit8/pm/view/task/payments,
// documentation/PAYMENTS_PLAN_WBS.html).
//   project_table.rowJSON (TRUE while never saved - the database reads a missing value as true):
//     paymentPlanAfterTaskFinishEnabled  true: the planned date of a payment may lie after the end of the task (a payment 30 days after the start of a 5 day task is fine);
//                                        false: the date must lie between the start and the end of the task (with the anchor "Task end" only shift 0 is possible)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectPaymentsValues {
  paymentPlanAfterTaskFinishEnabled?: boolean;
}

/** a missing value is TRUE (a payment may be planned after the end of the task, also for a project made before the setting) */
export const paymentsValuesOf = (j: PMProjectPaymentsValues | undefined | null): Required<PMProjectPaymentsValues> => ({
  paymentPlanAfterTaskFinishEnabled: j?.paymentPlanAfterTaskFinishEnabled !== false,
});

/** may the payments of a project be planned after the end of their task (its rowJSON)? */
export const paymentPlanAfterTaskFinishOf = (j: PMProjectPaymentsValues | undefined | null): boolean => paymentsValuesOf(j).paymentPlanAfterTaskFinishEnabled;

export default function PMProjectPaymentsTab({ values, onChange }: { values: PMProjectPaymentsValues; onChange: (patch: PMProjectPaymentsValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = paymentsValuesOf(values);
  return (
    <View testID="pm-project-tab-payments-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Payment plan')}</Text>
      <SwitchApp
        testID="pm-project-payment-plan-after-finish"
        label={pmT('Payment plan after the task finish date (paymentPlanAfterTaskFinishEnabled)')}
        value={v.paymentPlanAfterTaskFinishEnabled}
        onValueChange={(on) => onChange({ paymentPlanAfterTaskFinishEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: the planned date of a payment may lie after the end of its task. Off: it must lie between the start and the end of the task (a payment after the end is refused at Post).')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
