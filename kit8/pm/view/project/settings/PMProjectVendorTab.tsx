// PMProjectVendorTab - "Vendor" tab of the Project settings window (TabVendor, after TabBudgets): what the vendor invoices of the project's tasks may do (kit8/documents/vendor/invoice).
//   project_table.rowJSON (both TRUE while never saved - the database reads a missing value as true):
//     userCanCreateVendorInvoicesFromTasksWithEmptyVendors  true: "Vendor Invoice" of a task / task line also makes ONE draft WITHOUT a vendor of the lines that have none (the vendor is chosen in the invoice before Post)
//                                                           false: such lines are left out - an invoice is made only for the vendors the lines have
//     independentInvoiceInputAvailable                      true: the lines of a DRAFT vendor invoice can be added (a CRUD panel above the lines), not tied to a task line; false: only the lines made from the task lines
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectVendorValues {
  userCanCreateVendorInvoicesFromTasksWithEmptyVendors?: boolean;
  independentInvoiceInputAvailable?: boolean;
}

/** a missing value is TRUE (a project made before the setting works as the setting says by default) */
export const vendorValuesOf = (j: PMProjectVendorValues | undefined | null): Required<PMProjectVendorValues> => ({
  userCanCreateVendorInvoicesFromTasksWithEmptyVendors: j?.userCanCreateVendorInvoicesFromTasksWithEmptyVendors !== false,
  independentInvoiceInputAvailable: j?.independentInvoiceInputAvailable !== false,
});

export default function PMProjectVendorTab({ values, onChange }: { values: PMProjectVendorValues; onChange: (patch: PMProjectVendorValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = vendorValuesOf(values);
  return (
    <View testID="pm-project-tab-vendor-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Vendor invoices')}</Text>
      <SwitchApp
        testID="pm-project-vendor-empty-vendors"
        label={pmT('Create vendor invoices from tasks with empty vendors (userCanCreateVendorInvoicesFromTasksWithEmptyVendors)')}
        value={v.userCanCreateVendorInvoicesFromTasksWithEmptyVendors}
        onValueChange={(on) => onChange({ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: the lines that have no vendor make one draft without a vendor; the vendor is chosen in the invoice before Post. Off: such lines are left out.')}</Text>
      <SwitchApp
        testID="pm-project-vendor-independent-input"
        label={pmT('Independent invoice input (independentInvoiceInputAvailable)')}
        value={v.independentInvoiceInputAvailable}
        onValueChange={(on) => onChange({ independentInvoiceInputAvailable: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: lines can be added to a draft vendor invoice by hand (a CRUD panel above its lines), not tied to a task line. Off: only the lines made from the task lines.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
