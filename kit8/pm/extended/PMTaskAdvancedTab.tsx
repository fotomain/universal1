// PMTaskAdvancedTab - the "Advanced" tab of the task window (Extended G1): one place for the scheduling inputs of the Extended functions that are switched on.
//   A1 mode · A3 constraint · A5 deadline · A6 type / work / units · A8 / A9 duration text, elapsed, estimate · A10 calendar · A12 splits · A14 inactive · A15 priority · G2 milestone flag
//   C3 actual dates · B5 external predecessor · B6 the inspector ("why does it start on this date")
// Every field writes at once (one undo step each) through the crud commands; a field of a function that is off is not shown.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import SwitchApp from '../../ui/components/common/SwitchApp';
import SegmentButtonsApp from '../../ui/components/common/SegmentButtonsApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../ui/components/common/TextInputApp';
import PMDateInput from '../inner/inputs/PMDateInput';
import { PMDialogButton } from '../inner/buttons';
import { usePMStore } from '../store/store_pm';
import type { PMCrud } from '../crud/usePMCrud';
import { pmT } from '../i18n/pmT';
import { extendedOf } from './extendedModel';
import { extendedOptionsOf } from './extendedOptions';
import { PM_TASK_TYPES, PMTaskType, triangleOf } from './taskTypes';
import { formatDurationText } from './durationText';
import { inspectTask } from './taskPath';
import { constraintHasDate, constraintOf, constraintReadOnlyReason, PM_CONSTRAINT_LABELS, PM_CONSTRAINT_TYPES, PMConstraintType } from '../model/taskConstraint';
import { taskModeOf, taskModeReadOnlyReason } from '../model/taskScheduleMode';
import { scheduleOptionsOf } from '../model/scheduleOptions';
import { formatDateISO } from '../view/project/scheduling';
import type { PMLinkType, PMTaskJSON } from '../model/types';

/** a text field that commits on blur / Enter (so a number is not saved on every key) */
function CommitText({ testID, label, value, onCommit, keyboardType, placeholder }: { testID: string; label: string; value: string; onCommit: (v: string) => void; keyboardType?: 'numeric'; placeholder?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextInputApp
      testID={testID}
      label={label}
      value={text}
      placeholder={placeholder}
      keyboardType={keyboardType}
      onChangeText={setText}
      onBlur={() => text !== value && onCommit(text)}
      onSubmitEditing={() => text !== value && onCommit(text)}
    />
  );
}

