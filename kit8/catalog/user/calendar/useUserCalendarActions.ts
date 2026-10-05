// Commands of the user calendar shared by the screen, the editor, the quick view and reminders:
// save (+ e-mail invitations), delete (one occurrence / all), duplicate, done on / off, Google sync.

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { showSnackbar } from '../../../redux/uxuiSlice';
import {
  calendarCodeOfKind,
  dayKey,
  deleteGoogleEvent,
  getGoogleCalendarToken,
  googleSyncResultText,
  isInvitationEmailConfigured,
  sendEventInvitations,
  syncUserCalendarWithGoogle,
  UserCalendarEventJSON,
  UserCalendarEventRow,
  userCalendarKeys,
  UserCalendarRow,
  useUserCalendarApi,
  useUserCalendarEventMutations,
  useUserCalendarOwnerGUID,
} from '../../../register/user_calendar';

let syncing: Promise<void> | null = null;

export function useUserCalendarActions() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const api = useUserCalendarApi();
  const ownerGUID = useUserCalendarOwnerGUID();
  const { createEvent, updateEvent, deleteEvent, buildEventRow } = useUserCalendarEventMutations(ownerGUID);
  const email = useSelector((s: any) => String(s.activeUserState?.activeUserEmail || ''));
  const name = useSelector((s: any) => `${s.activeUserState?.activeUserFirstName || ''} ${s.activeUserState?.activeUserLastName || ''}`.trim());
  const say = useCallback((message: string) => dispatch(showSnackbar(message)), [dispatch]);

  /** Two-way Google sync (only when connected). `quiet` = no "up to date" message. */
  const syncGoogle = useCallback(
    (quiet = false): Promise<void> => {
      const token = getGoogleCalendarToken();
      if (!token || !ownerGUID) {
        if (!quiet) say('Connect Google Calendar first.');
        return Promise.resolve();
      }
      if (syncing) return syncing;
      syncing = (async () => {
        try {
          const rows = await api.readEvents(ownerGUID);
          const result = await syncUserCalendarWithGoogle({ api, ownerGUID, token, rows });
          await qc.invalidateQueries({ queryKey: userCalendarKeys.events(ownerGUID) });
          if (!quiet || result.errors.length) say(googleSyncResultText(result));
        } catch (e: any) {
          say(`Google Calendar sync failed: ${e?.message || e}`);
        } finally {
          syncing = null;
        }
      })();
      return syncing;
    },
    [api, ownerGUID, qc, say]
  );

  /** Sends the invitations of the guests that did not get one yet; returns the entry with the new guest states. */
  const invite = useCallback(
    async (row: UserCalendarEventRow, all = false): Promise<UserCalendarEventRow> => {
      const guests = row.rowJSON.guests || [];
      const targets = guests.filter((g) => all || g.status !== 'sent').map((g) => g.email);
      if (!targets.length) return row;
      if (!isInvitationEmailConfigured()) {
        say('Invitations are not sent: add EXPO_PUBLIC_RESEND_API_KEY to .env.');
        return row;
      }
      const results = await sendEventInvitations(row, targets, { email, name });
      const now = new Date().toISOString();
      const byEmail = new Map(results.map((r) => [r.email, r]));
      const rowJSON: UserCalendarEventJSON = {
        ...row.rowJSON,
        guests: guests.map((g) => {
          const r = byEmail.get(g.email.trim().toLowerCase());
          return r ? { ...g, status: r.ok ? 'sent' : 'failed', sentAt: r.ok ? now : g.sentAt } : g;
        }),
      };
      const saved = await updateEvent.mutateAsync({ rowGUID: row.rowGUID, rowJSON });
      await api
        .createInvitations(ownerGUID, row.rowGUID, results.map((r) => ({ email: r.email, status: r.ok ? 'sent' : 'failed', sentAt: now, error: r.error, resendId: r.resendId })))
        .catch(() => {});
      const sent = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      say(failed.length ? `Invitations: ${sent} sent, ${failed.length} failed (${failed[0].error})` : `${sent} invitation${sent === 1 ? '' : 's'} sent`);
      return saved;
    },
    [api, email, name, ownerGUID, say, updateEvent]
  );

  /** Creates or updates an entry. Returns the saved row (null = it could not be saved). */
  const save = useCallback(
    async (rowJSON: UserCalendarEventJSON, existing: UserCalendarEventRow | undefined, options: { sendInvitations?: boolean } = {}): Promise<UserCalendarEventRow | null> => {
      if (!ownerGUID) {
        say('Sign in to use the calendar.');
        return null;
      }
      try {
        const calendars = qc.getQueryData<UserCalendarRow[]>(userCalendarKeys.calendars(ownerGUID)) || [];
        const calendarGUID = calendars.find((c) => c.rowJSON.calendarCode === calendarCodeOfKind(rowJSON.kind))?.rowGUID;
        let saved = existing
          ? await updateEvent.mutateAsync({ rowGUID: existing.rowGUID, rowJSON, calendarGUID })
          : await createEvent.mutateAsync(buildEventRow(ownerGUID, rowJSON, calendarGUID));
        if (options.sendInvitations) saved = await invite(saved);
        void syncGoogle(true);
        return saved;
      } catch (e: any) {
        say(`The calendar entry was not saved: ${e?.message || e}`);
        return null;
      }
    },
    [buildEventRow, createEvent, invite, ownerGUID, qc, say, syncGoogle, updateEvent]
  );

  /** Deletes the whole entry, or only the occurrence that starts at `occurrenceStartMs` of a repeating one. */
  const remove = useCallback(
    async (row: UserCalendarEventRow, occurrenceStartMs?: number) => {
      try {
        if (occurrenceStartMs !== undefined && row.rowJSON.recurrence) {
          const exDates = [...new Set([...(row.rowJSON.exDates || []), dayKey(occurrenceStartMs)])];
          await updateEvent.mutateAsync({ rowGUID: row.rowGUID, rowJSON: { ...row.rowJSON, exDates } });
          void syncGoogle(true);
          return;
        }
        await deleteEvent.mutateAsync(row.rowGUID);
        const token = getGoogleCalendarToken();
        if (token && row.rowJSON.googleEventId) await deleteGoogleEvent(token, row.rowJSON.googleEventId).catch((e) => say(`Not deleted in Google Calendar: ${e?.message || e}`));
      } catch (e: any) {
        say(`The calendar entry was not deleted: ${e?.message || e}`);
      }
    },
    [deleteEvent, say, syncGoogle, updateEvent]
  );

  const duplicate = useCallback(
    (row: UserCalendarEventRow) => {
      const { googleEventId: _g, googleUpdated: _u, googleCalendarId: _c, ...rest } = row.rowJSON as any;
      delete rest.googleHash;
      if (rest.kind === 'projectTask') {
        // a copy of a project task is a plain calendar task (the original stays linked to the project)
        rest.kind = 'task';
        delete rest.projectTaskGUID;
        delete rest.projectGUID;
        delete rest.projectTitle;
      }
      return save({ ...rest, title: `${row.rowJSON.title || 'Untitled'} (copy)`, guests: (row.rowJSON.guests || []).map((g) => ({ email: g.email, name: g.name, status: 'new' as const })) }, undefined);
    },
    [save]
  );

  const setDone = useCallback((row: UserCalendarEventRow, done: boolean) => save({ ...row.rowJSON, done }, row), [save]);

  return { ownerGUID, save, remove, duplicate, setDone, invite, syncGoogle };
}
