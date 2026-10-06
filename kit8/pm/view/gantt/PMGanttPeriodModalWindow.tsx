// "Custom period" window of the Gantt bar (period button before "Today").
// From / To (YYYY-MM-DD, both days included) or a preset; Apply = the chart zooms and scrolls so that
// the period fills the pane, and the time line is widened to it (store.ganttPeriod, PMGanttSurface).
// "Whole project" removes the custom period (= Fit to screen).

import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import PMDateInput from '../../inner/inputs/PMDateInput';
import { DAY_MS } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { formatDateISO, parseDateISO, todayUTC } from '../project/scheduling';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import { mondayOnOrBefore } from './ganttGeometry';
import { pmT } from '../../i18n/pmT';

interface Preset {
  id: string;
  label: string;
  range: (today: number, projectStart: number, projectFinish: number) => [number, number];
}

const monthStart = (ms: number, add = 0) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1);
};

/** [first day, last day] - both included */
export const PM_GANTT_PERIOD_PRESETS: Preset[] = [
  { id: 'this-week', label: 'This week', range: (t) => [mondayOnOrBefore(t), mondayOnOrBefore(t) + 6 * DAY_MS] },
  { id: 'next-2-weeks', label: 'Next 2 weeks', range: (t) => [t, t + 13 * DAY_MS] },
  { id: 'this-month', label: 'This month', range: (t) => [monthStart(t), monthStart(t, 1) - DAY_MS] },
  { id: 'next-month', label: 'Next month', range: (t) => [monthStart(t, 1), monthStart(t, 2) - DAY_MS] },
  { id: 'quarter', label: 'Next 3 months', range: (t) => [t, monthStart(t, 3) - DAY_MS] },
  { id: 'year', label: 'This year', range: (t) => [Date.UTC(new Date(t).getUTCFullYear(), 0, 1), Date.UTC(new Date(t).getUTCFullYear(), 11, 31)] },
  { id: 'to-finish', label: 'Today → project finish', range: (t, _s, f) => [Math.min(t, f - DAY_MS), Math.max(t, f - DAY_MS)] },
];

export default function PMGanttPeriodModalWindow() {
  const { themeColors: c } = useDesignSystem();
  const open = usePMStore((s) => s.ganttPeriodOpen);
  const period = usePMStore((s) => s.ganttPeriod);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const a = period ? period.startMs : projectStartMs;
    const b = period ? period.finishMs - DAY_MS : Math.max(projectStartMs, projectFinishMs - DAY_MS);
    setFrom(formatDateISO(a));
    setTo(formatDateISO(b));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const close = () => usePMStore.getState().setGanttPeriodOpen(false);
  const apply = (a: number | null, b: number | null) => {
    if (a === null || b === null) return setError('Dates must be YYYY-MM-DD.');
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    usePMStore.getState().setGanttPeriod({ startMs: lo, finishMs: hi + DAY_MS }); // finish is exclusive
    close();
  };
  const reset = () => {
    usePMStore.getState().setGanttPeriod(null);
    close();
  };
  const onKey = Platform.OS === 'web' ? { onSubmitEditing: () => apply(parseDateISO(from.trim()), parseDateISO(to.trim())) } : {};

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable testID="pm-gantt-period-backdrop" style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-gantt-period-window">
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{pmT('Chart period')}</Text>
            <PMIconButton testID="pm-gantt-period-close" icon="close" title={pmT('Close')} color={c.text} onPress={close} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              <View style={styles.field}>
                <PMDateInput
                  testID="pm-gantt-period-from"
                  pickerTestID="pm-gantt-period-from-picker"
                  label={pmT('From (YYYY-MM-DD)')}
                  value={from}
                  onChangeText={(t) => { setFrom(t); setError(null); }}
                  placeholder="2026-01-01"
                  {...onKey}
                />
              </View>
              <View style={styles.field}>
                <PMDateInput
                  testID="pm-gantt-period-to"
                  pickerTestID="pm-gantt-period-to-picker"
                  label={pmT('To (YYYY-MM-DD)')}
                  value={to}
                  onChangeText={(t) => { setTo(t); setError(null); }}
                  placeholder="2026-12-31"
                  {...onKey}
                />
              </View>
            </View>
            {!!error && <Text style={{ color: c.error, marginTop: 6 }}>{error}</Text>}
            <Text style={[styles.label, { color: c.text }]}>{pmT('Quick periods')}</Text>
            <View style={styles.chips}>
              {PM_GANTT_PERIOD_PRESETS.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`pm-gantt-period-preset-${p.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  onPress={() => {
                    const [a, b] = p.range(todayUTC(), projectStartMs, projectFinishMs);
                    apply(a, b);
                  }}
                  style={({ hovered, pressed }: any) => [styles.chip, { borderColor: c.border, backgroundColor: hovered || pressed ? `${c.primary}22` : 'transparent' }]}
                >
                  <Text style={{ color: c.text, fontSize: 13 }}>{pmT(p.label)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <PMDialogButton testID="pm-gantt-period-reset" kind="text" icon="fit_screen" title={pmT('Whole project')} color={c.text} style={{ marginLeft: 0 }} onPress={reset} />
            <View style={{ flex: 1, minWidth: 8 }} />
            <PMDialogButton testID="pm-gantt-period-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} onPress={close} />
            <PMDialogButton testID="pm-gantt-period-apply" kind="primary" title={pmT('Apply')} onPress={() => apply(parseDateISO(from.trim()), parseDateISO(to.trim()))} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 440, maxHeight: '92%', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  field: { flexGrow: 1, flexBasis: 150, paddingHorizontal: 4 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 10, marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputFlex: { flex: 1, minWidth: 0 },
  pickerBtn: { marginLeft: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, rowGap: 8 },
});
