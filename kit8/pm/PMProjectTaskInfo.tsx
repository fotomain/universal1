// /pm/project/task?taskGUID=...  - one task: schedule facts, progress, predecessors /
// successors (edge table, with link type + lag), and all transitive blockers /
// dependents straight from the closure table. Works as a deep link too: it looks the
// task up, selects its project and loads that project's data.
//
// Back (the in-page arrow, the header arrow, Android back, browser back): the user
// returns to the dashboard and this task is activated in the tree (parents expanded,
// row selected and scrolled into view) - see store.requestFocus / PMGanttSurface.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from '../components/common/IconApp';
import { PM_ROUTES } from './constants';
import { usePMStore } from './store';
import {
  usePMOwnerGUID,
  useReadProjectDataQuery,
  useReadProjectsQuery,
  useReadTaskClosureQuery,
  useReadTaskQuery,
} from './queries';
import { usePMCrud } from './usePMCrud';
import { formatDateISO, LINK_TYPES, validateNewDependency } from './scheduling';
import { PMTaskDependencyRow } from './types';
import PMTaskEditModal from './PMTaskEditModal';
import PMEditDependencyScreen from './PMEditDependencyScreen';
import PMApproveYesNoCancelModalWindow from './PMApproveYesNoCancelModalWindow';
import PMUndoProvider from './undo/PMUndoProvider';
import { PMDialogButton, PMIconButton, PMTipPressable } from './buttons';
import { PMTooltipLayer } from './PMTooltip';

const LINK_TYPE_TIP: Record<string, string> = { FS: 'Finish → Start', SS: 'Start → Start', FF: 'Finish → Finish', SF: 'Start → Finish' };

export default function PMProjectTaskInfo(props: { taskGUID: string; projectGUID?: string }) {
  return (
    <PMUndoProvider>
      <PMProjectTaskInfoInner {...props} />
    </PMUndoProvider>
  );
}

/**
 * Back to the dashboard with the task activated in the tree. Also used by the route's
 * header back arrow and by Android's hardware back button.
 */
export function useBackToDashboard(taskGUID: string) {
  const router = useRouter();
  return useCallback(() => {
    if (taskGUID) usePMStore.getState().requestFocus(taskGUID);
    router.navigate(PM_ROUTES.dashboard as any);
  }, [router, taskGUID]);
}

