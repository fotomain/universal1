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
/**
 * ONE box height for every element of the row (the visible border of an input, a select, a button, a chip): 42 px, and ALL of them stand on the SAME bottom line (the row is aligned to the bottom), so their top and
 * bottom borders are on the same two lines. Paper draws an outlined input in a box that is LABEL_ROOM px taller than its outline (the floating label sits on the top border), so an input there gets
 * BOX_H + LABEL_ROOM as its height; the other design systems get BOX_H.
 */
const BOX_H = 42;
const BUTTON_H = BOX_H;
const LABEL_ROOM = 12;
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
  const { themeColors: c, activeSystem } = useDesignSystem();
  const testID = p.testID ?? 'timesheet';
  const inputH = activeSystem === 'paper' ? BOX_H + LABEL_ROOM : BOX_H;
  const slotH = Math.max(inputH, BOX_H);
  // with the month switch on a quick choice that leaves today's month is not offered
  const quick = quickPeriods().filter((q) => !p.onlyCurrentMonth || timesheetPeriodProblem(q.startDate, q.finishDate, true) === null);
  return (
    <View testID={`${testID}-form`} style={styles.form}>
      <View style={[styles.cell, { width: 130, height: slotH }]}>
        <TextInputApp testID={`${testID}-field-number`} label={pmT('Document')} value={p.header.documentNumber} compact disabled hideClearIcon inputHeight={inputH} style={FIELD} />
      </View>
      <View style={[styles.cell, { width: 220, height: slotH }]}>
        {/* the organization of the user: shown, never edited */}
        <TextInputApp testID={`${testID}-field-organization`} label={pmT('Organization')} value={p.organizationTitle} compact disabled hideClearIcon inputHeight={inputH} style={FIELD} />
      </View>
      <View style={[styles.cell, { width: 260, height: slotH }]}>
        <SelectItemFromListApp
          testID={`${testID}-field-workCenter`} items={p.workCenters} value={p.header.workCenter} onSelect={(v) => { if (v) p.onWorkCenter(v); }} disabled={!p.edit}
          placeholder={pmT('Work center')} searchPlaceholder={pmT('Work center')} fieldHeight={BOX_H} fieldRadius={4}
        />
      </View>
      {p.canCreateWorkCenter && p.edit && (
        // the Person of the user has no work center yet: one click makes it
        <View style={[styles.cell, { height: slotH }]}>
          <ButtonApp testID={`${testID}-create-work-center`} title={pmT('Create work center')} icon="add_circle" variant="outlined" size="medium" style={{ marginVertical: 0, height: BUTTON_H }} disabled={p.creatingWorkCenter} onPress={p.onCreateWorkCenter} />
        </View>
      )}
      <View style={[styles.cell, { width: 200, height: slotH }]}>
        <DateInputApp testID={`${testID}-field-startDate`} label={pmT('Start date')} value={p.startText} compact disabled={!p.edit} error={p.startError} inputHeight={inputH} style={FIELD} onChangeText={p.onStartText} />
      </View>
      <View style={[styles.cell, { width: 200, height: slotH }]}>
        <DateInputApp testID={`${testID}-field-finishDate`} label={pmT('Finish date')} value={p.finishText} compact disabled={!p.edit} error={p.finishError} inputHeight={inputH} style={FIELD} onChangeText={p.onFinishText} />
      </View>
      {p.edit && (
        <View style={[styles.period, { height: slotH }]}>
          {/* the period selector writes BOTH dates (a range of months) */}
          <View style={styles.periodIcon}>
            <SelectPeriodButton testID={`${testID}-period`} value={{ startDate: p.header.startDate, finishDate: p.header.finishDate }} onApply={p.onPeriod} color={c.primary} />
          </View>
          {quick.map((q) => (
            <Pressable key={q.id} testID={`${testID}-quick-${q.id}`} accessibilityRole="button" onPress={() => p.onPeriod({ startDate: q.startDate, finishDate: q.finishDate })} style={[styles.chip, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 13 }}>{pmT(q.label)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View testID={`${testID}-totals`} style={[styles.totals, { height: slotH }]}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{pmT('Hours')} {p.hours} · {p.lineCount} {pmT('lines')}</Text>
      </View>
      {!!p.periodMessage && <Text testID={`${testID}-period-message`} style={{ color: c.error, fontSize: 12, width: '100%' }}>{p.periodMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // every slot stands on the same bottom line: the boxes inside have the same height, so their top borders meet too
  form: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  cell: { justifyContent: 'flex-end' },
  period: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 6 },
  // the icon button of the period selector: a box of the button height, the icon centered in it
  periodIcon: { width: BOX_H, height: BOX_H, alignItems: 'center', justifyContent: 'center' },
  chip: { height: BUTTON_H, borderWidth: 1, borderRadius: BUTTON_H / 2, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  totals: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginLeft: 8, paddingBottom: (BOX_H - 14) / 2 },
});
