// "Add to Google Calendar" (row menu, hover panels, Edit task window, task page, Kanban card, FAB).
// Opens Google Calendar's "new event" page pre-filled with the task: no OAuth, no API key - the user
// reviews the event and presses Save in his own calendar (web: new tab, native: browser / Calendar app).
//
// Timed event (no all-day events): dates=YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
//   - If task has duration (not null): uses task duration / finishMs
//   - Otherwise (null / milestone): 15-minute duration from the day's begin

import { Linking, Platform } from 'react-native';
import { DAY_MS } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { buildTaskInfoText, taskShareURL } from './taskShare';

type PMState = ReturnType<typeof usePMStore.getState>;

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');
const dayStamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};
const timeStamp = (ms: number) => {
  const d = new Date(ms);
  return `${dayStamp(ms)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

/** Google Calendar "create event" URL of a task (null = unknown / unscheduled row). Pure. */
export function taskGoogleCalendarURL(guid: string, s: PMState = usePMStore.getState()): string | null {
  const t = s.tasksById[guid];
  const r = s.schedule[guid];
  if (!t || !r) return null;

  // Never all-day event:
  // 1) duration from task if not null
  // 2) or 15 min duration from the day's begin
  const hasTaskDuration = !r.isMilestone && (r.finishMs > r.startMs || (t.rowJSON.durationDays != null && t.rowJSON.durationDays > 0));
  const finishMs = hasTaskDuration
    ? (r.finishMs > r.startMs ? r.finishMs : r.startMs + (t.rowJSON.durationDays ?? 0) * DAY_MS)
    : r.startMs + FIFTEEN_MIN_MS;

  const dates = `${timeStamp(r.startMs)}/${timeStamp(finishMs)}`;
  const project = t.projectGUID ? s.projectsById[t.projectGUID] : undefined;
  const url = taskShareURL(guid, t.projectGUID);
  const details = buildTaskInfoText(guid, s, url) ?? url;
  const params: Record<string, string> = {
    action: 'TEMPLATE',
    text: project ? `${t.rowJSON.name} · ${project.rowJSON.name}` : t.rowJSON.name,
    dates,
    details,
  };
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `https://calendar.google.com/calendar/render?${qs}`;
}

/** Opens the pre-filled Google Calendar event; false when the task has no dates yet / nothing could open it. */
export async function addTaskToGoogleCalendar(guid: string): Promise<boolean> {
  const url = taskGoogleCalendarURL(guid);
  if (!url) {
    usePMStore.getState().setError('This task has no dates yet - it cannot be added to Google Calendar.');
    return false;
  }
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    usePMStore.getState().setError('Could not open Google Calendar.');
    return false;
  }
}
