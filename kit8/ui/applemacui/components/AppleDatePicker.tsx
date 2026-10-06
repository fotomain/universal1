// AppleDatePicker (iOS / Android): a field that opens the date / time picker. Same API as the web file
// (value, onChange, mode date | time | datetime, min, max).
//
// The pickers come from react-native-paper-dates, which the app already ships. The brief's native pickers
// (@react-native-community/datetimepicker wheel / compact on iOS, react-native-date-picker wheel on Android) are NOT
// installed - adding them changes the stack and needs a new dev build, so that is left as a decision: only this file
// changes when they are added.
import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import IconApp from '../../components/common/IconApp';
import { useAppleMacUI } from '../WithAppleMacUI';
import { AppleDatePickerProps, clampDate, formatPickerValue } from './appleDatePickerShared';

export type { AppleDatePickerProps, AppleDatePickerMode } from './appleDatePickerShared';

export const AppleDatePicker = memo(function AppleDatePicker({ value, onChange, mode = 'date', min, max, label, placeholder, disabled = false, locale = 'en', style, testID = 'apple-date-picker' }: AppleDatePickerProps) {
  const { theme, text } = useAppleMacUI();
  const [step, setStep] = useState<'closed' | 'date' | 'time'>('closed');
  const [pending, setPending] = useState<Date | null>(null);
  const c = theme.colors;
  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { width: '100%', marginBottom: theme.space[3] },
        label: { ...text('subhead'), color: c.secondaryLabel, marginBottom: theme.space[1] + 2, marginLeft: theme.space[1] },
        field: { minHeight: theme.size.touchTarget, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[3], borderRadius: theme.radii.input, backgroundColor: c.tertiaryFill, opacity: disabled ? 0.5 : 1 },
        value: { ...text('body'), flex: 1, color: c.label },
        placeholder: { color: c.placeholderText },
      }),
    [theme, text, c, disabled]
  );
  const shown = formatPickerValue(value, mode);
  const current = value && !isNaN(value.getTime()) ? value : new Date();
  const finish = (d: Date) => {
    setStep('closed');
    setPending(null);
    onChange(mode === 'time' ? d : clampDate(d, min, max));
  };
  return (
    <View style={[s.root, style]}>
      {!!label && (
        <Text style={s.label} allowFontScaling>
          {label}
        </Text>
      )}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${shown || placeholder || ''}` : shown || placeholder}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setStep(mode === 'time' ? 'time' : 'date')}
        style={s.field}
      >
        <Text style={[s.value, !shown && s.placeholder]} numberOfLines={1} allowFontScaling>
          {shown || placeholder || (mode === 'time' ? 'HH:MM' : 'YYYY-MM-DD')}
        </Text>
        <IconApp name={mode === 'time' ? 'schedule' : 'calendar_today'} size={18} color={theme.tint} />
      </Pressable>
      <DatePickerModal
        locale={locale}
        mode="single"
        visible={step === 'date'}
        date={current}
        validRange={{ startDate: min, endDate: max }}
        onDismiss={() => setStep('closed')}
        onConfirm={({ date }: { date?: Date }) => {
          const d = new Date(date || current);
          d.setHours(current.getHours(), current.getMinutes(), 0, 0);
          if (mode === 'datetime') {
            setPending(d);
            setStep('time');
          } else finish(d);
        }}
      />
      <TimePickerModal
        locale={locale}
        visible={step === 'time'}
        hours={current.getHours()}
        minutes={current.getMinutes()}
        onDismiss={() => setStep('closed')}
        onConfirm={({ hours, minutes }: { hours: number; minutes: number }) => {
          const d = new Date(pending || current);
          d.setHours(hours, minutes, 0, 0);
          finish(d);
        }}
      />
    </View>
  );
});

export default AppleDatePicker;
