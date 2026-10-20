// Small questions the calendar screens ask, answered with the real platform adapter.

import { reminderOs } from './reminderOs';
import { useReminderStore } from './reminderStore';
import { PlannedReminder } from './reminderPlan';

/**
 * true = the OS shows this device's reminders itself (phone, switch on, permission given). UserCalendarNotifier then does not
 * open the modal for a reminder that is already past (the OS notification is in the notification list), only for a fresh one.
 */
export async function reminderOsDelivers(): Promise<boolean> {
  if (!reminderOs.supportsScheduling || !useReminderStore.getState().enabled) return false;
  return (await reminderOs.getPermission()) === 'granted';
}

/** Web: shows a due reminder through the service worker (the phone's OS has it scheduled already). */
export async function showReminderNow(r: Pick<PlannedReminder, 'identifier' | 'title' | 'body' | 'data'>): Promise<void> {
  if (reminderOs.supportsScheduling) return;
  await reminderOs.showNow(r);
}
