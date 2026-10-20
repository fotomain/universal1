// iOS + Android: the OS holds the reminders (local scheduled notifications), so they fire with the app closed,
// the phone locked, in Doze and offline. Android: exact alarm when the app may (expo-notifications uses
// setExactAndAllowWhileIdle when AlarmManager.canScheduleExactAlarms(), else an inexact alarm) and re-creates the
// alarms after a reboot (its boot receiver).

import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PlannedReminder, ReminderData, ScheduledReminder } from './reminderPlan';
import type { ReminderOs, ReminderPermission } from './reminderTypes';

export const REMINDER_CHANNEL_ID = 'calendar-reminders';

const permissionOf = (p: Notifications.NotificationPermissionsStatus): ReminderPermission =>
  p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ? 'granted' : p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';

const dataOf = (value: unknown): ReminderData | null => {
  const d = value as Partial<ReminderData> | null | undefined;
  return d && typeof d.ownerGUID === 'string' && typeof d.eventGUID === 'string' && typeof d.key === 'string' ? (d as ReminderData) : null;
};

// While the app is open the in-app modal (UserCalendarNotifier) shows the reminder: the OS banner stays silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

export const reminderOs: ReminderOs = {
  supportsScheduling: true,

  async getPermission() {
    return permissionOf(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    return permissionOf(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  },

  async ensureChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Calendar reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  },

  async listScheduled(): Promise<ScheduledReminder[]> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.map((n) => ({ identifier: n.identifier, sig: (n.content.data as { sig?: string } | null)?.sig }));
  },

  async schedule(r: PlannedReminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.identifier,
      content: { title: r.title, body: r.body, data: { ...r.data }, sound: 'default', interruptionLevel: 'active' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.fireMs), channelId: REMINDER_CHANNEL_ID },
    });
  },

  async cancel(identifier: string) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  },

  async showNow(r) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.identifier,
      content: { title: r.title, body: r.body, data: { ...r.data }, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: REMINDER_CHANNEL_ID },
    });
  },

  async openSettings() {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
      try {
        // "Alarms & reminders" (the exact alarm switch of this app)
        await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
        return;
      } catch {
        // fall through to the app settings
      }
    }
    await Linking.openSettings();
  },

  onTap(handler) {
    const first = Notifications.getLastNotificationResponse();
    const firstData = dataOf(first?.notification.request.content.data);
    if (firstData) {
      Notifications.clearLastNotificationResponse();
      handler(firstData);
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const d = dataOf(response.notification.request.content.data);
      if (d) handler(d);
    });
    return () => sub.remove();
  },
};
