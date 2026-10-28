# Resource optimization – leveling and smoothing (`kit8/pm/resourceleveling`)

Design: `documentation/RESOURCE_LEVELING_WBS.html` (+ `_RU.html`). The PMBOK umbrella term is **Resource optimization**; its methods are **leveling** (dates may move beyond the slack) and **smoothing** (only the slack is used). Every MS Project word still works (Level now, Leveling Delay, "Level only within available slack" = smoothing). Project settings → tab **Resources** → section **Resource optimization**.

**Everything is OFF while `resourceLevelingFunctionalityEnabled` was never saved**: the scheduler, the Gantt chart, Post and the busy check work exactly as before (golden test `schedulingLeveling.test.ts`).

## What is built (Phase 1, Manual mode)
| Part | File |
|---|---|
| Settings (keys, defaults, effective values, Smoothing = `resourceLevelingWithinSlackOnly`) | `resourceLevelingSettings.ts`, `PMResourceLevelingSettingsTab.tsx` (tab "Resources"; also Organization edit → Projects → Settings) |
| Model, codes | `resourceLevelingModel.ts` |
| Demand of a resource per day (the hours of the Time lines spread as Post does), frozen rules | `resourceLevelingDemand.ts` |
| Over-allocation detector (twin of `organization_resource_busy_check`; period `day` or `week`) | `resourceLevelingDetect.ts` |
| **Engine** (pure; orders, leveling and smoothing, forward and backward, reason codes) | `resourceLevelingEngine.ts`, `resourceLevelingPlace.ts` |
| The environment of a real project (scheduler + calendars + capacity) and one run → the plan to preview | `resourceLevelingEnv.ts`, `resourceLevelingRun.ts` |
| Database calls | `resourceLevelingApi.ts` (SQL PART 42: `project_resource_leveling_inputs / _apply / _clear / _undo`) |
| Commands (Level now, Apply, Clear, Undo) | `useResourceLeveling.ts`, `resourceLevelingUiStore.ts` |
| Windows | `PMResourceLevelingBarButton` (the **Level** button of the Gantt bar), `…PreviewWindow`, `…PostedTasksDialog`, `…ConflictsList`, `…RunHistory` |
| Texts | `resourceLevelingText.ts` (+ `kit8/pm/i18n`: 14 languages) |

The result is the **leveling delay** of a task: `project_task_table.rowJSON.taskLevelingDelayDays` (whole working days of the task calendar, away from the anchor: later when planned from the start, EARLIER when planned from the finish – Q5). `scheduleProject` reads it like a lag (`levelingEnabled`, `levelingDelays`); `PMScheduledRow.levelingDelayDays` carries it out. The dates are written by the usual schedule write-back.

## Rules worth knowing
- **A posted task never loses its posting silently.** A date that moves unposts the lines and payments (existing triggers), so a run that needs to move posted tasks asks first (`PMResourceLevelingPostedTasksDialog`): *Unpost and move* · *Move and post again* (the app posts the task again with the normal Post; only for tasks that post without conflicts) · *Keep their dates* (the same run with those tasks frozen, `planWithoutPosted`). Settings: `resourceLevelingPostedTasksMovementEnabled` (true) and `resourceLevelingPostedTasksAction` (`ask`). Tasks that have started / finished or have a posted fact input are never moved.
- Capacity comes ONLY from SQL (`organization_resource_capacity`); a day with no calendar row is "unknown" and is reported (`capacityUnknown`), never guessed. Equal is not over-allocated.
- The engine never changes hours, units, resources or durations. It only delays.
- Deterministic and idempotent (tests with generated plans). Smoothing: a batch pass that moves the project finish (start, when planned from the finish) is rolled back and redone one move at a time; a move that still does is refused (`slackLimit`).
- Dates and delays in the hook: `ensureCalculated()` first (Calculation Manual, A2).
- `taskLevelingDelayDays` is stripped by `task_template_clean_task`; the check trigger `trg_project_task_leveling_chk` refuses a negative / fractional delay and any delay on a stage, a milestone or a subproject task.

## Not built yet (see the status in the design document, section 19)
Automatic mode · Fast mode (in-place editing, quick-fix menu) · the delay column, the delay bar on the chart, the over-allocation mark in the tree, the Load graph / Usage grid, the Level Resources options window, the status chip · splits by leveling · `resourceGrainUnit` = hour behaves as day (the plan has no time of day) · the hour-by-hour model `resourceOptimizationMode = hourByHourModel` (phase 2: calendar work windows, task start time, hour Post – SQL PART 43).

## Tests
`__tests__/pm/resourceleveling/*` (engine + properties, scheduler, settings, demand, run, windows, hook, translations), `__tests__/sql/startSqlSplit.test.ts`, Docker `kit8/docker/tests/31_resource_leveling.sql` (`./test_time_genus.sh 31`) and `./test_sql.sh`.
