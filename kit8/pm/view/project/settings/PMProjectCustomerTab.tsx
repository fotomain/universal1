// PMProjectCustomerTab - "Customer" tab of the Project settings window (TabCustomer, after TabVendor): what the customer invoices of the project's tasks may do (kit8/documents/customer/invoice).
//   project_table.rowJSON (TRUE while never saved - the database reads a missing value as true):
//     customerInvoiceFunctionalityEnabled  true: the context menu of a task has "Create based on this → Customer invoice" (made from the Deliverable = Revenue lines of the task) and "Go to → Customer invoices",
//                                          the Customer invoice column group of Monitor01 is filled; false: no customer invoice can be made for the tasks of the project
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectCustomerValues {
  customerInvoiceFunctionalityEnabled?: boolean;
}

/** a missing value is TRUE (the functionality is on by default, also for a project made before the setting) */
export const customerValuesOf = (j: PMProjectCustomerValues | undefined | null): Required<PMProjectCustomerValues> => ({
  customerInvoiceFunctionalityEnabled: j?.customerInvoiceFunctionalityEnabled !== false,
});

/** is the customer invoice functionality on for a project (its rowJSON)? */
export const customerInvoiceEnabledOf = (j: PMProjectCustomerValues | undefined | null): boolean => customerValuesOf(j).customerInvoiceFunctionalityEnabled;

export default function PMProjectCustomerTab({ values, onChange }: { values: PMProjectCustomerValues; onChange: (patch: PMProjectCustomerValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = customerValuesOf(values);
  return (
    <View testID="pm-project-tab-customer-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Customer invoices')}</Text>
      <SwitchApp
        testID="pm-project-customer-invoice-enabled"
        label={pmT('Customer invoice functionality (customerInvoiceFunctionalityEnabled)')}
        value={v.customerInvoiceFunctionalityEnabled}
        onValueChange={(on) => onChange({ customerInvoiceFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: the Task menu has "Create based on this → Customer invoice" (made from the Deliverable lines of the task) and "Go to → Customer invoices". Off: no customer invoice is made for the tasks of this project.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
