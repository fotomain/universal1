// Step 4 (hour by hour only) - the clock of the plan: the step in minutes, the working windows of a day, the time zone (Project settings -> Resources -> Time of day).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import { parseWindowsText, timeZoneIsValid } from '../../../../pm/hourmodel/hourModelSettings';
import { SLOT_MINUTE_CHOICES } from '../../../../pm/hourmodel/minutes';
import { ChipChoice } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

const WINDOW_PRESETS: { id: string; label: string; text: string }[] = [
  { id: 'office', label: '8 hours', text: '08:00-16:00' },
  { id: 'lunch', label: 'With a lunch break', text: '09:00-13:00, 14:00-18:00' },
  { id: 'twoShifts', label: 'Two shifts', text: '06:00-14:00, 14:00-22:00' },
  { id: 'roundClock', label: 'Round the clock', text: '00:00-24:00' },
];

const deviceTimeZone = (): string | undefined => {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && timeZoneIsValid(z) ? z : undefined;
  } catch {
    return undefined;
  }
};

export default function TimeOfDayStep({ values, onChange }: AssistantStepProps) {
  const zone = values.projectTimeZone.trim();
  const zoneBad = zone === '' || !timeZoneIsValid(zone);
  const windowsBad = parseWindowsText(values.workWindowsText) === null;
  const device = deviceTimeZone();
  return (
    <View>
      <ChipChoice
        id="slot"
        label="Step (minutes)"
        items={SLOT_MINUTE_CHOICES.map((n) => ({ value: n as number, label: String(n) }))}
        value={values.resourceSlotMinutes}
        onChange={(resourceSlotMinutes) => onChange({ resourceSlotMinutes })}
        hint="The smallest step of a start time and of a leveling move, in minutes. The checks are exact to the minute."
      />

      <TextInput
        mode="outlined"
        label={pmT('Time zone')}
        value={values.projectTimeZone}
        onChangeText={(projectTimeZone) => onChange({ projectTimeZone })}
        error={zoneBad}
        autoCapitalize="none"
        autoCorrect={false}
        testID="assistant-zone"
      />
      <HelperText type={zoneBad ? 'error' : 'info'} visible>
        {zoneBad ? pmT('This is not a time zone name, for example Europe/Berlin.') : pmT('The zone the windows are read in; it matters when the plan is posted.')}
      </HelperText>
      <View style={styles.row}>
        {device ? <Button compact mode="text" onPress={() => onChange({ projectTimeZone: device })} testID="assistant-zone-device">{`${pmT('This device')}: ${device}`}</Button> : null}
        <Button compact mode="text" onPress={() => onChange({ projectTimeZone: 'UTC' })} testID="assistant-zone-utc">UTC</Button>
      </View>
      <TextInput
        mode="outlined"
        label={pmT('Working windows of a day')}
        value={values.workWindowsText}
        onChangeText={(workWindowsText) => onChange({ workWindowsText })}
        error={windowsBad}
        autoCapitalize="none"
        autoCorrect={false}
        testID="assistant-windows"
        style={{ marginTop: 8 }}
      />
      <HelperText type={windowsBad ? 'error' : 'info'} visible>
        {pmT('From-to, separated by commas, for example 09:00-13:00, 14:00-18:00. A break is the gap between two windows.')}
      </HelperText>
      <View style={styles.row}>
        {WINDOW_PRESETS.map((p) => (
          <Button key={p.id} compact mode="text" onPress={() => onChange({ workWindowsText: p.text })} testID={`assistant-windows-${p.id}`}>{pmT(p.label)}</Button>
        ))}
      </View>

      <Text variant="bodySmall" style={{ opacity: 0.7, marginTop: 4 }}>{pmT('The time-of-day model plans from the project start; a plan from the finish date is not used in it.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap' } });
