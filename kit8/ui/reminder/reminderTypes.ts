// What the platform adapters (reminderOs.native.ts, reminderOs.web.ts) have to offer; the tests use a fake one.

import type { PlannedReminder, ReminderData, ScheduledReminder } from './reminderPlan';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface ReminderOs {
  /** true = the OS holds scheduled notifications (iOS, Android). The web has none: it shows the due ones while the page lives. */
  supportsScheduling: boolean;
  getPermission(): Promise<ReminderPermission>;
  /** Shows the OS prompt (the web needs a user gesture) and returns the answer. */
  requestPermission(): Promise<ReminderPermission>;
  /** Android 8+: the notification channel (importance high). No-op elsewhere. */
  ensureChannel(): Promise<void>;
  listScheduled(): Promise<ScheduledReminder[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
  /** Shows a notification now (web reminders, the test button on the web). */
  showNow(reminder: Pick<PlannedReminder, 'identifier' | 'title' | 'body' | 'data'>): Promise<void>;
  /** The OS settings of this app (notifications, Android: alarms). */
  openSettings(): Promise<void>;
  /** A tap on a notification (also the one that started the app). Returns the unsubscribe function. */
  onTap(handler: (data: ReminderData) => void): () => void;
}

export interface ReminderStatus {
  permission: ReminderPermission;
  scheduled: number;
  nextFireMs: number | null;
  lastSyncAt: number | null;
  error: string | null;
}
