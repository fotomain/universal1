// PMProjectRoiTab - "ROI" tab of the Project settings window (TabROI, after TabSubprojects) and of Organization edit -> Projects -> Settings (documentation/ROI_DOC.html section 2, kit8/pm/reports/roi).
//   project_table.rowJSON - EVERY key is OFF while never saved (the database reads a missing value as false):
//     roiForTasksFunctionalityEnabled   ROI per TASK: Monitor02 shows this project, with a line per task (off: the project is not in Monitor02 and no task is calculated)
//     roiHistoryFunctionalityEnabled    the ROI history: a snapshot is written whenever the totals change (Monitor03, "as seen on")
//     projectROIIncludeAllTaxes         master: both VAT switches below count as ON (shown ON and locked)
//     projectROIIncludeSaleVAT          the VAT of the revenue side is added to the revenue
//     projectROIIncludePurchaseVAT      ALL the VAT of the cost side is added to the cost (off: net + the VAT that is cost, the IFRS / GAAP cost)
// The values and the rules are in kit8/pm/reports/roi/roiSettings.ts (pure); this file is only the form.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { pmT } from '../../../i18n/pmT';
import { PMProjectRoiValues, roiValuesOf } from '../../../reports/roi/roiSettings';

export type { PMProjectRoiValues };
export { roiValuesOf };

export default function PMProjectRoiTab({ values, onChange }: { values: PMProjectRoiValues; onChange: (patch: PMProjectRoiValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = roiValuesOf(values);
  const all = v.projectROIIncludeAllTaxes;
  return (
    <View testID="pm-project-tab-roi-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('ROI reports')}</Text>
      <SwitchApp
        testID="pm-project-roi-for-tasks"
        label={pmT('ROI for tasks (roiForTasksFunctionalityEnabled)')}
        value={v.roiForTasksFunctionalityEnabled}
        onValueChange={(on) => onChange({ roiForTasksFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: Monitor02 (ROI now) shows this project, with a line per task. Off: the project is not in Monitor02 and no task is calculated.')}</Text>
      <SwitchApp
        testID="pm-project-roi-history"
        label={pmT('ROI history (roiHistoryFunctionalityEnabled)')}
        value={v.roiHistoryFunctionalityEnabled}
        onValueChange={(on) => onChange({ roiHistoryFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: a snapshot of the project ROI is written whenever its totals change (Monitor03, "as seen on a date"). History exists only from the day it is switched on; the rows already written are kept when it is switched off.')}</Text>

      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Taxes (VAT) in the ROI')}</Text>
      <SwitchApp
        testID="pm-project-roi-all-taxes"
        label={pmT('Include all taxes (VAT) (projectROIIncludeAllTaxes)')}
        value={all}
        onValueChange={(on) => onChange({ projectROIIncludeAllTaxes: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: both switches below count as on. The system stores VAT only: no other tax.')}</Text>
      <SwitchApp
        testID="pm-project-roi-sale-vat"
        label={pmT('Include the sale VAT (projectROIIncludeSaleVAT)')}
        value={all || v.projectROIIncludeSaleVAT}
        disabled={all}
        onValueChange={(on) => onChange({ projectROIIncludeSaleVAT: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: the VAT of the planned revenue, the fact input and the customer invoices is added to the revenue. Off: revenue is net.')}</Text>
      <SwitchApp
        testID="pm-project-roi-purchase-vat"
        label={pmT('Include the purchase VAT (projectROIIncludePurchaseVAT)')}
        value={all || v.projectROIIncludePurchaseVAT}
        disabled={all}
        onValueChange={(on) => onChange({ projectROIIncludePurchaseVAT: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: ALL the VAT of the plan and of the vendor invoices is added to the cost. Off: cost = net + the part of the VAT that is cost (not recoverable) - the IFRS / GAAP cost.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
});
