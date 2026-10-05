// Mounted once in the root layout (app/_layout.tsx). It
//   * keeps the user's calendar rows fresh (one shared read + realtime),
//   * fires the reminders ("auto notifications"): when a reminder time passes, the entry opens as
//     a modal window - web and mobile - and, on web, also as a browser notification when allowed,
//   * hosts the two calendar windows (quick view, editor) so any screen can open them
//     (useUserCalendarUiStore: the calendar, a reminder, a share intent).
// A reminder is shown once per device (AsyncStorage); reminders missed while the app was closed
// are shown at the next start if they are not older than 12 hours.

import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dueReminders,
  eventWhenText,
  UserCalendarDueReminder,
  UserCalendarEventRow,
  useUserCalendarEventsQuery,
  useUserCalendarOwnerGUID,
  useUserCalendarRealtime,
  useUserCalendarsQuery,
} from '../../../register/user_calendar';
import UserCalendarEventEditor from './UserCalendarEventEditor';
import UserCalendarEventView from './UserCalendarEventView';
import { useUserCalendarUiStore } from './userCalendarUiStore';

const CHECK_EVERY_MS = 30 * 1000;
const MISSED_WINDOW_MS = 12 * 60 * 60 * 1000;
const LAST_CHECK_KEY = 'userCalendar.lastReminderCheck';
const SHOWN_KEY = 'userCalendar.shownReminders';

function webNotification(r: UserCalendarDueReminder) {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const row = r.occurrence.row;
    const n = new Notification(row.rowJSON.title || 'Calendar', { body: `${eventWhenText(row, r.occurrence.startMs, r.occurrence.endMs)}\n${r.label}`, tag: r.key });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // some browsers only allow notifications from a service worker: the modal window is shown anyway
  }
}

export default function UserCalendarNotifier() {
  const ownerGUID = useUserCalendarOwnerGUID();
  useUserCalendarsQuery(ownerGUID || null);
  const events = useUserCalendarEventsQuery(ownerGUID || null);
  useUserCalendarRealtime(ownerGUID || null);

  const rowsRef = useRef<UserCalendarEventRow[]>([]);
  rowsRef.current = events.data || [];
  const loaded = events.isSuccess;
  const queue = useRef<UserCalendarDueReminder[]>([]);
  const viewOpen = useUserCalendarUiStore((s) => !!s.view);
  const editorOpen = useUserCalendarUiStore((s) => !!s.editor);

  /** Shows the next waiting reminder when no calendar window is open. */
  const showNext = () => {
    const ui = useUserCalendarUiStore.getState();
    if (ui.view || ui.editor) return;
    const next = queue.current.shift();
    if (!next) return;
    // the row may have changed since the reminder was queued
    const row = rowsRef.current.find((r) => r.rowGUID === next.occurrence.row.rowGUID);
    if (!row) return showNext();
    ui.openView({ occurrence: { ...next.occurrence, row }, reminder: next });
  };

  useEffect(() => {
    if (!viewOpen && !editorOpen) showNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOpen, editorOpen]);

  useEffect(() => {
    if (!ownerGUID || !loaded) return;
    let stopped = false;
    let running = false;
    const check = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const now = Date.now();
        const [lastText, shownText] = await Promise.all([AsyncStorage.getItem(LAST_CHECK_KEY), AsyncStorage.getItem(SHOWN_KEY)]);
        const last = Math.max(Number(lastText) || 0, now - MISSED_WINDOW_MS);
        let shown: Record<string, number> = {};
        try {
          shown = JSON.parse(shownText || '{}') || {};
        } catch {
          shown = {};
        }
        const due = dueReminders(rowsRef.current, last, now).filter((r) => !shown[`${ownerGUID}:${r.key}`]);
        if (stopped) return;
        if (due.length) {
          due.forEach((r) => {
            shown[`${ownerGUID}:${r.key}`] = now;
            webNotification(r);
          });
          // forget keys older than a week
          Object.keys(shown).forEach((k) => now - shown[k] > 7 * 24 * 3600 * 1000 && delete shown[k]);
          await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
          queue.current.push(...due);
          showNext();
        }
        await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));
      } catch (e: any) {
        console.log('Calendar reminder check failed:', e?.message || e);
      } finally {
        running = false;
      }
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    // timers pause while a phone app is in the background: check again when it comes back
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerGUID, loaded]);

  if (!ownerGUID) return null;
  return (
    <>
      <UserCalendarEventView />
      <UserCalendarEventEditor />
    </>
  );
}
