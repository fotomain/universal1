// "Add to Google Calendar" (row menu, hover panels, Edit task window, task page, Kanban card, FAB).
// Opens Google Calendar's "new event" page pre-filled with the task: no OAuth, no API key - the user
// reviews the event and presses Save in his own calendar (web: new tab, native: browser / Calendar app).
//
//   day plans      all-day event  dates=YYYYMMDD/YYYYMMDD (the end day is exclusive, like schedule.finishMs)
//   sub-day plans  timed event    dates=YYYYMMDDTHHMMSSZ/...   (project.rowJSON.planHour / planMinute / planSecond)

import { Linking, Platform } from 'react-native';
import { DAY_MS } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { buildTaskInfoText, taskShareURL } from './taskShare';

type PMState = ReturnType<typeof usePMStore.getState>;

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
  const subDay = !!(s.planHour || s.planMinute || s.planSecond);
  let dates: string;
  if (subDay) {
    const finish = r.finishMs > r.startMs ? r.finishMs : r.startMs + 60 * 60 * 1000;
    dates = `${timeStamp(r.startMs)}/${timeStamp(finish)}`;
  } else {
    // all-day: the end date is exclusive; a milestone = one day
    const finish = r.finishMs > r.startMs ? r.finishMs : r.startMs + DAY_MS;
    dates = `${dayStamp(r.startMs)}/${dayStamp(finish)}`;
  }
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
