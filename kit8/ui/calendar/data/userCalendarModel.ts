// User calendar model, mirroring kit8/sql/init/create_user_calendar_tables.sql.
// Tables use the kit8/sql/defTable.md pattern; rowOwnerGUID = userState.userGUID.

export const userCalendarTable = 'user_calendar_table';
export const userCalendarEventTable = 'user_calendar_event_table';
export const userCalendarInvitationTable = 'user_calendar_invitation_table';

/** event = meeting, task = calendar to-do, birthday = yearly all-day, projectTask = copy of a project task (SQL trigger). */
export type UserCalendarKind = 'event' | 'task' | 'birthday' | 'projectTask';

export type UserCalendarRepeatUnit = 'day' | 'week' | 'month' | 'year';

export type UserCalendarRecurrenceEnd =
  | { type: 'never' }
  /** last day (inclusive), 'YYYY-MM-DD' */
  | { type: 'on'; date: string }
  | { type: 'after'; count: number };

/** "Custom recurrence": repeats every `interval` `freq`. */
export interface UserCalendarRecurrence {
  freq: UserCalendarRepeatUnit;
  interval: number;
  /** week: days it repeats on, 0 = Sunday ... 6 = Saturday (empty = the weekday of the start) */
  weekdays?: number[];
  /** month: the same day number (default) or the same n-th weekday ("first Wednesday") */
  monthlyMode?: 'dayOfMonth' | 'nthWeekday';
  end: UserCalendarRecurrenceEnd;
}

/** Reminder: `amount` `unit` before the start; all-day entries also need the time of day. */
export interface UserCalendarNotification {
  amount: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
  /** all-day entries: 'HH:MM' of the reminder day (default 09:00) */
  atTime?: string;
}

export interface UserCalendarGuest {
  email: string;
  name?: string;
  /** e-mail invitation: not sent yet / sent / could not be sent */
  status?: 'new' | 'sent' | 'failed';
  sentAt?: string;
}

/** What was shared into the app (kit8/providers/WithIntent.tsx) when the entry was created from an intent. */
export interface IntentLink {
  intentURL?: string | null;
  intentMIME?: string | null;
  intentText?: string | null;
  intentTitle?: string | null;
  intentFiles?: { path: string; mimeType?: string | null; fileName?: string | null; size?: number | null }[];
  intentReceivedAt?: string;
}

export interface UserCalendarEventJSON {
  kind: UserCalendarKind;
  title: string;
  allDay: boolean;
  /** ISO instant (UTC). All-day entries: use startDate / endDate, these are kept for sorting and SQL. */
  startAt: string;
  endAt: string;
  /** all-day entries: first and last day (inclusive), 'YYYY-MM-DD' */
  startDate?: string;
  endDate?: string;
  recurrence?: UserCalendarRecurrence | null;
  /** occurrences removed from a repeating entry, 'YYYY-MM-DD' of their start day */
  exDates?: string[];
  notifications?: UserCalendarNotification[];
  guests?: UserCalendarGuest[];
  location?: string;
  description?: string;
  color?: string | null;
  // ---- tasks ----
  done?: boolean;
  /** 'YYYY-MM-DD' */
  deadline?: string | null;
  // ---- Google Calendar sync ----
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  /** Google's "updated" stamp of the copy we hold (to see which side changed) */
  googleUpdated?: string | null;
  // ---- created from a share intent ----
  intent?: IntentLink | null;
  // ---- kind 'projectTask' (written by the SQL trigger, read-only in the calendar) ----
  projectGUID?: string;
  projectTaskGUID?: string;
  projectTitle?: string;
  rowKind?: string;
  rowProgress?: number;
}

export interface UserCalendarEventRow {
  rowGUID: string;
  rowOwnerGUID: string;
  /** user_calendar_table.rowGUID or 'empty' */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: UserCalendarEventJSON;
  created_at?: string;
  updated_at?: string;
}

