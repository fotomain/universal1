// "Lightbox" editor (DHTMLX-style) for one row, opened by double-tap / edit buttons.
// Header: title + close (X). TopTabs: TabMain · TabUXUI (Colors).
// Footer: Delete · Details · Cancel · Save. The bar color is stored as rowJSON.taskColor.

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { usePMStore } from '../../store/store_pm';
import { addWorkDays, formatDateISO, parseDateISO, utcMidnight, workDaysBetween } from '../project/scheduling';
import { formatPlanDate, parsePlanDate } from '../../model/planDateFormats';
import { DAY_MS } from '../../model/constants';
import { PMCrud } from '../../crud/usePMCrud';
import { PMRowKind, taskColorOf } from '../../model/types';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import { usePMKanbanStore } from '../../store/store_kanban';
import { useKanbanCommands, PMKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import { kanbanStageProgressOf } from '../../model/kanbanTypes';
import { derivedKanbanProgress, kanbanLeavesOf } from '../kanban/kanbanModel';
import IconApp from '../../../components/common/IconApp';
import ColorPickerRowApp from '../../../components/common/ColorPickerRowApp';
import TextAreaApp from '../../../components/common/TextAreaApp';
import DateInputApp from '../../inner/inputs/PMDateInput';
import NumberInputApp from '../../../components/common/NumberInputApp';
import TextInputApp from '../../../components/common/TextInputApp';
import SegmentButtonsApp from '../../../components/common/SegmentButtonsApp';
import NumberStepperInputApp, { NUMBER_STEPPER_MIN_WIDTH } from '../../../components/common/NumberStepperInputApp';
import { pmT } from '../../i18n/pmT';

const SWATCHES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];
const KINDS: { kind: Exclude<PMRowKind, 'project'>; label: string; icon: string }[] = [
  { kind: 'stage', label: 'Stage', icon: 'folder' },
  { kind: 'task', label: 'Task', icon: 'task_alt' },
  { kind: 'milestone', label: 'Milestone', icon: 'flag' },
];

export type TaskEditTab = 'TabMain' | 'TabUXUI';

import { useUxuiCurrentJSON } from '../../../redux/useUxuiCurrentJSON';
import ShareScreenshotButton from '../../../components/common/ShareScreenshotButton';

