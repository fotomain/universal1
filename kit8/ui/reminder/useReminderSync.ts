// Keeps the OS schedule equal to the calendar of the SIGNED-IN user (phones). Mounted once by ReminderHost.
//   * runs when: sign in, the calendar rows change, the switch changes, the app comes to the foreground, every 15 minutes while open
//   * logged in only: nothing is planned without a Supabase session; SIGNED_OUT (button, expired / revoked session) and a cold start
//     without a session cancel everything the OS holds; another user signing in replaces the plan (the diff cancels the old one)

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSupabase } from '../../providers/WithSupabase';
import { useUserCalendarEventsQuery, useUserCalendarOwnerGUID } from '../calendar/data';
import { reminderOs } from './reminderOs';
import { useReminderStore } from './reminderStore';
import { syncReminders, wipeReminders } from './reminderSync';

const DEBOUNCE_MS = 400;
const RESYNC_EVERY_MS = 15 * 60 * 1000;

export function useReminderSync() {
  const { supabase } = useSupabase();
  const ownerGUID = useUserCalendarOwnerGUID();
  const events = useUserCalendarEventsQuery(ownerGUID || null);
  const enabled = useReminderStore((s) => s.enabled);
  const loaded = useReminderStore((s) => s.loaded);
  const nonce = useReminderStore((s) => s.nonce);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    void useReminderStore.getState().load();
  }, []);

  // ---- the session: logged in only ----
  useEffect(() => {
    if (!reminderOs.supportsScheduling) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setHasSession(!!data.session);
      if (!data.session) void wipeReminders(reminderOs).catch(() => {});
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setHasSession(!!session);
      if (event === 'SIGNED_OUT' || !session) void wipeReminders(reminderOs).catch(() => {});
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  // ---- more triggers: the app comes back, time passes ----
  useEffect(() => {
    if (!reminderOs.supportsScheduling) return;
    const sub = AppState.addEventListener('change', (state) => state === 'active' && setTick((t) => t + 1));
    const timer = setInterval(() => setTick((t) => t + 1), RESYNC_EVERY_MS);
    return () => {
      sub?.remove?.();
      clearInterval(timer);
    };
  }, []);

  const rows = events.data;
  const run = useCallback(() => {
    if (!rows || !ownerGUID || hasSession !== true || !loaded) return;
    // one run at a time: a later run starts after the earlier one has changed the OS
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        try {
          useReminderStore.getState().setStatus(await syncReminders(reminderOs, { rows, ownerGUID, enabled, nowMs: Date.now() }));
        } catch (e: any) {
          useReminderStore.getState().setStatus({ error: e?.message || String(e), lastSyncAt: Date.now() });
        }
      });
  }, [rows, ownerGUID, hasSession, loaded, enabled]);

  useEffect(() => {
    if (!reminderOs.supportsScheduling) return;
    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // tick = a new run without a change of the data
  }, [run, tick, nonce]);

  return { ownerGUID, hasSession };
}
