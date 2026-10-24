// PMProjectPaymentsTab - "Payments" tab of the Project settings window (TabPayments, right after TabBudgets): what the payment plan of the tasks of the project may do (kit8/pm/view/task/payments,
// documentation/PAYMENTS_PLAN_WBS.html).
//   project_table.rowJSON (TRUE while never saved - the database reads a missing value as true):
//     paymentPlanAfterTaskFinishEnabled  true: the planned date of a payment may lie after the end of the task (a payment 30 days after the start of a 5 day task is fine);
//                                        false: the date must lie between the start and the end of the task (with the anchor "Task end" only shift 0 is possible)
//     paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled
//                                        true: ONE payment fact may carry lines whose business units belong to different first level roots of the business unit tree;
//                                        false: a payment fact with a line of this project must keep all its business units under ONE root (Post refuses otherwise: businessUnitsOfDifferentRoots)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectPaymentsValues {
  paymentPlanAfterTaskFinishEnabled?: boolean;
  paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled?: boolean;
}

/** a missing value is TRUE (a payment may be planned after the end of the task, also for a project made before the setting) */
export const paymentsValuesOf = (j: PMProjectPaymentsValues | undefined | null): Required<PMProjectPaymentsValues> => ({
  paymentPlanAfterTaskFinishEnabled: j?.paymentPlanAfterTaskFinishEnabled !== false,
  paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: j?.paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled !== false,
});

/** may ONE payment fact of a project carry business units of different first level roots (its rowJSON)? TRUE unless stored false */
export const paymentDifferentRootsOf = (j: PMProjectPaymentsValues | undefined | null): boolean => paymentsValuesOf(j).paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled;

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
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Payment fact')}</Text>
      <SwitchApp
        testID="pm-project-payment-different-roots"
        label={pmT('A payment may contain business units of different 1st level roots (paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled)')}
        value={v.paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled}
        onValueChange={(on) => onChange({ paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On (default): one payment fact may have lines with business units of different first level roots of the business unit tree. Off: all the business units of a payment fact that has a line of this project must be under one root (Post is refused otherwise).')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
