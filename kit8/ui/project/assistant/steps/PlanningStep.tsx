// Step 3 - how fine the plan is: day by day or hour by hour (Project settings -> Resources -> Planning model), and the unit of the resource load.
import React from 'react';
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import { HOUR_BY_HOUR_MODEL_AVAILABLE, type ResourceGrainUnit, type ResourceOptimizationMode } from '../../../../pm/resourceleveling/resourceLevelingSettings';
import { ChipChoice } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

const GRAINS: { value: ResourceGrainUnit; label: string }[] = [
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

export default function PlanningStep({ values, onChange }: AssistantStepProps) {
  const hour = values.resourceOptimizationMode === 'hourByHourModel';
  return (
    <View>
      <Text variant="labelLarge" style={{ marginBottom: 6 }}>{pmT('Planning model')}</Text>
      <SegmentedButtons
        value={values.resourceOptimizationMode}
        onValueChange={(m) => onChange({ resourceOptimizationMode: (m === 'hourByHourModel' && HOUR_BY_HOUR_MODEL_AVAILABLE ? 'hourByHourModel' : 'dayByDayModel') as ResourceOptimizationMode })}
        buttons={[
          { value: 'dayByDayModel', label: pmT('Day by day'), testID: 'assistant-model-day' },
          { value: 'hourByHourModel', label: pmT('Hour by hour'), disabled: !HOUR_BY_HOUR_MODEL_AVAILABLE, testID: 'assistant-model-hour' },
        ]}
      />
      <Text variant="bodySmall" style={{ marginTop: 6, marginBottom: 8, opacity: 0.7 }}>
        {pmT(hour ? 'Time of day: start times, durations and delays are whole minutes; the calendar has working windows.' : 'The plan counts working days, as it does today.')}
      </Text>
      <ChipChoice
        id="grain"
        label="Unit of resource load"
        items={GRAINS.map((g) => ({ value: g.value, label: pmT(g.label) }))}
        value={values.resourceGrainUnit}
        onChange={(resourceGrainUnit) => onChange({ resourceGrainUnit })}
        hint="The unit shown for the hours of a resource and the period in which its load is compared with its calendar."
      />
    </View>
  );
}
