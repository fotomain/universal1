// File-level guards of the reminder feature (the wiring that no render test covers).

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('reminder wiring', () => {
  it('the calendar lives in kit8/ui/calendar, the old folders are gone', () => {
    expect(fs.existsSync(path.join(root, 'kit8/ui/calendar/UserCalendarScreen.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'kit8/ui/calendar/data/userCalendarModel.ts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'kit8/catalog/user/calendar'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'kit8/register/user_calendar'))).toBe(false);
  });

  it('the root layout mounts ReminderHost next to UserCalendarNotifier', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toContain("kit8/ui/reminder/ReminderHost");
    expect(layout).toContain('<ReminderHost />');
  });

  it('app.config.js declares the exact alarm permission and keeps POST_NOTIFICATIONS', () => {
    const cfg = read('app.config.js');
    expect(cfg).toContain('android.permission.SCHEDULE_EXACT_ALARM');
    expect(cfg).toContain('android.permission.POST_NOTIFICATIONS');
  });

  it('expo-notifications is installed for SDK 57', () => {
    expect(JSON.parse(read('package.json')).dependencies['expo-notifications']).toMatch(/57/);
  });

  it('the web service worker is served from the site root and handles the click', () => {
    const sw = read('public/reminder-sw.js');
    expect(sw).toContain("'notificationclick'");
    expect(sw).toContain('/user/calendar');
    expect(read('kit8/ui/reminder/reminderOs.web.ts')).toContain("'/reminder-sw.js'");
  });

  it('the calendar toolbar opens the reminder window', () => {
    expect(read('kit8/ui/calendar/UserCalendarScreen.tsx')).toContain('ReminderSettingsWindow');
  });
});
