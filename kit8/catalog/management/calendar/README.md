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

## Resource calendars - the capacity (`documentation/TIME_GENUS_CONTROL_WBS.html`)
A calendar with `rowJSON.kind = 'resource'` is the **capacity** of a person, an equipment or a contract: its day rows carry `rowJSON.hours` (0..24; `isActive` is kept in step - 0 h = not active). A project
calendar has no hours and is unchanged. No new table.

| What | Where |
|---|---|
| calendar row | `kind 'resource'` · `hoursPerDay` · `weekDays` 5/6/7 or a custom `weekPattern {mon..sun}` · `workFrom`/`workTo` (for hour/minute control later) |
| day row | `hours` · `reason` fill / weekend / holiday / manual / **vacation / sickLeave / training / other** (the exceptions; a Fill keeps them unless "Overwrite my manual changes") |
| folders | Project · Resource role · Person · **Equipment · Contract** |
| seeded week modes | `standardWorkWeekCalendar` (Mon-Fri 8 h, the calendar of every resource that has none) · `sixDayWeekCalendar` · `sevenDayWeekCalendar` · `partTime4hCalendar` |
| the pointer | `rowJSON.resourceCalendar` on `personTable`, `equipmentTable`, `contractTable` (a person's), `templateResourceContractTable` (the calendar a contract made from it starts with). Screens: `ResourceCalendarField` (person, contract), the "Calendar" column (equipment, templates) |
| **priority** | the calendar of the **contract in force** (latest start wins) › the calendar of the resource › the Standard work week. No day row = not filled, never guessed (`organization_resource_capacity_info`) |
| Own calendar | copy on write: `organization_copy_calendar` copies a shared calendar (row + all days) so a vacation of ONE resource does not touch the others |

* **Fill** (`fill_management_calendar(calendar, year, mode, overwrite, hours, follow_project_holidays)`): the week modes × the hours of an active day; mode `pattern` = the custom week; **Follow project holidays**
  = the days the project calendars of the organization flag as holidays become holidays (0 h). `organization_calendar_consistency` reports where a resource calendar and the project calendars disagree.
* **The calendar lock**: a change that **lowers** the capacity of a day under the hours **posted** for a resource is refused - a day row (so a Fill, which is one statement, as a whole), the
  `resourceCalendar` pointer, a contract (calendar, dates, new, deleted). Raising is always allowed, so an over-booked day can be repaired. The screen shows a lock with the hours (`organization_calendar_lock_info`),
  the cell refuses the change with the reason, and the **"!" button** of the Fill menu explains the logic. The rule is always on, whatever the mode of the organization.
