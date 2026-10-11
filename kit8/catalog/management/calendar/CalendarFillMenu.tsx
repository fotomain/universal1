// CalendarFillMenu - the "Fill" menu of a management calendar:
//   Fill ▸ Current year  ▸ Working days · 5 days a week · 6 days a week · All days
//        ▸ Previous year ▸ (the same four)
//        ▸ Next year     ▸ (the same four)        (not in the document, but a plan of next year needs it)
// Pressing a mode writes the whole year in one call (SQL fill_management_calendar). Days the user switched by hand ("manual") are kept unless
// "Overwrite my manual changes" is on.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { fillManagementCalendar } from './managementCalendarApi';
import { CALENDAR_FILL_MODES, CalendarFillMode } from './managementCalendarModel';

export interface CalendarFillMenuProps {
  calendarGUID: string | null;
  /** called after a fill (the days table reads again) */
  onFilled?: (year: number) => void;
  testID?: string;
  /** today's year (a test passes a fixed one) */
  currentYear?: number;
}

export default function CalendarFillMenu({ calendarGUID, onFilled, testID = 'calendar-fill', currentYear = new Date().getFullYear() }: CalendarFillMenuProps) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState<number | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const years = [
    { year: currentYear, label: 'Current year' },
    { year: currentYear - 1, label: 'Previous year' },
    { year: currentYear + 1, label: 'Next year' },
  ];

  const run = async (year: number, mode: CalendarFillMode) => {
    if (!calendarGUID || busy) return;
    setBusy(true);
    try {
      const n = await fillManagementCalendar(calendarGUID, year, mode, overwrite);
      dispatch(showSnackbar({ message: `${year}: ${n} days written` }));
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
              {yearOpen === year && CALENDAR_FILL_MODES.map((m) => (
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
});
