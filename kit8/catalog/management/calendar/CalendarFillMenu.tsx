// CalendarFillMenu - the "Fill" menu of a management calendar:
//   Fill ▸ Current year  ▸ Working days · 5 days a week · 6 days a week · All days
//        ▸ Previous year ▸ (the same four)
//        ▸ Next year     ▸ (the same four)        (not in the document, but a plan of next year needs it)
// Pressing a mode writes the whole year in one call (SQL fill_management_calendar). Days the user switched by hand ("manual", and the exceptions vacation / sick leave /
// training / other of a resource calendar) are kept unless "Overwrite my manual changes" is on.
// A RESOURCE calendar (the capacity of persons / equipment / contracts) also asks the HOURS of an active day, offers its custom week (weekPattern) and "Follow project holidays"
// (the days the project calendars of the organization flag as holidays become holidays, 0 h). A Fill that would put the capacity of a day under hours already posted is refused as a whole.
// The "!" button explains the logic (CALENDAR_HELP_TEXT).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { fetchCalendarConsistency, fillManagementCalendar } from './managementCalendarApi';
import { CALENDAR_FILL_MODES, CALENDAR_PATTERN_FILL_MODE, CalendarFillMode, calendarHoursPerDay, hasWeekPattern, isResourceCalendar } from './managementCalendarModel';
import type { DefRow } from '../../product/productModel';

/** the text of the "!" button: the logic of the capacity and of the calendar lock, in plain words */
export const CALENDAR_HELP_TEXT = [
  'The hours of a day are the capacity of a person, an equipment or a contract: how many hours can be booked on that day.',
  'A resource cannot work less than the hours already planned for it. Every posted task line of your organization that books the resource on a day is counted.',
  'If a change would put the capacity of a day under those hours, it is refused - first move the task or reduce its hours, then change the calendar. You can always raise the hours.',
  'A Fill is refused as a whole if one day would break this; the message names the resource, the day and the project and task that hold the hours.',
  'The calendar of a contract that is in force wins over the calendar of the person or the equipment; a resource with no calendar uses the Standard work week.',
  'Follow project holidays: the days that the project calendars of your organization flag as holidays become holidays (0 h) here. Weekends are decided by the week mode.',
].join('\n');

export interface CalendarFillMenuProps {
  calendarGUID: string | null;
  /** called after a fill (the days table reads again) */
  onFilled?: (year: number) => void;
  testID?: string;
  /** today's year (a test passes a fixed one) */
  currentYear?: number;
  /** the selected calendar (its row): a resource calendar also asks the hours, offers its custom week and "Follow project holidays" */
  calendar?: DefRow<any> | null;
}

