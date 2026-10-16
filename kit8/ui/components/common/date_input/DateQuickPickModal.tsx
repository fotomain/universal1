// DateQuickPickModal - the calendar of DateInputApp, with a row of quick-pick buttons (Today · Tomorrow · Yesterday) right above the library's own header
// ("Select date" / pencil / Save), so a one-day pick needs no month grid at all. Built from the pieces `react-native-paper-dates` exports PUBLICLY
// (DatePickerModalContent, the calendar + its header + Save - but not the outer Modal): the outer Modal / backdrop / content box here is our own, copied
// from the library's own `DatePickerModal` (react-native-paper-dates/lib/module/Date/DatePickerModal.js) so the calendar still looks and behaves the same.
// A quick-pick button fires the SAME onConfirm as picking a day in the grid (one place decides what "a day was picked" does); a day outside `validRange`
// is shown but disabled, as a day of the grid itself would be.
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { DatePickerModalContent } from 'react-native-paper-dates';
import { dateInValidRange, localToday, localTomorrow, localYesterday } from './dateInputFormat';

export interface DateQuickPickModalProps {
  visible: boolean;
  locale: string;
  date?: Date;
  onChange?: (p: { date?: Date }) => void;
  onConfirm: (p: { date?: Date }) => void;
  onDismiss: () => void;
  label?: string;
  validRange?: { startDate?: Date; endDate?: Date };
  /** false hides the quick-pick row (the calendar alone, as before) */
  showQuickDates?: boolean;
  todayLabel?: string;
  tomorrowLabel?: string;
  yesterdayLabel?: string;
  testID?: string;
}

const QuickButton = ({ label, date, validRange, onPress, color, disabledColor, borderColor, testID }: {
  label: string; date: Date; validRange?: { startDate?: Date; endDate?: Date }; onPress: (date: Date) => void; color: string; disabledColor: string; borderColor: string; testID: string;
}) => {
  const enabled = dateInValidRange(date, validRange);
  return (
    <TouchableWithoutFeedback testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !enabled }} onPress={enabled ? () => onPress(date) : undefined}>
      <View style={[styles.quickButton, { borderColor }, !enabled && styles.quickButtonDisabled]}>
        <Text style={[styles.quickButtonText, { color: enabled ? color : disabledColor }]}>{label}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default function DateQuickPickModal({
  visible, locale, date, onChange, onConfirm, onDismiss, label, validRange, showQuickDates = true, todayLabel = 'Today', tomorrowLabel = 'Tomorrow', yesterdayLabel = 'Yesterday', testID = 'date-quick-pick',
}: DateQuickPickModalProps) {
  const theme = useTheme();
  const pick = (d: Date) => onConfirm({ date: d });
  // closed: build nothing (as the calendar's own mock does) - no point constructing the content, and the theme of a bare test host may have no MD3 tokens
  if (!visible) return null;
  const elevation3 = theme.colors.elevation?.level3 ?? theme.colors.surface;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Modal animationType={Platform.select({ web: 'none', default: 'slide' })} transparent visible={visible} onRequestClose={onDismiss} statusBarTranslucent>
        <TouchableWithoutFeedback testID={`${testID}-backdrop`} onPress={onDismiss}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.backdrop }]} />
        </TouchableWithoutFeedback>
        <View style={[StyleSheet.absoluteFill, styles.modalRoot]} pointerEvents="box-none">
          <View style={[styles.modalContent, { backgroundColor: elevation3 }]}>
            {showQuickDates && (
              <View testID={`${testID}-row`} style={[styles.quickRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                <QuickButton testID={`${testID}-today`} label={todayLabel} date={localToday()} validRange={validRange} onPress={pick} color={theme.colors.primary} disabledColor={theme.colors.outline} borderColor={theme.colors.outline} />
                <QuickButton testID={`${testID}-tomorrow`} label={tomorrowLabel} date={localTomorrow()} validRange={validRange} onPress={pick} color={theme.colors.primary} disabledColor={theme.colors.outline} borderColor={theme.colors.outline} />
                <QuickButton testID={`${testID}-yesterday`} label={yesterdayLabel} date={localYesterday()} validRange={validRange} onPress={pick} color={theme.colors.primary} disabledColor={theme.colors.outline} borderColor={theme.colors.outline} />
              </View>
            )}
            <DatePickerModalContent mode="single" locale={locale} date={date} onChange={onChange} onConfirm={onConfirm} onDismiss={onDismiss} label={label} validRange={validRange} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  modalContent: { flex: 1, width: '100%', maxWidth: 400, maxHeight: 600, borderRadius: 28, overflow: 'hidden' },
  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  quickButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  quickButtonDisabled: { opacity: 0.4 },
  quickButtonText: { fontSize: 13, fontWeight: '600' },
});
