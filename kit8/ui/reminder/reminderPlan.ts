// The reminder PLAN: which reminders of the user's calendar entries the phone's OS must hold, and the diff against what it holds now.
// Pure (no OS, no React): documentation/REMINDER_WBS.html sections 4 and 5. The times are the ones of the in-app modal
// (dueReminders in ../calendar/data/userCalendarReminders.ts uses the same expandEvents / notificationTimeMs).

import { DAY_MS, dayKey, notificationLabel, notificationTimeMs, UserCalendarEventRow } from '../calendar/data/userCalendarModel';
import { expandEvents } from '../calendar/data/userCalendarRecurrence';
import { eventWhenText } from '../calendar/data/userCalendarEmail';

/** iOS keeps at most 64 pending local notifications per app; one slot stays free for the test notification. */
export const REMINDER_PLAN_LIMIT = 60;
/** How far ahead a reminder is planned. */
export const REMINDER_HORIZON_DAYS = 120;
/** Identifier prefix of the notifications this module manages (the test notification has another prefix and is left alone). */
export const REMINDER_ID_PREFIX = 'reminder:';

/** What travels inside the OS notification (read back at a tap and by the diff). */
export interface ReminderData {
  ownerGUID: string;
  /** `${rowGUID}:${YYYY-MM-DD}:${index}` - the key of dueReminders, "shown once per device" */
  key: string;
  eventGUID: string;
  /** 'YYYY-MM-DD' of the occurrence (deep link ?date=) */
  date: string;
  /** fire time + texts: a change of any of them replaces the scheduled notification */
  sig: string;
}

export interface PlannedReminder {
  identifier: string;
  key: string;
  fireMs: number;
  title: string;
  body: string;
  data: ReminderData;
}

/** A notification the OS holds (read back from it). */
export interface ScheduledReminder {
  identifier: string;
  sig?: string;
}

export const reminderIdentifier = (ownerGUID: string, key: string) => `${REMINDER_ID_PREFIX}${ownerGUID}:${key}`;
export const isManagedReminder = (identifier: string) => identifier.startsWith(REMINDER_ID_PREFIX);

const UNIT_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: DAY_MS, weeks: 7 * DAY_MS };

/** The longest "before" of the rows' reminders decides how far past the horizon occurrences must be expanded. */
const maxLeadMs = (rows: UserCalendarEventRow[]) => {
  let max = DAY_MS;
  for (const r of rows) for (const n of r.rowJSON.notifications || []) max = Math.max(max, n.amount * UNIT_MS[n.unit]);
  return max + DAY_MS;
};

/** The next `limit` reminders after `nowMs`, nearest first. Done tasks do not remind (events have no done state). */
export function planReminders(rows: UserCalendarEventRow[], ownerGUID: string, nowMs: number, limit = REMINDER_PLAN_LIMIT): PlannedReminder[] {
  if (!ownerGUID) return [];
  const withReminders = rows.filter((r) => (r.rowJSON.notifications || []).length > 0 && !(r.rowJSON.done && r.rowJSON.kind !== 'event'));
  if (!withReminders.length) return [];
  const horizonMs = nowMs + REMINDER_HORIZON_DAYS * DAY_MS;
  const byKey = new Map<string, PlannedReminder>();
  for (const occurrence of expandEvents(withReminders, nowMs - DAY_MS, horizonMs + maxLeadMs(withReminders))) {
    const row = occurrence.row;
    (row.rowJSON.notifications || []).forEach((notification, i) => {
      const fireMs = notificationTimeMs(notification, occurrence.startMs, occurrence.allDay);
      if (fireMs <= nowMs || fireMs > horizonMs) return;
      const key = `${occurrence.key}:${i}`;
      const title = row.rowJSON.title || 'Calendar';
      const body = `${eventWhenText(row, occurrence.startMs, occurrence.endMs)}\n${notificationLabel(notification, occurrence.allDay)}`;
      byKey.set(key, {
        identifier: reminderIdentifier(ownerGUID, key),
        key,
        fireMs,
        title,
        body,
        data: { ownerGUID, key, eventGUID: row.rowGUID, date: dayKey(occurrence.startMs), sig: `${fireMs}|${title}|${body}` },
      });
    });
  }
  return [...byKey.values()].sort((a, b) => a.fireMs - b.fireMs || a.key.localeCompare(b.key)).slice(0, limit);
}

export interface ReminderDiff {
  /** identifiers to cancel first (gone, changed, or of another user) */
  cancel: string[];
  /** reminders to schedule (new or changed) */
  schedule: PlannedReminder[];
}

/** What to change in the OS so that it holds exactly `plan` (only the notifications of this module are touched). */
export function diffPlan(plan: PlannedReminder[], pending: ScheduledReminder[]): ReminderDiff {
  const held = new Map(pending.filter((p) => isManagedReminder(p.identifier)).map((p) => [p.identifier, p]));
  const wanted = new Set(plan.map((p) => p.identifier));
  const cancel: string[] = [];
  const schedule: PlannedReminder[] = [];
  held.forEach((_p, id) => {
    if (!wanted.has(id)) cancel.push(id);
  });
  for (const p of plan) {
    const h = held.get(p.identifier);
    if (!h) schedule.push(p);
    else if (h.sig !== p.data.sig) {
      cancel.push(p.identifier);
      schedule.push(p);
    }
  }
  return { cancel, schedule };
}
