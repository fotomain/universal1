// Step (asked only while time costs are on) - Resource optimization: leveling / smoothing of the over-allocated resources (Project settings -> Resources).
import React from 'react';
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import { ToggleRow } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

export default function OptimizationStep({ values, onChange }: AssistantStepProps) {
  const on = values.resourceLevelingFunctionalityEnabled;
  return (
    <View>
      <ToggleRow
        id="optimization"
        title="Resource optimization"
        description="On: resources booked for more hours than their calendar allows can be levelled (tasks are delayed) or smoothed. Off: nothing changes."
        value={on}
        onChange={(resourceLevelingFunctionalityEnabled) => onChange({ resourceLevelingFunctionalityEnabled })}
      />
      {on && (
        <View testID="assistant-optimization-options">
          <Text variant="labelLarge" style={{ marginTop: 8, marginBottom: 6 }}>{pmT('Optimize')}</Text>
          <SegmentedButtons
            value={values.resourceLevelingMode}
            onValueChange={(m) => onChange({ resourceLevelingMode: m === 'automatic' ? 'automatic' : 'manual' })}
            buttons={[
              { value: 'manual', label: pmT('Manual'), testID: 'assistant-optimize-manual' },
              { value: 'automatic', label: pmT('Automatic'), testID: 'assistant-optimize-automatic' },
            ]}
          />
          <Text variant="bodySmall" style={{ marginTop: 6, opacity: 0.7 }}>{pmT(values.resourceLevelingMode === 'automatic' ? 'Optimize after every change.' : 'Optimize on command, with a preview.')}</Text>
          <Text variant="labelLarge" style={{ marginTop: 12, marginBottom: 6 }}>{pmT('Method')}</Text>
          <SegmentedButtons
            value={values.resourceLevelingWithinSlackOnly ? 'smoothing' : 'leveling'}
            onValueChange={(m) => onChange({ resourceLevelingWithinSlackOnly: m === 'smoothing' })}
            buttons={[
              { value: 'leveling', label: pmT('Leveling'), testID: 'assistant-method-leveling' },
              { value: 'smoothing', label: pmT('Smoothing'), testID: 'assistant-method-smoothing' },
            ]}
          />
          <Text variant="bodySmall" style={{ marginTop: 6, opacity: 0.7 }}>
            {pmT(values.resourceLevelingWithinSlackOnly ? 'Only the slack is used; the project finish does not change.' : 'Dates may move beyond the slack; the project finish may change.')}
          </Text>
        </View>
      )}
    </View>
  );
}