export default function PMTaskEditModal({
  crud,
  kanban: kanbanProp,
}: {
  crud: PMCrud;
  kanban?: PMKanbanCommands;
}) {
  const { themeColors } = useDesignSystem();
  // width of the Duration / Progress / Kanban row (0 = not measured yet): too narrow for 3 fields -> one per row
  const [numbersWidth, setNumbersWidth] = useState(0);
  // web: always one row of 3 inputs; smartphones (iOS / Android): one input per row when the row is too narrow
  const numbersStacked = Platform.OS !== 'web' && numbersWidth > 0 && (numbersWidth - 2 * 8) / 3 < NUMBER_STEPPER_MIN_WIDTH;
  const editingGUID = usePMStore((s) => s.editingGUID);
  const task = usePMStore((s) => (s.editingGUID ? s.tasksById[s.editingGUID] : undefined));
  // uxui.currentJSON while the window is open ("Share screenshot + JSON")
  useUxuiCurrentJSON(task ? { kind: 'task', title: task.rowJSON?.name || 'task', json: task } : null);
  const sched = usePMStore((s) => (s.editingGUID ? s.schedule[s.editingGUID] : undefined));
  const hasChildren = usePMStore((s) => (s.editingGUID ? (s.tree.childrenById[s.editingGUID]?.length ?? 0) > 0 : false));
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const project = usePMStore((s) => (projectGUID ? s.projectsById[projectGUID] : undefined));
  const tasksById = usePMStore((s) => s.tasksById);
  const tree = usePMStore((s) => s.tree);
  const close = () => usePMStore.getState().setEditing(null);

  // Project planning units & format settings
  const planDay = usePMStore((s) => s.planDay);
  const planHour = usePMStore((s) => s.planHour);
  const planMinute = usePMStore((s) => s.planMinute);
  const planSecond = usePMStore((s) => s.planSecond);
  const planDateInputFormat = usePMStore((s) => s.planDateInputFormat);
  const isSubDay = planHour || planMinute || planSecond;

  const statesByTask = usePMKanbanStore((s) => s.statesByTask);
  const kanbanHook = useKanbanCommands(projectGUID);
  const kanban = kanbanProp ?? kanbanHook;

  const [activeTab, setActiveTab] = useState<TaskEditTab>('TabMain');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Exclude<PMRowKind, 'project'>>('task');
  const [days, setDays] = useState('1');
  const [start, setStart] = useState('');
  const [finish, setFinish] = useState('');
  const finishUserEditedRef = useRef(false);
  const lastEditedDateFieldRef = useRef<'start' | 'finish' | null>(null);

  const [startHour, setStartHour] = useState('0');
  const [startMinute, setStartMinute] = useState('0');
  const [startSecond, setStartSecond] = useState('0');
  const [finishHour, setFinishHour] = useState('0');
  const [finishMinute, setFinishMinute] = useState('0');
  const [finishSecond, setFinishSecond] = useState('0');
  const [progress, setProgress] = useState('0');
  const [kanbanProgress, setKanbanProgress] = useState('0');
  const [color, setColor] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setActiveTab('TabMain');
    setName(task.rowJSON.name || '');
    setKind((task.rowJSON.rowKind as any) === 'project' ? 'task' : (task.rowJSON.rowKind as Exclude<PMRowKind, 'project'>) || 'task');
    setDays(String(task.rowJSON.durationDays ?? 1));
    finishUserEditedRef.current = false;
    lastEditedDateFieldRef.current = null;

    // Initialize start date and sub-units
    const manualStartMs = task.rowJSON.manualStartAt ? Date.parse(task.rowJSON.manualStartAt) : null;
    const initialStartMs = manualStartMs ?? sched?.startMs ?? null;
    setStart(initialStartMs ? (planDateInputFormat === 'YYYY-MM-DD' ? formatDateISO(initialStartMs) : formatPlanDate(initialStartMs, planDateInputFormat)) : '');

    const sDate = initialStartMs ? new Date(initialStartMs) : new Date();
    setStartHour(String(task.rowJSON.startHourStart ?? (initialStartMs ? sDate.getUTCHours() : 0)));
    setStartMinute(String(task.rowJSON.planMinuteStart ?? (initialStartMs ? sDate.getUTCMinutes() : 0)));
    setStartSecond(String(task.rowJSON.planSecondStart ?? (initialStartMs ? sDate.getUTCSeconds() : 0)));

    // Initialize finish date and sub-units
    const schedFinishMs = sched?.finishMs;
    const finishDisplayMs = schedFinishMs
      ? isSubDay
        ? schedFinishMs
        : schedFinishMs > (sched?.startMs ?? 0)
        ? schedFinishMs - 1
        : schedFinishMs
      : null;
    setFinish(finishDisplayMs ? (planDateInputFormat === 'YYYY-MM-DD' ? formatDateISO(finishDisplayMs) : formatPlanDate(finishDisplayMs, planDateInputFormat)) : '');

    const fDate = schedFinishMs ? new Date(schedFinishMs) : new Date();
    setFinishHour(String(task.rowJSON.startHourFinish ?? (schedFinishMs ? fDate.getUTCHours() : 0)));
    setFinishMinute(String(task.rowJSON.planMinuteFinish ?? (schedFinishMs ? fDate.getUTCMinutes() : 0)));
    setFinishSecond(String(task.rowJSON.planSecondFinish ?? (schedFinishMs ? fDate.getUTCSeconds() : 0)));

    setProgress(String(Math.round(task.rowProgress || 0)));
    const isSumm = hasChildren || (task.rowJSON.rowKind as any) === 'stage';
    const initialKanbanProg = isSumm
      ? derivedKanbanProgress(task.rowGUID, tasksById, tree, statesByTask)
      : kanbanStageProgressOf(statesByTask[task.rowGUID], 0);
    setKanbanProgress(String(Math.round(initialKanbanProg)));
    setColor(taskColorOf(task.rowJSON));
    setNotes(task.rowJSON.notes || '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingGUID]);

  if (!task) return null;
  const summary = hasChildren || kind === 'stage';

  const handleStartChange = (newStart: string) => {
    setError(null);
    lastEditedDateFieldRef.current = 'start';
    setStart(newStart);

    // If finish was not explicitly edited by the user, keep finish in sync with start + days
    if (!finishUserEditedRef.current && newStart.trim()) {
      const pStart = parsePlanDate(newStart, planDateInputFormat) ?? parseDateISO(newStart);
      if (pStart !== null) {
        const d = parseInt(days, 10) || 1;
        const cal = { skipWeekends: !!project?.rowJSON.skipWeekends };
        const autoFinishMs = isSubDay ? pStart + d * DAY_MS : addWorkDays(pStart, Math.max(1, d), cal) - 1;
        setFinish(planDateInputFormat === 'YYYY-MM-DD' ? formatDateISO(autoFinishMs) : formatPlanDate(autoFinishMs, planDateInputFormat));
      }
    }
  };

  const handleFinishChange = (newFinish: string) => {
    setError(null);
    lastEditedDateFieldRef.current = 'finish';
    finishUserEditedRef.current = true;
    setFinish(newFinish);
  };

  const handleDaysChange = (newDaysText: string) => {
    const clean = newDaysText.replace(/[^0-9]/g, '');
    setDays(clean);
    if (!finishUserEditedRef.current && start.trim()) {
      const pStart = parsePlanDate(start, planDateInputFormat) ?? parseDateISO(start);
      if (pStart !== null) {
        const d = parseInt(clean, 10) || 1;
        const cal = { skipWeekends: !!project?.rowJSON.skipWeekends };
        const autoFinishMs = isSubDay ? pStart + d * DAY_MS : addWorkDays(pStart, Math.max(1, d), cal) - 1;
        setFinish(planDateInputFormat === 'YYYY-MM-DD' ? formatDateISO(autoFinishMs) : formatPlanDate(autoFinishMs, planDateInputFormat));
      }
    }
  };

  const save = () => {
    // 1. Parse & validate start date
    let parsedStartMs: number | null = null;
    if (start.trim()) {
      parsedStartMs =
        planDateInputFormat === 'YYYY-MM-DD'
          ? parseDateISO(start)
          : parsePlanDate(start, planDateInputFormat);
      if (parsedStartMs === null) {
        setError(`Start must be ${planDateInputFormat} (or empty = as soon as possible).`);
        return;
      }
    }

    // 2. Parse & validate finish date
    let parsedFinishMs: number | null = null;
    if (finish.trim()) {
      parsedFinishMs =
        planDateInputFormat === 'YYYY-MM-DD'
          ? parseDateISO(finish)
          : parsePlanDate(finish, planDateInputFormat);
      if (parsedFinishMs === null) {
        setError(`Finish must be ${planDateInputFormat} (or valid format).`);
        return;
      }
    }

    // 3. Sub-unit bounds validation
    const sH = planHour ? parseInt(startHour, 10) || 0 : 0;
    const sM = planMinute ? parseInt(startMinute, 10) || 0 : 0;
    const sS = planSecond ? parseInt(startSecond, 10) || 0 : 0;
    const fH = planHour ? parseInt(finishHour, 10) || 0 : 0;
    const fM = planMinute ? parseInt(finishMinute, 10) || 0 : 0;
    const fS = planSecond ? parseInt(finishSecond, 10) || 0 : 0;

    if (planHour && (sH < 0 || sH > 23 || fH < 0 || fH > 23)) {
      setError('Hours must be between 0 and 23.');
      return;
    }
    if (planMinute && (sM < 0 || sM > 59 || fM < 0 || fM > 59)) {
      setError('Minutes must be between 0 and 59.');
      return;
    }
    if (planSecond && (sS < 0 || sS > 59 || fS < 0 || fS > 59)) {
      setError('Seconds must be between 0 and 59.');
      return;
    }

    // 4. Combined full timestamps for validation
    const fullStartMs =
      parsedStartMs !== null
        ? parsedStartMs + (sH * 3600 + sM * 60 + sS) * 1000
        : null;

    const fullFinishMs =
      parsedFinishMs !== null
        ? parsedFinishMs + (fH * 3600 + fM * 60 + fS) * 1000
        : null;

    // Requirement validations:
    // 1. start - check if bigger then finish
    // 2. finish - check if less then start
    if (fullStartMs !== null && fullFinishMs !== null) {
      if (lastEditedDateFieldRef.current === 'finish' && fullFinishMs < fullStartMs) {
        setError('Finish date cannot be before start date.');
        return;
      }
      if (fullStartMs > fullFinishMs) {
        setError('Start date cannot be after finish date.');
        return;
      }
    }

    // Recalculate durationDays if finish date was explicitly edited
    let durationDays = kind === 'milestone' ? 0 : Math.max(kind === 'stage' ? 0 : 1, parseInt(days, 10) || 0);
    if (!summary && finishUserEditedRef.current && fullStartMs !== null && fullFinishMs !== null && kind !== 'milestone') {
      if (isSubDay) {
        const diffMs = fullFinishMs - fullStartMs;
        if (diffMs > 0) durationDays = diffMs / DAY_MS;
      } else {
        const finishInstant = utcMidnight(parsedFinishMs!) + DAY_MS;
        if (finishInstant > parsedStartMs!) {
          const calendar = { skipWeekends: !!project?.rowJSON.skipWeekends };
          const calcDays = workDaysBetween(parsedStartMs!, finishInstant, calendar);
          if (calcDays >= 1) durationDays = calcDays;
        }
      }
    }

    const { color: _legacyColor, ...json } = task.rowJSON;
    const updatedJSON: any = {
      ...json,
      name: name.trim() || task.rowJSON.name,
      rowKind: kind,
      durationDays,
      manualStartAt: fullStartMs === null ? null : new Date(fullStartMs).toISOString(),
      taskColor: color,
      notes: notes.trim() || undefined,
    };

    if (planHour) {
      updatedJSON.startHourStart = sH;
      updatedJSON.startHourFinish = fH;
    }
    if (planMinute) {
      updatedJSON.planMinuteStart = sM;
      updatedJSON.planMinuteFinish = fM;
    }
    if (planSecond) {
      updatedJSON.planSecondStart = sS;
      updatedJSON.planSecondFinish = fS;
    }

    crud.updateTask(
      task.rowGUID,
      {
        rowProgress: Math.min(100, Math.max(0, parseInt(progress, 10) || 0)),
        rowJSON: updatedJSON,
      },
      `Edit "${name.trim() || task.rowJSON.name}"`
    );

    const kanbanPct = Math.min(100, Math.max(0, parseInt(kanbanProgress, 10) || 0));
    if (summary) {
      const leaves = kanbanLeavesOf(task.rowGUID, tasksById, tree);
      if (leaves.length) {
        kanban?.setTasksKanbanProgress?.(leaves, kanbanPct);
      }
    } else {
      kanban?.setTaskKanbanProgress?.(task.rowGUID, kanbanPct);
    }

    close();
  };

  const labelStyle = [styles.label, { color: themeColors.text }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text }]}>Edit {summary ? 'stage' : kind}</Text>
            <PMIconButton testID="pm-edit-google-calendar" icon="event" title={pmT('Add to Google Calendar')} color={themeColors.text} onPress={() => crud.addToGoogleCalendar(task.rowGUID)} />
            <ShareScreenshotButton testID="pm-edit-share" color={themeColors.text} />
            <PMIconButton testID="pm-edit-close" icon="close" title={pmT('Cancel (close without saving)')} color={themeColors.text} onPress={close} />
          </View>

          {/* TopTabs Bar: TabMain, TabUXUI */}
          <View testID="pm-task-edit-toptabs" style={styles.topTabsBar}>
            {[
              { id: 'TabMain' as const, label: 'Main', icon: 'info' },
              { id: 'TabUXUI' as const, label: 'UX/UI', icon: 'palette' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  testID={`pm-task-tab-${tab.id}`}
                  accessibilityRole="tab"
                  aria-selected={active}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.topTabButton,
                    {
                      borderBottomColor: active ? themeColors.primary : 'transparent',
                      backgroundColor: active ? `${themeColors.primary}18` : 'transparent',
                    },
                  ]}
                >
                  <IconApp
                    name={tab.icon}
                    size={16}
                    color={active ? themeColors.primary : themeColors.text}
                  />
                  <Text
                    style={[
                      styles.topTabText,
                      {
                        color: active ? themeColors.primary : themeColors.text,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {pmT(tab.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ paddingBottom: 12 }}>
            {/* TabMain content */}
            <View
              testID="pm-task-tab-main-content"
              style={activeTab === 'TabMain' ? undefined : { display: 'none' }}
            >
              <TextInputApp
                testID="pm-edit-name"
                label={pmT('Name')}
                value={name}
                onChangeText={setName}
                autoFocus={Platform.OS === 'web'}
                onSubmitEditing={save}
              />

              {!summary ? (
                // one row when every field has room for its clear button + number + arrows (web, tablets, landscape),
                // otherwise (phone portrait) one field per row
                <View
                  testID="pm-edit-numbers"
                  onLayout={(e) => setNumbersWidth(e.nativeEvent.layout.width)}
                  style={numbersStacked ? styles.numbersStacked : [styles.row, styles.rowInputsOnOneLine]}
                >
                  <View style={numbersStacked ? null : styles.numberCell}>
                    <NumberStepperInputApp
                      testID="pm-edit-days"
                      label={pmT('Duration (working days)')}
                      value={kind === 'milestone' ? '0' : days}
                      editable={kind !== 'milestone'}
                      disabled={kind === 'milestone'}
                      min={1}
                      emptyValue={1}
                      onChangeText={handleDaysChange}
                      clearLabel={pmT('Clear')} increaseLabel={pmT('Increase')} decreaseLabel={pmT('Decrease')}
                    />
                  </View>
                  <View style={numbersStacked ? null : styles.numberCell}>
                    <NumberStepperInputApp
                      testID="pm-edit-progress"
                      label={pmT('Progress %')}
                      value={progress}
                      selectTextOnFocus
                      min={0}
                      max={100}
                      maxDigits={3}
                      onChangeText={setProgress}
                      clearLabel={pmT('Clear')} increaseLabel={pmT('Increase')} decreaseLabel={pmT('Decrease')}
                    />
                  </View>
                  <View style={numbersStacked ? null : styles.numberCell}>
                    <NumberStepperInputApp
                      testID="pm-edit-kanban-progress"
                      label={pmT('Kanban stage progress %')}
                      value={kanbanProgress}
                      selectTextOnFocus
                      min={0}
                      max={100}
                      maxDigits={3}
                      onChangeText={setKanbanProgress}
                      clearLabel={pmT('Clear')} increaseLabel={pmT('Increase')} decreaseLabel={pmT('Decrease')}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 2 }}>
                  <NumberStepperInputApp
                    testID="pm-edit-kanban-progress"
                    label={pmT('Kanban stage progress %')}
                    value={kanbanProgress}
                    selectTextOnFocus
                    min={0}
                    max={100}
                    maxDigits={3}
                    onChangeText={setKanbanProgress}
                    clearLabel={pmT('Clear')} increaseLabel={pmT('Increase')} decreaseLabel={pmT('Decrease')}
                  />
                </View>
              )}

              {/* Dates Section: Start and Finish editing with sub-units */}
              {!summary && (
                <View style={styles.datesContainer}>
                  {/* Start Date */}
                  <DateInputApp
                    testID="pm-edit-start"
                    label={pmT('Start no earlier than (YYYY-MM-DD, empty = ASAP)').replace('YYYY-MM-DD', planDateInputFormat)}
                    dateFormat={planDateInputFormat}
                    value={start}
                    onChangeText={handleStartChange}
                    placeholder={pmT('as soon as possible')}
                  />

                  {/* Start sub-units: hours, minutes, seconds */}
                  {(planHour || planMinute || planSecond) && (
                    <View style={styles.subUnitsRow}>
                      {planHour && (
                        <View style={styles.subUnitField}>
                          <NumberInputApp
                            testID="pm-edit-start-hour"
                            label={pmT('Start Hour (0-23)')}
                            labelStyle={styles.subUnitLabel}
                            value={startHour}
                            onChangeText={(v) => setStartHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
                            min={0}
                            max={23}
                            step={1}
                            compact
                          />
                        </View>
                      )}
                      {planMinute && (
                        <View style={styles.subUnitField}>
                          <NumberInputApp
                            testID="pm-edit-start-minute"
                            label={pmT('Start Min (0-59)')}
                            labelStyle={styles.subUnitLabel}
                            value={startMinute}
                            onChangeText={(v) => setStartMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
                            min={0}
                            max={59}
                            step={1}
                            compact
                          />
                        </View>
                      )}
                      {planSecond && (
                        <View style={styles.subUnitField}>
                          <NumberInputApp
                            testID="pm-edit-start-second"
                            label={pmT('Start Sec (0-59)')}
                            labelStyle={styles.subUnitLabel}
                            value={startSecond}
                            onChangeText={(v) => setStartSecond(v.replace(/[^0-9]/g, '').slice(0, 2))}
                            min={0}
                            max={59}
                            step={1}
                            compact
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Finish Date */}
                  {kind !== 'milestone' && (
                    <DateInputApp
                      testID="pm-edit-finish"
                      label={`${pmT('Finish date')} (${planDateInputFormat})`}
                      dateFormat={planDateInputFormat}
                      value={finish}
                      onChangeText={handleFinishChange}
                      placeholder={planDateInputFormat}
                    />
                  )}

                      {/* Finish sub-units: hours, minutes, seconds */}
                      {(planHour || planMinute || planSecond) && (
                        <View style={styles.subUnitsRow}>
                          {planHour && (
                            <View style={styles.subUnitField}>
                              <NumberInputApp
                                testID="pm-edit-finish-hour"
                                label={pmT('Finish Hour (0-23)')}
                                labelStyle={styles.subUnitLabel}
                                value={finishHour}
                                onChangeText={(v) => setFinishHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
                                min={0}
                                max={23}
                                step={1}
                                compact
                              />
                            </View>
                          )}
                          {planMinute && (
                            <View style={styles.subUnitField}>
                              <NumberInputApp
                                testID="pm-edit-finish-minute"
                                label={pmT('Finish Min (0-59)')}
                                labelStyle={styles.subUnitLabel}
                                value={finishMinute}
                                onChangeText={(v) => setFinishMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
                                min={0}
                                max={59}
                                step={1}
                                compact
                              />
                            </View>
                          )}
                          {planSecond && (
                            <View style={styles.subUnitField}>
                              <NumberInputApp
                                testID="pm-edit-finish-second"
                                label={pmT('Finish Sec (0-59)')}
                                labelStyle={styles.subUnitLabel}
                                value={finishSecond}
                                onChangeText={(v) => setFinishSecond(v.replace(/[^0-9]/g, '').slice(0, 2))}
                                min={0}
                                max={59}
                                step={1}
                                compact
                              />
                            </View>
                          )}
                        </View>
                      )}
                </View>
              )}

              <Text style={labelStyle}>{pmT('Type')}</Text>
              <SegmentButtonsApp
                testID="pm-edit-kind"
                value={kind}
                onValueChange={(k) => {
                  setKind(k);
                  if (k === 'milestone') setDays('0');
                }}
                buttons={KINDS.map((k) => ({ value: k.kind, label: pmT(k.label), icon: k.icon }))}
              />

              {sched && (
                <Text style={[styles.hint, { color: themeColors.text }]}>
                  Scheduled {formatDateISO(sched.startMs)} → {formatDateISO(sched.finishMs - 1)} · {sched.durationDays} d
                  {sched.isCritical ? ' · critical' : sched.totalFloatDays ? ` · slack ${sched.totalFloatDays} d` : ''}
                </Text>
              )}

              <TextAreaApp
                testID="pm-edit-notes"
                label={pmT('Notes')}
                value={notes}
                onChangeText={setNotes}
                numberOfLines={3}
                style={{ marginTop: 8 }}
              />
            </View>

            {/* TabUXUI content */}
            <View
              testID="pm-task-tab-uxui-content"
              style={activeTab === 'TabUXUI' ? undefined : { display: 'none' }}
            >
              {/* TabUXUI -> Colors */}
              <View testID="pm-task-colors-section">
                <Text style={[labelStyle, { fontWeight: '700', fontSize: 13, marginBottom: 8 }]}>{pmT('Colors')}</Text>
                <Text style={labelStyle}>{pmT('Task bar color')}</Text>
                <ColorPickerRowApp
                  testID="pm-task-color-picker"
                  value={color}
                  onChange={setColor}
                  showAuto
                  swatches={SWATCHES}
                  title={pmT('Custom task color')}
                  autoLabel={pmT('auto')}
                  customLabel={pmT('Custom…')}
                  // ids of the old swatches: pm-edit-color-auto, pm-edit-color-#6366f1 …
                  swatchTestID={(c) => `pm-edit-color-${SWATCHES.find((x) => x.toUpperCase() === (c || '').toUpperCase()) ?? c ?? 'auto'}`}
                />
              </View>
            </View>

            {!!error && (
              <Text testID="pm-task-edit-error" style={{ color: themeColors.error, marginTop: 8, fontWeight: '600' }}>
                {error}
              </Text>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.actions}>
            <PMDialogButton testID="pm-edit-delete" kind="danger" title={pmT('Delete')} style={{ marginLeft: 0 }} onPress={() => { close(); crud.deleteTask(task.rowGUID); }} />
            <PMDialogButton testID="pm-edit-open" kind="text" title={pmT('Details')} onPress={() => { close(); crud.openInfo(task.rowGUID); }} />
            {/* Cancel + Save always stay together on the right (phones: they wrap as ONE group) */}
            <View style={styles.actionsRight}>
              <PMDialogButton testID="pm-edit-cancel" kind="secondary" title={pmT('Cancel')} color={themeColors.text} style={{ marginLeft: 0 }} onPress={close} />
              <PMDialogButton testID="pm-edit-save" kind="primary" title={pmT('Save')} onPress={save} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 460, height: 600, maxHeight: '92%', borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  topTabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    marginTop: 4,
  },
  topTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    gap: 6,
  },
  topTabText: {
    fontSize: 13,
  },
  label: { fontSize: 12, opacity: 0.7, marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  // fields whose labels wrap to a different number of lines (tamagui / expo / native draw the label above the
  // input): bottoms aligned = the inputs stand on one line
  rowInputsOnOneLine: { alignItems: 'flex-end' },
  numberCell: { flex: 1, minWidth: 0 },
  numbersStacked: { flexDirection: 'column' },
  segment: { flexDirection: 'row' },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderWidth: 1 },
  segmentFirst: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  segmentLast: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  datesContainer: { marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  subUnitsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  subUnitField: { flex: 1 },
  subUnitLabel: { fontSize: 10, opacity: 0.7, marginBottom: 2 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 10, fontSize: 12, opacity: 0.75 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 14, rowGap: 8 },
  actionsRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 },
});
