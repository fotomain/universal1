// Google Calendar synchronisation of the user calendar (two-way, the user's primary Google calendar).
//
//   pull  Google events (the last 3 months ... next 12 months) are created / updated / removed in
//         user_calendar_event_table (matched by rowJSON.googleEventId)
//   push  entries made in the app are created in Google; later edits are patched (a content hash,
//         rowJSON.googleHash, tells whether the app copy changed since the last sync - no clocks)
//   sql_for_delete an app entry that is linked to Google is removed there too (deleteGoogleEvent)
//
// Needs a Google access token with the scope GOOGLE_CALENDAR_SCOPE: useGoogleCalendarConnect.ts
// ("Connect Google Calendar" button). Project tasks are only pushed when asked (they can be many).

import type { UserCalendarApi } from './userCalendarApi';
import {
  addDays,
  DAY_MS,
  dayFromKey,
  dayKey,
  eventRange,
  newEventJSON,
  UserCalendarEventJSON,
  UserCalendarEventRow,
  UserCalendarNotification,
  withEventDates,
} from './userCalendarModel';
import { recurrenceToRRule, rruleToRecurrence } from './userCalendarRecurrence';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** rowJSON keys only this file writes. */
type Synced = UserCalendarEventJSON & { googleHash?: string | null };

const hash = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
};

