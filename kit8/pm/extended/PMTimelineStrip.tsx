// PMTimelineStrip (E9) - the Timeline of MS Project: a one-line strip above the Gantt chart with the tasks and milestones the user added ("Add to timeline" in the row menu),
// ordered by start date. A chip selects the task, x removes it; "E-mail" opens the mail program with the timeline as text. Shown only while the function is on.
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { usePMStore } from '../store/store_pm';
import type { PMCrud } from '../crud/usePMCrud';
import { pmT } from '../i18n/pmT';
import { extendedOptionsPatch } from './extendedOptions';
import { formatDateISO } from '../view/project/scheduling';

/** the text of the e-mail: one line per task */
export function timelineMailText(rows: { name: string; startMs: number; finishMs: number; milestone: boolean }[]): string {
  return rows.map((r) => (r.milestone ? `◆ ${formatDateISO(r.startMs)}  ${r.name}` : `${formatDateISO(r.startMs)} - ${formatDateISO(Math.max(r.startMs, r.finishMs - 86400000))}  ${r.name}`)).join('\n');
}

export default function PMTimelineStrip({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const on = usePMStore((s) => s.extFlags.ganttTimelineViewEnabled === true);
  const guids = usePMStore((s) => s.extOptions.timeline);
  const schedule = usePMStore((s) => s.schedule);
  const tasksById = usePMStore((s) => s.tasksById);
  const projectJSON = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : undefined));
  const projectName = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON?.name : '')) || '';
  if (!on) return null;
  const rows = guids
    .map((g) => ({ guid: g, r: schedule[g], t: tasksById[g] }))
    .filter((x) => x.r && x.t)
    .map((x) => ({ guid: x.guid, name: x.t!.rowJSON.taskDescription || '', startMs: x.r!.startMs, finishMs: x.r!.finishMs, milestone: x.r!.isMilestone }))
    .sort((a, b) => a.startMs - b.startMs);
  const save = (timeline: string[]) => crud.saveProjectJSON(extendedOptionsPatch(projectJSON, { timeline }));
  const email = () => {
    const subject = encodeURIComponent(`${projectName} - ${pmT('timeline')}`);
    const body = encodeURIComponent(timelineMailText(rows));
    void Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  };
  return (
    <View testID="pm-timeline-strip" style={[styles.strip, { backgroundColor: c.surface, borderColor: c.border }]}>
      <IconApp name="timeline" size={16} color={c.primary} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.chips}>
        {rows.length === 0 && <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('Timeline: add tasks with the row menu "Add to timeline"')}</Text>}
        {rows.map((r) => (
          <View key={r.guid} style={[styles.chip, { borderColor: c.border }]}>
            <Pressable testID={`pm-timeline-chip-${r.guid}`} onPress={() => { usePMStore.getState().setSelected(r.guid); usePMStore.getState().requestFocus(r.guid); }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{`${r.milestone ? '◆ ' : ''}${formatDateISO(r.startMs)}  ${r.name}`}</Text>
            </Pressable>
            <Pressable testID={`pm-timeline-remove-${r.guid}`} onPress={() => save(guids.filter((g) => g !== r.guid))} accessibilityLabel={pmT('Remove from the timeline')}><IconApp name="close" size={14} color={c.text} /></Pressable>
          </View>
        ))}
      </ScrollView>
      <Pressable testID="pm-timeline-email" disabled={rows.length === 0} onPress={email} style={{ opacity: rows.length ? 1 : 0.4 }} accessibilityLabel={pmT('E-mail the timeline')}><IconApp name="mail" size={18} color={c.primary} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 280 },
});