export default function CalendarFillMenu({ calendarGUID, onFilled, testID = 'calendar-fill', currentYear = new Date().getFullYear(), calendar = null }: CalendarFillMenuProps) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState<number | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const resource = isResourceCalendar(calendar);
  const [hoursText, setHoursText] = useState('');
  const [follow, setFollow] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const modes = resource && hasWeekPattern(calendar) ? [...CALENDAR_FILL_MODES, CALENDAR_PATTERN_FILL_MODE] : CALENDAR_FILL_MODES;
  const hoursValue = (): number | null => {
    const h = Number(hoursText.replace(',', '.'));
    return hoursText.trim() !== '' && Number.isFinite(h) ? h : null;
  };

  const years = [
    { year: currentYear, label: 'Current year' },
    { year: currentYear - 1, label: 'Previous year' },
    { year: currentYear + 1, label: 'Next year' },
  ];

  const run = async (year: number, mode: CalendarFillMode) => {
    if (!calendarGUID || busy) return;
    setBusy(true);
    try {
      const n = await fillManagementCalendar(calendarGUID, year, mode, overwrite, resource ? { hours: hoursValue(), followProjectHolidays: follow } : {});
      // a resource calendar: tell where it differs from the project calendars of the organization (information, nothing is refused for that)
      let note = '';
      if (resource) {
        try {
          const diffs = await fetchCalendarConsistency(calendarGUID, year);
          if (diffs.length) note = ` · ${diffs.length} day(s) differ from the project calendars of your organization`;
        } catch { /* the report is optional */ }
      }
      dispatch(showSnackbar({ message: `${year}: ${n} days written${note}` }));
      onFilled?.(year);
      setOpen(false);
      setYearOpen(null);
    } catch (e: any) {
      dispatch(showSnackbar({ message: `The calendar could not be filled: ${e?.message || e}` }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <PMIconButton tipScope="app" testID={`${testID}-button`} icon="edit_calendar" label="Fill" title={calendarGUID ? 'Fill a year of the selected calendar' : 'Select a calendar to fill'}
        color={c.primary} disabled={!calendarGUID} onPress={() => setOpen((v) => !v)} />
      {open && (
        <View testID={`${testID}-menu`} style={[styles.menu, { backgroundColor: c.surface, borderColor: c.border }]}>
          {resource && (
            <View testID={`${testID}-resource`} style={styles.resourceBox}>
              <View style={styles.row}>
                <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>Hours per day</Text>
                <TextInput testID={`${testID}-hours`} value={hoursText} onChangeText={setHoursText} keyboardType="decimal-pad"
                  placeholder={String(calendarHoursPerDay(calendar))} placeholderTextColor={c.text + '80'}
                  style={[styles.hours, { color: c.text, borderColor: c.border }]} />
                <Pressable testID={`${testID}-help`} accessibilityRole="button" accessibilityLabel="Help: how the capacity and the lock work" onPress={() => setHelpOpen((v) => !v)}
                  style={[styles.help, { borderColor: c.primary }]}>
                  <Text style={{ color: c.primary, fontWeight: '800' }}>!</Text>
                </Pressable>
              </View>
              <Pressable testID={`${testID}-follow`} accessibilityRole="checkbox" aria-checked={follow} onPress={() => setFollow((v) => !v)} style={styles.row}>
                <IconApp name={follow ? 'check_box' : 'check_box_outline_blank'} size={18} color={c.text} />
                <Text style={{ color: c.text, fontSize: 13 }}>Follow project holidays</Text>
              </Pressable>
              {helpOpen && <Text testID={`${testID}-help-text`} style={{ color: c.text, opacity: 0.85, fontSize: 12, paddingHorizontal: 12, paddingBottom: 6 }}>{CALENDAR_HELP_TEXT}</Text>}
            </View>
          )}
          <Pressable testID={`${testID}-overwrite`} accessibilityRole="checkbox" aria-checked={overwrite} onPress={() => setOverwrite((v) => !v)} style={styles.row}>
            <IconApp name={overwrite ? 'check_box' : 'check_box_outline_blank'} size={18} color={c.text} />
            <Text style={{ color: c.text, fontSize: 13 }}>Overwrite my manual changes</Text>
          </Pressable>
          {years.map(({ year, label }) => (
            <View key={year}>
              <Pressable testID={`${testID}-year-${year}`} accessibilityRole="menuitem" onPress={() => setYearOpen((y) => (y === year ? null : year))} style={styles.row}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '700', flex: 1 }}>{label} · {year}</Text>
                <IconApp name={yearOpen === year ? 'expand_more' : 'chevron_forward'} size={18} color={c.text} />
              </Pressable>
              {yearOpen === year && modes.map((m) => (
                <Pressable key={m.mode} testID={`${testID}-${year}-${m.mode}`} accessibilityRole="menuitem" accessibilityLabel={`${m.label}: ${m.hint}`} disabled={busy}
                  onPress={() => run(year, m.mode)} style={[styles.row, styles.sub]}>
                  <Text style={{ color: c.text, fontSize: 13 }}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 20 },
  menu: { position: 'absolute', top: 40, right: 0, minWidth: 250, borderWidth: 1, borderRadius: 10, paddingVertical: 4, zIndex: 30, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  sub: { paddingLeft: 32 },
  resourceBox: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#cbd5e1', marginBottom: 4 },
  hours: { width: 56, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, textAlign: 'right' },
  help: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
