// "Reminders on this device": the switch, the status (why a reminder may not come) and a test button.
// Opened from the calendar tool bar. documentation/REMINDER_WBS.html section 9.

import React from 'react';
import { Platform, Switch, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { CalButton, CalDivider, CalIconButton, CalRow, CalWindow } from '../calendar/calendarUi';
import { useUserCalendarOwnerGUID } from '../calendar/data';
import { reminderOs } from './reminderOs';
import { useReminderStore } from './reminderStore';
import { sendTestReminder } from './reminderSync';
import type { ReminderPermission } from './reminderTypes';

const whenText = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** The one line the user reads: does this device deliver reminders? */
export function reminderStatusText(enabled: boolean, permission: ReminderPermission, scheduled: number, nextFireMs: number | null): { text: string; ok: boolean } {
  if (!enabled) return { text: 'Off on this device.', ok: false };
  if (permission === 'unsupported') return { text: 'This browser cannot show notifications.', ok: false };
  if (permission === 'denied') return { text: 'Blocked: allow notifications for this app in the settings.', ok: false };
  if (permission === 'undetermined') return { text: 'Not allowed yet: press "Allow notifications".', ok: false };
  if (!reminderOs.supportsScheduling) return { text: 'On. Reminders show while the browser is open.', ok: true };
  return { text: scheduled ? `Active: ${scheduled} scheduled, next ${nextFireMs ? whenText(nextFireMs) : '-'}.` : 'Active: no reminder is waiting.', ok: true };
}

export default function ReminderSettingsWindow({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { themeColors: c } = useDesignSystem();
  const ownerGUID = useUserCalendarOwnerGUID();
  const { enabled, permission, scheduled, nextFireMs, error, setEnabled, setStatus, requestSync } = useReminderStore();
  const status = reminderStatusText(enabled, permission, scheduled, nextFireMs);

  const allow = async () => {
    setStatus({ permission: await reminderOs.requestPermission() });
    requestSync();
  };

  return (
    <CalWindow
      visible={visible}
      onClose={onClose}
      color={c}
      maxWidth={520}
      testID="reminder-settings-window"
      header={
        <>
          <CalIconButton icon="close" label="Close" onPress={onClose} color={c} testID="reminder-settings-close" />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '600', flex: 1, marginLeft: 6 }}>Reminders on this device</Text>
        </>
      }
    >
      <CalRow icon="notifications_active" color={c}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontSize: 15 }}>Remind me on this device</Text>
          <Switch testID="reminder-settings-switch" value={enabled} onValueChange={(v) => (setEnabled(v), requestSync())} />
        </View>
      </CalRow>
      <CalRow icon={status.ok ? 'check_circle' : 'info'} color={c}>
        <Text testID="reminder-settings-status" style={{ color: status.ok ? c.text : c.error, fontSize: 14 }}>{status.text}</Text>
        {!!error && <Text style={{ color: c.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
      </CalRow>
      <CalDivider color={c} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 36 }}>
        {enabled && permission === 'undetermined' && <CalButton primary label="Allow notifications" onPress={allow} color={c} testID="reminder-settings-allow" />}
        {enabled && permission === 'denied' && reminderOs.supportsScheduling && <CalButton label="Open settings" onPress={() => void reminderOs.openSettings()} color={c} testID="reminder-settings-open" />}
        {enabled && permission === 'granted' && <CalButton label="Send a test in 10 seconds" onPress={() => void sendTestReminder(reminderOs, ownerGUID)} color={c} testID="reminder-settings-test" />}
      </View>
      {Platform.OS === 'android' && (
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12.5, marginTop: 14 }}>
          For reminders on the minute, allow "Alarms & reminders" for this app{' '}
          <Text style={{ color: c.primary, fontWeight: '700' }} onPress={() => void reminderOs.openSettings()} testID="reminder-settings-alarms">(open)</Text>. On some phones (Samsung, Xiaomi, Huawei) also set the battery of this app to
          "Unrestricted" / "Never sleeping", or the phone may stop its alarms. "Force stop" cancels all reminders until you open the app again.
        </Text>
      )}
      {Platform.OS === 'ios' && (
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12.5, marginTop: 14 }}>
          Reminders are scheduled by iOS (the next 60), so they arrive with the app closed. Open the app now and then to schedule the later ones. A Focus mode can silence them.
        </Text>
      )}
      {Platform.OS === 'web' && (
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12.5, marginTop: 14 }}>
          A browser can show a reminder only while it is open (a background tab or a minimized window is fine). Use the phone app for reminders with the app closed.
        </Text>
      )}
    </CalWindow>
  );
}
