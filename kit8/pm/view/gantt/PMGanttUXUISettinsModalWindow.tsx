// PMGanttUXUISettinsModalWindow: edits project_table.rowJSON.uxuiSettings of the selected
// project (opened by the ⚙ button on the Gantt bar, after the task progress % button).
//
//   showCriticalPath · ganttArrowsForm · showTaskProgressOnGantt ·
//   taskProgressLinePosition · taskProgressLineColor ·
//   projectProgressLinePosition · projectProgressLineColor ·
//   row commands: projectTreeContextCommandsMode · projectGanttChartContextCommandsMode
//              ('onHoverPanelMode' = hover panel, 'onRightClickMenuMode' = right-click / long-press menu)
//   task tree: showTreeHierarchyNumbers ("#" column) · treeColumnsOrder (reset; reorder = drag the headers) ·
//              treeColumnsWidths (reset; resize = drag the header separators)
//
// Top tabs: Task · Tree · Gantt · Project (settings/uxuiSettingsIndex.ts lists which option is where).
// Search: type a substring of a setting's name -> table of matches (Setting | Tab); pressing a line opens
// that tab and scrolls to the option (it flashes).
// Works on a draft: Save writes all settings at once, Cancel / ✕ / backdrop discard,
// "Defaults" resets the draft.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import TextInputApp from '../../../components/common/TextInputApp';
import { usePMStore } from '../../store/store_pm';
import { PMContextCommandsMode, PM_CONTEXT_COMMANDS_MODES, PMUxUiSettings, uxuiSettingsOf } from '../../model/types';
import { PMCrud } from '../../crud/usePMCrud';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
// direct file import: the progress/line index also exports Skia components, which must not
// load on web before CanvasKit (see PMGanttSurfaceLoader.web.tsx)
import PMProgressLineSettings from '../task/progress/line/PMProgressLineSettings';
import { DEPENDENCY_LINE_FORMS } from '../task/dependency/DependencyArrowLineFormSelector';
import { withAlpha } from '../theme';
import { PM_UXUI_TABS, PMUxUiOptionId, PMUxUiTab, PM_UXUI_OPTIONS, searchUxuiOptions, uxuiTabTitle } from './settings/uxuiSettingsIndex';
import { normalizeTreeColumnsOrder, PM_TREE_COLUMNS_DEFAULT_ORDER, sameTreeColumnsOrder, treeColumnTitle } from '../tree/columns/treeColumns';

type Draft = Required<PMUxUiSettings>;

