// Copy cell / Paste cell of the task tree (right click on a cell of a task row -> the row menu has "Copy cell" and "Paste cell").
// The copied value is kept IN THE APP (not as text): a date stays a date, a duration stays a duration; the text of the cell also goes to the system clipboard.
// A value is pasted only into a cell of the SAME kind: Start -> Start, Finish -> Finish, Days -> Days, % -> %, a custom / Extended column -> the same column.
// The paste is the same command as the inline editor of the cell (so undo, scheduling and the checks of the editor are the same).
import * as Clipboard from 'expo-clipboard';
import { appDispatch } from '../../../redux/storeRef';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { DAY_MS } from '../../model/constants';
import { formatPlanDate, formatPlanDuration } from '../../model/planDateFormats';
import { hourModelOf } from '../../hourmodel/hourModelSettings';
import { windowMinutes } from '../../hourmodel/hourAxis';
import { formatMinutes } from '../../hourmodel/minutes';
import { customCellValue, isExtColumnKey } from '../../extended/extendedColumns';
import { editTextOfCustomValue, isCustomColumnKey } from './columns/customColumns';
import { extContextOf } from '../../store/storeDerive';
import { usePMStore } from '../../store/store_pm';
import type { PMCellField } from '../../store/storeTypes';
import type { PMCrud } from '../../crud/usePMCrud';
import { utcMidnight, workDaysBetween } from '../project/scheduling';

export type CellFamily = 'start' | 'finish' | 'duration' | 'progress' | `custom:${string}`;

export interface CellClip {
  family: CellFamily;
  /** start / finish: ms of the day · duration: days (+ minutes in the time-of-day model) · progress: 0..100 · custom: the stored value */
  value: any;
  minutes?: number;
  /** the text of the cell as the user saw it */
  text: string;
  /** the column the cell came from (menu hint) */
  field: PMCellField;
}

export const cellFamilyOf = (field: PMCellField | null | undefined): CellFamily | null => {
  if (!field) return null;
  if (field === 'taskStartDate' || field === 'start') return 'start';
  if (field === 'taskFinishDate') return 'finish';
  if (field === 'taskDuration' || field === 'days') return 'duration';
  if (field === 'progress') return 'progress';
  if (isCustomColumnKey(field)) return `custom:${field}`;
  return null; // Kanban and the hour / minute / second fields: not copied
};

let clip: CellClip | null = null;
const listeners = new Set<() => void>();
export const cellClipboard = {
  get: (): CellClip | null => clip,
  set: (c: CellClip | null) => { clip = c; listeners.forEach((l) => l()); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** the cell of a task as a clip; null = this column cannot be copied */
export function readCell(guid: string, field: PMCellField): CellClip | null {
  const s = usePMStore.getState();
  const family = cellFamilyOf(field);
  const task = s.tasksById[guid];
  const sched = s.schedule[guid];
  if (!family || !task) return null;
  const fmt = s.planDateInputFormat;
  if (family === 'start') return sched ? { family, field, value: sched.startMs, text: formatPlanDate(sched.startMs, fmt) } : null;
  if (family === 'finish') {
    if (!sched) return null;
    const isSubDay = s.planHour || s.planMinute || s.planSecond;
    const ms = isSubDay ? sched.finishMs : sched.finishMs > sched.startMs ? sched.finishMs - 1 : sched.startMs;
    return { family, field, value: ms, text: formatPlanDate(ms, fmt) };
  }
  if (family === 'duration') {
    const days = sched?.durationDays ?? task.rowJSON.durationDays ?? 1;
    const projectJSON = s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : undefined;
    const hm = hourModelOf(projectJSON);
    if (hm.active) {
      const dayMinutes = windowMinutes(hm.windows);
      const minutes = (sched as { durationMinutes?: number } | undefined)?.durationMinutes ?? Math.round(days * dayMinutes);
      return { family, field, value: days, minutes, text: formatMinutes(minutes) };
    }
    return { family, field, value: days, text: formatPlanDuration(days, { planDay: s.planDay, planHour: s.planHour, planMinute: s.planMinute, planSecond: s.planSecond }) };
  }
  if (family === 'progress') { const n = Math.round(task.rowProgress ?? 0); return { family, field, value: n, text: String(n) }; }
  const def = s.customColumns.find((c) => c.key === field);
  if (!def) return null;
  const value = customCellValue(field as string, task, sched, extContextOf(s));
  return { family, field, value, text: editTextOfCustomValue(def.type, value) };
}

/** Copy cell: keep the value in the app + the text on the system clipboard */
export async function copyCell(guid: string, field: PMCellField): Promise<boolean> {
  const c = readCell(guid, field);
  if (!c) return false;
  cellClipboard.set(c);
  try { await Clipboard.setStringAsync(c.text); } catch { /* the in-app copy still works */ }
  try { appDispatch(showSnackbar({ message: `Cell copied: ${c.text || '(empty)'}`, duration: 2000 })); } catch { /* no store in a test */ }
  return true;
}

/** can the copied value be pasted into this cell? */
export const canPasteCell = (c: CellClip | null, field: PMCellField | null | undefined): boolean => !!c && !!field && cellFamilyOf(field) === c.family;

/** Paste cell: the same command as the inline editor of the cell; returns an error text, or null when it was pasted */
export function pasteCell(c: CellClip, guid: string, field: PMCellField, crud: PMCrud): string | null {
  if (!canPasteCell(c, field)) return 'This value does not fit this column';
  const s = usePMStore.getState();
  const sched = s.schedule[guid];
  if (c.family === 'start') { crud.setStartConstraint(guid, c.value as number); return null; }
  if (c.family === 'finish') {
    if (!sched) return 'No schedule';
    const isSubDay = s.planHour || s.planMinute || s.planSecond;
    if (isSubDay) {
      const diff = (c.value as number) - sched.startMs;
      if (diff <= 0) return 'Finish must be after start';
      crud.setDurationDays(guid, diff / DAY_MS);
      return null;
    }
    const instant = utcMidnight(c.value as number) + DAY_MS;
    if (instant <= sched.startMs) return 'Finish must be after start';
    const project = s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID] : undefined;
    const days = workDaysBetween(sched.startMs, instant, { skipWeekends: !!project?.rowJSON.skipWeekends });
    if (days < 1) return 'Finish must be after start';
    crud.setDurationDays(guid, days);
    return null;
  }
  if (c.family === 'duration') {
    const projectJSON = s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : undefined;
    const hm = hourModelOf(projectJSON);
    if (hm.active && c.minutes) crud.setDurationMinutes(guid, c.minutes, windowMinutes(hm.windows));
    else crud.setDurationDays(guid, c.value as number);
    return null;
  }
  if (c.family === 'progress') { crud.setProgress(guid, c.value as number); return null; }
  if (isExtColumnKey(field as string)) crud.setExtColumnValue(guid, field as string, c.value);
  else crud.setCustomColumnValue(guid, field as string, c.value);
  return null;
}