function PMProjectTaskInfoInner({ taskGUID, projectGUID: projectHint }: { taskGUID: string; projectGUID?: string }) {
  const { themeColors } = useDesignSystem();
  const router = useRouter();
  const navigation = useNavigation();
  const ownerGUID = usePMOwnerGUID(); // real Supabase auth uid (uuid) - see queries.ts

  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const task = usePMStore((s) => s.tasksById[taskGUID]);
  const sched = usePMStore((s) => s.schedule[taskGUID]);
  const tasksById = usePMStore((s) => s.tasksById);
  const tasks = usePMStore((s) => s.tasks);
  const deps = usePMStore((s) => s.deps);
  const tree = usePMStore((s) => s.tree);
  const schedule = usePMStore((s) => s.schedule);

  // deep link: find the task's project, then load it
  const taskQuery = useReadTaskQuery(!task ? taskGUID : null);
  const projectGUID = task?.projectGUID || taskQuery.data?.projectGUID || projectHint || null;
  useReadProjectsQuery(ownerGUID);
  useEffect(() => {
    if (projectGUID && projectGUID !== selectedProjectGUID) usePMStore.getState().selectProject(projectGUID);
  }, [projectGUID, selectedProjectGUID]);
  useReadProjectDataQuery(projectGUID);

  const crud = usePMCrud(ownerGUID, projectGUID);
  const upstream = useReadTaskClosureQuery(task ? taskGUID : null, 'up');
  const downstream = useReadTaskClosureQuery(task ? taskGUID : null, 'down');

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const preds = useMemo(() => deps.filter((d) => d.rowGUID === taskGUID), [deps, taskGUID]);
  const succs = useMemo(() => deps.filter((d) => d.rowDependsOnGUID === taskGUID), [deps, taskGUID]);
  const candidates = useMemo(() => {
    if (!adding) return [];
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => t.rowGUID !== taskGUID && (!q || (t.rowJSON.name || '').toLowerCase().includes(q)))
      .map((t) => ({ t, problem: validateNewDependency(tasks, deps, t.rowGUID, taskGUID) }))
      .slice(0, 40);
  }, [adding, search, tasks, deps, taskGUID]);

  const breadcrumb = useMemo(() => {
    const names: string[] = [];
    for (let g = tree.parentById[taskGUID]; g; g = tree.parentById[g]) names.unshift(tasksById[g]?.rowJSON.name || '');
    return names;
  }, [tree, tasksById, taskGUID]);
  const projectName = usePMStore((s) => (projectGUID ? s.projectsById[projectGUID]?.rowJSON.name : undefined));

  const c = themeColors;
  const back = useBackToDashboard(taskGUID);

  // whatever way the user leaves this page (browser back, drawer, ...), the dashboard
  // activates this task in the tree when it is shown next
  useEffect(() => () => {
    if (taskGUID) usePMStore.getState().requestFocus(taskGUID);
  }, [taskGUID]);

  // header back arrow (the drawer header shows a hamburger by default) + Android back
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <PMTipPressable tip="Back to the Gantt chart" testID="pm-task-header-back" onPress={back} style={{ paddingHorizontal: 14 }} hitSlop={8}>
          <IconApp testID="pm-task-header-back-icon" name="arrow_back" size={22} color={c.text} />
        </PMTipPressable>
      ),
    } as any);
  }, [navigation, back, c.text]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  if (!task) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        {taskQuery.isLoading || (projectGUID && !taskQuery.isError) ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <>
            <Text style={{ color: c.text, marginBottom: 12 }}>Task not found.</Text>
            <PMDialogButton testID="pm-info-open-dashboard" kind="text" title="Open the Gantt dashboard" onPress={() => router.replace(PM_ROUTES.dashboard as any)} />
          </>
        )}
      </View>
    );
  }

  const nameOf = (guid: string) => tasksById[guid]?.rowJSON.name || guid.slice(0, 8);
  const cycleType = (d: PMTaskDependencyRow) => {
    const next = LINK_TYPES[(LINK_TYPES.indexOf(d.linkType || 'FS') + 1) % LINK_TYPES.length];
    crud.updateDependency({ rowGUID: d.rowGUID, dependsOnGUID: d.rowDependsOnGUID }, { linkType: next }, 'Change link type');
  };
  const bumpLag = (d: PMTaskDependencyRow, delta: number) =>
    crud.updateDependency({ rowGUID: d.rowGUID, dependsOnGUID: d.rowDependsOnGUID }, { lagDays: (Number(d.lagDays) || 0) + delta }, 'Change lag');

  const isSummary = !!sched?.isSummary;
  const progress = Math.round(sched?.progress ?? task.rowProgress ?? 0);

  const renderDep = (d: PMTaskDependencyRow, other: string, direction: 'pred' | 'succ') => (
    <View key={`${direction}-${other}`} style={[styles.depRow, { borderColor: c.border }]}>
      <PMTipPressable tip="Open this task" style={{ flex: 1 }} onPress={() => router.setParams({ taskGUID: other } as any)}>
        <Text style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>
          {nameOf(other)}
        </Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>
          {schedule[other] ? `${formatDateISO(schedule[other].startMs)} → ${formatDateISO(schedule[other].finishMs - 1)}` : ''}
        </Text>
      </PMTipPressable>
      <PMTipPressable
        tip={`Link type: ${LINK_TYPE_TIP[d.linkType || 'FS']} - tap to change`}
        testID={`pm-info-type-${other}`}
        onPress={() => cycleType(d)}
        style={[styles.pill, { borderColor: c.border }]}
      >
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>{d.linkType || 'FS'}</Text>
      </PMTipPressable>
      <PMIconButton compact size={16} testID={`pm-info-lag-minus-${other}`} icon="remove" title="Lag -1 day (negative = lead)" color={c.text} onPress={() => bumpLag(d, -1)} />
      <Text style={{ color: c.text, width: 44, textAlign: 'center', fontSize: 12 }}>
        {(Number(d.lagDays) || 0) >= 0 ? '+' : ''}
        {Number(d.lagDays) || 0}d
      </Text>
      <PMIconButton compact size={16} testID={`pm-info-lag-plus-${other}`} icon="add" title="Lag +1 day" color={c.text} onPress={() => bumpLag(d, 1)} />
      <PMIconButton
        compact
        size={16}
        testID={`pm-info-dep-edit-${other}`}
        icon="tune"
        title="Edit dependency (type, lag, color)"
        color={c.text}
        onPress={() => crud.openDependencyEditor({ rowGUID: d.rowGUID, dependsOnGUID: d.rowDependsOnGUID })}
      />
      <PMIconButton
        compact
        size={16}
        testID={`pm-info-unlink-${other}`}
        icon="link_off"
        title="Remove this dependency"
        color={c.error}
        onPress={() => (direction === 'pred' ? crud.unlink(other, taskGUID) : crud.unlink(taskGUID, other))}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <PMTipPressable tip="Back to the Gantt chart" onPress={back} style={styles.backRow} hitSlop={8}>
          <IconApp testID="pm-task-info-back" name="arrow_back" size={18} color={c.primary} />
          <Text style={{ color: c.primary, marginLeft: 4, fontWeight: '600' }}>Gantt</Text>
        </PMTipPressable>

        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }} numberOfLines={1}>
          {[projectName, ...breadcrumb].filter(Boolean).join('  ›  ')}
        </Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>{task.rowJSON.name}</Text>
          <View style={[styles.kind, { backgroundColor: `${c.primary}1f` }]}>
            <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800' }}>{(isSummary ? 'stage' : task.rowJSON.rowKind).toUpperCase()}</Text>
          </View>
        </View>

        {/* ---- schedule facts ---- */}
        {sched && (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Fact label="Start" value={formatDateISO(sched.startMs)} color={c.text} />
            <Fact label="Finish" value={formatDateISO(sched.finishMs - 1)} color={c.text} />
            <Fact label="Duration" value={`${sched.durationDays} working day(s)`} color={c.text} />
            <Fact
              label="Slack"
              value={sched.inCycle ? 'in a dependency cycle' : sched.isCritical ? 'critical path (0 d)' : `${sched.totalFloatDays} d`}
              color={sched.isCritical ? c.error : c.text}
            />
            {task.rowJSON.manualStartAt && (
              <View style={styles.factRow}>
                <Text style={[styles.factLabel, { color: c.text }]}>Constraint</Text>
                <Text style={{ color: c.text, flex: 1 }}>start ≥ {formatDateISO(Date.parse(task.rowJSON.manualStartAt))}</Text>
                <PMTipPressable tip="Remove the start constraint (start as soon as possible)" testID="pm-info-clear-constraint" onPress={() => crud.updateTask(taskGUID, { rowJSON: { ...task.rowJSON, manualStartAt: null } })}>
                  <Text style={{ color: c.primary, fontWeight: '600' }}>Clear</Text>
                </PMTipPressable>
              </View>
            )}
          </View>
        )}

        {/* ---- progress ---- */}
        <Text style={[styles.section, { color: c.text }]}>Progress {progress}%</Text>
        <View style={[styles.progressTrack, { backgroundColor: `${c.primary}22` }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: c.primary }]} />
        </View>
        {!isSummary && (
          <View style={styles.progressBtns}>
            {[0, 25, 50, 75, 100].map((p) => (
              <PMTipPressable tip={`Set progress to ${p}%`} key={p} testID={`pm-info-progress-${p}`} onPress={() => crud.setProgress(taskGUID, p)} style={[styles.pill, { borderColor: c.border, marginRight: 6 }]}>
                <Text style={{ color: progress === p ? c.primary : c.text, fontWeight: progress === p ? '700' : '400' }}>{p}%</Text>
              </PMTipPressable>
            ))}
          </View>
        )}
        {isSummary && <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>Rolled up from the tasks inside (weighted by duration).</Text>}

        {/* ---- predecessors ---- */}
        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: c.text, flex: 1 }]}>Waits for (predecessors)</Text>
          <PMIconButton testID="pm-info-add-pred" icon={adding ? 'close' : 'add_link'} title={adding ? 'Close the task picker' : 'Add a predecessor (a task this one waits for)'} color={c.primary} onPress={() => setAdding((v) => !v)} />
        </View>
        {adding && (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              testID="pm-info-pred-search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search tasks…"
              placeholderTextColor={c.border}
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />
            {candidates.map(({ t, problem }) => (
              <Pressable
                key={t.rowGUID}
                testID={`pm-info-pred-${t.rowGUID}`}
                disabled={!!problem}
                onPress={() => {
                  crud.link(t.rowGUID, taskGUID, 'FS');
                  setAdding(false);
                  setSearch('');
                }}
                style={[styles.candidate, { opacity: problem ? 0.4 : 1 }]}
              >
                <Text style={{ color: c.text, flex: 1 }} numberOfLines={1}>
                  {t.rowJSON.name}
                </Text>
                {problem && <Text style={{ color: c.text, opacity: 0.7, fontSize: 11 }}>{problem}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        {preds.length === 0 && <Text style={{ color: c.text, opacity: 0.6 }}>Starts as soon as the project (or its constraint) allows.</Text>}
        {preds.map((d) => renderDep(d, d.rowDependsOnGUID, 'pred'))}

        {/* ---- successors ---- */}
        <Text style={[styles.section, { color: c.text }]}>Blocks (successors)</Text>
        {succs.length === 0 && <Text style={{ color: c.text, opacity: 0.6 }}>Nothing waits for this row.</Text>}
        {succs.map((d) => renderDep(d, d.rowGUID, 'succ'))}

        {/* ---- closure table ---- */}
        <Text style={[styles.section, { color: c.text }]}>All blockers (transitive)</Text>
        <ClosureList rows={upstream.data} loading={upstream.isLoading} nameOf={nameOf} color={c.text} kind="up" />
        <Text style={[styles.section, { color: c.text }]}>Everything it delays (transitive)</Text>
        <ClosureList rows={downstream.data} loading={downstream.isLoading} nameOf={nameOf} color={c.text} kind="down" />

        {!!task.rowJSON.notes && (
          <>
            <Text style={[styles.section, { color: c.text }]}>Notes</Text>
            <Text style={{ color: c.text }}>{task.rowJSON.notes}</Text>
          </>
        )}

        <View style={styles.actions}>
          <PMDialogButton testID="pm-info-edit" kind="primary" icon="edit" title="Edit" style={{ marginLeft: 0 }} onPress={() => crud.edit(taskGUID)} />
          <PMDialogButton
            testID="pm-info-delete"
            kind="dangerOutlined"
            icon="delete"
            title="Delete"
            onPress={async () => {
              await crud.deleteTask(taskGUID);
              if (!usePMStore.getState().tasksById[taskGUID]) back();
            }}
          />
        </View>
      </ScrollView>
      <PMTaskEditModal crud={crud} />
      <PMEditDependencyScreen crud={crud} />
      <PMApproveYesNoCancelModalWindow />
      <PMTooltipLayer />
    </View>
  );
}

function Fact({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={[styles.factLabel, { color }]}>{label}</Text>
      <Text style={{ color, flex: 1 }}>{value}</Text>
    </View>
  );
}

function ClosureList({
  rows,
  loading,
  nameOf,
  color,
  kind,
}: {
  rows?: { ancestorGUID: string; descendantGUID: string; depthLevel: number }[];
  loading: boolean;
  nameOf: (g: string) => string;
  color: string;
  kind: 'up' | 'down';
}) {
  if (loading) return <ActivityIndicator />;
  if (!rows?.length) return <Text style={{ color, opacity: 0.6 }}>None.</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {rows.map((r) => {
        const g = kind === 'up' ? r.ancestorGUID : r.descendantGUID;
        return (
          <View key={g} style={[styles.closureChip, { borderColor: `${color}33` }]}>
            <Text style={{ color, fontSize: 12 }}>
              {nameOf(g)} <Text style={{ opacity: 0.5 }}>· {r.depthLevel}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 48, maxWidth: 820, width: '100%', alignSelf: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', flexShrink: 1 },
  kind: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  factRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  factLabel: { width: 96, opacity: 0.6, fontSize: 13 },
  section: { fontWeight: '700', marginTop: 20, marginBottom: 8, fontSize: 15 },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 5 },
  progressBtns: { flexDirection: 'row', marginTop: 10 },
  pill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
  depRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { padding: 4, marginLeft: 2 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  candidate: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  closureChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6 },
  actions: { flexDirection: 'row', marginTop: 28 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginRight: 10 },
});