async function google<T = any>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (res.status === 204) return undefined as T;
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `Google Calendar: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Reminder -> minutes before the start, as Google wants it (0 ... 4 weeks). */
function reminderMinutes(n: UserCalendarNotification, allDay: boolean): number {
  let minutes: number;
  if (allDay) {
    const [h, m] = (n.atTime || '09:00').split(':').map(Number);
    const days = n.unit === 'weeks' ? n.amount * 7 : n.unit === 'days' ? n.amount : 0;
    minutes = days * 1440 - ((h || 0) * 60 + (m || 0));
  } else minutes = n.amount * (n.unit === 'weeks' ? 10080 : n.unit === 'days' ? 1440 : n.unit === 'hours' ? 60 : 1);
  return Math.max(0, Math.min(40320, Math.round(minutes)));
}

/** App entry -> Google event resource. */
export function toGoogleEvent(json: UserCalendarEventJSON): Record<string, any> {
  const { startMs, endMs } = eventRange(json);
  const body: Record<string, any> = {
    summary: json.title || '(No title)',
    description: json.description || '',
    location: json.location || '',
    start: json.allDay ? { date: dayKey(startMs) } : { dateTime: new Date(startMs).toISOString(), timeZone: timeZone() },
    end: json.allDay ? { date: dayKey(endMs) } : { dateTime: new Date(endMs).toISOString(), timeZone: timeZone() },
    recurrence: json.recurrence ? [recurrenceToRRule(json.recurrence, new Date(startMs))] : [],
    reminders: { useDefault: false, overrides: (json.notifications || []).slice(0, 5).map((n) => ({ method: 'popup', minutes: reminderMinutes(n, json.allDay) })) },
  };
  const guests = (json.guests || []).filter((g) => g.email);
  if (guests.length) body.attendees = guests.map((g) => ({ email: g.email }));
  return body;
}

/** Google event -> app entry (kept: what Google does not know - kind, color, intent, done ...). */
export function fromGoogleEvent(g: any, previous?: UserCalendarEventJSON): UserCalendarEventJSON {
  const allDay = !!g.start?.date;
  const kind = previous?.kind || (g.eventType === 'birthday' ? 'birthday' : 'event');
  const start = allDay ? dayFromKey(g.start.date) : new Date(g.start?.dateTime || Date.now());
  const end = allDay ? dayFromKey(g.end?.date || g.start.date) : new Date(g.end?.dateTime || start.getTime() + 3600000);
  let json = withEventDates(previous || newEventJSON(kind, start, allDay), start, allDay && end <= start ? addDays(start, 1) : end, allDay);
  const rule = (g.recurrence || []).find((r: string) => /^RRULE:/i.test(r));
  const notifications: UserCalendarNotification[] | undefined = g.reminders?.overrides?.map((o: any): UserCalendarNotification => {
    const m = Number(o.minutes) || 0;
    if (allDay) {
      // minutes before midnight -> "N days before at HH:MM"
      const days = Math.ceil(m / 1440);
      const at = days * 1440 - m;
      return { amount: days, unit: 'days', atTime: `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}` };
    }
    if (m && m % 10080 === 0) return { amount: m / 10080, unit: 'weeks' };
    if (m && m % 1440 === 0) return { amount: m / 1440, unit: 'days' };
    if (m && m % 60 === 0) return { amount: m / 60, unit: 'hours' };
    return { amount: m, unit: 'minutes' };
  });
  json = {
    ...json,
    title: g.summary || '',
    description: g.description || '',
    location: g.location || '',
    recurrence: rule ? rruleToRecurrence(rule) : null,
    notifications: notifications || (g.reminders?.useDefault ? previous?.notifications || [{ amount: 30, unit: 'minutes' }] : []),
    guests: (g.attendees || []).filter((a: any) => a.email && !a.self).map((a: any) => {
      const old = previous?.guests?.find((p) => p.email.toLowerCase() === String(a.email).toLowerCase());
      return { email: a.email, name: a.displayName || old?.name, status: old?.status || 'new', sentAt: old?.sentAt };
    }),
    googleEventId: g.id,
    googleCalendarId: 'primary',
    googleUpdated: g.updated || null,
  };
  (json as Synced).googleHash = hash(JSON.stringify(toGoogleEvent(json)));
  return json;
}

export async function deleteGoogleEvent(token: string, googleEventId: string): Promise<void> {
  try {
    await google(token, `${API}/${encodeURIComponent(googleEventId)}?sendUpdates=none`, { method: 'DELETE' });
  } catch (e: any) {
    if (e?.status !== 404 && e?.status !== 410) throw e; // already gone = fine
  }
}

export interface GoogleSyncResult {
  pulledNew: number;
  pulledUpdated: number;
  pulledDeleted: number;
  pushedNew: number;
  pushedUpdated: number;
  errors: string[];
}

export async function syncUserCalendarWithGoogle(params: {
  api: UserCalendarApi;
  ownerGUID: string;
  token: string;
  rows: UserCalendarEventRow[];
  /** also create the project task copies in Google (default false) */
  includeProjectTasks?: boolean;
}): Promise<GoogleSyncResult> {
  const { api, ownerGUID, token, includeProjectTasks = false } = params;
  const result: GoogleSyncResult = { pulledNew: 0, pulledUpdated: 0, pulledDeleted: 0, pushedNew: 0, pushedUpdated: 0, errors: [] };
  const rows = [...params.rows];
  const byGoogleId = new Map<string, UserCalendarEventRow>();
  rows.forEach((r) => r.rowJSON.googleEventId && byGoogleId.set(r.rowJSON.googleEventId, r));
  const note = (what: string, e: any) => result.errors.length < 10 && result.errors.push(`${what}: ${e?.message || e}`);

  // ---- pull ----
  const timeMin = new Date(Date.now() - 92 * DAY_MS).toISOString();
  const timeMax = new Date(Date.now() + 366 * DAY_MS).toISOString();
  let pageToken = '';
  const touched = new Set<string>();
  for (let page = 0; page < 8; page++) {
    const qs = `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=false&showDeleted=true&maxResults=250${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const data = await google<any>(token, `${API}?${qs}`);
    for (const g of data.items || []) {
      if (!g.id || g.recurringEventId) continue; // changed single occurrences of a series are not mirrored
      const local = byGoogleId.get(g.id);
      try {
        if (g.status === 'cancelled') {
          if (local) {
            await api.deleteEvent(local.rowGUID);
            byGoogleId.delete(g.id);
            touched.add(local.rowGUID);
            result.pulledDeleted++;
          }
        } else if (!g.start) {
          continue;
        } else if (!local) {
          const row = await api.createEvent(api.buildEventRow(ownerGUID, fromGoogleEvent(g)));
          byGoogleId.set(g.id, row);
          touched.add(row.rowGUID);
          result.pulledNew++;
        } else if ((g.updated || '') !== (local.rowJSON.googleUpdated || '')) {
          const next = await api.updateEvent(local.rowGUID, fromGoogleEvent(g, local.rowJSON));
          touched.add(next.rowGUID);
          result.pulledUpdated++;
        }
      } catch (e) {
        note(g.summary || g.id, e);
      }
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  // ---- push ----
  for (const row of rows) {
    if (touched.has(row.rowGUID)) continue; // Google's version just won
    const json = row.rowJSON as Synced;
    if (json.kind === 'projectTask' && !includeProjectTasks && !json.googleEventId) continue;
    const body = toGoogleEvent(json);
    const bodyHash = hash(JSON.stringify(body));
    try {
      if (!json.googleEventId) {
        const g = await google<any>(token, `${API}?sendUpdates=none`, { method: 'POST', body: JSON.stringify(body) });
        await api.updateEvent(row.rowGUID, { ...json, googleEventId: g.id, googleCalendarId: 'primary', googleUpdated: g.updated || null, googleHash: bodyHash } as Synced);
        result.pushedNew++;
      } else if (json.googleHash !== bodyHash) {
        const g = await google<any>(token, `${API}/${encodeURIComponent(json.googleEventId)}?sendUpdates=none`, { method: 'PATCH', body: JSON.stringify(body) });
        await api.updateEvent(row.rowGUID, { ...json, googleUpdated: g.updated || null, googleHash: bodyHash } as Synced);
        result.pushedUpdated++;
      }
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 410) {
        // deleted in Google outside the pulled period: unlink, the next sync creates it again
        await api.updateEvent(row.rowGUID, { ...json, googleEventId: null, googleUpdated: null, googleHash: null } as Synced).catch(() => {});
      } else note(json.title || row.rowGUID, e);
    }
  }
  return result;
}

export const googleSyncResultText = (r: GoogleSyncResult) => {
  const parts = [
    r.pulledNew + r.pulledUpdated + r.pulledDeleted ? `from Google: ${r.pulledNew} new, ${r.pulledUpdated} updated, ${r.pulledDeleted} deleted` : '',
    r.pushedNew + r.pushedUpdated ? `to Google: ${r.pushedNew} new, ${r.pushedUpdated} updated` : '',
  ].filter(Boolean);
  const text = parts.length ? `Google Calendar synchronised (${parts.join('; ')})` : 'Google Calendar is up to date';
  return r.errors.length ? `${text}. ${r.errors.length} problem(s): ${r.errors[0]}` : text;
};
