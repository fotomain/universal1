// One synchronisation of the OS with the calendar: plan -> diff -> cancel / schedule. Idempotent (run it as often as needed),
// no React, the platform adapter is a parameter (tests use a fake one). Logged in only: see wipeReminders and useReminderSync.

import { UserCalendarEventRow } from '../calendar/data/userCalendarModel';
import { diffPlan, isManagedReminder, planReminders, PlannedReminder } from './reminderPlan';
import type { ReminderOs, ReminderStatus } from './reminderTypes';

export interface ReminderSyncInput {
  rows: UserCalendarEventRow[];
  /** the signed-in user ('' = nobody: nothing is planned) */
  ownerGUID: string;
  /** the user's switch "Reminders on this device" */
  enabled: boolean;
  nowMs: number;
}

/**
 * Makes the OS hold exactly the next reminders of `ownerGUID`. Switch off = everything cancelled. The OS prompt is shown
 * (once: the OS remembers the answer) the first time the user has a reminder to deliver.
 */
export async function syncReminders(os: ReminderOs, input: ReminderSyncInput): Promise<ReminderStatus> {
  const done = (s: Partial<ReminderStatus>): ReminderStatus => ({ permission: 'undetermined', scheduled: 0, nextFireMs: null, lastSyncAt: input.nowMs, error: null, ...s });
  if (!os.supportsScheduling) return done({ permission: await os.getPermission() });
  if (!input.enabled) {
    await os.cancelAll();
    return done({ permission: await os.getPermission() });
  }
  const plan = planReminders(input.rows, input.ownerGUID, input.nowMs);
  let permission = await os.getPermission();
  if (permission === 'undetermined' && plan.length) permission = await os.requestPermission();
  if (permission !== 'granted') return done({ permission });
  await os.ensureChannel();
  const { cancel, schedule } = diffPlan(plan, (await os.listScheduled()).filter((p) => isManagedReminder(p.identifier)));
  for (const id of cancel) await os.cancel(id);
  for (const r of schedule) await os.schedule(r);
  return done({ permission, scheduled: plan.length, nextFireMs: plan[0]?.fireMs ?? null });
}

/** Sign out / session lost: nothing of this user may stay on the phone. */
export async function wipeReminders(os: ReminderOs): Promise<void> {
  if (os.supportsScheduling) await os.cancelAll();
}

/** "Send a test": a notification after `delaySeconds` (the OS holds it, so the app can be closed meanwhile). */
export async function sendTestReminder(os: ReminderOs, ownerGUID: string, nowMs = Date.now(), delaySeconds = 10): Promise<void> {
  const fireMs = nowMs + delaySeconds * 1000;
  const test: PlannedReminder = {
    identifier: 'reminder-test',
    key: 'test',
    fireMs,
    title: 'Calendar reminder',
    body: 'This is a test: reminders reach you on this device.',
    data: { ownerGUID, key: 'test', eventGUID: '', date: '', sig: String(fireMs) },
  };
  if (os.supportsScheduling) await os.schedule(test);
  else setTimeout(() => void os.showNow(test), delaySeconds * 1000);
}
