// Service worker of the calendar reminders on the web (registered by kit8/ui/reminder/reminderOs.web.ts).
// It must live at the site root to control the whole app. It shows no reminder by itself: the page asks it
// (registration.showNotification) and it handles the click. A push message (a reminder while the browser is
// closed) would need a server and is not built.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  const query = data.eventGUID ? '?eventGUID=' + encodeURIComponent(data.eventGUID) + (data.date ? '&date=' + encodeURIComponent(data.date) : '') : '';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'reminder-open', data });
          return;
        }
      }
      await self.clients.openWindow('/user/calendar' + query);
    })(),
  );
});
