// PMGanttUXUISettinsModalWindow: edits project_table.rowJSON.uxuiSettings of the selected
// project (opened by the ⚙ button on the Gantt bar, after the task progress % button).
//
//   showCriticalPath · ganttArrowsForm · showTaskProgressOnGantt ·
//   taskProgressLinePosition · taskProgressLineColor ·
//   projectProgressLinePosition · projectProgressLineColor ·
//   task tree: showTreeHierarchyNumbers ("#" column) · treeColumnsOrder (reset; reorder = drag the headers)
//
// Works on a draft: Save writes all settings at once, Cancel / ✕ / backdrop discard,
// "Defaults" resets the draft.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { usePMStore } from '../store';
import { PMUxUiSettings, uxuiSettingsOf } from '../types';
import { PMCrud } from '../usePMCrud';
import { PMDialogButton, PMIconButton } from '../buttons';
// direct file import: the progress/line index also exports Skia components, which must not
// load on web before CanvasKit (see PMGanttSurfaceLoader.web.tsx)
import PMProgressLineSettings from '../progress/line/PMProgressLineSettings';
import { DEPENDENCY_LINE_FORMS } from './toolbars/DependencyArrowLineFormSelector';
import { PM_TREE_COLUMN_TITLES, PM_TREE_COLUMNS_DEFAULT_ORDER, sameTreeColumnsOrder } from '../tree/columns/treeColumns';

type Draft = Required<PMUxUiSettings>;

export default function PMGanttUXUISettinsModalWindow({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const open = usePMStore((s) => s.uxuiSettingsOpen);
  const project = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined));
  const close = () => usePMStore.getState().setUxuiSettingsOpen(false);
  const [draft, setDraft] = useState<Draft>(() => uxuiSettingsOf(undefined));

  // fresh draft every time the window opens (or the project changes)
  useEffect(() => {
    if (open) setDraft(uxuiSettingsOf(project?.rowJSON));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.rowGUID]);

  if (!open || !project) return null;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const save = () => {
    crud.setGanttViewSettings(draft);
    close();
  };
  const colors = { text: c.text, border: c.border, background: c.background, primary: c.primary };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-uxui-window">
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              Gantt settings · {project.rowJSON.name}
            </Text>
            <PMIconButton testID="pm-uxui-close" icon="close" title="Close without saving" color={c.text} onPress={close} />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {/* ---- general ---- */}
            <Row label="Show the critical path" color={c.text}>
              <Switch testID="pm-uxui-critical" value={draft.showCriticalPath} onValueChange={(v) => set('showCriticalPath', v)} />
            </Row>

            <Text style={[styles.label, { color: c.text }]}>Dependency arrows</Text>
            <View style={styles.segment}>
              {DEPENDENCY_LINE_FORMS.map((f) => (
                <PMIconButton
                  key={f.form}
                  testID={`pm-uxui-arrows-${f.form}`}
                  icon={f.icon}
                  label={f.form === 'smoothForm' ? 'Smooth' : 'Square'}
                  title={f.title}
                  active={draft.ganttArrowsForm === f.form}
                  activeColor={c.primary}
                  color={c.text}
                  onPress={() => set('ganttArrowsForm', f.form)}
                />
              ))}
            </View>

            {/* ---- task tree ---- */}
            <Row label='Show hierarchy numbers ("#" column) in the task tree' color={c.text}>
              <Switch testID="pm-uxui-tree-numbers" value={draft.showTreeHierarchyNumbers} onValueChange={(v) => set('showTreeHierarchyNumbers', v)} />
            </Row>
            <Text style={[styles.label, { color: c.text }]}>Task tree columns (drag a column header in the tree to move it)</Text>
            <View style={[styles.segment, { alignItems: 'center' }]}>
              <Text testID="pm-uxui-tree-columns-order" style={{ color: c.text, flex: 1 }} numberOfLines={1}>
                {draft.treeColumnsOrder.map((k) => PM_TREE_COLUMN_TITLES[k]).join('  ·  ')}
              </Text>
              <PMDialogButton
                testID="pm-uxui-tree-columns-reset"
                kind="text"
                icon="restart_alt"
                title="Default order"
                color={c.text}
                disabled={sameTreeColumnsOrder(draft.treeColumnsOrder, PM_TREE_COLUMNS_DEFAULT_ORDER)}
                onPress={() => set('treeColumnsOrder', [...PM_TREE_COLUMNS_DEFAULT_ORDER])}
              />
            </View>

            {/* ---- progress ---- */}
            <Row label="Show task progress on the Gantt (lines + %)" color={c.text}>
              <Switch testID="pm-uxui-progress" value={draft.showTaskProgressOnGantt} onValueChange={(v) => set('showTaskProgressOnGantt', v)} />
            </Row>

            <View style={{ opacity: draft.showTaskProgressOnGantt ? 1 : 0.5 }}>
              <PMProgressLineSettings
                testID="pm-uxui-task-line"
                title="Task progress line"
                positionLabel="Position on the task bar"
                position={draft.taskProgressLinePosition}
                onPosition={(v) => set('taskProgressLinePosition', v)}
                color={draft.taskProgressLineColor}
                onColor={(v) => set('taskProgressLineColor', v)}
                previewBarColor={c.primary}
                colors={colors}
              />
              <PMProgressLineSettings
                testID="pm-uxui-project-line"
                title="Project progress line"
                positionLabel="Position in the time scale"
                position={draft.projectProgressLinePosition}
                onPosition={(v) => set('projectProgressLinePosition', v)}
                color={draft.projectProgressLineColor}
                onColor={(v) => set('projectProgressLineColor', v)}
                previewBarColor={c.border}
                colors={colors}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <PMDialogButton testID="pm-uxui-defaults" kind="text" icon="restart_alt" title="Defaults" color={c.text} style={{ marginLeft: 0 }} onPress={() => setDraft(uxuiSettingsOf(undefined))} />
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-uxui-cancel" kind="secondary" title="Cancel" color={c.text} onPress={close} />
            <PMDialogButton testID="pm-uxui-save" kind="primary" title="Save" onPress={save} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={{ color, flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '92%', borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '700', marginTop: 16 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  segment: { flexDirection: 'row' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 },
});