export default function PMTaskAdvancedTab({ guid, crud }: { guid: string; crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const task = usePMStore((s) => s.tasksById[guid]);
  const row = usePMStore((s) => s.schedule[guid]);
  const hasChildren = usePMStore((s) => (s.tree.childrenById[guid]?.length ?? 0) > 0);
  const project = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined));
  const externalDates = usePMStore((s) => s.externalDates);
  const [showWhy, setShowWhy] = useState(false);
  const [extGuid, setExtGuid] = useState('');
  const [extType, setExtType] = useState<PMLinkType>('FS');
  const [extLag, setExtLag] = useState('0');
  if (!task || !project) return null;

  const json = task.rowJSON as PMTaskJSON;
  const ext = extendedOf(project.rowJSON);
  const opts = extendedOptionsOf(project.rowJSON);
  const so = scheduleOptionsOf(project.rowJSON);
  const stage = hasChildren || json.rowKind === 'stage';
  const label = { color: c.text };
  const set = (patch: Partial<PMTaskJSON>, what: string) => crud.updateTaskFields(guid, patch, what);
  const isManual = taskModeOf(json, so.manualEnabled, hasChildren) === 'manual';
  const modeLocked = taskModeReadOnlyReason(json, hasChildren);
  const con = constraintOf(json, so.constraintsEnabled);
  const conLocked = constraintReadOnlyReason(json, hasChildren, isManual);
  const tri = triangleOf(json);
  const fmt = (ms: number) => formatDateISO(ms);
  const section = (title: string) => <Text style={[styles.section, label]}>{pmT(title)}</Text>;

  return (
    <View testID="pm-task-tab-advanced-content" style={{ gap: 8 }}>
      {ext.ganttManualSchedulingEnabled && !stage && (
        <View>
          {section('Scheduling mode')}
          <SegmentButtonsApp
            testID="pm-adv-mode"
            value={isManual ? 'manual' : 'auto'}
            disabled={!!modeLocked}
            onValueChange={(m) => crud.setScheduleMode(guid, m)}
            buttons={[{ value: 'auto', label: pmT('Auto scheduled') }, { value: 'manual', label: pmT('Manually scheduled') }]}
          />
          {!!modeLocked && <Text style={styles.hint}>{pmT(modeLocked)}</Text>}
        </View>
      )}

      {ext.ganttConstraintsEnabled && !stage && (
        <View>
          {section('Constraint')}
          <SelectItemFromListApp
            testID="pm-adv-constraint-type"
            label={pmT('Constraint type')}
            disabled={!!conLocked}
            items={PM_CONSTRAINT_TYPES.map((t) => ({ value: t, label: pmT(PM_CONSTRAINT_LABELS[t]) }))}
            value={con.type}
            onSelect={(t: PMConstraintType) => crud.setConstraint(guid, t, constraintHasDate(t) ? con.dateMs ?? row?.startMs ?? Date.now() : null)}
          />
          {constraintHasDate(con.type) && !conLocked && (
            <PMDateInput
              testID="pm-adv-constraint-date"
              label={`${pmT('Constraint date')}${con.type === 'MFO' || con.type === 'FNET' || con.type === 'FNLT' ? ' · ' + pmT('the last day of the task') : ''}`}
              dateFormat="YYYY-MM-DD"
              value={con.dateMs !== null ? fmt(con.dateMs) : ''}
              onChangeText={(v) => {
                const ms = /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : NaN;
                if (Number.isFinite(ms)) crud.setConstraint(guid, con.type, ms);
              }}
            />
          )}
          {!!conLocked && <Text style={styles.hint}>{pmT(conLocked)}</Text>}
        </View>
      )}

      {ext.ganttDeadlineEnabled && !stage && (
        <PMDateInput
          testID="pm-adv-deadline"
          label={pmT('Deadline (never moves the task)')}
          dateFormat="YYYY-MM-DD"
          value={json.taskDeadline ? json.taskDeadline.slice(0, 10) : ''}
          onChangeText={(v) => (v === '' ? set({ taskDeadline: null }, 'Deadline') : /^\d{4}-\d{2}-\d{2}$/.test(v) && set({ taskDeadline: new Date(`${v}T00:00:00Z`).toISOString() }, 'Deadline'))}
        />
      )}

      {ext.ganttTaskTypesEnabled && !stage && (
        <View>
          {section('Task type, work and units')}
          <SelectItemFromListApp testID="pm-adv-type" label={pmT('Task type')} items={PM_TASK_TYPES.map((t) => ({ value: t.value, label: pmT(t.label) }))} value={tri.type} onSelect={(v: PMTaskType) => set({ taskType: v }, 'Task type')} />
          <SwitchApp testID="pm-adv-effort" label={pmT('Effort driven')} value={tri.effortDriven} onValueChange={(v) => set({ taskEffortDriven: v }, 'Effort driven')} />
          <View style={styles.row}>
            <View style={styles.cell}><CommitText testID="pm-adv-duration-days" label={pmT('Duration (days)')} keyboardType="numeric" value={String(tri.durationDays)} onCommit={(v) => crud.setTaskTriangle(guid, 'duration', Number(v.replace(',', '.')))} /></View>
            <View style={styles.cell}><CommitText testID="pm-adv-work" label={pmT('Work (hours)')} keyboardType="numeric" value={String(tri.workHours)} onCommit={(v) => crud.setTaskTriangle(guid, 'work', Number(v.replace(',', '.')))} /></View>
            <View style={styles.cell}><CommitText testID="pm-adv-units" label={pmT('Units (%)')} keyboardType="numeric" value={String(tri.units)} onCommit={(v) => crud.setTaskTriangle(guid, 'units', Number(v.replace(',', '.')))} /></View>
          </View>
        </View>
      )}

      {(ext.ganttDurationUnitsEnabled || ext.ganttEstimatedDurationEnabled) && !stage && json.rowKind !== 'milestone' && (
        <View>
          {section('Duration')}
          <CommitText testID="pm-adv-duration-text" label={pmT('Duration with a unit: 3d, 2w, 1mo, 4ed, 6h (? = estimate)')} value={formatDurationText(json.durationDays ?? 1, { elapsed: ext.ganttDurationUnitsEnabled && json.durationElapsed === true, estimated: ext.ganttEstimatedDurationEnabled && json.durationEstimated === true })} onCommit={(v) => crud.setDurationText(guid, v)} />
          {ext.ganttDurationUnitsEnabled && <SwitchApp testID="pm-adv-elapsed" label={pmT('Elapsed duration (calendar days, ignores the calendar)')} value={json.durationElapsed === true} onValueChange={(v) => set({ durationElapsed: v }, 'Elapsed duration')} />}
          {ext.ganttEstimatedDurationEnabled && <SwitchApp testID="pm-adv-estimated" label={pmT('Estimated duration (?)')} value={json.durationEstimated === true} onValueChange={(v) => set({ durationEstimated: v }, 'Estimated duration')} />}
        </View>
      )}

      {ext.ganttTaskCalendarEnabled && !stage && (
        <SelectItemFromListApp
          testID="pm-adv-calendar"
          label={pmT('Calendar of the task')}
          items={[{ value: '', label: pmT('Project calendar') }, ...opts.calendars.map((x) => ({ value: x.id, label: x.name }))]}
          value={json.taskCalendarId && opts.calendars.some((x) => x.id === json.taskCalendarId) ? json.taskCalendarId : ''}
          onSelect={(v: string) => set({ taskCalendarId: v || null }, 'Task calendar')}
        />
      )}

      {ext.ganttSplitTasksEnabled && !stage && json.rowKind !== 'milestone' && (
        <View>
          {section('Splits')}
          {(json.taskSplits ?? []).map((sp, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.cell}><CommitText testID={`pm-adv-split-after-${i}`} label={pmT('After (days of work)')} keyboardType="numeric" value={String(sp.after)} onCommit={(v) => set({ taskSplits: (json.taskSplits ?? []).map((x, j) => (j === i ? { ...x, after: Math.max(1, Math.round(Number(v) || 1)) } : x)) }, 'Split')} /></View>
              <View style={styles.cell}><CommitText testID={`pm-adv-split-gap-${i}`} label={pmT('Pause (days)')} keyboardType="numeric" value={String(sp.gap)} onCommit={(v) => set({ taskSplits: (json.taskSplits ?? []).map((x, j) => (j === i ? { ...x, gap: Math.max(1, Math.round(Number(v) || 1)) } : x)) }, 'Split')} /></View>
              <PMDialogButton testID={`pm-adv-split-del-${i}`} kind="danger" title={pmT('Remove')} onPress={() => set({ taskSplits: (json.taskSplits ?? []).filter((_, j) => j !== i) }, 'Remove split')} />
            </View>
          ))}
          <PMDialogButton testID="pm-adv-split-add" kind="secondary" icon="add" title={pmT('Add split')} onPress={() => set({ taskSplits: [...(json.taskSplits ?? []), { after: Math.max(1, Math.floor((json.durationDays ?? 2) / 2)), gap: 1 }] }, 'Add split')} />
        </View>
      )}

      {ext.ganttInactiveTasksEnabled && (
        <SwitchApp testID="pm-adv-inactive" label={pmT('Inactive task (visible, not part of the schedule)')} value={json.taskInactive === true} onValueChange={(v) => set({ taskInactive: v }, v ? 'Inactivate' : 'Activate')} />
      )}

      {ext.ganttTaskPriorityEnabled && (
        <CommitText testID="pm-adv-priority" label={pmT('Priority (0-1000)')} keyboardType="numeric" value={String(json.taskPriority ?? 500)} onCommit={(v) => set({ taskPriority: Math.max(0, Math.min(1000, Math.round(Number(v) || 0))) }, 'Priority')} />
      )}

      {ext.ganttMilestoneFlagEnabled && !stage && json.rowKind !== 'milestone' && (
        <SwitchApp testID="pm-adv-milestone" label={pmT('Mark as milestone (a diamond at the finish)')} value={json.taskMarkAsMilestone === true} onValueChange={(v) => set({ taskMarkAsMilestone: v }, 'Milestone flag')} />
      )}

      {ext.ganttActualDatesEnabled && !stage && (
        <View>
          {section('Actual dates')}
          <PMDateInput testID="pm-adv-actual-start" label={pmT('Actual start')} dateFormat="YYYY-MM-DD" value={json.actualStartAt ? json.actualStartAt.slice(0, 10) : ''} onChangeText={(v) => (v === '' ? set({ actualStartAt: null }, 'Actual start') : /^\d{4}-\d{2}-\d{2}$/.test(v) && set({ actualStartAt: new Date(`${v}T00:00:00Z`).toISOString() }, 'Actual start'))} />
          <PMDateInput testID="pm-adv-actual-finish" label={pmT('Actual finish (the last day)')} dateFormat="YYYY-MM-DD" value={json.actualFinishAt ? json.actualFinishAt.slice(0, 10) : ''} onChangeText={(v) => (v === '' ? set({ actualFinishAt: null }, 'Actual finish') : /^\d{4}-\d{2}-\d{2}$/.test(v) && set({ actualFinishAt: new Date(`${v}T00:00:00Z`).toISOString() }, 'Actual finish'))} />
        </View>
      )}

      {ext.ganttCrossProjectLinksEnabled && !stage && (
        <View>
          {section('Predecessors in other projects')}
          {(json.externalPredecessors ?? []).map((e, i) => {
            const d = externalDates[e.taskGUID];
            return (
              <View key={i} style={styles.row}>
                <Text style={[styles.cell, label]} numberOfLines={2}>{`${e.name || e.taskGUID.slice(0, 8)} · ${e.linkType || 'FS'}${e.lagDays ? ` ${e.lagDays > 0 ? '+' : ''}${e.lagDays}d` : ''}${d ? ` · ${fmt(d.startMs)} → ${fmt(d.finishMs - 86400000)}` : ` · ${pmT('dates not read yet')}`}`}</Text>
                <PMDialogButton testID={`pm-adv-ext-del-${i}`} kind="danger" title={pmT('Remove')} onPress={() => set({ externalPredecessors: (json.externalPredecessors ?? []).filter((_, j) => j !== i) }, 'Remove external predecessor')} />
              </View>
            );
          })}
          <TextInputApp testID="pm-adv-ext-guid" label={pmT('GUID of a task of another project (row menu: Copy GUID)')} value={extGuid} onChangeText={setExtGuid} autoCapitalize="none" />
          <View style={styles.row}>
            <View style={styles.cell}><SelectItemFromListApp testID="pm-adv-ext-type" label={pmT('Link type')} items={(['FS', 'SS', 'FF', 'SF'] as PMLinkType[]).map((t) => ({ value: t, label: t }))} value={extType} onSelect={(v: PMLinkType) => setExtType(v)} /></View>
            <View style={styles.cell}><TextInputApp testID="pm-adv-ext-lag" label={pmT('Lag (days)')} value={extLag} keyboardType="numeric" onChangeText={setExtLag} /></View>
          </View>
          <PMDialogButton
            testID="pm-adv-ext-add"
            kind="secondary"
            icon="add"
            title={pmT('Add external predecessor')}
            disabled={!/^[0-9a-fA-F-]{36}$/.test(extGuid.trim())}
            onPress={() => {
              set({ externalPredecessors: [...(json.externalPredecessors ?? []), { taskGUID: extGuid.trim().toLowerCase(), linkType: extType, lagDays: Math.round(Number(extLag) || 0) }] }, 'External predecessor');
              setExtGuid('');
            }}
          />
        </View>
      )}

      {ext.ganttTaskInspectorEnabled && row && (
        <View>
          <PMDialogButton testID="pm-adv-why" kind="text" icon="help" title={showWhy ? pmT('Hide the explanation') : pmT('Why does it start on this date?')} onPress={() => setShowWhy((v) => !v)} />
          {showWhy && (
            <View testID="pm-adv-inspector" style={{ gap: 4 }}>
              {inspectTask({ task, row, deps: usePMStore.getState().deps, schedule: usePMStore.getState().schedule, tasksById: usePMStore.getState().tasksById, cal: so.projectCalendar ?? { skipWeekends: !!project.rowJSON.skipWeekends }, projectStartMs: usePMStore.getState().projectStartMs, constraintsEnabled: so.constraintsEnabled, fmt }).map((l, i) => (
                <Text key={i} style={{ color: l.kind === 'warning' ? '#c2410c' : c.text, fontSize: 13 }}>{`${l.kind === 'warning' ? '⚠ ' : l.kind === 'driver' ? '→ ' : '· '}${l.text}`}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cell: { flex: 1 },
});
