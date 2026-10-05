// E-mail invitations to calendar events, calendar tasks and birthdays through Resend
// (same approach as expo-w1 mi/ui/demo/checkotp/utils/api.ts: EXPO_PUBLIC_RESEND_API_KEY in .env).
// Every invitation carries an .ics file, so the guest adds the entry to any calendar with one tap.
//
// .env:  EXPO_PUBLIC_RESEND_API_KEY=re_...            (required)
//        EXPO_PUBLIC_RESEND_FROM=Calendar <you@your-domain>   (optional; default = Resend's test sender,
//                                                              which only delivers to your own address)
// Web: Resend does not allow calls from a browser page (CORS). Set EXPO_PUBLIC_RESEND_PROXY_URL to a
// server endpoint that forwards the same JSON to https://api.resend.com/emails when the web app must send.

import {
  addDays,
  dayFromKey,
  eventRange,
  isValidEmail,
  USER_CALENDAR_KIND_LABELS,
  UserCalendarEventRow,
} from './userCalendarModel';
import { MONTH_NAMES, recurrenceLabel, recurrenceToRRule, WEEKDAY_NAMES } from './userCalendarRecurrence';

const RESEND_URL = (process.env.EXPO_PUBLIC_RESEND_PROXY_URL || 'https://api.resend.com/emails').trim();
const RESEND_FROM = (process.env.EXPO_PUBLIC_RESEND_FROM || 'Calendar <onboarding@resend.dev>').trim();

export const isInvitationEmailConfigured = () => !!(process.env.EXPO_PUBLIC_RESEND_API_KEY || process.env.EXPO_PUBLIC_RESEND_PROXY_URL);

const pad = (n: number) => String(n).padStart(2, '0');
const icsDay = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsUTC = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Wednesday, 7 October 2026 · 10:00 – 11:00" / "Wednesday, 7 October 2026" (all day). */
export function eventWhenText(row: UserCalendarEventRow, startMs?: number, endMs?: number): string {
  const range = eventRange(row.rowJSON);
  const s = new Date(startMs ?? range.startMs);
  const e = new Date(endMs ?? range.endMs);
  const day = (d: Date) => `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (row.rowJSON.allDay) {
    const last = addDays(e, -1);
    return last.getTime() > s.getTime() ? `${day(s)} – ${day(last)}` : day(s);
  }
  if (row.rowJSON.kind === 'task') return `${day(s)} · ${time(s)}`;
  return s.toDateString() === e.toDateString() ? `${day(s)} · ${time(s)} – ${time(e)}` : `${day(s)} ${time(s)} – ${day(e)} ${time(e)}`;
}

/** iCalendar file of the entry (METHOD:REQUEST, so mail apps show "Add to calendar"). */
export function buildEventICS(row: UserCalendarEventRow, organizerEmail: string, guests: string[]): string {
  const j = row.rowJSON;
  const { startMs, endMs } = eventRange(j);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UNIVERSAL1//User Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${row.rowGUID}@universal1`,
    `DTSTAMP:${icsUTC(new Date())}`,
    j.allDay ? `DTSTART;VALUE=DATE:${icsDay(new Date(startMs))}` : `DTSTART:${icsUTC(new Date(startMs))}`,
    j.allDay ? `DTEND;VALUE=DATE:${icsDay(new Date(endMs))}` : `DTEND:${icsUTC(new Date(endMs))}`,
    `SUMMARY:${icsText(j.title || USER_CALENDAR_KIND_LABELS[j.kind])}`,
  ];
  if (j.description) lines.push(`DESCRIPTION:${icsText(j.description)}`);
  if (j.location) lines.push(`LOCATION:${icsText(j.location)}`);
  if (j.recurrence) lines.push(recurrenceToRRule(j.recurrence, new Date(startMs)));
  (j.exDates || []).forEach((d) => lines.push(`EXDATE;VALUE=DATE:${icsDay(dayFromKey(d))}`));
  if (organizerEmail) lines.push(`ORGANIZER:mailto:${organizerEmail}`);
  guests.forEach((g) => lines.push(`ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${g}`));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  if (typeof btoa === 'function') return btoa(bin);
  return (globalThis as any).Buffer.from(bin, 'binary').toString('base64');
};

export interface InvitationResult {
  email: string;
  ok: boolean;
  error?: string;
  resendId?: string;
}

/**
 * Sends one invitation e-mail per guest (so guests do not see each other's address in "To").
 * Never throws: every guest gets its own result.
 */
export async function sendEventInvitations(
  row: UserCalendarEventRow,
  guestEmails: string[],
  organizer: { email: string; name?: string }
): Promise<InvitationResult[]> {
  const emails = [...new Set(guestEmails.map((e) => e.trim().toLowerCase()).filter(isValidEmail))];
  if (!emails.length) return [];
  const apiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY || '';
  if (!isInvitationEmailConfigured()) {
    return emails.map((email) => ({ email, ok: false, error: 'EXPO_PUBLIC_RESEND_API_KEY is not set in .env' }));
  }
  const j = row.rowJSON;
  const kind = USER_CALENDAR_KIND_LABELS[j.kind].toLowerCase();
  const who = organizer.name || organizer.email || 'Someone';
  const title = j.title || USER_CALENDAR_KIND_LABELS[j.kind];
  const repeat = j.recurrence ? recurrenceLabel(j.recurrence, new Date(eventRange(j).startMs)) : '';
  const body = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 520px;">
      <p style="color:#666; margin:0 0 6px;">${html(who)} invited you to ${j.kind === 'event' ? 'an' : 'a'} ${kind}</p>
      <h2 style="margin:0 0 12px;">${html(title)}</h2>
      <p style="font-size:16px; margin:0 0 4px;">${html(eventWhenText(row))}</p>
      ${repeat ? `<p style="color:#666; margin:0 0 4px;">${html(repeat)}</p>` : ''}
      ${j.location ? `<p style="margin:8px 0 0;"><b>Where:</b> ${html(j.location)}</p>` : ''}
      ${j.description ? `<p style="margin:8px 0 0; white-space:pre-wrap;">${html(j.description)}</p>` : ''}
      <p style="color:#666; font-size:12px; margin-top:18px;">Open the attached invite.ics to add it to your calendar.</p>
    </div>`;
  const ics = toBase64(buildEventICS(row, organizer.email, emails));
  return Promise.all(
    emails.map(async (email): Promise<InvitationResult> => {
      try {
        const res = await fetch(RESEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [email],
            ...(organizer.email ? { reply_to: organizer.email } : {}),
            subject: `Invitation: ${title} · ${eventWhenText(row)}`,
            html: body,
            attachments: [{ filename: 'invite.ics', content: ics, content_type: 'text/calendar; method=REQUEST' }],
          }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) return { email, ok: false, error: data?.message || data?.error || `HTTP ${res.status}` };
        return { email, ok: true, resendId: data?.id };
      } catch (e: any) {
        return { email, ok: false, error: e?.message || String(e) };
      }
    })
  );
}
