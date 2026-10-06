// User calendar screen (route /user/calendar): events, calendar tasks, birthdays and - automatically -
// every task of the user's projects (rows of user_calendar_event_table, rowOwnerGUID = userState.userGUID).
//
//   tool bar   Today · previous / next · period title · Day / Week / Month / Agenda · Google sync · "+"
//   calendars  chips to show / hide My calendar · Tasks · Birthdays · Project tasks (saved per user)
//   views      UserCalendarViews.tsx; a tap on an entry opens the quick view, a tap on a free
//              slot / day starts a new entry there
//   deep link  /user/calendar?new=event|task|birthday   /user/calendar?eventGUID=<uuid>   ?date=YYYY-MM-DD
// The windows (quick view, editor) and the reminders live in UserCalendarNotifier (root layout).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { ModalWindowListToSelect } from '../../../ui/components/common';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { showSnackbar } from '../../../redux/uxuiSlice';
import {
  addDays,
  calendarCodeOfKind,
  colorOfEvent,
  dateAtTime,
  dayFromKey,
  expandEvents,
  isGoogleCalendarConfigured,
  MONTH_NAMES,
  MONTH_SHORT,
  newEventJSON,
  startOfDay,
  UserCalendarEventRow,
  UserCalendarKind,
  UserCalendarOccurrence,
  useGoogleCalendarConnect,
  useUserCalendarApi,
  useUserCalendarEventsQuery,
  useUserCalendarsQuery,
} from '../../../register/user_calendar';
import { CalButton, CalChip, CalIconButton, useIsWide } from './calendarUi';
import { startOfWeek, UserCalendarAgendaView, UserCalendarMonthView, UserCalendarTimeGridView } from './UserCalendarViews';
import { useUserCalendarActions } from './useUserCalendarActions';
import { useUserCalendarUiStore } from './userCalendarUiStore';

type Mode = 'day' | 'week' | 'month' | 'agenda';
const MODES: { id: Mode; title: string; icon: string }[] = [
  { id: 'day', title: 'Day', icon: 'calendar_view_day' },
  { id: 'week', title: 'Week', icon: 'calendar_view_week' },
  { id: 'month', title: 'Month', icon: 'calendar_view_month' },
  { id: 'agenda', title: 'Agenda', icon: 'view_agenda' },
];
const MODE_KEY = 'userCalendar.viewMode';
const AGENDA_DAYS = 90;

/** Google button of the tool bar; rendered only when .env has the Google client id of the platform. */
function GoogleSyncButton({ onSync }: { onSync: () => void }) {
  const { themeColors: c } = useDesignSystem();
  const google = useGoogleCalendarConnect();
  const wasConnected = useRef(google.connected);
  useEffect(() => {
    // first sync right after the user connected
    if (google.connected && !wasConnected.current) onSync();
    wasConnected.current = google.connected;
  }, [google.connected, onSync]);
  return (
    <CalIconButton
      testID="user-calendar-google"
      icon={google.connected ? 'sync' : 'add_link'}
      label={google.connected ? 'Synchronise with Google Calendar' : 'Connect Google Calendar'}
      tint={google.connected ? c.primary : undefined}
      disabled={!google.ready}
      color={c}
      onPress={() => (google.connected ? onSync() : void google.connect())}
    />
  );
}

