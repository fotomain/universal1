// React Query hooks of the user calendar + realtime auto refresh.
// The cache key is the owner, so every screen (calendar, reminders, app bar) shares one read.

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import { usePMOwnerGUID } from '../../pm/crud/queries';
import { createUserCalendarApi, UserCalendarApi } from './userCalendarApi';
import { UserCalendarEventJSON, UserCalendarEventRow, userCalendarEventTable, UserCalendarRow, userCalendarTable } from './userCalendarModel';

export const userCalendarKeys = {
  all: ['userCalendar'] as const,
  calendars: (ownerGUID: string | null | undefined) => ['userCalendar', 'calendars', ownerGUID] as const,
  events: (ownerGUID: string | null | undefined) => ['userCalendar', 'events', ownerGUID] as const,
  invitations: (eventGUID: string | null | undefined) => ['userCalendar', 'invitations', eventGUID] as const,
};

/** rowOwnerGUID of the calendar rows = userState.userGUID ('' = not signed in). */
export const useUserCalendarOwnerGUID = usePMOwnerGUID;

export function useUserCalendarApi(): UserCalendarApi {
  const { supabase } = useSupabase();
  return useMemo(() => createUserCalendarApi(supabase), [supabase]);
}

export function useUserCalendarsQuery(ownerGUID: string | null | undefined) {
  const api = useUserCalendarApi();
  return useQuery<UserCalendarRow[]>({
    queryKey: userCalendarKeys.calendars(ownerGUID),
    queryFn: () => api.ensureCalendars(ownerGUID as string),
    enabled: !!ownerGUID,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserCalendarEventsQuery(ownerGUID: string | null | undefined) {
  const api = useUserCalendarApi();
  return useQuery<UserCalendarEventRow[]>({
    queryKey: userCalendarKeys.events(ownerGUID),
    queryFn: () => api.readEvents(ownerGUID as string),
    enabled: !!ownerGUID,
    staleTime: 60 * 1000,
  });
}

/** Create / update / delete with an optimistic cache update (rolled back on error). */
export function useUserCalendarEventMutations(ownerGUID: string | null | undefined) {
  const api = useUserCalendarApi();
  const qc = useQueryClient();
  const key = userCalendarKeys.events(ownerGUID);
  const optimistic = async (change: (rows: UserCalendarEventRow[]) => UserCalendarEventRow[]) => {
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<UserCalendarEventRow[]>(key);
    qc.setQueryData<UserCalendarEventRow[]>(key, change(previous || []));
    return { previous };
  };
  const rollback = (_e: unknown, _v: unknown, ctx: { previous?: UserCalendarEventRow[] } | undefined) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous);
  };
  const settle = () => qc.invalidateQueries({ queryKey: key });

  const createEvent = useMutation({
    mutationFn: (row: UserCalendarEventRow) => api.createEvent(row),
    onMutate: (row) => optimistic((rows) => [...rows, row]),
    onError: rollback,
    onSettled: settle,
  });
  const updateEvent = useMutation({
    mutationFn: (v: { rowGUID: string; rowJSON: UserCalendarEventJSON; calendarGUID?: string }) => api.updateEvent(v.rowGUID, v.rowJSON, v.calendarGUID),
    onMutate: (v) => optimistic((rows) => rows.map((r) => (r.rowGUID === v.rowGUID ? { ...r, rowJSON: v.rowJSON, rowParentGUID: v.calendarGUID || r.rowParentGUID } : r))),
    onError: rollback,
    onSettled: settle,
  });
  const deleteEvent = useMutation({
    mutationFn: (rowGUID: string) => api.deleteEvent(rowGUID),
    onMutate: (rowGUID) => optimistic((rows) => rows.filter((r) => r.rowGUID !== rowGUID)),
    onError: rollback,
    onSettled: settle,
  });
  return { createEvent, updateEvent, deleteEvent, buildEventRow: api.buildEventRow };
}

/**
 * Realtime: any change of the user's calendar rows (other devices, Google sync, the project
 * task trigger) refreshes the cache. Mount once (UserCalendarNotifier does, in the root layout).
 */
export function useUserCalendarRealtime(ownerGUID: string | null | undefined) {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  useEffect(() => {
    if (!ownerGUID) return;
    let timer: any = null;
    const refresh = (key: readonly unknown[]) => {
      // a schedule write-back changes many project tasks at once: one refresh for the burst
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: key }), 400);
    };
    const channel = supabase
      .channel(`user-calendar-${ownerGUID}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: userCalendarEventTable, filter: `rowOwnerGUID=eq.${ownerGUID}` }, () => refresh(userCalendarKeys.events(ownerGUID)))
      .on('postgres_changes', { event: '*', schema: 'public', table: userCalendarTable, filter: `rowOwnerGUID=eq.${ownerGUID}` }, () => qc.invalidateQueries({ queryKey: userCalendarKeys.calendars(ownerGUID) }))
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, qc, ownerGUID]);
}
