// Web: no scheduled notifications - a browser can wake a page or service worker at a time only through a push
// message from a server (not built: no server push). So the web shows the reminders that
// UserCalendarNotifier finds due while the browser is open (the page may be a background tab or minimized),
// through the service worker (public/reminder-sw.js): it works on Android Chrome too (where `new Notification`
// is refused) and a click on the notification brings the app forward and opens the entry.

import type { ReminderData } from './reminderPlan';
import type { ReminderOs, ReminderPermission } from './reminderTypes';

const SW_URL = '/reminder-sw.js';

const hasNotifications = () => typeof window !== 'undefined' && typeof Notification !== 'undefined';

const permissionOf = (p: NotificationPermission): ReminderPermission => (p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'undetermined');

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** The registered service worker, or null where the browser has none (non-secure origin, old browser). */
function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!registrationPromise) {
    registrationPromise =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
            .register(SW_URL, { scope: '/' })
            .then(() => navigator.serviceWorker.ready)
            .catch(() => null)
        : Promise.resolve(null);
  }
  return registrationPromise;
}

export const reminderOs: ReminderOs = {
  supportsScheduling: false,

  async getPermission() {
    return hasNotifications() ? permissionOf(Notification.permission) : 'unsupported';
  },

  /** Must be called from a click (browsers refuse the prompt otherwise). */
  async requestPermission() {
    if (!hasNotifications()) return 'unsupported';
    const answer = await Notification.requestPermission();
    if (answer === 'granted') void serviceWorker();
    return permissionOf(answer);
  },

  async ensureChannel() {},
  async listScheduled() {
    return [];
  },
  async schedule() {},
  async cancel() {},
  async cancelAll() {
    const reg = await serviceWorker();
    const open = reg ? await reg.getNotifications() : [];
    open.forEach((n) => n.close());
  },

  async showNow(r) {
    if (!hasNotifications() || Notification.permission !== 'granted') return;
    const options: NotificationOptions = { body: r.body, tag: r.identifier, data: r.data, icon: '/favicon.png' };
    const reg = await serviceWorker();
    if (reg) return reg.showNotification(r.title, options);
    try {
      const n = new Notification(r.title, options);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // the in-app modal window is shown anyway
    }
  },

  async openSettings() {
    // a browser has no settings link: the user changes the site permission in the address bar
  },

  onTap(handler) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
    const listener = (event: MessageEvent) => {
      if (event.data?.type === 'reminder-open' && event.data.data) handler(event.data.data as ReminderData);
    };
    navigator.serviceWorker.addEventListener('message', listener);
    return () => navigator.serviceWorker.removeEventListener('message', listener);
  },
};