export default function UserCalendarScreen() {
  const { themeColors: c } = useDesignSystem();
  const wide = useIsWide();
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ new?: string; eventGUID?: string; date?: string }>();
  const actions = useUserCalendarActions();
  const api = useUserCalendarApi();
  const ownerGUID = actions.ownerGUID;
  const calendarsQuery = useUserCalendarsQuery(ownerGUID || null);
  const eventsQuery = useUserCalendarEventsQuery(ownerGUID || null);
  const openEditor = useUserCalendarUiStore((s) => s.openEditor);
  const openView = useUserCalendarUiStore((s) => s.openView);

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [mode, setModeState] = useState<Mode>(wide ? 'week' : 'month');
  const [modeMenu, setModeMenu] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((m) => m && MODES.some((x) => x.id === m) && setModeState(m as Mode)).catch(() => {});
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  };

  // ---- calendars: colors + show / hide ----
  const calendars = calendarsQuery.data || [];
  const calendarOf = useCallback(
    (row: UserCalendarEventRow) => calendars.find((k) => k.rowGUID === row.rowParentGUID) || calendars.find((k) => k.rowJSON.calendarCode === calendarCodeOfKind(row.rowJSON.kind)),
    [calendars]
  );
  const colorOf = useCallback((row: UserCalendarEventRow) => colorOfEvent(row.rowJSON, calendarOf(row)?.rowJSON.calendarColor), [calendarOf]);
  const toggleCalendar = async (rowGUID: string) => {
    const cal = calendars.find((k) => k.rowGUID === rowGUID);
    if (!cal) return;
    try {
      await api.updateCalendar(rowGUID, { ...cal.rowJSON, isVisible: cal.rowJSON.isVisible === false });
      await calendarsQuery.refetch();
    } catch (e: any) {
      dispatch(showSnackbar(e?.message || String(e)));
    }
  };

  // ---- the shown period ----
  const period = useMemo(() => {
    if (mode === 'day') return { from: anchor, to: addDays(anchor, 1), days: [anchor] };
    if (mode === 'week') {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 7), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
    }
    if (mode === 'month') {
      const from = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      return { from, to: addDays(from, 42), days: [] };
    }
    return { from: anchor, to: addDays(anchor, AGENDA_DAYS), days: [] };
  }, [anchor, mode]);

  const occurrences = useMemo(() => {
    const rows = (eventsQuery.data || []).filter((r) => calendarOf(r)?.rowJSON.isVisible !== false);
    return expandEvents(rows, period.from.getTime(), period.to.getTime());
  }, [eventsQuery.data, calendarOf, period]);

  const title = useMemo(() => {
    if (mode === 'day') return `${anchor.getDate()} ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (mode === 'week') {
      const last = addDays(period.from, 6);
      return period.from.getMonth() === last.getMonth()
        ? `${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`
        : `${MONTH_SHORT[period.from.getMonth()]} – ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`;
    }
    return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }, [anchor, mode, period]);

  const step = (dir: number) => {
    if (mode === 'day') setAnchor(addDays(anchor, dir));
    else if (mode === 'week') setAnchor(addDays(anchor, dir * 7));
    else if (mode === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, dir * 30));
  };

  // ---- commands ----
  const newEntry = useCallback(
    (kind: UserCalendarKind, start?: Date, allDay?: boolean) => {
      // default start: the next full hour of the shown day
      const now = new Date();
      const base = start || dateAtTime(mode === 'month' || mode === 'agenda' ? (anchor.getMonth() === now.getMonth() ? now : anchor) : anchor, `${String(Math.min(23, now.getHours() + 1)).padStart(2, '0')}:00`);
      openEditor({ draft: newEventJSON(kind, base, kind === 'birthday' ? true : !!allDay) });
    },
    [anchor, mode, openEditor]
  );
  const onNewAt = useCallback((start: Date, allDay: boolean) => newEntry('event', allDay ? dateAtTime(start, '09:00') : start, false), [newEntry]);
  const onShowDay = useCallback((day: Date) => {
    setAnchor(startOfDay(day));
    setModeState('day');
  }, []);
  const onOpen = useCallback((occurrence: UserCalendarOccurrence) => openView({ occurrence }), [openView]);
  const onToggleDone = useCallback((row: UserCalendarEventRow) => void actions.setDone(row, !row.rowJSON.done), [actions]);
  const syncGoogle = useCallback(() => void actions.syncGoogle(false), [actions]);

  // ---- deep links: ?new=task  ?eventGUID=...  ?date=YYYY-MM-DD ----
  const handled = useRef('');
  useEffect(() => {
    const sign = `${params.new || ''}|${params.eventGUID || ''}|${params.date || ''}`;
    if (sign === '||' || sign === handled.current) return;
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) setAnchor(dayFromKey(params.date));
    if (params.new === 'event' || params.new === 'task' || params.new === 'birthday') {
      handled.current = sign;
      newEntry(params.new);
      router.setParams({ new: undefined } as any);
      return;
    }
    if (params.eventGUID) {
      if (!eventsQuery.data) return; // wait for the rows
      handled.current = sign;
      const row = eventsQuery.data.find((r) => r.rowGUID === params.eventGUID);
      if (row) {
        const occurrence = expandEvents([row], 0, Number.MAX_SAFE_INTEGER / 2).find((o) => o.endMs >= Date.now()) || expandEvents([row], 0, Date.now() + 1)[0];
        if (occurrence) {
          setAnchor(startOfDay(occurrence.startMs));
          openView({ occurrence });
        }
      }
      return;
    }
    handled.current = sign;
  }, [params.new, params.eventGUID, params.date, eventsQuery.data, newEntry, openView, router]);

  if (!ownerGUID) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]} testID="user-calendar-signed-out">
        <Text style={{ color: c.text, fontSize: 16, marginBottom: 14, textAlign: 'center' }}>Sign in to see your calendar.</Text>
        <CalButton label="Sign in" primary onPress={() => router.push('/signin')} color={c} testID="user-calendar-signin" />
      </View>
    );
  }

  const viewProps = { occurrences, color: c, colorOf, onOpen, onNewAt, onShowDay, onToggleDone };
  const error = (eventsQuery.error || calendarsQuery.error) as Error | null;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} testID="user-calendar-screen">
      {/* ---- tool bar ---- */}
      <View style={[styles.toolbar, { borderColor: c.border, backgroundColor: c.surface }]}>
        <CalIconButton testID="user-calendar-today" icon="today" label="Today" onPress={() => setAnchor(startOfDay(new Date()))} color={c} />
        <CalIconButton testID="user-calendar-prev" icon="chevron_left" label="Previous" onPress={() => step(-1)} color={c} />
        <CalIconButton testID="user-calendar-next" icon="chevron_right" label="Next" onPress={() => step(1)} color={c} />
        <Text numberOfLines={1} testID="user-calendar-title" style={{ color: c.text, fontSize: wide ? 18 : 15, fontWeight: '600', flex: 1, marginLeft: 4 }}>{title}</Text>
        {wide ? (
          MODES.map((m) => (
            <CalChip key={m.id} testID={`user-calendar-mode-${m.id}`} label={m.title} selected={mode === m.id} onPress={() => setMode(m.id)} color={c} />
          ))
        ) : (
          <CalIconButton testID="user-calendar-mode" icon={MODES.find((m) => m.id === mode)?.icon || 'calendar_view_month'} label="Day / Week / Month / Agenda" onPress={() => setModeMenu(true)} color={c} />
        )}
        {isGoogleCalendarConfigured() ? (
          <GoogleSyncButton onSync={syncGoogle} />
        ) : (
          <CalIconButton
            testID="user-calendar-google-setup"
            icon="sync_disabled"
            label="Google Calendar sync is not set up"
            color={c}
            onPress={() => dispatch(showSnackbar({ message: 'Google Calendar sync: add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / _ANDROID_CLIENT_ID / _IOS_CLIENT_ID to .env (see kit8/register/user_calendar/README.md).', duration: 8000 }))}
          />
        )}
        <CalIconButton testID="user-calendar-add" icon="add_circle" label="New event, task or birthday" tint={c.primary} onPress={() => newEntry('event')} color={c} />
      </View>

      {/* ---- calendars ---- */}
      {calendars.length > 0 && (
        <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 6 }}>
            {calendars.map((k) => (
              <CalChip key={k.rowGUID} testID={`user-calendar-filter-${k.rowJSON.calendarCode}`} label={k.rowJSON.calendarTitle} dot={k.rowJSON.calendarColor} selected={k.rowJSON.isVisible !== false} onPress={() => toggleCalendar(k.rowGUID)} color={c} />
            ))}
          </ScrollView>
        </View>
      )}

      {error ? (
        <View style={styles.center} testID="user-calendar-error">
          <Text style={{ color: c.error, fontSize: 15, textAlign: 'center', marginBottom: 8 }}>The calendar could not be read.</Text>
          <Text selectable style={{ color: c.text, opacity: 0.75, fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
            {error.message}
            {/user_calendar|schema cache|does not exist/i.test(error.message) ? '\n\nRun kit8/sql/init/create_user_calendar_tables.sql in the Supabase SQL editor.' : ''}
          </Text>
          <CalButton label="Try again" onPress={() => (void eventsQuery.refetch(), void calendarsQuery.refetch())} color={c} testID="user-calendar-retry" />
        </View>
      ) : mode === 'month' ? (
        <UserCalendarMonthView anchor={anchor} {...viewProps} />
      ) : mode === 'agenda' ? (
        <UserCalendarAgendaView from={anchor} days={AGENDA_DAYS} {...viewProps} />
      ) : (
        <UserCalendarTimeGridView days={period.days} {...viewProps} />
      )}

      <ModalWindowListToSelect
        testID="user-calendar-mode-list"
        visible={modeMenu}
        title="View"
        items={MODES.map((m) => ({ id: m.id, title: m.title, icon: m.icon }))}
        selectedId={mode}
        onSelect={(id) => {
          setMode(id as Mode);
          setModeMenu(false);
        }}
        onClose={() => setModeMenu(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
