# Reminder (calendar reminders with the app closed)

Plan and the WHY: `documentation/REMINDER_WBS.html` (Phase 1 built 2026-10-20; Phase 2, the server push, is NOT built - decision of the owner).
The calendar itself (entries, `notifications[]`, the in-app modal) is in `kit8/ui/calendar`.

| File | What |
| --- | --- |
| `reminderPlan.ts` | PURE: `planReminders(rows, owner, now)` = the next 60 reminders (same times as the in-app modal), `diffPlan(plan, pending)` = cancel / schedule lists |
| `reminderSync.ts` | `syncReminders(os, ...)` (plan -> diff -> OS; idempotent), `wipeReminders` (sign out), `sendTestReminder` |
| `reminderOs.native.ts` | iOS + Android adapter over `expo-notifications`: local scheduled notifications (the OS fires them with the app closed) |
| `reminderOs.web.ts` | web adapter: permission + `registration.showNotification` through the service worker `public/reminder-sw.js` (no scheduling) |
| `reminderTypes.ts` | the adapter interface + the status |
| `useReminderSync.ts` | the hook: runs the sync at sign in, row change, switch, app foreground, every 15 min; wipes at SIGNED_OUT / no session |
| `ReminderHost.tsx` | mounted in `app/_layout.tsx`: the hook + a tap on an OS notification opens `/user/calendar?eventGUID&date` |
| `ReminderSettingsWindow.tsx` | calendar tool bar bell: switch, status, "Allow notifications", test in 10 s, Android alarm settings |
| `reminderShown.ts`, `reminderStore.ts`, `reminderRuntime.ts` | shared "shown once" keys with the in-app modal, switch + status (zustand), small queries of the Notifier |

## Rules
- Logged in only: nothing is planned without a Supabase session; SIGNED_OUT (also an expired / revoked session) and a cold start without a session cancel everything the OS holds; another user signing in replaces the plan (the diff cancels the old identifiers `reminder:<owner>:<key>`).
- The OS holds at most 60 reminders (iOS keeps 64 pending); the list is topped up whenever the app is open. A phone that is not opened for weeks runs out of reminders (only a server push would close that: not built).
- While the app is open the in-app modal (`UserCalendarNotifier`) shows the reminder and the OS banner is silent (foreground handler). A reminder that is already past and was delivered by the OS is marked shown, no modal.
- Android: exact alarm only when the user allows "Alarms & reminders" (`SCHEDULE_EXACT_ALARM` in `app.config.js`); otherwise Android may delay by minutes. Alarms are re-created after a reboot by the library's boot receiver. "Force stop" and some phone makers' battery managers cancel alarms: the settings window says so.
- Web: a browser cannot wake a page at a time without a push server, so a web reminder is shown only while the browser is open (a background tab is fine). The click opens the entry.
- The `expo-notifications` config plugin is NOT in `app.config.js` on purpose: it always adds the iOS `aps-environment` (push) entitlement, which local notifications do not need and a free Apple team refuses. Add `'expo-notifications'` (icon, colour) only when push is built. Android then shows the app icon as the small icon.

## Build
`expo-notifications` and the new Android permission are native: after pulling this, make a new dev build (`npx expo run:ios` / `npx expo run:android`); Expo Go and the old dev client do not have the module. Web needs only a reload.

## Tests
`__tests__/ui/reminder` (planner, diff, sync with a fake OS, the sign in / out hook, wiring guards). On devices (not automatable): app swiped away, screen off, Doze (`adb shell dumpsys deviceidle force-idle`), reboot, airplane mode, force stop (documented as lost), iPhone locked / Focus / force-quit, 70 reminders, time zone change, sign out then wait = nothing shows.
