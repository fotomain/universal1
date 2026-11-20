// Step (asked only while time costs are on) - Resource optimization: leveling / smoothing of the over-allocated resources (Project settings -> Resources).
import React from 'react';
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import { ChipChoice, ToggleRow } from '../components/AssistantFields';
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
          <ChipChoice
            id="order"
            label="Leveling order"
            items={[{ value: 'standard', label: pmT('Standard') }, { value: 'priorityStandard', label: pmT('Priority, Standard') }, { value: 'idOnly', label: pmT('ID only') }]}
            value={values.resourceLevelingOrder}
            onChange={(resourceLevelingOrder) => onChange({ resourceLevelingOrder })}
            hint="Which of two competing tasks is moved first."
          />
          <ChipChoice
            id="computation"
            label="Where is a run calculated?"
            items={[{ value: 'resourceLevelingClientSideComputations', label: pmT('This device') }, { value: 'resourceLevelingServerSideComputations', label: pmT('Database (server side)') }]}
            value={values.resourceLevelingComputationSide}
            onChange={(resourceLevelingComputationSide) => onChange({ resourceLevelingComputationSide })}
            hint={values.resourceLevelingComputationSide === 'resourceLevelingServerSideComputations' ? 'The database proposes the plan and the device checks it: good for big projects, no Fast mode.' : 'The same scheduler that draws the Gantt chart: an exact preview, works with every project setting.'}
          />
          <ChipChoice
            id="posted"
            label="When a posted task must move"
            items={[{ value: 'ask', label: pmT('Ask me') }, { value: 'unpostAndMove', label: pmT('Unpost and move') }, { value: 'moveAndPostAgain', label: pmT('Move and post again') }, { value: 'keep', label: pmT('Keep their dates') }]}
            value={values.resourceLevelingPostedTasksAction}
            onChange={(resourceLevelingPostedTasksAction) => onChange({ resourceLevelingPostedTasksAction })}
            hint="A posted task is never moved without a rule: moving it unposts its lines and payments."
          />
        </View>
      )}
    </View>
  );
}
