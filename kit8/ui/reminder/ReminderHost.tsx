// Mounted once in the root layout (app/_layout.tsx), next to UserCalendarNotifier. Keeps the OS schedule up to date
// (useReminderSync) and opens the entry when the user taps an OS notification (also the one that started the app).

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useReminderSync } from './useReminderSync';
import { reminderOs } from './reminderOs';
import { markRemindersShown } from './reminderShown';
import type { ReminderData } from './reminderPlan';

export default function ReminderHost() {
  const router = useRouter();
  const { ownerGUID } = useReminderSync();
  const owner = useRef(ownerGUID);
  owner.current = ownerGUID;
  /** a tap that arrived before the session was known (a cold start) waits here */
  const waiting = useRef<ReminderData | null>(null);

  const open = (d: ReminderData) => {
    void markRemindersShown(d.ownerGUID, [d.key]);
    router.push({ pathname: '/user/calendar', params: d.eventGUID ? { eventGUID: d.eventGUID, date: d.date } : {} } as any);
  };

  useEffect(
    () =>
      reminderOs.onTap((d) => {
        // a notification of another user is never opened
        if (owner.current && d.ownerGUID === owner.current) open(d);
        else if (!owner.current) waiting.current = d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const d = waiting.current;
    if (!d || !ownerGUID) return;
    waiting.current = null;
    if (d.ownerGUID === ownerGUID) open(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerGUID]);

  return null;
}
