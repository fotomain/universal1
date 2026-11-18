// Step 5 - which kinds of resource a time line may book (asked only while time costs are on).
import React from 'react';
import { View } from 'react-native';
import { ToggleRow } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

export default function ResourcesStep({ values, onChange }: AssistantStepProps) {
  return (
    <View>
      <ToggleRow id="person" title="People" description="Employees and contractors booked by the hour." value={values.projectTimeOfPersonNeeded} onChange={(projectTimeOfPersonNeeded) => onChange({ projectTimeOfPersonNeeded })} />
      <ToggleRow id="equipment" title="Equipment" description="Machines and tools with their own calendar." value={values.projectTimeOfEquipmentNeeded} onChange={(projectTimeOfEquipmentNeeded) => onChange({ projectTimeOfEquipmentNeeded })} />
      <ToggleRow id="partner" title="Partners (suppliers)" description="A supplier's time, paid through vendor invoices." value={values.projectTimeOfPartnerNeeded} onChange={(projectTimeOfPartnerNeeded) => onChange({ projectTimeOfPartnerNeeded })} />
    </View>
  );
}
