// SelectPeriodModal - a month-range picker (three years of months side by side, Prev / Next shift all three together): click a month to start the period,
// click another to finish it (the earlier/later order does not matter); "Select" writes { startDate, finishDate } = the first day of the earlier month ..
// the last day of the later month, in the shape Monitor01Filters already uses. "Clear period" only resets the DRAFT in the window; "Cancel" discards it.
// Design reference: a Google-Ads-style period picker (three year columns, Jan-Dec tiles). Dialog chrome (title + ✕, Cancel / primary button at the bottom)
// follows this app's own PMGanttPeriodModalWindow, not the reference image, so every modal of the app opens and closes the same way.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import { pmT } from '../../i18n/pmT';
import {
  MONITOR_PERIOD_MONTH_NAMES, MonitorPeriodMonth, monitorPeriodMonthInRange, monitorPeriodMonthOfDay, monitorPeriodOf, monitorPeriodSameMonth, monitorPeriodYears,
} from './monitor01Period';

export interface SelectPeriodModalProps {
  visible: boolean;
  /** the filter now (startDate / finishDate, 'YYYY-MM-DD' or ''): the grid opens centred on its year and shows it as the current selection */
  value: { startDate: string; finishDate: string };
  onApply: (next: { startDate: string; finishDate: string }) => void;
  onClose: () => void;
  testID?: string;
}

const thisMonth = (): MonitorPeriodMonth => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; };
const mkey = (m: MonitorPeriodMonth) => `${m.year}-${m.month}`;

export default function SelectPeriodModal({ visible, value, onApply, onClose, testID = 'monitor01-period' }: SelectPeriodModalProps) {
  const { themeColors: c } = useDesignSystem();
  const [centerYear, setCenterYear] = useState(() => new Date().getFullYear());
  const [start, setStart] = useState<MonitorPeriodMonth | null>(null);
  const [end, setEnd] = useState<MonitorPeriodMonth | null>(null);

  // opening: the draft starts at the filter's own months (so re-opening shows what is active), the grid centred on the start month
  useEffect(() => {
    if (!visible) return;
    const s = monitorPeriodMonthOfDay(value.startDate);
    const f = monitorPeriodMonthOfDay(value.finishDate);
    setStart(s);
    setEnd(f && s && !monitorPeriodSameMonth(s, f) ? f : null);
    setCenterYear((s || f)?.year ?? new Date().getFullYear());
  }, [visible, value.startDate, value.finishDate]);

  if (!visible) return null;

  const pick = (m: MonitorPeriodMonth) => {
    if (!start || end) { setStart(m); setEnd(null); return; } // nothing picked yet, or a range is already complete: start over
    if (monitorPeriodSameMonth(m, start)) { setEnd(m); return; } // the SAME month again = a one-month period (end === start)
    setEnd(m);
  };
  const clear = () => { setStart(null); setEnd(null); };
  const select = () => {
    if (!start) return;
    onApply(monitorPeriodOf(start, end ?? start));
    onClose();
  };

  // the two edges, chronologically ordered (start/end are in CLICK order, not necessarily calendar order - monitorPeriodOf sorts them, same as Select does)
  const period = start ? monitorPeriodOf(start, end ?? start) : null;
  const fromText = period?.startDate ?? '';
  const toText = period?.finishDate ?? '';
  const today = thisMonth();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID={testID}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{pmT('Select period')}</Text>
            <PMIconButton testID={`${testID}-close`} icon="close" title={pmT('Close')} color={c.text} onPress={onClose} />
          </View>

          <View style={styles.rangeRow}>
            <Text testID={`${testID}-from`} style={[styles.rangeText, { color: c.text, borderColor: c.border }]}>{fromText || pmT('Start month')}</Text>
            <Text style={{ color: c.text, opacity: 0.6, marginHorizontal: 6 }}>–</Text>
            <Text testID={`${testID}-to`} style={[styles.rangeText, { color: c.text, borderColor: c.border }]}>{toText || pmT('Finish month')}</Text>
            {!!(start || end) && (
              <Pressable testID={`${testID}-clear`} onPress={clear} style={{ marginLeft: 12 }}>
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>{pmT('Clear period')}</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.yearsRow, { borderColor: c.border }]}>
            <PMIconButton testID={`${testID}-prev`} icon="chevron_left" title={pmT('Earlier years')} color={c.text} onPress={() => setCenterYear((y) => y - 1)} />
            {monitorPeriodYears(centerYear).map((year) => (
              <View key={year} style={styles.yearCol}>
                <Text testID={`${testID}-year-${year}`} style={[styles.yearLabel, { color: c.text }]}>{year}</Text>
                <View style={styles.monthGrid}>
                  {MONITOR_PERIOD_MONTH_NAMES.map((name, month) => {
                    const m: MonitorPeriodMonth = { year, month };
                    const isEdge = (!!start && monitorPeriodSameMonth(m, start)) || (!!end && monitorPeriodSameMonth(m, end));
                    const inRange = !!start && !!end && monitorPeriodMonthInRange(m, start, end);
                    const isToday = monitorPeriodSameMonth(m, today);
                    return (
                      <Pressable
                        key={mkey(m)}
                        testID={`${testID}-month-${year}-${String(month + 1).padStart(2, '0')}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${name} ${year}`}
                        onPress={() => pick(m)}
                        style={[
                          styles.monthTile,
                          inRange && !isEdge ? { backgroundColor: `${c.primary}22` } : null,
                          isEdge ? { backgroundColor: c.primary } : null,
                          isToday && !isEdge ? { borderColor: c.primary, borderWidth: 1 } : null,
                        ]}
                      >
                        <Text style={{ color: isEdge ? '#fff' : c.text, fontSize: 13, fontWeight: isEdge ? '700' : '400' }}>{pmT(name)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <PMIconButton testID={`${testID}-next`} icon="chevron_right" title={pmT('Later years')} color={c.text} onPress={() => setCenterYear((y) => y + 1)} />
          </View>

          <View style={styles.actions}>
            <PMDialogButton testID={`${testID}-cancel`} kind="secondary" title={pmT('Cancel')} color={c.text} onPress={onClose} />
            <PMDialogButton testID={`${testID}-select`} kind="primary" title={pmT('Select')} disabled={!start} onPress={select} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  rangeText: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, minWidth: 96 },
  yearsRow: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  yearCol: { flex: 1, alignItems: 'center', minWidth: 120 },
  yearLabel: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, width: '100%' },
  monthTile: { width: '30%', paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
});
