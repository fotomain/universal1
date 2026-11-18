// Step 4 - which money the project controls: revenue and / or costs (time, material, expenses).
import React from 'react';
import { View } from 'react-native';
import { Divider } from 'react-native-paper';
import { ToggleRow } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

export default function BudgetsStep({ values, onChange }: AssistantStepProps) {
  return (
    <View>
      <ToggleRow id="revenue" title="Revenue budget" description="The project earns money (invoices to customers)." value={values.projectRevenueBudgetNeeded} onChange={(projectRevenueBudgetNeeded) => onChange({ projectRevenueBudgetNeeded })} />
      <Divider />
      <ToggleRow id="cost" title="Cost budget" description="The project spends money: you plan and follow its costs." value={values.projectExpenseBudgetNeeded} onChange={(projectExpenseBudgetNeeded) => onChange({ projectExpenseBudgetNeeded })} />
      {values.projectExpenseBudgetNeeded && (
        <View style={{ paddingLeft: 16 }}>
          <ToggleRow id="time" title="Time (work of people, equipment, partners)" value={values.projectTimeCostsNeeded} onChange={(projectTimeCostsNeeded) => onChange({ projectTimeCostsNeeded })} />
          <ToggleRow id="material" title="Material (products and goods)" value={values.projectMaterialCostsNeeded} onChange={(projectMaterialCostsNeeded) => onChange({ projectMaterialCostsNeeded })} />
          <ToggleRow id="expense" title="Expenses (travel, services, fees)" value={values.projectExpenseCostsNeeded} onChange={(projectExpenseCostsNeeded) => onChange({ projectExpenseCostsNeeded })} />
        </View>
      )}
    </View>
  );
}