export default function PMGanttUXUISettinsModalWindow({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const open = usePMStore((s) => s.uxuiSettingsOpen);
  const project = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined));
  const close = () => usePMStore.getState().setUxuiSettingsOpen(false);
  const [draft, setDraft] = useState<Draft>(() => uxuiSettingsOf(undefined));
  const customColumns = usePMStore((s) => s.customColumns);
  /** default order = built-in default + the custom columns in creation order */
  const defaultOrder = normalizeTreeColumnsOrder(PM_TREE_COLUMNS_DEFAULT_ORDER, customColumns.map((c) => c.key));

  const [tab, setTab] = useState<PMUxUiTab>('TabTask');
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchUxuiOptions(query), [query]);
  const scrollRef = useRef<ScrollView>(null);
  /** y of every option of the current tab (onLayout), and the option to scroll to once it is laid out */
  const optionY = useRef<Partial<Record<PMUxUiOptionId, number>>>({});
  const pendingFocus = useRef<PMUxUiOptionId | null>(null);
  const [flashId, setFlashId] = useState<PMUxUiOptionId | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  /** mark the option at once (feedback even before its layout is known) */
  const flashOption = useCallback((id: PMUxUiOptionId) => {
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
  }, []);
  const scrollToOption = useCallback((y: number) => {
    pendingFocus.current = null;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, []);
  const switchTab = useCallback((t: PMUxUiTab) => {
    setTab((cur) => {
      if (cur !== t) optionY.current = {};
      return t;
    });
  }, []);
  /** search result pressed: open its tab and scroll to the option */
  const goToOption = useCallback(
    (id: PMUxUiOptionId) => {
      const opt = PM_UXUI_OPTIONS.find((o) => o.id === id);
      if (!opt) return;
      setQuery('');
      flashOption(id);
      if (opt.tab === tab && optionY.current[id] !== undefined) return scrollToOption(optionY.current[id]!);
      pendingFocus.current = id; // scrolled in onLayout of the option, once the tab is rendered
      switchTab(opt.tab);
    },
    [tab, flashOption, scrollToOption, switchTab]
  );
  const onOptionLayout = useCallback(
    (id: PMUxUiOptionId, y: number) => {
      optionY.current[id] = y;
      if (pendingFocus.current === id) scrollToOption(y);
    },
    [scrollToOption]
  );
  const optCtx = useMemo(() => ({ flashId, onLayout: onOptionLayout, highlight: withAlpha(c.primary, 0.14) }), [flashId, onOptionLayout, c.primary]);

  // fresh draft every time the window opens (or the project changes); start on the first tab
  useEffect(() => {
    if (open) {
      setQuery('');
      setTab('TabTask');
      optionY.current = {};
      pendingFocus.current = null;
    }
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

          {/* ---- search: any setting by a substring of its name ---- */}
          <TextInputApp
            testID="pm-uxui-search"
            label="Search settings"
            placeholder="e.g. arrows, progress, column"
            leftIcon="search"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            style={{ marginBottom: 6 }}
          />
          {query.trim().length > 0 &&
            (results.length > 0 ? (
              <View style={[styles.table, { borderColor: c.border }]} testID="pm-uxui-search-results">
                <View style={[styles.tableRow, styles.tableHead, { borderColor: c.border }]}>
                  <Text style={[styles.cellSetting, styles.headText, { color: c.text }]}>Setting</Text>
                  <Text style={[styles.cellTab, styles.headText, { color: c.text }]}>Tab</Text>
                </View>
                {results.map((o, i) => (
                  <Pressable
                    key={o.id}
                    testID={`pm-uxui-search-row-${o.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${o.label} - ${uxuiTabTitle(o.tab)}`}
                    onPress={() => goToOption(o.id)}
                    style={({ hovered, pressed }: any) => [
                      styles.tableRow,
                      { borderColor: c.border, borderBottomWidth: i === results.length - 1 ? 0 : StyleSheet.hairlineWidth },
                      (hovered || pressed) && { backgroundColor: withAlpha(c.primary, 0.1) },
                    ]}
                  >
                    <Text style={[styles.cellSetting, { color: c.text }]}>{o.label}</Text>
                    <Text style={[styles.cellTab, { color: c.primary }]}>{uxuiTabTitle(o.tab)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text testID="pm-uxui-search-empty" style={[styles.label, { color: c.text }]}>
                No settings found
              </Text>
            ))}

          {/* ---- top tabs ---- */}
          <View style={[styles.tabs, { borderColor: c.border }]} accessibilityRole="tablist">
            {PM_UXUI_TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  testID={`pm-uxui-tab-${t.key}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  // react-native-web 0.21 ignores accessibilityState -> aria-* too
                  aria-selected={active}
                  onPress={() => switchTab(t.key)}
                  style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}
                >
                  <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500' }}>{t.title}</Text>
                </Pressable>
              );
            })}
          </View>

          <OptContext.Provider value={optCtx}>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" testID={`pm-uxui-panel-${tab}`}>
            {tab === 'TabTask' && (
              <>
                <Opt id="taskProgress">
                  <Row label="Show task progress on the Gantt (lines + %)" color={c.text}>
                    <Switch testID="pm-uxui-progress" value={draft.showTaskProgressOnGantt} onValueChange={(v) => set('showTaskProgressOnGantt', v)} />
                  </Row>
                </Opt>
                <Opt id="taskProgressLine">
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
                  </View>
                </Opt>
              </>
            )}

            {tab === 'TabTree' && (
              <>
                <Opt id="treeCommands">
                  <CommandsModeSelector
                    label="Task tree: row commands"
                    testID="pm-uxui-tree-commands"
                    value={draft.projectTreeContextCommandsMode}
                    onChange={(v) => set('projectTreeContextCommandsMode', v)}
                    colors={{ text: c.text, primary: c.primary }}
                  />
                </Opt>
                <Opt id="treeNumbers">
                  <Row label='Show hierarchy numbers ("#" column) in the task tree' color={c.text}>
                    <Switch testID="pm-uxui-tree-numbers" value={draft.showTreeHierarchyNumbers} onValueChange={(v) => set('showTreeHierarchyNumbers', v)} />
                  </Row>
                </Opt>
                <Opt id="treeColumns">
                  <Text style={[styles.label, { color: c.text }]}>
                    Task tree columns (drag a column header in the tree to move it, drag a header separator to resize, right-click / long-press a header to add a custom column)
                  </Text>
                  <View style={[styles.segment, { alignItems: 'center' }]}>
                    <Text testID="pm-uxui-tree-columns-order" style={{ color: c.text, flex: 1 }} numberOfLines={1}>
                      {normalizeTreeColumnsOrder(draft.treeColumnsOrder, customColumns.map((cc) => cc.key))
                        .map((k) => treeColumnTitle(k, customColumns))
                        .join('  ·  ')}
                    </Text>
                    <PMDialogButton
                      testID="pm-uxui-tree-columns-reset"
                      kind="text"
                      icon="restart_alt"
                      title="Default order"
                      color={c.text}
                      disabled={sameTreeColumnsOrder(normalizeTreeColumnsOrder(draft.treeColumnsOrder, customColumns.map((cc) => cc.key)), defaultOrder)}
                      onPress={() => set('treeColumnsOrder', defaultOrder)}
                    />
                    <PMDialogButton
                      testID="pm-uxui-tree-columns-widths-reset"
                      kind="text"
                      icon="fit_width"
                      title="Default widths"
                      color={c.text}
                      disabled={Object.keys(draft.treeColumnsWidths).length === 0}
                      onPress={() => set('treeColumnsWidths', {})}
                    />
                  </View>
                </Opt>
              </>
            )}

            {tab === 'TabGantt' && (
              <>
                <Opt id="criticalPath">
                  <Row label="Show the critical path" color={c.text}>
                    <Switch testID="pm-uxui-critical" value={draft.showCriticalPath} onValueChange={(v) => set('showCriticalPath', v)} />
                  </Row>
                </Opt>
                <Opt id="arrows">
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
                </Opt>
                <Opt id="ganttCommands">
                  <CommandsModeSelector
                    label="Gantt chart: bar commands"
                    testID="pm-uxui-gantt-commands"
                    value={draft.projectGanttChartContextCommandsMode}
                    onChange={(v) => set('projectGanttChartContextCommandsMode', v)}
                    colors={{ text: c.text, primary: c.primary }}
                  />
                </Opt>
              </>
            )}

            {tab === 'TabProject' && (
              <Opt id="projectProgressLine">
                <View style={{ opacity: draft.showTaskProgressOnGantt ? 1 : 0.5 }}>
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
                {!draft.showTaskProgressOnGantt && (
                  <Text style={[styles.label, { color: c.text }]}>Shown when "Show task progress" (Task tab) is on.</Text>
                )}
              </Opt>
            )}
          </ScrollView>
          </OptContext.Provider>

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

/** Opt needs the window's flash / layout callbacks; a context keeps Opt a stable component (no remounts). */
const OptContext = React.createContext<{ flashId: PMUxUiOptionId | null; onLayout: (id: PMUxUiOptionId, y: number) => void; highlight: string }>({
  flashId: null,
  onLayout: () => {},
  highlight: 'transparent',
});

/** One option block of a tab: remembers its y (search -> scroll) and flashes when a search result brought the user here. */
function Opt({ id, children }: { id: PMUxUiOptionId; children: React.ReactNode }) {
  const { flashId, onLayout, highlight } = React.useContext(OptContext);
  const flashing = flashId === id;
  return (
    <View
      testID={`pm-uxui-opt-${id}`}
      accessibilityState={{ selected: flashing }}
      aria-selected={flashing}
      onLayout={(e) => onLayout(id, e.nativeEvent.layout.y)}
      style={[styles.opt, flashing && { backgroundColor: highlight }]}
    >
      {children}
    </View>
  );
}

const COMMANDS_MODE_UI: Record<PMContextCommandsMode, { icon: string; label: string; title: string }> = {
  onHoverPanelMode: { icon: 'more_horiz', label: 'Hover panel', title: 'Buttons on the hovered (web) / selected (touch) row' },
  onRightClickMenuMode: { icon: 'menu_open', label: 'Right-click menu', title: 'Menu on right-click (web) / long-press and release (touch)' },
};

/** Hover panel | Right-click menu (uxuiSettings.project…ContextCommandsMode) */
function CommandsModeSelector({
  label,
  testID,
  value,
  onChange,
  colors,
}: {
  label: string;
  testID: string;
  value: PMContextCommandsMode;
  onChange: (v: PMContextCommandsMode) => void;
  colors: { text: string; primary: string };
}) {
  return (
    <>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.segment} testID={testID}>
        {PM_CONTEXT_COMMANDS_MODES.map((m) => (
          <PMIconButton
            key={m}
            testID={`${testID}-${m}`}
            icon={COMMANDS_MODE_UI[m].icon}
            label={COMMANDS_MODE_UI[m].label}
            title={COMMANDS_MODE_UI[m].title}
            active={value === m}
            activeColor={colors.primary}
            color={colors.text}
            onPress={() => onChange(m)}
          />
        ))}
      </View>
    </>
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
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 6, marginBottom: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2 },
  opt: { borderRadius: 8, paddingHorizontal: 4, paddingBottom: 4 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  tableHead: { borderBottomWidth: StyleSheet.hairlineWidth },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  headText: { fontSize: 12, fontWeight: '700', opacity: 0.7 },
  cellSetting: { flex: 1, paddingRight: 8 },
  cellTab: { width: 72, textAlign: 'right' },
});

