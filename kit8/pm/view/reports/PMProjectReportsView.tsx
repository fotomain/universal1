// PMProjectReportsView - the "Reports" view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showReportsView';
// the Skia task tree stays on the left): a summary of the selected project computed from the store.
//
//   toolbar   Reports ........ [Gantt | Kanban | Network | Versions | Finances | Plan | Reports]
//   body      cards: tasks · stages · milestones · progress · start · finish · dependency cycles
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../store/store_pm';
import { PMPalette } from '../theme';
import { PMCrud } from '../../crud/usePMCrud';
import { PMTipIcon } from '../../inner/buttons';
import { PMToolbar, PMToolbarSpacer } from '../../inner/toolbars/PMToolbarPrimitives';
import GanttToggleButtons from '../gantt/toolbars/GanttToggleButtons';
import { pmT } from '../../i18n/pmT';

export interface PMProjectReportsViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
}

const dateOf = (ms: number) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : '-');

export default function PMProjectReportsView({ width, height, palette, crud }: PMProjectReportsViewProps) {
  const schedule = usePMStore((s) => s.schedule);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);
  const cycleCount = usePMStore((s) => s.cycleGUIDs.length);

  const stats = useMemo(() => {
    const rows = Object.values(schedule);
    const leaves = rows.filter((r) => !r.isSummary);
    const done = leaves.filter((r) => r.progress >= 100).length;
    const progress = leaves.length ? Math.round(leaves.reduce((a, r) => a + (r.progress || 0), 0) / leaves.length) : 0;
    return {
      tasks: leaves.length,
      stages: rows.length - leaves.length,
      milestones: rows.filter((r) => r.isMilestone).length,
      done,
      progress,
    };
  }, [schedule]);

  const cards: { id: string; label: string; value: string }[] = [
    { id: 'tasks', label: pmT('Tasks'), value: String(stats.tasks) },
    { id: 'stages', label: pmT('Stages'), value: String(stats.stages) },
    { id: 'milestones', label: pmT('Milestones'), value: String(stats.milestones) },
    { id: 'done', label: pmT('Done'), value: `${stats.done} / ${stats.tasks}` },
    { id: 'progress', label: pmT('Progress'), value: `${stats.progress}%` },
    { id: 'start', label: pmT('Start'), value: dateOf(projectStartMs) },
    { id: 'finish', label: pmT('Finish'), value: dateOf(projectFinishMs) },
    { id: 'cycles', label: pmT('Dependency cycles'), value: String(cycleCount) },
  ];

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-reports-view">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMTipIcon tip={pmT('Reports')} testID="pm-reports-icon" name="assessment" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
        <Text style={[styles.title, { color: palette.text }]} testID="pm-reports-title" numberOfLines={1}>
          {pmT('Reports')}
        </Text>
        <PMToolbarSpacer />
        <GanttToggleButtons palette={palette} onChange={crud.setGanttVsNetworkView} onReorder={crud.setViewButtonsOrder} />
      </PMToolbar>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          {cards.map((c) => (
            <View key={c.id} testID={`pm-reports-card-${c.id}`} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardLabel, { color: palette.textMuted }]}>{c.label}</Text>
              <Text style={[styles.cardValue, { color: palette.text }]}>{c.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '600', marginHorizontal: 6, flexShrink: 1 },
  body: { padding: 12, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { minWidth: 140, flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  cardLabel: { fontSize: 12, marginBottom: 4 },
  cardValue: { fontSize: 20, fontWeight: '700' },
});
