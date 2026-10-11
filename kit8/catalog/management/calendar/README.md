# Management calendars

The working calendars of the business (the abstract entity; until a business table exists the owner of every calendar is `managementCalendarCatalog`). A day a calendar excludes gets no row and no money in a task plan
(`kit8/pm/view/task/plan`). SQL: `kit8/sql/init/create_management_calendar_tables.sql` (+ `delete_management_calendar_tables.sql`).

| Table | Rows |
|---|---|
| `managementCalendarTable` | **folders** (level 1) `projectCalendarFolder` · `resourceRoleCalendarFolder` · `personCalendarFolder` (Project / Resource role / Person) and **calendars** (level 2, `rowParentGUID` = folder), `rowJSON { title, description }`. Seed: `workingDaysCalendar` (Project folder) |
| `managementCalendarDaysTable` | one row per day: `rowGUID` `<calendar>:<YYYY-MM-DD>`, `rowOwnerGUID` = the calendar, `rowParentGUID` = the **year** (a table of one calendar and one year is a page of ≤ 366 rows), `orderInList` = days since 1970, `rowJSON { day, isActive, reason: fill|weekend|holiday|manual, note }` |

* **Exclude a day**: switch `Active` off in the days table (reason becomes `manual`; a later Fill keeps it). To mark a holiday set Reason = Holiday and switch Active off ("Working days" keeps holidays off).
* **Fill** (header menu, `CalendarFillMenu.tsx`, RPC `fill_management_calendar`): Current year ▸ / Previous year ▸ / Next year ▸ **Working days** (Mon-Fri, holidays stay off) · **5 days a week** (Mon-Fri) ·
  **6 days a week** (Mon-Sat) · **All days**. "Overwrite my manual changes" also rewrites the manual days. The default calendar is filled for last, this and next year when the SQL is run.
* `project.calendarForTaskPlan` (Project settings → Finances → Task plan) = the calendar whose excluded days divide the timeline of a task plan; default `workingDaysCalendar`.
* A day with **no row** (a year nobody filled) is never guessed: Post stops with "calendar is not filled for 2027".
* Role / person calendars are stored in their folders; the task plan uses the project's calendar only.

Screen: drawer **Catalogs → Management calendars**, route `/catalog/management/calendar/list` → `ManagementCalendarCRUD.tsx` (folders tree + calendars table, then the days of the picked calendar and year).
Pure rules: `managementCalendarModel.ts` (`resolveCalendarDays`, `activeSegments`, `daysBetween`…); `managementCalendarApi.ts` (Fill, `fetchCalendarDays`).
Tests: `__tests__/catalog/management/managementCalendar.test.ts`, `calendarFillMenu.test.tsx`.
