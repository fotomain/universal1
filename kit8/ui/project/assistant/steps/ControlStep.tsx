// Step (control) - how the project is followed.
import React from 'react';
import { View } from 'react-native';
import { ToggleRow } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

export default function ControlStep({ values, onChange }: AssistantStepProps) {
  return (
    <View>
      <ToggleRow id="roi" title="ROI per task" description="Return on investment of every task, not only of the project." value={values.roiForTasksFunctionalityEnabled} onChange={(roiForTasksFunctionalityEnabled) => onChange({ roiForTasksFunctionalityEnabled })} />
      <ToggleRow id="customerInvoice" title="Customer invoices" description="Invoice the customer from the revenue lines of the tasks." value={values.customerInvoiceFunctionalityEnabled} onChange={(customerInvoiceFunctionalityEnabled) => onChange({ customerInvoiceFunctionalityEnabled })} />
      <ToggleRow id="subprojects" title="Subprojects" description="A task can stand for another project." value={values.subprojectsFunctionalityEnabled} onChange={(subprojectsFunctionalityEnabled) => onChange({ subprojectsFunctionalityEnabled })} />
      <ToggleRow id="chat" title="Chat of the tasks" description="Every task gets a chat of the people who work on it." value={values.chatFunctionalityEnabled} onChange={(chatFunctionalityEnabled) => onChange({ chatFunctionalityEnabled })} />
    </View>
  );
}
