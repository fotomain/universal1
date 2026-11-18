# The time-of-day model (`kit8/pm/hourmodel`)

Design: `documentation/RESOURCE_LEVELING_HOURS_WBS.html` (phase 2 of `RESOURCE_LEVELING_WBS.html`). Project setting **Resources → Planning model → Hour by hour** (`resourceOptimizationMode = hourByHourModel`).
The model plans, posts, checks and levels **to the minute**: every time value is a whole number of minutes. With `dayByDayModel` (the default, every existing project) nothing here is read or written.

## The idea: a virtual working-minute axis
`hourAxis.ts` numbers the WORKING minutes of the project calendar (days worked × the daily windows, e.g. 09:00-13:00 + 14:00-18:00), every break and day off removed. On that axis **one virtual
day is one working minute and every virtual day is worked**, so the existing code runs on it unchanged:

| Piece | File | What it does |
|---|---|---|
| minutes, clock text, the step | `minutes.ts` | `parseMinutes('1h30m' / '90m' / '2d' / '45s')`, `formatMinutes`, `parseClock`, `resourceSlotMinutes` (1 · 5 · 10 · 15 · 30 · 60, default 15) |
| settings | `hourModelSettings.ts` | `hourModelOf(projectJSON)`: `active`, `windows` (`projectWorkWindows`), `slotMinutes`, `timeZone` (`projectTimeZone`); `hourModelSwitchPatch` |
| the axis | `hourAxis.ts`, `hourAxisOfProject.ts` | `workMinuteAt(instant)`, `startInstant(wm)`, `endInstant(wm)`, `pieces(a, b)` (a break splits a bar); cached per project |
| the scheduler | `scheduleHours.ts` | `scheduleProjectHours` = `scheduleProject` on the virtual axis (links, lags, stages, float, cycles are the SAME code), mapped back to instants; `taskStartMinute` = "not before" pin (a few passes); delays in minutes |
| leveling | `hourLevelingEnv.ts` | a `LevelingEnv` on the axis of STEPS (one virtual day = one step): the engine, detector and demand of Resource optimization are reused; capacity = the windows of the resource, foreign = the posted slices of the other projects |
| server side | `hourServerProblem.ts` | the problem `v = 2` for `project_resource_leveling_server_plan` (dates = 2000-01-01 + step, capacity and foreign load as runs of steps) |
| Post | `hourPostPlan.ts` | the SLICES `{d, f, t, c}` of a Time line over the pieces of the bar (distribution over the working minutes); the day rows are made from the slices |

Task keys (`project_task_table.rowJSON`): `taskStartMinute` (0..1439) · `taskDurationMinutes` (>= 1) · `taskLevelingDelayMinutes` (>= 0, a multiple of the step). `durationDays` is still written
(days touched, rounded up) so every reader that knows only days keeps a valid value.

## Where it is wired
- `store/storeDerive.ts` picks `scheduleProjectHours` for a project in the model (`calcSignature.ts` knows the new keys and the windows).
- `resourceleveling/useResourceLeveling.ts` gathers `project_resource_leveling_inputs_hours`, `resourceLevelingRun.ts` (`PlanLevelingArgs.hour`) runs the engine on the step axis and presents real instants; `resourceLevelingBackend.ts` sends the `v = 2` problem when **Server side computations** is chosen (the same radio as the day model; no new setting).
- `view/task/plan/runTaskPost.ts` (+ `useTaskPost`, `useProjectPostActions`) sends the slices and the project time zone.
- Tree duration cell (`EditTaskDuration`, "1h 30m"), task window (start hour / minute of the window = `taskStartMinute`), Fill window of a resource calendar ("Working windows").
- SQL PART 53 (`kit8/sql/start`), Docker tests `101_time_of_day.sql`, `102_time_of_day_post.sql`.

## Rules worth knowing
- **Working minutes, not wall clock**: a typed `12h` is 12 WORKING hours (1.5 days of an 8 h calendar). Seconds do not exist (`45s` is rounded up to 1 minute).
- A task's calendar = the project calendar (`PMCalendar`) x `projectWorkWindows` (the same windows every working day); the capacity of a RESOURCE = its calendar's windows (day row `windows`, else the calendar's `workWindows` pattern when it adds up to the hours, else one window from `workFrom`).
- Leveling works on the **step grid** (`resourceSlotMinutes`); the busy check of Post is exact to the minute. Use step 1 when the two must agree to the minute.
- Not in this model (the code says so, nothing is guessed): planning from the finish date, constraints other than Start No Earlier Than, split / elapsed / task calendars / external predecessors, Fast mode of Resource optimization needs the client side as before.
- `projectTimeZone` is used only where a real timestamp is written (Post, `task_line_plan_hour_movements.periodStart`); the dates of the app are floating wall-clock values.

## Not built yet
The Gantt **hour / minute zoom** (a bar is drawn by its instants on the day scale), a per-day windows editor (only the calendar pattern in the Fill window), the lock of a calendar change against posted slices, the hour axis of the Load graph / Usage grid (the day versions of Resource optimization do not exist yet), A12 splits and A13 recurring tasks in this model, Fact input / Time sheet by the clock.

## Tests
`__tests__/pm/hourmodel/*` (minutes, axis, scheduler incl. a golden test against the day scheduler, settings, leveling, server problem, Post slices), `__tests__/sql/timeOfDaySql.test.ts`, Docker `./test_time_genus.sh 101` and `102`.
