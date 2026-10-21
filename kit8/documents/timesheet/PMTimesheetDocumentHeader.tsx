// PMTimesheetDocumentHeader - the HEADER of a time sheet in the form (documentation/TIME_SHEET_WBS.html section 4): document number · organization (DISABLED: the organization of the user) · work center
// (a select; the switch timesheetAllWorkCenterInputAvailable decides whether it lists only the user's own Person work center or all of them; while the user has none, the button "Create work center") ·
// start date · finish date · the period selector (the month-range window of Monitor01 + quick choices this / previous week and month) · the hours of the sheet.
// Every field is a TextInputApp-like box without its outer margin so the row is centered on one line.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import TextInputApp from '../../ui/components/common/TextInputApp';
import ButtonApp from '../../ui/components/common/ButtonApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import DateInputApp from '../../ui/components/common/date_input/DateInputApp';
import SelectPeriodButton from '../../pm/reports/monitor01/SelectPeriodButton';
import { pmT } from '../../pm/i18n/pmT';
import { TimesheetHeader, addDays, monthEnd, monthStart, timesheetPeriodProblem, todayDay, weekdayOf } from './timesheetModel';
import type { SelectOption } from './useTimesheet';

export interface PMTimesheetDocumentHeaderProps {
  header: TimesheetHeader;
  /** the sheet is a draft: the work center and the period can be changed */
  edit: boolean;
  /** the title of the organization of the user (shown, disabled) */
  organizationTitle: string;
  /** the work centers the user may pick (own Person work center, or all) */
  workCenters: SelectOption[];
  /** the user has no Person work center yet: the button "Create work center" */
  canCreateWorkCenter: boolean;
  creatingWorkCenter: boolean;
  onCreateWorkCenter: () => void;
  onWorkCenter: (guid: string) => void;
  /** the dates as typed (the form saves a valid, allowed period) */
  startText: string;
  finishText: string;
  startError: boolean;
  finishError: boolean;
  onStartText: (text: string) => void;
  onFinishText: (text: string) => void;
  /** the period selector / a quick choice applied (both dates) */
  onPeriod: (next: { startDate: string; finishDate: string }) => void;
  /** timesheetOnlyCurrentMonthInputEnabled: only periods inside the current month are offered */
  onlyCurrentMonth: boolean;
  /** the message of the period rule, '' = fine */
  periodMessage: string;
  hours: number;
  lineCount: number;
  testID?: string;
}

const FIELD = { marginBottom: 0 };
/** every element of the row is ONE height and centered vertically */
const ROW_H = 44;
/** the quick choices: this / previous week (Monday - Sunday) and month */
export function quickPeriods(now: Date = new Date()): { id: string; label: string; startDate: string; finishDate: string }[] {
  const today = todayDay(now);
  const mondayOffset = (weekdayOf(today) + 6) % 7;
  const monday = addDays(today, -mondayOffset);
  const prevMonthDay = addDays(monthStart(today), -1);
  return [
    { id: 'thisWeek', label: 'This week', startDate: monday, finishDate: addDays(monday, 6) },
    { id: 'previousWeek', label: 'Previous week', startDate: addDays(monday, -7), finishDate: addDays(monday, -1) },
    { id: 'thisMonth', label: 'This month', startDate: monthStart(today), finishDate: monthEnd(today) },
    { id: 'previousMonth', label: 'Previous month', startDate: monthStart(prevMonthDay), finishDate: monthEnd(prevMonthDay) },
  ];
}

export default function PMTimesheetDocumentHeader(p: PMTimesheetDocumentHeaderProps) {
  const { themeColors: c } = useDesignSystem();
  const testID = p.testID ?? 'timesheet';
  // with the month switch on a quick choice that leaves today's month is not offered
  const quick = quickPeriods().filter((q) => !p.onlyCurrentMonth || timesheetPeriodProblem(q.startDate, q.finishDate, true) === null);
  return (
    <View testID={`${testID}-form`} style={styles.form}>
      <View style={[styles.cell, { width: 130 }]}>
        <TextInputApp testID={`${testID}-field-number`} label={pmT('Document')} value={p.header.documentNumber} compact disabled hideClearIcon style={FIELD} />
      </View>
      <View style={[styles.cell, { width: 220 }]}>
        {/* the organization of the user: shown, never edited */}
        <TextInputApp testID={`${testID}-field-organization`} label={pmT('Organization')} value={p.organizationTitle} compact disabled hideClearIcon style={FIELD} />
      </View>
      <View style={[styles.cell, { width: 260 }]}>
        <SelectItemFromListApp
          testID={`${testID}-field-workCenter`} items={p.workCenters} value={p.header.workCenter} onSelect={(v) => { if (v) p.onWorkCenter(v); }} disabled={!p.edit}
          placeholder={pmT('Work center')} searchPlaceholder={pmT('Work center')} fieldHeight={42} fieldRadius={4}
        />
      </View>
      {p.canCreateWorkCenter && p.edit && (
        // the Person of the user has no work center yet: one click makes it
        <View style={styles.cell}>
          <ButtonApp testID={`${testID}-create-work-center`} title={pmT('Create work center')} icon="add_circle" variant="outlined" size="medium" style={{ marginVertical: 0, height: 42 }} disabled={p.creatingWorkCenter} onPress={p.onCreateWorkCenter} />
        </View>
      )}
      <View style={[styles.cell, { width: 200 }]}>
        <DateInputApp testID={`${testID}-field-startDate`} label={pmT('Start date')} value={p.startText} compact disabled={!p.edit} error={p.startError} style={FIELD} onChangeText={p.onStartText} />
      </View>
      <View style={[styles.cell, { width: 200 }]}>
        <DateInputApp testID={`${testID}-field-finishDate`} label={pmT('Finish date')} value={p.finishText} compact disabled={!p.edit} error={p.finishError} style={FIELD} onChangeText={p.onFinishText} />
      </View>
      {p.edit && (
        <View style={[styles.period, { height: ROW_H }]}>
          {/* the period selector writes BOTH dates (a range of months) */}
          <SelectPeriodButton testID={`${testID}-period`} value={{ startDate: p.header.startDate, finishDate: p.header.finishDate }} onApply={p.onPeriod} color={c.primary} />
          {quick.map((q) => (
            <Pressable key={q.id} testID={`${testID}-quick-${q.id}`} accessibilityRole="button" onPress={() => p.onPeriod({ startDate: q.startDate, finishDate: q.finishDate })} style={[styles.chip, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 12 }}>{pmT(q.label)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View testID={`${testID}-totals`} style={[styles.totals, { height: ROW_H }]}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{pmT('Hours')} {p.hours} · {p.lineCount} {pmT('lines')}</Text>
      </View>
      {!!p.periodMessage && <Text testID={`${testID}-period-message`} style={{ color: c.error, fontSize: 12, width: '100%' }}>{p.periodMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  cell: { height: ROW_H, justifyContent: 'center' },
  period: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  totals: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 },
});
