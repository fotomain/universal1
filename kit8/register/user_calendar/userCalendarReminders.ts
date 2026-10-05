// Reminders ("notifications") of calendar entries: which ones became due between two checks.
// Pure; the UserCalendarNotifier (kit8/catalog/user/calendar) runs it and opens the entry as a modal window.

import { DAY_MS, notificationLabel, notificationTimeMs, UserCalendarEventRow, UserCalendarNotification, UserCalendarOccurrence } from './userCalendarModel';
import { expandEvents } from './userCalendarRecurrence';

export interface UserCalendarDueReminder {
  /** `${occurrence key}:${index of the notification}` - shown once per device */
  key: string;
  occurrence: UserCalendarOccurrence;
  notification: UserCalendarNotification;
  fireMs: number;
  label: string;
}

/** The longest "before" of the rows' reminders decides how far ahead occurrences must be expanded. */
const maxLeadMs = (rows: UserCalendarEventRow[]) => {
  let max = DAY_MS;
  for (const r of rows)
    for (const n of r.rowJSON.notifications || []) {
      const ms = n.amount * (n.unit === 'weeks' ? 7 * DAY_MS : n.unit === 'days' ? DAY_MS : n.unit === 'hours' ? 3600000 : 60000);
      if (ms > max) max = ms;
    }
  return max + DAY_MS;
};

/** Reminders whose time is inside (afterMs, nowMs]. Done tasks do not remind. */
export function dueReminders(rows: UserCalendarEventRow[], afterMs: number, nowMs: number): UserCalendarDueReminder[] {
  const withReminders = rows.filter((r) => (r.rowJSON.notifications || []).length > 0 && !(r.rowJSON.done && r.rowJSON.kind !== 'event'));
  if (!withReminders.length) return [];
  const out: UserCalendarDueReminder[] = [];
  for (const occurrence of expandEvents(withReminders, afterMs - DAY_MS, nowMs + maxLeadMs(withReminders))) {
    (occurrence.row.rowJSON.notifications || []).forEach((notification, i) => {
      const fireMs = notificationTimeMs(notification, occurrence.startMs, occurrence.allDay);
      if (fireMs > afterMs && fireMs <= nowMs) {
        out.push({ key: `${occurrence.key}:${i}`, occurrence, notification, fireMs, label: notificationLabel(notification, occurrence.allDay) });
      }
    });
  }
  return out.sort((a, b) => a.fireMs - b.fireMs);
}
