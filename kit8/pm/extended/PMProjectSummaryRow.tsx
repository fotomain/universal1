// PMProjectSummaryRow (E7) - the project summary row of MS Project: one line above the Gantt chart with the whole project in numbers
// (dates, span, progress, tasks, critical, late). Shown only while the function is on. A tap on "late" or "critical" selects the highlight filter of F9.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { usePMStore } from '../store/store_pm';
import { pmT } from '../i18n/pmT';
import { formatDateISO } from '../view/project/scheduling';
import { projectSummaryOf } from './projectSummary';

export default function PMProjectSummaryRow() {
  const { themeColors: c } = useDesignSystem();
  const on = usePMStore((s) => s.extFlags.ganttProjectSummaryRowEnabled === true);
  const schedule = usePMStore((s) => s.schedule);
  const statusDate = usePMStore((s) => s.extOptions.statusDate);
  const name = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON?.name : '')) || '';
  const sum = useMemo(() => {
    if (!on) return null;
    const statusMs = statusDate ? Date.parse(`${statusDate}T00:00:00Z`) : Date.now();
    return projectSummaryOf(Object.values(schedule), statusMs);
  }, [on, schedule, statusDate]);
  if (!on || !sum) return null;
  const item = (label: string, value: string, warn = false) => (
    <View style={styles.item}>
      <Text style={{ color: c.text, opacity: 0.6, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: warn ? c.error : c.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
  return (
    <View testID="pm-project-summary" style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
      <IconApp name="summarize" size={16} color={c.primary} />
      <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: '700', maxWidth: 200 }}>{name}</Text>
      {item(pmT('Start'), formatDateISO(sum.startMs))}
      {item(pmT('Finish'), formatDateISO(Math.max(sum.startMs, sum.finishMs - 86400000)))}
      {item(pmT('Span'), pmT('{{n}} days', { n: sum.spanDays }))}
      {item(pmT('Progress'), `${sum.progress}%`)}
      {item(pmT('Tasks'), `${sum.done}/${sum.tasks + sum.milestones}`)}
      {item(pmT('Critical'), String(sum.critical))}
      {item(pmT('Late'), String(sum.late), sum.late > 0)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, flexWrap: 'wrap' },
  item: { alignItems: 'flex-start' },
});
