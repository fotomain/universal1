# User calendar

Route `/user/calendar` (app bar button before the three dots menu, drawer item "Calendar").

| Where | What |
| --- | --- |
| `kit8/sql/init/create_user_calendar_tables.sql` | tables `user_calendar_table`, `user_calendar_event_table`, `user_calendar_invitation_table`, owner RLS, realtime, project task triggers |
| `kit8/register/user_calendar` | model, Supabase CRUD, React Query + realtime, recurrence, reminders, Google sync, e-mail invitations |
| `kit8/catalog/user/calendar` | screen (Day / Week / Month / Agenda), editor, quick view, custom recurrence, `UserCalendarNotifier` |

## Setup

1. Run `kit8/sql/init/create_user_calendar_tables.sql` in the Supabase SQL editor (after `done/create_tables.sql`; safe to run twice).
2. `.env`: `EXPO_PUBLIC_RESEND_API_KEY` (invitations), `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` (Google sync). Restart `expo start` after changing `.env`.

## Rules

- Every row: `rowOwnerGUID = userState.userGUID` (SQL `app_user_guid()`).
- Project tasks: a database trigger copies every task / milestone of `project_task_table` into the calendar
  (`rowJSON.kind = 'projectTask'`) on insert, update and delete. Name and dates follow the project; reminders,
  guests and the color added in the calendar are kept.
- Reminders: `UserCalendarNotifier` (root layout) checks every 30 seconds and opens the entry as a modal window
  (web + mobile); on web also a browser notification when the user allowed it. The app must be open.
- Invitations: one e-mail per guest through Resend with an `invite.ics` attachment; each send is logged in
  `user_calendar_invitation_table`. Resend does not accept calls from a browser page: on web set
  `EXPO_PUBLIC_RESEND_PROXY_URL`.
- Google sync: "Connect Google Calendar" in the calendar tool bar, then the same button synchronises both ways
  with the primary Google calendar (3 months back, 12 months ahead). The token lasts about an hour.
  Project task copies are not pushed to Google unless `includeProjectTasks` is passed to `syncUserCalendarWithGoogle`.
