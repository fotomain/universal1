// Supabase CRUD of the user calendar tables (user_calendar_table, user_calendar_event_table,
// user_calendar_invitation_table). Every row belongs to ownerGUID = userState.userGUID (RLS).

import type { SupabaseClient } from '@supabase/supabase-js';
import { check, newGUID } from '../../pm/crud/api/apiUtils';
import {
  eventRange,
  USER_CALENDAR_DEFAULTS,
  UserCalendarEventJSON,
  UserCalendarEventRow,
  UserCalendarInvitationRow,
  UserCalendarRow,
  userCalendarEventTable,
  userCalendarInvitationTable,
  userCalendarTable,
} from './userCalendarModel';

const normalizeEvent = (row: any): UserCalendarEventRow => ({ ...row, orderInList: Number(row.orderInList) || 0, rowJSON: row.rowJSON || {} });

/** orderInList of an entry = its start in ms (so SQL can order by time). */
export const orderOfEvent = (json: UserCalendarEventJSON) => eventRange(json).startMs;

export function createUserCalendarApi(sb: SupabaseClient) {
  // ---- calendars ------------------------------------------------------------------------------
  async function readCalendars(ownerGUID: string): Promise<UserCalendarRow[]> {
    const data = check(await sb.from(userCalendarTable).select('*').eq('rowOwnerGUID', ownerGUID).order('orderInList', { ascending: true }));
    return (data || []) as UserCalendarRow[];
  }

  /** Reads the user's calendars and adds the default ones that are missing (first visit). */
  async function ensureCalendars(ownerGUID: string): Promise<UserCalendarRow[]> {
    const existing = await readCalendars(ownerGUID);
    const codes = new Set(existing.map((c) => c.rowJSON?.calendarCode));
    const missing = USER_CALENDAR_DEFAULTS.filter((d) => !codes.has(d.calendarCode));
    if (!missing.length) return existing;
    const rows = missing.map((rowJSON) => ({
      rowGUID: newGUID(),
      rowOwnerGUID: ownerGUID,
      rowParentGUID: 'empty',
      orderInList: (USER_CALENDAR_DEFAULTS.indexOf(rowJSON) + 1) * 1024,
      rowJSON,
    }));
    // another device may have created them at the same moment: the unique index makes that a no-op
    const res = await sb.from(userCalendarTable).upsert(rows, { onConflict: 'rowGUID', ignoreDuplicates: true });
    if (res.error && !/duplicate|unique/i.test(res.error.message || '')) throw new Error(res.error.message);
    return readCalendars(ownerGUID);
  }

  async function updateCalendar(rowGUID: string, rowJSON: UserCalendarRow['rowJSON']): Promise<void> {
    check(await sb.from(userCalendarTable).update({ rowJSON }).eq('rowGUID', rowGUID));
  }

  // ---- events / tasks / birthdays ----------------------------------------------------------------
  async function readEvents(ownerGUID: string): Promise<UserCalendarEventRow[]> {
    const data = check(await sb.from(userCalendarEventTable).select('*').eq('rowOwnerGUID', ownerGUID).order('orderInList', { ascending: true }));
    return (data || []).map(normalizeEvent);
  }

  async function readEvent(rowGUID: string): Promise<UserCalendarEventRow | null> {
    const data = check(await sb.from(userCalendarEventTable).select('*').eq('rowGUID', rowGUID).maybeSingle());
    return data ? normalizeEvent(data) : null;
  }

  function buildEventRow(ownerGUID: string, rowJSON: UserCalendarEventJSON, calendarGUID?: string | null): UserCalendarEventRow {
    return { rowGUID: newGUID(), rowOwnerGUID: ownerGUID, rowParentGUID: calendarGUID || 'empty', orderInList: orderOfEvent(rowJSON), rowJSON };
  }

  async function createEvent(row: UserCalendarEventRow): Promise<UserCalendarEventRow> {
    const { created_at: _c, updated_at: _u, ...clean } = row;
    return normalizeEvent(check(await sb.from(userCalendarEventTable).insert(clean).select().single()));
  }

  async function updateEvent(rowGUID: string, rowJSON: UserCalendarEventJSON, calendarGUID?: string): Promise<UserCalendarEventRow> {
    const patch: any = { rowJSON, orderInList: orderOfEvent(rowJSON) };
    if (calendarGUID) patch.rowParentGUID = calendarGUID;
    return normalizeEvent(check(await sb.from(userCalendarEventTable).update(patch).eq('rowGUID', rowGUID).select().single()));
  }

  /** Deletes the entry and the invitations sent for it. */
  async function deleteEvent(rowGUID: string): Promise<void> {
    check(await sb.from(userCalendarInvitationTable).delete().eq('rowParentGUID', rowGUID));
    check(await sb.from(userCalendarEventTable).delete().eq('rowGUID', rowGUID));
  }

  // ---- invitations ------------------------------------------------------------------------------
  async function readInvitations(eventGUID: string): Promise<UserCalendarInvitationRow[]> {
    const data = check(await sb.from(userCalendarInvitationTable).select('*').eq('rowParentGUID', eventGUID).order('orderInList', { ascending: true }));
    return (data || []) as UserCalendarInvitationRow[];
  }

  async function createInvitations(ownerGUID: string, eventGUID: string, items: UserCalendarInvitationRow['rowJSON'][]): Promise<void> {
    if (!items.length) return;
    const now = Date.now();
    check(
      await sb.from(userCalendarInvitationTable).insert(
        items.map((rowJSON, i) => ({ rowGUID: newGUID(), rowOwnerGUID: ownerGUID, rowParentGUID: eventGUID, orderInList: now + i, rowJSON }))
      )
    );
  }

  return {
    readCalendars,
    ensureCalendars,
    updateCalendar,
    readEvents,
    readEvent,
    buildEventRow,
    createEvent,
    updateEvent,
    deleteEvent,
    readInvitations,
    createInvitations,
  };
}

export type UserCalendarApi = ReturnType<typeof createUserCalendarApi>;
