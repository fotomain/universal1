// TaskDatesBar - Start date – Finish date · Select period, RIGHT of the task name in the toolbar of the task window (PMTaskEditView; documentation: kit8/pm/view/task/edit/README.md).
//   * the dates of the task as the schedule has them, in the project's date format, shown as TEXT (no input boxes): a press / touch on a date or on the icon opens Select period (the pressed date's input is active in it: the cursor is there)
//     (the window of Monitor01: a range of months, and its two dates can be typed or picked there too)
//   * Select period writes BOTH dates at once (the same rule as the task form: the start is "start no earlier than", the finish sets the duration in working days); a finish
//     before the start is refused with a message
//   * REPLAN: when the dates of a task that is posted (or was posted and changed) are changed, the plan of its lines is calculated again (Post of that one task, after the scheduler
//     has moved the days: REPLAN_DELAY_MS) - the plan days follow the new dates. A task that was never posted is not posted by this.
//   * read only (a press shows the tip that says why) for a stage / a task with children, a task that follows its subproject and while hours / minutes / seconds are on (edit those in
//     the task form)
//   * a milestone has one date: the Finish is shown, the start is not changed by a period
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../store/store_pm';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { PMIconButton } from '../../inner/buttons';
import { usePMTip } from '../../inner/tooltip/PMTooltip';
import { pmT } from '../../i18n/pmT';
import type { PMCrud } from '../../crud/usePMCrud';
import { formatPlanDate } from '../../model/planDateFormats';
import { formatDateISO } from '../project/scheduling';
import SelectPeriodModal from '../../reports/monitor01/SelectPeriodModal';
import { useProjectPostActions } from './plan/useProjectPostActions';
import { useProjectTaskLines } from './plan/useProjectTaskLines';
import { taskPostState } from './plan/taskLinePlanModel';
import { TaskDatesInput, taskDatesPatch, taskDatesReadOnlyReason, taskPeriodPatch } from './taskDatesModel';

/** the scheduler moves the days of the task on the server: the replan waits for it (the plan is calculated for the NEW days) */
export const REPLAN_DELAY_MS = 1500;
/** a replan that waited longer than this for the dates to move is dropped (the dates did not change after all) */
const REPLAN_WAIT_MS = 15000;

export default function TaskDatesBar({ guid, crud, testID = 'pm-task-dates' }: { guid: string; crud: Pick<PMCrud, 'updateTask'>; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const task = usePMStore((s) => s.tasksById[guid]);
  const sched = usePMStore((s) => s.schedule[guid]);
  const hasChildren = usePMStore((s) => (s.tree.childrenById[guid]?.length ?? 0) > 0);
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const skipWeekends = usePMStore((s) => !!(projectGUID ? s.projectsById[projectGUID]?.rowJSON?.skipWeekends : false));
  const format = usePMStore((s) => s.planDateInputFormat);
  const planHour = usePMStore((s) => s.planHour);
  const planMinute = usePMStore((s) => s.planMinute);
  const planSecond = usePMStore((s) => s.planSecond);

  const json: Record<string, any> = task?.rowJSON ?? {};
  const input: TaskDatesInput = { json, hasChildren, subDay: planHour || planMinute || planSecond, skipWeekends, format };
  const reason = taskDatesReadOnlyReason(input);
  const milestone = json.rowKind === 'milestone';

  // what the schedule says (the finish is the LAST day of the task, the schedule's finish is the instant after it)
  const startMs: number | null = sched?.startMs ?? null;
  const finishDay: number | null = sched?.finishMs ? (sched.finishMs > (sched.startMs ?? 0) ? sched.finishMs - 1 : sched.finishMs) : null;
  const show = (ms: number | null) => (ms === null ? '' : format === 'YYYY-MM-DD' || !format ? formatDateISO(ms) : formatPlanDate(ms, format));
  const shownStart = show(startMs);
  const shownFinish = show(finishDay);

  const [open, setOpen] = useState(false);
  const [focusField, setFocusField] = useState<'start' | 'finish' | null>(null); // the date that was pressed gets the cursor in the window
  const [error, setError] = useState<string | null>(null);
  const { postTask } = useProjectPostActions(projectGUID);
  const { byTask } = useProjectTaskLines(projectGUID);
  // REPLAN: set when the dates of a posted task were written; the effect below fires when the schedule shows the new days
  const replanSince = useRef<number | null>(null);
  const replanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (replanSince.current === null) return;
    const waited = Date.now() - replanSince.current;
    replanSince.current = null;
    if (waited > REPLAN_WAIT_MS) return;
    if (replanTimer.current) clearTimeout(replanTimer.current);
    replanTimer.current = setTimeout(() => { replanTimer.current = null; postTask(guid); }, REPLAN_DELAY_MS);
  }, [shownStart, shownFinish, guid, postTask]);
  useEffect(() => () => { if (replanTimer.current) clearTimeout(replanTimer.current); }, []);

  const tip = usePMTip(reason ? pmT(reason) : undefined);
  const openPeriod = (field: 'start' | 'finish' | null = null) => { if (reason) return; setFocusField(field); setOpen(true); };
  const apply = (p: { startDate: string; finishDate: string }) => {
    if (reason) return;
    const same = p.startDate === (startMs === null ? '' : formatDateISO(startMs)) && p.finishDate === (finishDay === null ? '' : formatDateISO(finishDay));
    const patch = same ? null : taskPeriodPatch(input, p, startMs);
    if (!patch) return;                                               // the same dates: nothing to write, nothing to replan
    if ('error' in patch) { setError(pmT(patch.error)); return; }
    setError(null);
    // a task that is posted (or was posted and changed since) gets its plan calculated again for the new dates
    if (taskPostState(byTask[guid] || []) !== 'post') replanSince.current = Date.now();
    crud.updateTask(guid, { rowJSON: { ...json, ...patch.json } }, `Change the dates of "${json.taskDescription ?? ''}"`);
  };

  if (!task) return null;
  const color = reason ? c.text + '66' : c.text;
  const dateText = (id: 'start' | 'finish', text: string, label: string) => (
    <Pressable testID={`${testID}-${id}`} accessibilityRole="button" accessibilityLabel={`${label}: ${text}`} onPress={() => openPeriod(id)} style={styles.date}>
      <Text numberOfLines={1} style={[styles.dateText, { color }]}>{text || '–'}</Text>
    </Pressable>
  );
  return (
    <View testID={testID} style={styles.row} {...(reason ? tip : {})}>
      {dateText('start', shownStart, pmT('Start date'))}
      <Text style={{ color, opacity: 0.6 }}>–</Text>
      {dateText('finish', shownFinish, pmT('Finish date'))}
      {!!error && <Text testID={`${testID}-error`} numberOfLines={1} style={[styles.dateText, { color: c.error }]}>{error}</Text>}
      {/* a whole range of months at once: the start AND the finish */}
      <PMIconButton testID={`${testID}-period-button`} icon="date_range" compact title={pmT('Select period (a range of months)')} color={color} onPress={() => openPeriod(null)} />
      <SelectPeriodModal dateFormat={format} focusField={focusField} testID={`${testID}-period-modal`} visible={open} onClose={() => setOpen(false)} onApply={apply}
        value={{ startDate: startMs === null ? '' : formatDateISO(startMs), finishDate: finishDay === null ? '' : formatDateISO(finishDay) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, flexShrink: 0 },
  date: { height: 24, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 4 },
  dateText: { fontSize: 14 },
});