export interface UserCalendarJSON {
  calendarCode: 'my' | 'tasks' | 'birthdays' | 'projectTasks' | string;
  calendarTitle: string;
  calendarColor: string;
  isVisible: boolean;
}

export interface UserCalendarRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: UserCalendarJSON;
}

export interface UserCalendarInvitationRow {
  rowGUID: string;
  rowOwnerGUID: string;
  /** user_calendar_event_table.rowGUID */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: { email: string; status: 'sent' | 'failed'; sentAt: string; error?: string; resendId?: string };
}

/** One shown entry: a single entry, or one occurrence of a repeating one. Times are local. */
export interface UserCalendarOccurrence {
  /** `${rowGUID}:${YYYY-MM-DD of the start}` */
  key: string;
  row: UserCalendarEventRow;
  startMs: number;
  /** exclusive */
  endMs: number;
  allDay: boolean;
}

export const USER_CALENDAR_KIND_LABELS: Record<UserCalendarKind, string> = {
  event: 'Event',
  task: 'Task',
  birthday: 'Birthday',
  projectTask: 'Project task',
};

export const USER_CALENDAR_KIND_COLORS: Record<UserCalendarKind, string> = {
  event: '#7986CB',
  task: '#4285F4',
  birthday: '#33B679',
  projectTask: '#F4511E',
};

export const USER_CALENDAR_COLORS = ['#7986CB', '#4285F4', '#33B679', '#0B8043', '#F6BF26', '#F4511E', '#D50000', '#E67C73', '#8E24AA', '#616161'];

/** The calendars every user gets at the first visit. */
export const USER_CALENDAR_DEFAULTS: UserCalendarJSON[] = [
  { calendarCode: 'my', calendarTitle: 'My calendar', calendarColor: USER_CALENDAR_KIND_COLORS.event, isVisible: true },
  { calendarCode: 'tasks', calendarTitle: 'Tasks', calendarColor: USER_CALENDAR_KIND_COLORS.task, isVisible: true },
  { calendarCode: 'birthdays', calendarTitle: 'Birthdays', calendarColor: USER_CALENDAR_KIND_COLORS.birthday, isVisible: true },
  { calendarCode: 'projectTasks', calendarTitle: 'Project tasks', calendarColor: USER_CALENDAR_KIND_COLORS.projectTask, isVisible: true },
];

/** Which default calendar an entry of this kind belongs to. */
export const calendarCodeOfKind = (kind: UserCalendarKind) =>
  kind === 'task' ? 'tasks' : kind === 'birthday' ? 'birthdays' : kind === 'projectTask' ? 'projectTasks' : 'my';

