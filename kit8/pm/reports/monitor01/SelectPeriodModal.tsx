// SelectPeriodModal - a month-range picker (three years of months side by side, Prev / Next shift all three together): click a month to start the period,
// click another to finish it (the earlier/later order does not matter); "Select" writes { startDate, finishDate } = the first day of the earlier month ..
// the last day of the later month, in the shape Monitor01Filters already uses. The two dates above the grid are inputs (type, or pick with the calendar): a typed
// day is kept as typed (Select writes exactly the two days) and the grid shows its months; a click on a month rewrites both dates. "Clear period" only resets the
// DRAFT in the window; "Cancel" discards it.
// Design reference: a Google-Ads-style period picker (three year columns, Jan-Dec tiles). Dialog chrome (title + ✕, Cancel / primary button at the bottom)
// follows this app's own PMGanttPeriodModalWindow, not the reference image, so every modal of the app opens and closes the same way.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import { PMDateInput } from '../../inner/inputs/PMDateInput';
import { formatDateISO, parseDateISO } from '../../view/project/scheduling';
import { formatPlanDate, parsePlanDate } from '../../model/planDateFormats';
import type { PMPlanDateInputFormat } from '../../model/types';
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
  /** the date format of the project: the two dates are typed / shown in it (default YYYY-MM-DD); onApply and `value` are always 'YYYY-MM-DD' */
  dateFormat?: PMPlanDateInputFormat;
  /** the input that gets the cursor when the window opens (the date that was pressed); none = no input is activated */
  focusField?: 'start' | 'finish' | null;
  testID?: string;
}

const thisMonth = (): MonitorPeriodMonth => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; };
/** the calendar formats that keep the year (the others - 'DD MMM', hours ... - fall back to YYYY-MM-DD, as PMDateInput does) */
const YEAR_FORMATS: PMPlanDateInputFormat[] = ['DD.MM.YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
/** a typed text (the format, or YYYY-MM-DD) -> 'YYYY-MM-DD'; null = not a date */
const isoOfText = (t: string, fmt: PMPlanDateInputFormat): string | null => {
  const x = (t || '').trim();
  const ms = x ? (parseDateISO(x) ?? parsePlanDate(x, fmt)) : null;
  return ms === null || ms === undefined ? null : formatDateISO(ms);
};
/** 'YYYY-MM-DD' -> the text in the format of the project ('' stays '') */
const textOfIso = (iso: string, fmt: PMPlanDateInputFormat): string => {
  const ms = fmt === 'YYYY-MM-DD' || !iso ? null : parseDateISO(iso);
  return ms === null || ms === undefined ? iso || '' : formatPlanDate(ms, fmt);
};
const mkey = (m: MonitorPeriodMonth) => `${m.year}-${m.month}`;

export default function SelectPeriodModal({ visible, value, onApply, onClose, dateFormat = 'YYYY-MM-DD', focusField = null, testID = 'monitor01-period' }: SelectPeriodModalProps) {
  const fmt: PMPlanDateInputFormat = YEAR_FORMATS.includes(dateFormat) ? dateFormat : 'YYYY-MM-DD';
  const { themeColors: c } = useDesignSystem();
  const [centerYear, setCenterYear] = useState(() => new Date().getFullYear());
  // the draft = the two dates as TEXT (typed, picked or written by a click on a month); `anchor` = the first month of a click-range that waits for its second click
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [anchor, setAnchor] = useState<MonitorPeriodMonth | null>(null);

  // opening: the draft starts at the filter's own dates (so re-opening shows what is active), the grid centred on the start month
  useEffect(() => {
    if (!visible) return;
    setFromText(textOfIso(value.startDate || '', fmt));
    setToText(textOfIso(value.finishDate || '', fmt));
    setAnchor(null);
    const s = monitorPeriodMonthOfDay(value.startDate);
    const f = monitorPeriodMonthOfDay(value.finishDate);
    setCenterYear((s || f)?.year ?? new Date().getFullYear());
  }, [visible, value.startDate, value.finishDate, fmt]);

  if (!visible) return null;

  const fromIso = isoOfText(fromText, fmt);
  const toIso = isoOfText(toText, fmt);
  const fromOk = fromIso !== null;
  const toOk = toIso !== null;
  const start = fromIso ? monitorPeriodMonthOfDay(fromIso) : null;
  const end = toIso ? monitorPeriodMonthOfDay(toIso) : null;
  const backwards = !!fromIso && !!toIso && fromIso > toIso; // ISO texts sort like dates
  const fromError = fromText.trim() !== '' && !fromOk ? pmT('Not a date') : undefined;
  const toError = toText.trim() !== '' && !toOk ? pmT('Not a date') : backwards ? pmT('The finish is before the start') : undefined;

  const write = (a: MonitorPeriodMonth, b: MonitorPeriodMonth) => { const p = monitorPeriodOf(a, b); setFromText(textOfIso(p.startDate, fmt)); setToText(textOfIso(p.finishDate, fmt)); };
  const pick = (m: MonitorPeriodMonth) => {
    if (!anchor) { setAnchor(m); write(m, m); return; }   // the first click = that one month; a second click completes the range, a third starts over
    setAnchor(null);
    write(anchor, m);
  };
  const clear = () => { setFromText(''); setToText(''); setAnchor(null); };
  const canSelect = fromOk && (toText.trim() === '' || (toOk && !backwards));
  const select = () => {
    if (!canSelect) return;
    onApply({ startDate: fromIso as string, finishDate: toIso ?? (fromIso as string) });
    onClose();
  };

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
            <PMDateInput testID={`${testID}-from`} label={pmT('Start date')} value={fromText} dateFormat={fmt} autoFocus={focusField === 'start'} compact error={fromError} style={styles.dateField}
              onChangeText={(t) => { setFromText(t); setAnchor(null); }} />
            <Text style={{ color: c.text, opacity: 0.6, marginHorizontal: 6 }}>–</Text>
            <PMDateInput testID={`${testID}-to`} label={pmT('Finish date')} value={toText} dateFormat={fmt} autoFocus={focusField === 'finish'} compact error={toError} style={styles.dateField}
              onChangeText={(t) => { setToText(t); setAnchor(null); }} />
            {!!(fromText || toText) && (
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
            <PMDialogButton testID={`${testID}-select`} kind="primary" title={pmT('Select')} disabled={!canSelect} onPress={select} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 640, maxHeight: '92%', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, gap: 4 },
  dateField: { width: 250, marginBottom: 0 }, // 10 characters + the calendar icon + the clear icon, fully visible
  yearsRow: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  yearCol: { flex: 1, alignItems: 'center', minWidth: 120 },
  yearLabel: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, width: '100%' },
  monthTile: { width: '30%', paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
});
