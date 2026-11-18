// Step 2 - when: start (required), finish (optional), the accuracy of the plan and the working days.
import React from 'react';
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import { DateField, ToggleRow } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

export default function ScheduleStep({ values, ctx, onChange }: AssistantStepProps) {
  return (
    <View>
      <DateField id="start" label="Start date" value={values.projectStartDate} onChange={(projectStartDate) => onChange({ projectStartDate })} today={ctx.today} presets="start" helper="The day the first task can begin." />
      <DateField id="finish" label="Finish date (target)" value={values.projectFinishDate} onChange={(projectFinishDate) => onChange({ projectFinishDate })} today={ctx.today} presets="finish" helper="Leave empty while the plan decides it." />
      <Text variant="labelLarge" style={{ marginTop: 8, marginBottom: 6 }}>{pmT('Accuracy of the plan')}</Text>
      <SegmentedButtons
        value={values.planUnit}
        onValueChange={(v) => onChange({ planUnit: v === 'hour' ? 'hour' : 'day' })}
        buttons={[
          { value: 'day', label: pmT('Days'), testID: 'assistant-plan-day' },
          { value: 'hour', label: pmT('Days and hours'), testID: 'assistant-plan-hour' },
        ]}
      />
      <ToggleRow id="skipWeekends" title="Skip weekends" description="Saturdays and Sundays are not working days of the plan." value={values.skipWeekends} onChange={(skipWeekends) => onChange({ skipWeekends })} />
    </View>
  );
}