export const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local day -> 'YYYY-MM-DD'. */
export const dayKey = (d: Date | number) => {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

/** 'YYYY-MM-DD' -> local midnight. */
export const dayFromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const startOfDay = (d: Date | number) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date | number, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

/** 'HH:MM' of a local time. */
export const timeText = (d: Date | number) => {
  const x = new Date(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

/** '9', '930', '9:30', '09.30' -> 'HH:MM' (null = not a time). */
export function parseTimeText(text: string): string | null {
  const t = text.trim().replace(/[.\s,-]/g, ':');
  let h: number;
  let m: number;
  if (/^\d{1,2}:\d{1,2}$/.test(t)) [h, m] = t.split(':').map(Number);
  else if (/^\d{3,4}$/.test(t)) {
    h = Number(t.slice(0, t.length - 2));
    m = Number(t.slice(-2));
  } else if (/^\d{1,2}$/.test(t)) {
    h = Number(t);
    m = 0;
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** Local day + 'HH:MM' -> Date. */
export const dateAtTime = (day: Date | number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const x = startOfDay(day);
  x.setHours(h || 0, m || 0, 0, 0);
  return x;
};

/** Local start / exclusive end of the entry itself (its first occurrence). */
export function eventRange(json: UserCalendarEventJSON): { startMs: number; endMs: number } {
  if (json.allDay) {
    const start = json.startDate ? dayFromKey(json.startDate) : startOfDay(new Date(json.startAt));
    const last = json.endDate ? dayFromKey(json.endDate) : start;
    return { startMs: start.getTime(), endMs: addDays(last < start ? start : last, 1).getTime() };
  }
  const startMs = new Date(json.startAt).getTime();
  const endMs = new Date(json.endAt).getTime();
  return { startMs, endMs: endMs > startMs ? endMs : startMs + 30 * 60 * 1000 };
}

/** Sets the dates of an entry from local values, keeping startAt / endAt / startDate / endDate in step. */
export function withEventDates(json: UserCalendarEventJSON, start: Date, endExclusive: Date, allDay: boolean): UserCalendarEventJSON {
  if (allDay) {
    const first = startOfDay(start);
    const last = startOfDay(new Date(Math.max(first.getTime(), endExclusive.getTime() - 1)));
    return {
      ...json,
      allDay: true,
      startDate: dayKey(first),
      endDate: dayKey(last),
      startAt: `${dayKey(first)}T00:00:00Z`,
      endAt: `${dayKey(addDays(last, 1))}T00:00:00Z`,
    };
  }
  const end = endExclusive.getTime() > start.getTime() ? endExclusive : new Date(start.getTime() + 60 * 60 * 1000);
  return { ...json, allDay: false, startAt: start.toISOString(), endAt: end.toISOString(), startDate: dayKey(start), endDate: dayKey(end) };
}

/** Reminders a new entry of this kind starts with (as in the reference screens). */
export function defaultNotifications(kind: UserCalendarKind, allDay: boolean): UserCalendarNotification[] {
  if (kind === 'birthday') return [{ amount: 1, unit: 'weeks', atTime: '09:00' }, { amount: 0, unit: 'days', atTime: '09:00' }];
  if (allDay) return [{ amount: 1, unit: 'days', atTime: '17:00' }];
  return [{ amount: 30, unit: 'minutes' }];
}

/** A new, not yet saved entry starting at `start` (local). */
export function newEventJSON(kind: UserCalendarKind, start: Date, allDay = kind === 'birthday'): UserCalendarEventJSON {
  const base: UserCalendarEventJSON = { kind, title: '', allDay, startAt: '', endAt: '', notifications: defaultNotifications(kind, allDay), guests: [], description: '', location: '' };
  const json = withEventDates(base, start, allDay ? addDays(startOfDay(start), 1) : new Date(start.getTime() + (kind === 'task' ? 30 : 60) * 60 * 1000), allDay);
  if (kind === 'birthday') json.recurrence = { freq: 'year', interval: 1, end: { type: 'never' } };
  if (kind === 'task') json.done = false;
  return json;
}

export const colorOfEvent = (json: UserCalendarEventJSON, calendarColor?: string | null) =>
  json.color || calendarColor || USER_CALENDAR_KIND_COLORS[json.kind] || USER_CALENDAR_KIND_COLORS.event;

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

/** "30 minutes before", "1 week before at 09:00", "On the day at 09:00". */
export function notificationLabel(n: UserCalendarNotification, allDay: boolean): string {
  const unit = n.amount === 1 ? n.unit.replace(/s$/, '') : n.unit;
  if (allDay) {
    const at = n.atTime || '09:00';
    return n.amount === 0 ? `On the day at ${at}` : `${n.amount} ${unit} before at ${at}`;
  }
  return n.amount === 0 ? 'At the start' : `${n.amount} ${unit} before`;
}

const UNIT_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: DAY_MS, weeks: 7 * DAY_MS };

/** When the reminder of an occurrence fires (local ms). */
export function notificationTimeMs(n: UserCalendarNotification, occStartMs: number, allDay: boolean): number {
  if (allDay) {
    const days = n.unit === 'weeks' ? n.amount * 7 : n.unit === 'days' ? n.amount : 0;
    return dateAtTime(addDays(occStartMs, -days), n.atTime || '09:00').getTime();
  }
  return occStartMs - n.amount * UNIT_MS[n.unit];
}
